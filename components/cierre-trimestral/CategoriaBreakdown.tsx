import type { CategoriaBreakdownRow } from "@/lib/unabase/cierreTrimestral";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  rows: CategoriaBreakdownRow[];
}

export default function CategoriaBreakdown({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Desglose por categoría
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin datos para el trimestre.</p>
      </article>
    );
  }

  const maxVenta = Math.max(...rows.map((r) => r.totalVentaTickets), 1);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Desglose por categoría
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Ventas, asistentes y per cápita por categoría de evento.
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] text-left font-medium text-[#666666]">
              <th className="py-2 pr-4 text-xs uppercase tracking-wide">Categoría</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Eventos</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Asistentes</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Venta tickets</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Venta FF&BB</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">PC tickets</th>
              <th className="py-2 text-right text-xs uppercase tracking-wide">PC FF&BB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const widthPct = Math.max(2, (r.totalVentaTickets / maxVenta) * 100);
              return (
                <tr key={r.categoria} className="border-b border-[#F0F0F0] last:border-b-0">
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium text-[#333333]">{r.categoria}</span>
                      <div className="h-1 w-full max-w-[200px] rounded-full bg-[#F0F0F0]">
                        <div
                          className="h-1 rounded-full bg-[#9F99F8]"
                          style={{ width: `${widthPct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-[#333333]">
                    {formatNumber(r.totalEventos)}
                  </td>
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
                    {formatCurrency(r.perCapitaFFBB)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {(() => {
              const totEventos = rows.reduce((a, r) => a + r.totalEventos, 0);
              const totAsistentes = rows.reduce((a, r) => a + r.totalAsistentes, 0);
              const totVentaTickets = rows.reduce((a, r) => a + r.totalVentaTickets, 0);
              const totVentaFFBB = rows.reduce((a, r) => a + r.totalVentaFFBB, 0);
              const pcTickets = totAsistentes > 0 ? totVentaTickets / totAsistentes : 0;
              const pcFFBB = totAsistentes > 0 ? totVentaFFBB / totAsistentes : 0;
              return (
                <tr className="border-t-2 border-[#333333]">
                  <td className="py-3 pr-4 font-display text-sm font-bold uppercase tracking-wide text-[#333333]">
                    Total
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#333333]">
                    {formatNumber(totEventos)}
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
                    {formatCurrency(pcFFBB)}
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
