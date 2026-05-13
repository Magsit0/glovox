import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

export default function GuardarropiaTimeline({ report }: { report: EntelReport }) {
  const stockInicial = 200;
  // Mostramos hitos con cambio (cuposGuardados !== null) o el primero/último.
  const hitos = report.guardarropia.timeline.filter(
    (t, i, arr) => t.cuposGuardados !== null || i === 0 || i === arr.length - 1,
  );
  return (
    <div className="er-card">
      <div className="er-card-title">Guardarropía · Cupos acumulados</div>
      <div className="er-card-desc">
        Registro de {stockInicial} cupos disponibles · agotados a las 22:47 hrs
      </div>
      <div className="er-guard-timeline">
        {hitos.map((h) => {
          const pct = (h.cuposAcum / stockInicial) * 100;
          const isFull = h.cuposAcum >= stockInicial;
          return (
            <div className="er-guard-col" key={h.hora}>
              <div className="er-guard-val" style={isFull ? { color: "var(--orange)" } : undefined}>
                {h.cuposAcum}
              </div>
              <div
                className={`er-guard-bar${isFull ? " full" : ""}`}
                style={{ height: `${Math.max(1, pct)}%` }}
              />
              <div className="er-guard-label" style={isFull ? { color: "var(--orange)" } : undefined}>
                {isFull ? `${h.hora} ✓` : h.hora}
              </div>
            </div>
          );
        })}
      </div>
      <div className="er-guard-callout">
        <span style={{ fontSize: 16 }}>📦</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sky)", marginBottom: 2 }}>
            Stock agotado a las 22:47 hrs
          </div>
          <div style={{ fontSize: 11, color: "var(--gray-600)" }}>
            {stockInicial} cupos entregados en su totalidad. Alta demanda sostenida desde las 18:30 hrs en adelante.
          </div>
        </div>
      </div>
    </div>
  );
}
