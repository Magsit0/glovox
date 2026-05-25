type SummaryRow = {
  dashboardKey: string;
  dashboardLabel: string;
  uniqueUsers30d: number;
  totalVisits30d: number;
  lastAccessedAt: string | null;
  lastAccessedBy: string | null;
  topUsers: { email: string; visits: number }[];
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Sin accesos";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Hace unos segundos";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days} d`;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AccessSummary({ rows }: { rows: SummaryRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold text-[#333333]">
        Resumen por dashboard
        <span className="ml-2 font-sans text-xs font-normal text-[#666666]">
          (últimos 30 días)
        </span>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.dashboardKey}
            className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-4"
          >
            <div>
              <h3 className="font-display text-base font-bold text-[#333333]">
                {r.dashboardLabel}
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-wide text-[#999999]">
                {r.dashboardKey}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="font-display text-2xl font-bold text-[#333333]">
                  {r.uniqueUsers30d}
                </div>
                <div className="font-sans text-xs text-[#666666]">
                  usuarios únicos
                </div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-[#333333]">
                  {r.totalVisits30d}
                </div>
                <div className="font-sans text-xs text-[#666666]">visitas</div>
              </div>
            </div>
            <div className="font-sans text-xs text-[#666666]">
              <span className="text-[#999999]">Último acceso: </span>
              {formatRelative(r.lastAccessedAt)}
              {r.lastAccessedBy ? (
                <>
                  {" · "}
                  <span className="text-[#333333]">{r.lastAccessedBy}</span>
                </>
              ) : null}
            </div>
            {r.topUsers.length > 0 ? (
              <div className="flex flex-col gap-1 border-t border-[#F0F0F0] pt-2">
                <p className="font-sans text-[10px] uppercase tracking-wide text-[#999999]">
                  Top usuarios (30d)
                </p>
                {r.topUsers.map((u) => (
                  <div
                    key={u.email}
                    className="flex items-center justify-between font-sans text-xs"
                  >
                    <span className="truncate text-[#333333]">{u.email}</span>
                    <span className="ml-2 font-mono text-[#666666]">
                      {u.visits}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
