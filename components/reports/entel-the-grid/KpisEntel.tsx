import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

const ICONS: Record<string, string> = {
  Fidelización: "🤝",
  Captación: "📲",
  Visibilidad: "📣",
};

const LABELS: Record<"si" | "proyeccion" | "no", string> = {
  si: "✓ Objetivo alcanzado",
  proyeccion: "◐ Proyección de mejora",
  no: "✗ No alcanzado",
};

export default function KpisEntel({ report }: { report: EntelReport }) {
  return (
    <div className="er-grid-3 er-mb-28">
      {report.objetivosEntel.map((obj) => (
        <div className="er-card" key={obj.titulo}>
          <div className="er-obj-icon">{ICONS[obj.titulo] ?? "📊"}</div>
          <div className="er-card-title">{obj.titulo}</div>
          <div className="er-card-desc">{obj.pregunta}</div>
          <div className={`er-objpill ${obj.alcanzado}`}>{LABELS[obj.alcanzado]}</div>
          <div className="er-obj-detail">{obj.detalle}</div>
        </div>
      ))}
    </div>
  );
}
