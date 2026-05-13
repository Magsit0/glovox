import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

export default function Cronologia({ report }: { report: EntelReport }) {
  return (
    <div className="er-card er-mb-28">
      <div className="er-timeline">
        {report.timeline.map((e) => (
          <div className="er-tl-item" key={e.hora + e.tag}>
            <div className="er-tl-left">
              <div className="er-tl-time">{e.hora}</div>
              <div className={`er-tl-dot ${e.tone}`} />
            </div>
            <div className="er-tl-body">
              <div className={`er-tl-tag ${e.tone}`}>{e.tag}</div>
              <div className="er-tl-text">{e.texto}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
