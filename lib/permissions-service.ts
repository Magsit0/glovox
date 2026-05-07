/**
 * Permissions service — single entry point for "who is this user and what
 * can they see/do".
 *
 * Lookup order:
 *   1. Postgres (`users` + `user_dashboard_access`).
 *   2. If not found AND PERMISSIONS_FALLBACK_TO_ENV !== "false" → legacy
 *      env var-based logic (lib/permissions.ts + ALLOWED_DOMAIN/EMAILS).
 *   3. Otherwise → null (no access).
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
 * Country → ticketera mapping for marketing data scopes.
 * Lives here (not in DB) because it's BigQuery model metadata, not
 * something the superadmin should edit through UI.
 */
const COUNTRY_TICKETERAS: Record<Country, string[]> = {
  CL: [],
  PE: ["TeleTicket"],
};

/**
 * Path prefixes where country scope is materialized as a ticketera filter.
 * Other dashboards may apply country differently (e.g. EventoID prefix);
 * those filters live in the query layer.
 */
const TICKETERA_SCOPED_DASHBOARDS = ["/marketing/weekly", "/marketingPE/weekly"];

function buildPermissions(
  role: Role,
  pathPrefixes: string[],
  country: Country | null,
): DashboardPermissions {
  if (role === "superadmin") return "all";
  if (pathPrefixes.length === 0) return [];

  if (!country) return pathPrefixes;

  const ticketeras = COUNTRY_TICKETERAS[country];
  if (ticketeras.length === 0) return pathPrefixes;

  const dataScopes: Record<string, { ticketera: string[] }> = {};
  for (const prefix of TICKETERA_SCOPED_DASHBOARDS) {
    if (pathPrefixes.includes(prefix)) {
      dataScopes[prefix] = { ticketera: ticketeras };
    }
  }
  if (Object.keys(dataScopes).length === 0) return pathPrefixes;

  return { dashboards: pathPrefixes, dataScopes };
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
    permissions: buildPermissions(head.role, pathPrefixes, head.country),
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
 * Resolve a user's identity from the most authoritative source available.
 * Returns null if the user is unknown / revoked / outside the env whitelist.
 */
export async function getUserIdentity(
  email: string,
): Promise<UserIdentity | null> {
  if (!email) return null;

  try {
    const dbIdentity = await lookupFromDb(email);
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
  }

  if (process.env.PERMISSIONS_FALLBACK_TO_ENV === "false") return null;
  return lookupFromEnv(email);
}
