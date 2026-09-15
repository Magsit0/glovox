"use client";

import type {
  OnepagerAsistenciaRow,
  OnepagerLlegadaRow,
} from "@/lib/queries/onepager";
import BrutalChartPanel from "./BrutalChartPanel";
import LlegadasChart from "./LlegadasChart";

type Props = {
  asistencia: OnepagerAsistenciaRow[];
  llegadas: OnepagerLlegadaRow[];
};

const TH =
  "font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3";
const NUM = "font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums";

/**
 * Validación de asistencia (pestaña Tickets): tickets emitidos vs personas que
 * entraron, por tipo (VENTA / CORTESIA), en PERSONAS, más la curva de hora de
 * llegada con el peak marcado. Es un chequeo operativo, no una cifra de negocio.
 */
export default function ValidacionAsistencia({ asistencia, llegadas }: Props) {
  const VENTA_ORDER: Record<string, number> = { VENTA: 0, CORTESIA: 1 };
  const asistenciaSorted = [...asistencia].sort(
    (a, b) => (VENTA_ORDER[a.ventaNoventa] ?? 99) - (VENTA_ORDER[b.ventaNoventa] ?? 99)
  );
  const totalQtty = asistenciaSorted.reduce((a, r) => a + r.qtty, 0);
  const totalQtty2 = asistenciaSorted.reduce((a, r) => a + r.qtty2, 0);
  const totalPct = totalQtty > 0 ? (totalQtty2 / totalQtty) * 100 : null;

  return (
    <BrutalChartPanel title="Validación de asistencia">
      <p className="font-sans text-xs text-[#666666] -mt-2 mb-4">
        Personas con ticket vs personas que entraron (quemados), por tipo de
        ticket. Los asistentes son los que se usan en los percápita.
      </p>
      {/* Tres cifras arriba, tabla a ancho completo abajo (misma grilla que las
          cifras del peak más abajo, para que el panel lea como una sola pieza). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">Tickets emitidos</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {totalQtty.toLocaleString("es-CL")}
          </p>
          <p className="mt-2 font-sans text-xs text-[#999999]">Personas con ticket (venta + cortesía)</p>
        </div>
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">Asistentes</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {totalQtty2.toLocaleString("es-CL")}
          </p>
          <p className="mt-2 font-sans text-xs text-[#999999]">Personas que entraron (quemados)</p>
        </div>
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">% asistencia</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {totalPct != null ? `${totalPct.toFixed(1)}%` : "—"}
          </p>
          <p className="mt-2 font-sans text-xs text-[#999999]">
            {totalQtty > 0
              ? `${(totalQtty - totalQtty2).toLocaleString("es-CL")} personas no asistieron`
              : "Sin tickets emitidos"}
          </p>
        </div>
      </div>

      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
              <th className={`${TH} text-left`}>Tipo</th>
              <th className={`${TH} text-right`}>Tickets</th>
              <th className={`${TH} text-right`}>Asistentes</th>
              <th className={`${TH} text-right`}>% asistencia</th>
            </tr>
          </thead>
          <tbody>
            {asistenciaSorted.map((r) => {
              const pct = r.qtty > 0 ? (r.qtty2 / r.qtty) * 100 : null;
              return (
                <tr
                  key={r.ventaNoventa}
                  className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                >
                  <td className="font-sans text-sm font-medium text-[#333333] px-4 py-3">
                    {r.ventaNoventa === "CORTESIA" ? "Cortesía" : r.ventaNoventa === "VENTA" ? "Venta" : r.ventaNoventa}
                  </td>
                  <td className={NUM}>{r.qtty.toLocaleString("es-CL")}</td>
                  <td className={NUM}>{r.qtty2.toLocaleString("es-CL")}</td>
                  <td className={NUM}>{pct != null ? `${pct.toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
            <tr className="bg-[#FAFAFA]">
              <td className="font-sans text-sm font-semibold text-[#333333] px-4 py-3">
                Total
              </td>
              <td className={`${NUM} font-semibold`}>{totalQtty.toLocaleString("es-CL")}</td>
              <td className={`${NUM} font-semibold`}>{totalQtty2.toLocaleString("es-CL")}</td>
              <td className={`${NUM} font-semibold`}>
                {totalPct != null ? `${totalPct.toFixed(1)}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Curva de hora de llegada (quemados por slot de 15 min) con el peak marcado */}
      <div className="mt-6 pt-6 border-t border-[#E5E5E5]">
        <h4 className="font-display font-bold text-base text-[#333333] mb-1">
          Evolución de hora de llegada
        </h4>
        <p className="font-sans text-xs text-[#666666] mb-4">
          Personas que entraron por slot de 15 minutos según la hora de quemado del
          ticket, con el peak marcado y el % de público acumulado.
        </p>
        <LlegadasChart data={llegadas} />
      </div>
    </BrutalChartPanel>
  );
}
