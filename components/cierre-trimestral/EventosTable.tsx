import type { EventoDetalleRow } from "@/lib/unabase/cierreTrimestral";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  rows: EventoDetalleRow[];
}

export default function EventosTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Eventos del trimestre
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin eventos para el trimestre.</p>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Eventos del trimestre
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          {formatNumber(rows.length)} eventos ordenados por fecha (más reciente primero).
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] text-left font-medium text-[#666666]">
              <th className="py-2 pr-4 text-xs uppercase tracking-wide">Evento</th>
              <th className="py-2 pr-4 text-xs uppercase tracking-wide">Fecha</th>
              <th className="py-2 pr-4 text-xs uppercase tracking-wide">Categoría</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Asistentes</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Venta tickets</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Venta FF&BB</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">PC tickets</th>
              <th className="py-2 text-right text-xs uppercase tracking-wide">Gasto PM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.eventoId} className="border-b border-[#F0F0F0] last:border-b-0">
                <td className="py-3 pr-4">
                  <span className="font-medium text-[#333333]">{r.nombreId}</span>
                </td>
                <td className="py-3 pr-4 text-[#666666] tabular-nums">{r.fechaEvento ?? "—"}</td>
                <td className="py-3 pr-4 text-[#666666]">{r.categoria}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-[#333333]">
                  {formatNumber(r.totalAsistentes)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-[#333333]">
                  {compactCurrency(r.totalVentaTickets)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-[#333333]">
                  {compactCurrency(r.totalVentaFFBB)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-[#666666]">
                  {formatCurrency(r.perCapitaTickets)}
                </td>
                <td className="py-3 text-right tabular-nums text-[#666666]">
                  {compactCurrency(r.gastoPM)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(() => {
              const totAsistentes = rows.reduce((a, r) => a + r.totalAsistentes, 0);
              const totVentaTickets = rows.reduce((a, r) => a + r.totalVentaTickets, 0);
              const totVentaFFBB = rows.reduce((a, r) => a + r.totalVentaFFBB, 0);
              const totGastoPM = rows.reduce((a, r) => a + r.gastoPM, 0);
              const pcTickets = totAsistentes > 0 ? totVentaTickets / totAsistentes : 0;
              return (
                <tr className="border-t-2 border-[#333333]">
                  <td
                    className="py-3 pr-4 font-display text-sm font-bold uppercase tracking-wide text-[#333333]"
                    colSpan={3}
                  >
                    Total ({formatNumber(rows.length)} eventos)
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#333333]">
                    {formatNumber(totAsistentes)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#333333]">
                    {compactCurrency(totVentaTickets)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#333333]">
                    {compactCurrency(totVentaFFBB)}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#333333]">
                    {formatCurrency(pcTickets)}
                  </td>
                  <td className="py-3 text-right tabular-nums font-bold text-[#333333]">
                    {compactCurrency(totGastoPM)}
                  </td>
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>
    </article>
  );
}
