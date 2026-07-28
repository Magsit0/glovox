import type { PnlInternoRow } from "@/lib/queries/interno";
import type { MontoMode } from "@/components/montoMode";
import { formatCurrency } from "@/components/proveedor/format";

interface Props {
  rows: PnlInternoRow[];
  monto: MontoMode;
}

/**
 * Mini P&L de los negocios internos CON venta asociada (BOTILLERIA, RENTAL…).
 * Server component sin interactividad: pocas filas, orden fijo por venta desc.
 * El gasto es `gasto_real` del maestro (neto por diseño del API Unabase), así
 * que en modo bruto el margen mezcla venta bruta con gasto neto — se advierte
 * en el subtítulo.
 */
export default function PnlInternoTable({ rows, monto }: Props) {
  const ventaLabel = monto === "bruto" ? "Venta bruta" : "Venta neta";
  const nota =
    monto === "bruto"
      ? "Venta bruta (con IVA) contra gasto real del maestro (neto): el margen es referencial."
      : "Cifras netas del maestro Unabase: venta neta contra gasto real.";

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white">
      <header className="flex flex-col gap-1 px-6 pt-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Negocios internos con venta
        </h2>
        <p className="font-sans text-sm text-[#666666]">
          Rubros internos que también venden (botillería, rental…). {nota}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Ningún negocio interno registra venta.
        </p>
      ) : (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {["Negocio", ventaLabel, "Gasto real", "Margen", "Margen %"].map(
                  (label, i) => (
                    <th
                      key={label}
                      className={`sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666] ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.venta > 0 ? (r.margen / r.venta) * 100 : 0;
                const dot = r.margen >= 0 ? "bg-[#B1D750]" : "bg-[#ED75A0]";
                return (
                  <tr
                    key={r.negocioId}
                    className="border-b border-[#E5E5E5] transition-colors last:border-b-0 hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className="truncate font-sans text-sm text-[#333333]"
                          title={r.referencia}
                        >
                          {r.referencia || `Negocio ${r.negocioId}`}
                        </span>
                        <span className="font-sans text-xs text-[#999999]">
                          {r.negocioId}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatCurrency(r.venta)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatCurrency(r.gasto)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`}
                          aria-hidden="true"
                        />
                        {formatCurrency(r.margen)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
