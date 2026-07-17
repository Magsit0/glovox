"use client";

import type { OnepagerPuntoVentaRow } from "@/lib/queries/onepager";
import { BRAND } from "@/lib/chart-colors";

type Props = {
  data: OnepagerPuntoVentaRow[];
  color?: string;
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

export default function PuntoVentaChart({ data, color = BRAND.purple }: Props) {
  const maxVenta = Math.max(...data.map((d) => d.venta), 1);

  return (
    <div className="max-h-[480px] overflow-y-auto bg-white border border-[#E5E5E5] rounded-lg">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
            <th className="font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 text-left w-[8%]">
              #
            </th>
            <th className="font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 text-left w-[32%]">
              Punto de Venta
            </th>
            <th className="font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 text-right w-[20%]">
              Qtty
            </th>
            <th className="font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 text-right w-[20%]">
              Venta
            </th>
            <th className="font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 w-[20%]" />
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const pct = Math.round((row.venta / maxVenta) * 100);
            return (
              <tr
                key={row.puntoVenta || `row-${i}`}
                className="border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#FAFAFA] transition-colors duration-150"
              >
                <td className="font-sans text-sm text-[#666666] px-4 py-3 tabular-nums">
                  {i + 1}
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-3 font-medium">
                  {row.puntoVenta || "—"}
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                  {row.qtty.toLocaleString("es-CL")}
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {fmtClp(row.venta)}
                </td>
                <td className="px-4 py-3">
                  <div className="w-full bg-[#F0F0F0] h-2 rounded-full">
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
