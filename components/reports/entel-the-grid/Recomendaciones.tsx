import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

export default function Recomendaciones({ report }: { report: EntelReport }) {
  return (
    <div className="er-recom-grid er-mb-28">
      {report.recomendaciones.map((r) => (
        <div className="er-recom-card" key={r.numero}>
          <span className={`er-recom-priority ${r.prioridad.toLowerCase()}`}>{r.prioridad}</span>
          <div className="er-recom-num">{r.numero}</div>
          <div className="er-recom-title">{r.titulo}</div>
          <div className="er-recom-text">{r.detalle}</div>
        </div>
      ))}
    </div>
  );
}
