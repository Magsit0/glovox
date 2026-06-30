import { requireSuperadmin } from "@/lib/access";
import { listDashboards, listUsers } from "@/lib/admin-users-service";
import {
  getAccessLogs,
  getDashboardAccessSummary,
  getTopUsersForDashboard,
} from "@/lib/dashboard-access-service";
import AccessSummary from "./_components/AccessSummary";
import AccessLogTable from "./_components/AccessLogTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseInteger(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseStringList(v: string | string[] | undefined): string[] {
  const values = Array.isArray(v) ? v : v ? [v] : [];
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export default async function AdminAccesosPage({
  searchParams,
}: {
  searchParams: Promise<{
    userId?: string | string[];
    dashboardKey?: string | string[];
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireSuperadmin();

  const sp = await searchParams;
  const userIds = parseStringList(sp.userId);
  const dashboardKeys = parseStringList(sp.dashboardKey);
  const from = parseDate(sp.from);
  const to = parseDate(sp.to);
  if (to) to.setHours(23, 59, 59, 999);
  const page = parseInteger(sp.page, 0);

  const [summaryRows, logsRes, users, catalog] = await Promise.all([
    getDashboardAccessSummary(),
    getAccessLogs({
      userIds,
      dashboardKeys,
      from,
      to,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    listUsers(),
    listDashboards(),
  ]);

  const topUsersByDashboard = await Promise.all(
    summaryRows.map(async (s) => ({
      key: s.dashboardKey,
      top: await getTopUsersForDashboard(s.dashboardKey, 3),
    })),
  );
  const topMap = new Map(
    topUsersByDashboard.map((t) => [
      t.key,
      t.top.map((u) => ({ email: u.email, visits: u.visits })),
    ]),
  );

  const summary = summaryRows.map((s) => ({
    dashboardKey: s.dashboardKey,
    dashboardLabel: s.dashboardLabel,
    uniqueUsers30d: s.uniqueUsers30d,
    totalVisits30d: s.totalVisits30d,
    lastAccessedAt: s.lastAccessedAt
      ? s.lastAccessedAt.toISOString()
      : null,
    lastAccessedBy: s.lastAccessedBy,
    topUsers: topMap.get(s.dashboardKey) ?? [],
  }));

  const logs = logsRes.rows.map((r) => ({
    id: r.id,
    accessedAt: r.accessedAt.toISOString(),
    userId: r.userId,
    email: r.email,
    dashboardKey: r.dashboardKey,
    dashboardLabel: r.dashboardLabel,
    path: r.path,
  }));

  const userOptions = users
    .filter((u) => !u.revokedAt)
    .map((u) => ({ id: u.id, email: u.email }));
  const dashboardOptions = catalog.map((d) => ({
    key: d.key,
    label: d.label,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#333333]">
          Accesos a dashboards
        </h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Registro de quién entró a cada dashboard. Resumen de los últimos 30
          días y log detallado con filtros.
        </p>
      </div>

      <AccessSummary rows={summary} />

      <AccessLogTable
        rows={logs}
        total={logsRes.total}
        pageSize={PAGE_SIZE}
        page={page}
        userOptions={userOptions}
        dashboardOptions={dashboardOptions}
        filters={{
          userIds,
          dashboardKeys,
          from: sp.from ?? "",
          to: sp.to ?? "",
        }}
      />
    </div>
  );
}
