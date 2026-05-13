import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

export default function FlujoChart({ report }: { report: EntelReport }) {
  const data = report.flujoAgrupado;
  const max = Math.max(...data.map((d) => d.vasos), 1);
  return (
    <div className="er-card">
      <div className="er-card-title">Vasos entregados por tramo horario</div>
      <div className="er-card-desc">
        Distribución de canjes desde apertura hasta cierre de activación · peak a las 19:00 hrs marcado en naranja
      </div>
      <div style={{ position: "relative", height: 240 }}>
        <div className="er-bar-chart">
          {data.map((d) => {
            const heightPct = d.vasos === 0 ? 3 : Math.max(4, (d.vasos / max) * 100);
            return (
              <div key={d.hora} className="er-bar-col">
                <div
                  className="er-bar-val"
                  style={{ color: d.peak ? "var(--orange)" : d.vasos === 0 ? "var(--gray-400)" : undefined }}
                >
                  {d.vasos}
                </div>
                <div
                  className={`er-bar${d.peak ? " peak" : ""}${d.vasos === 0 ? " empty" : ""}`}
                  style={{ height: `${heightPct}%` }}
                />
                <div className={`er-bar-label${d.peak ? " peak" : ""}`}>
                  {d.peak ? `${d.hora} 🔥` : d.hora}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
