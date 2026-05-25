/**
 * Servicio para el log de accesos a dashboards.
 *
 * `logDashboardAccess` se invoca desde un Server Component embebido en cada
 * dashboard y es fire-and-forget: si la inserción falla, el dashboard sigue
 * cargando normal.
 *
 * Las funciones de lectura son consumidas exclusivamente por el panel admin
 * (`/admin/accesos`), que asegura el guard de superadmin antes de llamarlas.
 */
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dashboardAccessLog, dashboards, users } from "@/db/schema";
import { ensureDashboardsCatalog } from "@/lib/ensureDashboardsCatalog";

/**
 * Ventana de dedupe: si el mismo usuario ya registró acceso al mismo
 * dashboard dentro de este intervalo, no creamos un nuevo row.
 *
 * Cubre refrescos, aplicación de filtros, navegación entre subpáginas
 * del mismo dashboard (`/club` → `/club/earnings`). Una sesión continua
 * de uso queda como una sola visita.
 */
const DEDUPE_WINDOW_MINUTES = 5;

export async function logDashboardAccess(
  userId: string,
  dashboardKey: string,
  path: string,
): Promise<void> {
  try {
    // Garantiza que el dashboardKey exista en la tabla `dashboards`
    // antes del insert (la FK lo exige). Memoizado in-process, costo
    // despreciable después del primer hit.
    await ensureDashboardsCatalog();

    await db.execute(sql`
      insert into ${dashboardAccessLog} (user_id, dashboard_key, path)
      select ${userId}::uuid, ${dashboardKey}, ${path}
      where not exists (
        select 1 from ${dashboardAccessLog}
        where user_id = ${userId}::uuid
          and dashboard_key = ${dashboardKey}
          and accessed_at >= now() - (${DEDUPE_WINDOW_MINUTES}::int * interval '1 minute')
      )
    `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[dashboard-access-service] insert failed (user=${userId}, dashboard=${dashboardKey}): ${msg}`,
    );
  }
}

export type AccessLogFilters = {
  userId?: string | null;
  dashboardKey?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit: number;
  offset: number;
};

export type AccessLogRow = {
  id: number;
  accessedAt: Date;
  userId: string;
  email: string;
  dashboardKey: string;
  dashboardLabel: string;
  path: string;
};

export async function getAccessLogs(
  filters: AccessLogFilters,
): Promise<{ rows: AccessLogRow[]; total: number }> {
  const where = and(
    filters.userId ? eq(dashboardAccessLog.userId, filters.userId) : undefined,
    filters.dashboardKey
      ? eq(dashboardAccessLog.dashboardKey, filters.dashboardKey)
      : undefined,
    filters.from ? gte(dashboardAccessLog.accessedAt, filters.from) : undefined,
    filters.to ? lte(dashboardAccessLog.accessedAt, filters.to) : undefined,
  );

  const [rowsRaw, countRaw] = await Promise.all([
    db
      .select({
        id: dashboardAccessLog.id,
        accessedAt: dashboardAccessLog.accessedAt,
        userId: dashboardAccessLog.userId,
        email: users.email,
        dashboardKey: dashboardAccessLog.dashboardKey,
        dashboardLabel: dashboards.label,
        path: dashboardAccessLog.path,
      })
      .from(dashboardAccessLog)
      .innerJoin(users, eq(users.id, dashboardAccessLog.userId))
      .innerJoin(dashboards, eq(dashboards.key, dashboardAccessLog.dashboardKey))
      .where(where)
      .orderBy(desc(dashboardAccessLog.accessedAt))
      .limit(filters.limit)
      .offset(filters.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(dashboardAccessLog)
      .where(where),
  ]);

  return {
    rows: rowsRaw,
    total: Number(countRaw[0]?.count ?? 0),
  };
}

export type DashboardSummaryRow = {
  dashboardKey: string;
  dashboardLabel: string;
  sortOrder: number;
  uniqueUsers30d: number;
  totalVisits30d: number;
  lastAccessedAt: Date | null;
  lastAccessedBy: string | null;
};

export async function getDashboardAccessSummary(): Promise<
  DashboardSummaryRow[]
> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    // 1) Catálogo de dashboards (siempre listamos todos, aunque no tengan logs).
    const allDashboards = await db
      .select({
        key: dashboards.key,
        label: dashboards.label,
        sortOrder: dashboards.sortOrder,
      })
      .from(dashboards)
      .orderBy(dashboards.sortOrder);

    // 2) Conteos de visitas/únicos en los últimos 30d (solo dashboards con logs).
    const counts = await db
      .select({
        dashboardKey: dashboardAccessLog.dashboardKey,
        uniqueUsers30d: sql<number>`count(distinct ${dashboardAccessLog.userId})::int`,
        totalVisits30d: sql<number>`count(*)::int`,
      })
      .from(dashboardAccessLog)
      .where(gte(dashboardAccessLog.accessedAt, thirtyDaysAgo))
      .groupBy(dashboardAccessLog.dashboardKey);

    // 3) Último acceso por dashboard (sin filtro temporal).
    // Usamos max(accessed_at) directamente sobre la columna (Drizzle lo
    // deserializa como Date). Un `sql<Date>` arbitrario lo devuelve como
    // string, así que evitamos esa ruta.
    const lastAccess = await db.execute<{
      dashboard_key: string;
      last_accessed_at: Date;
    }>(sql`
      select dashboard_key, max(accessed_at) as last_accessed_at
      from ${dashboardAccessLog}
      group by dashboard_key
    `);

    // 4) Email del último accedente por dashboard (vía DISTINCT ON).
    const lastByDashboard = await db.execute<{
      dashboard_key: string;
      email: string;
    }>(sql`
      select distinct on (log.dashboard_key)
        log.dashboard_key, u.email
      from ${dashboardAccessLog} log
      inner join ${users} u on u.id = log.user_id
      order by log.dashboard_key, log.accessed_at desc
    `);

    const countsByKey = new Map(counts.map((c) => [c.dashboardKey, c]));
    const lastAccessByKey = new Map<string, Date>();
    for (const l of lastAccess as unknown as Array<{
      dashboard_key: string;
      last_accessed_at: Date | string;
    }>) {
      const d =
        l.last_accessed_at instanceof Date
          ? l.last_accessed_at
          : new Date(l.last_accessed_at);
      lastAccessByKey.set(l.dashboard_key, d);
    }
    const emailByKey = new Map<string, string>();
    for (const r of lastByDashboard as unknown as Array<{
      dashboard_key: string;
      email: string;
    }>) {
      emailByKey.set(r.dashboard_key, r.email);
    }

    return allDashboards.map((d) => ({
      dashboardKey: d.key,
      dashboardLabel: d.label,
      sortOrder: d.sortOrder,
      uniqueUsers30d: countsByKey.get(d.key)?.uniqueUsers30d ?? 0,
      totalVisits30d: countsByKey.get(d.key)?.totalVisits30d ?? 0,
      lastAccessedAt: lastAccessByKey.get(d.key) ?? null,
      lastAccessedBy: emailByKey.get(d.key) ?? null,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && (err as { cause?: unknown }).cause
        ? (err as { cause?: unknown }).cause
        : null;
    console.error(
      `[dashboard-access-service] getDashboardAccessSummary failed: ${msg}`,
      cause ?? "",
    );
    throw err;
  }
}

export type TopUserRow = {
  userId: string;
  email: string;
  visits: number;
  lastAccessedAt: Date;
};

export async function getTopUsersForDashboard(
  dashboardKey: string,
  limit: number = 5,
): Promise<TopUserRow[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db
    .select({
      userId: dashboardAccessLog.userId,
      email: users.email,
      visits: sql<number>`count(*)::int`,
      lastAccessedAt: sql<Date>`max(${dashboardAccessLog.accessedAt})`,
    })
    .from(dashboardAccessLog)
    .innerJoin(users, eq(users.id, dashboardAccessLog.userId))
    .where(
      and(
        eq(dashboardAccessLog.dashboardKey, dashboardKey),
        gte(dashboardAccessLog.accessedAt, thirtyDaysAgo),
      ),
    )
    .groupBy(dashboardAccessLog.userId, users.email)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
