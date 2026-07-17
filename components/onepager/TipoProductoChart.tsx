"use client";

import type { OnepagerTipoProductoRow } from "@/lib/queries/onepager";
import { BRAND } from "@/lib/chart-colors";

type Props = {
  data: OnepagerTipoProductoRow[];
  color?: string;
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

export default function TipoProductoChart({ data, color = BRAND.purple }: Props) {
  const maxVenta = Math.max(...data.map((d) => d.venta), 1);

  return (
    <div className="max-h-[480px] overflow-y-auto bg-white border border-[#E5E5E5] rounded-lg">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-[#E5E5E5]">
            <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left w-[40%]">
              Tipo Producto
            </th>
            <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right w-[20%]">
              Qtty
            </th>
            <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right w-[20%]">
              Venta
            </th>
            <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 w-[20%]" />
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const pct = Math.round((row.venta / maxVenta) * 100);
            return (
              <tr
                key={row.tipoProducto}
                className="border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#FAFAFA] transition-colors duration-150"
              >
                <td className="font-sans text-sm text-[#333333] px-4 py-2 font-medium">
                  {row.tipoProducto}
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-2 text-right tabular-nums">
                  {row.qtty.toLocaleString("es-CL")}
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-2 text-right tabular-nums whitespace-nowrap">
                  {fmtClp(row.venta)}
                </td>
                <td className="px-4 py-2">
                  <div className="w-full bg-[#F0F0F0] h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
