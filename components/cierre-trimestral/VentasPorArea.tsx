import type { VentasAggregate } from "@/lib/unabase/cierreTrimestral";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import MontoModeToggle from "@/components/MontoModeToggle";
import type { MontoMode } from "@/components/montoMode";

interface Props {
  agg: VentasAggregate;
  monto: MontoMode;
}

export default function VentasPorArea({ agg, monto }: Props) {
  const montoHeader = monto === "bruto" ? "Total bruto (con IVA)" : "Total neto";

  if (agg.porArea.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Ventas por área de negocio
          </h2>
          <MontoModeToggle value={monto} />
        </div>
        <p className="mt-3 font-sans text-sm text-[#999999]">
          Sin negocios asignados en el trimestre.
        </p>
      </article>
    );
  }

  const maxVenta = Math.max(...agg.porArea.map((r) => r.totalNeto), 1);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Ventas por área de negocio
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            {montoHeader} agrupado por <span className="text-[#333333]">area_negocio</span>, filtrado
            por fecha de asignación.
          </p>
        </div>
        <MontoModeToggle value={monto} />
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] text-left font-medium text-[#666666]">
              <th className="py-2 pr-4 text-xs uppercase tracking-wide">Área de negocio</th>
              <th className="py-2 pr-4 text-right text-xs uppercase tracking-wide">Negocios</th>
              <th className="py-2 text-right text-xs uppercase tracking-wide">{montoHeader}</th>
            </tr>
          </thead>
          <tbody>
            {agg.porArea.map((r) => {
              const widthPct = Math.max(2, (r.totalNeto / maxVenta) * 100);
              return (
                <tr key={r.area} className="border-b border-[#F0F0F0]">
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium text-[#333333]">{r.area}</span>
                      <div className="h-1 w-full max-w-[240px] rounded-full bg-[#F0F0F0]">
                        <div
                          className="h-1 rounded-full bg-[#87DACD]"
                          style={{ width: `${widthPct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-[#333333]">
                    {formatNumber(r.cantidadNegocios)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-[#333333]">
                    {compactCurrency(r.totalNeto)}
                    <div className="font-sans text-xs text-[#666666]">
                      {formatCurrency(r.totalNeto)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#333333]">
              <td className="py-3 pr-4 font-display text-sm font-bold uppercase tracking-wide text-[#333333]">
                Total
              </td>
              <td className="py-3 pr-4 text-right tabular-nums font-bold text-[#333333]">
                {formatNumber(agg.totalNegocios)}
              </td>
              <td className="py-3 text-right tabular-nums font-bold text-[#333333]">
                {compactCurrency(agg.totalNeto)}
                <div className="font-sans text-xs font-normal text-[#666666]">
                  {formatCurrency(agg.totalNeto)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
