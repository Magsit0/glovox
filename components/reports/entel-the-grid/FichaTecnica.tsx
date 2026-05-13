import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

const numberFmt = new Intl.NumberFormat("es-CL");

export default function FichaTecnica({ report }: { report: EntelReport }) {
  const { meta, stock, horario, conclusionEjecutiva } = report;
  return (
    <div className="er-grid-2 er-mb-28">
      <div className="er-card">
        <div className="er-card-title">Ficha técnica</div>
        <table className="er-ficha-table">
          <tbody>
            <tr>
              <td className="er-ficha-label">Evento</td>
              <td className="er-ficha-value">{meta.evento}</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Fecha</td>
              <td className="er-ficha-value">{meta.fechaLarga}</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Venue</td>
              <td className="er-ficha-value">{meta.venue} · Santiago</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Asistentes estimados</td>
              <td className="er-ficha-value">{numberFmt.format(meta.asistentesEstimados)} personas</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Stock de vasos</td>
              <td className="er-ficha-value">{numberFmt.format(stock.ajustado)} unidades</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Stock guardarropía</td>
              <td className="er-ficha-value">200 cupos</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Hora de inicio</td>
              <td className="er-ficha-value">{horario.inicio} hrs</td>
            </tr>
            <tr>
              <td className="er-ficha-label">Hora peak</td>
              <td className="er-ficha-value accent">
                {horario.peakInicio} — {horario.peakTermino} hrs
              </td>
            </tr>
            <tr>
              <td className="er-ficha-label">Cierre activación</td>
              <td className="er-ficha-value">21:15 hrs</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="er-card">
        <div className="er-conclusion">
          <div className="er-conclusion-label">Conclusión ejecutiva</div>
          <div className="er-conclusion-text">{conclusionEjecutiva}</div>
        </div>
      </div>
    </div>
  );
}
