/**
 * Admin-side service for the superadmin UI.
 *
 * Read helpers list users + their dashboard grants. Write helpers mutate
 * the same tables and emit `audit_log` entries.
 *
 * All writes assert a superadmin actor. Self-modification of role/revocation
 * is blocked at this layer; the UI also hides the controls.
 */
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  dashboards,
  userDashboardAccess,
  users,
  type Country,
  type Role,
} from "@/db/schema";

export type AdminUserRow = {
  id: string;
  email: string;
  role: Role;
  country: Country | null;
  revokedAt: Date | null;
  createdAt: Date;
  dashboardKeys: string[];
};

export type DashboardCatalogRow = {
  key: string;
  pathPrefix: string;
  label: string;
  appliesCountryScope: boolean;
  sortOrder: number;
};

export async function listDashboards(): Promise<DashboardCatalogRow[]> {
  const rows = await db
    .select({
      key: dashboards.key,
      pathPrefix: dashboards.pathPrefix,
      label: dashboards.label,
      appliesCountryScope: dashboards.appliesCountryScope,
      sortOrder: dashboards.sortOrder,
    })
    .from(dashboards)
    .orderBy(asc(dashboards.sortOrder));
  return rows;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      country: users.country,
      revokedAt: users.revokedAt,
      createdAt: users.createdAt,
      dashboardKey: userDashboardAccess.dashboardKey,
    })
    .from(users)
    .leftJoin(userDashboardAccess, eq(userDashboardAccess.userId, users.id))
    .orderBy(asc(users.email));

  const map = new Map<string, AdminUserRow>();
  for (const r of rows) {
    const cur = map.get(r.id) ?? {
      id: r.id,
      email: r.email,
      role: r.role,
      country: r.country,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
      dashboardKeys: [],
    };
    if (r.dashboardKey) cur.dashboardKeys.push(r.dashboardKey);
    map.set(r.id, cur);
  }
  return Array.from(map.values());
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.id ?? null;
}

async function logAudit(
  actorId: string | null,
  action: string,
  targetUserId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({
    actorId,
    action,
    targetUserId,
    payload,
  });
}

export type CreateUserInput = {
  email: string;
  role: Role;
  country: Country | null;
  dashboardKeys: string[];
};

export async function createUser(
  actorEmail: string,
  input: CreateUserInput,
): Promise<{ id: string }> {
  const actorId = await findUserIdByEmail(actorEmail);
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      role: input.role,
      country: input.country,
      createdBy: actorId,
    })
    .returning({ id: users.id });

  if (input.dashboardKeys.length > 0) {
    await db.insert(userDashboardAccess).values(
      input.dashboardKeys.map((dashboardKey) => ({
        userId: row.id,
        dashboardKey,
        grantedBy: actorId,
      })),
    );
  }

  await logAudit(actorId, "user.create", row.id, {
    email: input.email,
    role: input.role,
    country: input.country,
    dashboardKeys: input.dashboardKeys,
  });
  return { id: row.id };
}

export async function setUserCountry(
  actorEmail: string,
  userId: string,
  country: Country | null,
): Promise<void> {
  const actorId = await findUserIdByEmail(actorEmail);
  await db
    .update(users)
    .set({ country, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await logAudit(actorId, "user.country", userId, { country });
}

export async function setUserRole(
  actorEmail: string,
  userId: string,
  role: Role,
): Promise<void> {
  const actorId = await findUserIdByEmail(actorEmail);
  if (actorId === userId && role !== "superadmin") {
    throw new Error("Un superadmin no puede degradarse a sí mismo.");
  }

  if (role !== "superadmin") {
    // Block losing the last active superadmin.
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (target?.role === "superadmin") {
      const [{ count }] = await db
        .select({ count: countDistinctActiveSuperadmins() })
        .from(users)
        .where(
          and(
            eq(users.role, "superadmin"),
            isNull(users.revokedAt),
            ne(users.id, userId),
          ),
        );
      if (Number(count) === 0) {
        throw new Error("Debe quedar al menos un superadmin activo.");
      }
    }
  }

  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await logAudit(actorId, "user.role", userId, { role });
}

function countDistinctActiveSuperadmins() {
  return sql<number>`count(*)`;
}

export async function setUserDashboards(
  actorEmail: string,
  userId: string,
  dashboardKeys: string[],
): Promise<void> {
  const actorId = await findUserIdByEmail(actorEmail);
  await db
    .delete(userDashboardAccess)
    .where(eq(userDashboardAccess.userId, userId));
  if (dashboardKeys.length > 0) {
    await db.insert(userDashboardAccess).values(
      dashboardKeys.map((dashboardKey) => ({
        userId,
        dashboardKey,
        grantedBy: actorId,
      })),
    );
  }
  await db
    .update(users)
    .set({ updatedAt: new Date() })
    .where(eq(users.id, userId));
  await logAudit(actorId, "access.set", userId, { dashboardKeys });
}

export async function revokeUser(
  actorEmail: string,
  userId: string,
): Promise<void> {
  const actorId = await findUserIdByEmail(actorEmail);
  if (actorId === userId) {
    throw new Error("No puedes revocarte a ti mismo.");
  }
  await db
    .update(users)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
  await logAudit(actorId, "user.revoke", userId, {});
}

export async function restoreUser(
  actorEmail: string,
  userId: string,
): Promise<void> {
  const actorId = await findUserIdByEmail(actorEmail);
  await db
    .update(users)
    .set({ revokedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await logAudit(actorId, "user.restore", userId, {});
}
