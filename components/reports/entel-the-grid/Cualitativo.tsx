import type { CualitativoItem, EntelReport } from "@/lib/reports/entel-the-grid/types";

function Column({
  title,
  desc,
  items,
}: {
  title: string;
  desc: string;
  items: CualitativoItem[];
}) {
  return (
    <div className="er-card">
      <div className="er-card-title">{title}</div>
      <div className="er-card-desc">{desc}</div>
      {items.map((it) => (
        <div
          key={it.titulo}
          className={`er-collab-item${it.tone === "projection" ? " projection" : ""}`}
        >
          <div className="er-collab-ico">{it.icon}</div>
          <div>
            <div className="er-collab-title">{it.titulo}</div>
            <div className="er-collab-text">{it.detalle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Cualitativo({ report }: { report: EntelReport }) {
  return (
    <div className="er-grid-2 er-mb-28">
      <Column
        title="¿Qué funcionó?"
        desc="Resultados positivos de la activación"
        items={report.cualitativo.queFunciono}
      />
      <Column
        title="Proyecciones de mejora"
        desc="Oportunidades de escalamiento para próximas ediciones"
        items={report.cualitativo.proyecciones}
      />
    </div>
  );
}
