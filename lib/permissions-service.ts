/**
 * Permissions service — single entry point for "who is this user and what
 * can they see/do".
 *
 * Lookup order:
 *   1. Postgres (`users` + `user_dashboard_access`).
 *   2. If not found AND PERMISSIONS_FALLBACK_TO_ENV !== "false" → legacy
 *      env var-based logic (lib/permissions.ts + ALLOWED_DOMAIN/EMAILS).
 *   3. Otherwise → null (no access). A DB error also denies (fails closed).
 *
 * Env-var fallback never grants `superadmin` role; admin UI requires an
 * explicit DB row with role='superadmin'. This keeps the migration safe:
 * existing users keep dashboard access, but no one gets admin powers
 * without being seeded explicitly.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  dashboards,
  userDashboardAccess,
  users,
  type Country,
  type Role,
} from "@/db/schema";
import { ensureDashboardsCatalog } from "@/lib/ensureDashboardsCatalog";
import { withNeonRetry } from "@/lib/neon-retry";
import {
  getUserPermissions as getLegacyPermissions,
  type DashboardPermissions,
} from "@/lib/permissions";

export type { Country, Role };

export type UserIdentity = {
  /** uuid when sourced from DB; null for env-var fallback */
  id: string | null;
  email: string;
  role: Role;
  country: Country | null;
  permissions: DashboardPermissions;
  source: "db" | "env";
};

/**
 * Which dashboards the user can open. The country does not travel here: the
 * queries read `session.user.country` and filter by the event's country
 * (lib/scopes.ts). Until 2026-11-04 this also built a ticketera `dataScopes`
 * (PE → TeleTicket) that no query read.
 */
function buildPermissions(role: Role, pathPrefixes: string[]): DashboardPermissions {
  if (role === "superadmin") return "all";
  return pathPrefixes;
}

async function lookupFromDb(email: string): Promise<UserIdentity | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      country: users.country,
      pathPrefix: dashboards.pathPrefix,
    })
    .from(users)
    .leftJoin(userDashboardAccess, eq(users.id, userDashboardAccess.userId))
    .leftJoin(
      dashboards,
      eq(userDashboardAccess.dashboardKey, dashboards.key),
    )
    .where(and(eq(users.email, email), isNull(users.revokedAt)));

  if (rows.length === 0) return null;

  const head = rows[0];
  const pathPrefixes = rows
    .map((r) => r.pathPrefix)
    .filter((p): p is string => !!p);

  return {
    id: head.id,
    email: head.email,
    role: head.role,
    country: head.country,
    permissions: buildPermissions(head.role, pathPrefixes),
    source: "db",
  };
}

function lookupFromEnv(email: string): UserIdentity | null {
  if (!email) return null;
  const allowedDomain = process.env.ALLOWED_DOMAIN ?? "";
  const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const domainOk =
    !!allowedDomain && email.endsWith(`@${allowedDomain}`);
  const emailOk = allowedEmails.includes(email);
  if (!domainOk && !emailOk) return null;

  const legacy = getLegacyPermissions(email);
  // Empty array = email not in DASHBOARD_PERMISSIONS at all → still let them
  // in (matches old signIn behavior) but with no dashboards.
  return {
    id: null,
    email,
    role: "user",
    country: null,
    permissions: legacy,
    source: "env",
  };
}

/**
 * Crea la fila en `users` para un usuario que entró por env-fallback y le
 * copia los permisos del env a `user_dashboard_access`. Idempotente:
 *
 *  - Si la fila ya existe (incluyendo revocados), no hace nada en `users`.
 *  - Si recién la creó, traduce los path prefixes del env a `dashboard_key`
 *    via la tabla `dashboards` (sincronizada por `ensureDashboardsCatalog`).
 *  - Si el env dice `"all"`, otorga TODOS los dashboards del catálogo
 *    actual. No promueve a superadmin: esa decisión queda manual via
 *    `/admin/users`.
 *
 * Devuelve la identity desde la DB tras la migración. Si la fila ya
 * estaba pero está revocada, devuelve null (revocación gana).
 */
async function autoMigrateEnvUserToDb(
  email: string,
  envIdentity: UserIdentity,
): Promise<UserIdentity | null> {
  // El log de accesos tiene FK a `dashboards`; nos aseguramos de que la
  // tabla esté sincronizada antes de insertar grants.
  await ensureDashboardsCatalog();

  const inserted = await db
    .insert(users)
    .values({
      email,
      role: "user",
      country: null,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  // Si recién insertamos, seedeamos los grants desde el env.
  if (inserted.length > 0) {
    const newUserId = inserted[0].id;
    const catalog = await db
      .select({ key: dashboards.key, pathPrefix: dashboards.pathPrefix })
      .from(dashboards);

    let prefixesToGrant: string[] = [];
    const perms = envIdentity.permissions;
    if (perms === "all") {
      prefixesToGrant = catalog.map((d) => d.pathPrefix);
    } else if (Array.isArray(perms)) {
      prefixesToGrant = perms;
    } else if (perms && typeof perms === "object") {
      const dashPerms = perms.dashboards;
      prefixesToGrant =
        dashPerms === "all"
          ? catalog.map((d) => d.pathPrefix)
          : dashPerms;
    }

    const grants = catalog
      .filter((d) => prefixesToGrant.includes(d.pathPrefix))
      .map((d) => ({
        userId: newUserId,
        dashboardKey: d.key,
        grantedBy: null,
      }));

    if (grants.length > 0) {
      await db
        .insert(userDashboardAccess)
        .values(grants)
        .onConflictDoNothing();
    }

    console.log(
      `[permissions-service] auto-creado en DB: ${email} con ${grants.length} dashboards`,
    );
  }

  // Re-lookup desde DB. Si está revocado, devuelve null (lo cual bloquea
  // el signin más arriba en NextAuth).
  return lookupFromDb(email);
}

/**
 * Resolve a user's identity from the most authoritative source available.
 * Returns null if the user is unknown / revoked / outside the env whitelist.
 *
 * Si el usuario solo existe en env vars, lo crea automáticamente en DB
 * (con sus permisos copiados) la primera vez. A partir de ahí queda
 * trackeado en `dashboard_access_log` por tener `userId` real.
 */
export async function getUserIdentity(
  email: string,
): Promise<UserIdentity | null> {
  if (!email) return null;

  try {
    const dbIdentity = await withNeonRetry(() => lookupFromDb(email));
    if (dbIdentity) return dbIdentity;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && (err as NodeJS.ErrnoException).cause
        ? (err as NodeJS.ErrnoException).cause
        : null;
    console.error(
      `[permissions-service] DB lookup failed for ${email}: ${msg}`,
      cause ? `\n  cause: ${cause}` : "",
    );
    // Falla cerrado: sin la base no sabemos si está revocado ni su país. El
    // fallback a env solo aplica cuando la base respondió "no existe".
    return null;
  }

  if (process.env.PERMISSIONS_FALLBACK_TO_ENV === "false") return null;

  const envIdentity = lookupFromEnv(email);
  if (!envIdentity) return null;

  // Auto-migra a DB para que quede registrable en `dashboard_access_log`.
  // Si falla, no entra: sin la fila en la base no hay revocación ni país, y la
  // sesión no se podría revalidar (ver getDbIdentity).
  try {
    const migrated = await autoMigrateEnvUserToDb(email, envIdentity);
    if (migrated) return migrated;
    return null; // existía pero estaba revocado
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[permissions-service] auto-migrate failed for ${email}: ${msg}`,
    );
    return null;
  }
}

/**
 * Identidad leída SOLO de la base, para revalidar sesiones ya abiertas
 * (callback jwt de lib/auth.ts). null = el usuario no existe o está revocado.
 * Lanza si la base falla: quien llama decide (la sesión se mantiene y se
 * reintenta). Nunca cae al env, que no conoce revocaciones ni país. Un solo
 * intento, sin withNeonRetry: corre dentro de requests de usuario y con la base
 * caída no debe sumarles segundos de reintentos.
 */
export async function getDbIdentity(email: string): Promise<UserIdentity | null> {
  if (!email) return null;
  return lookupFromDb(email);
}
