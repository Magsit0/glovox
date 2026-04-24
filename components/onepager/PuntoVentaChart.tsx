"use client";

import type { OnepagerPuntoVentaRow } from "@/lib/queries/onepager";

type Props = {
  data: OnepagerPuntoVentaRow[];
  color?: string;
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

export default function PuntoVentaChart({ data, color = "#FF0000" }: Props) {
  const maxVenta = Math.max(...data.map((d) => d.venta), 1);

  return (
    <div className="max-h-[480px] overflow-y-auto border-4 border-black">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="bg-black text-white">
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-left w-[8%]">
              #
            </th>
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-left w-[32%]">
              Punto de Venta
            </th>
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-right w-[20%]">
              Qtty
            </th>
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-right w-[20%]">
              Venta
            </th>
            <th className="font-mono-data uppercase text-xs px-4 py-3 w-[20%]" />
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const pct = Math.round((row.venta / maxVenta) * 100);
            return (
              <tr
                key={row.puntoVenta || `row-${i}`}
                className="border-b-2 border-black last:border-b-0 hover:bg-[#FFFF00] transition-colors duration-150"
              >
                <td className="font-mono-data text-xs px-4 py-2 font-bold">
                  {i + 1}
                </td>
                <td className="font-mono-data text-xs px-4 py-2 font-bold">
                  {row.puntoVenta || "—"}
                </td>
                <td className="font-mono-data text-xs px-4 py-2 text-right">
                  {row.qtty.toLocaleString("es-CL")}
                </td>
                <td className="font-mono-data text-xs px-4 py-2 text-right whitespace-nowrap">
                  {fmtClp(row.venta)}
                </td>
                <td className="px-4 py-2">
                  <div className="w-full bg-black/10 h-3 border border-black">
                    <div
                      className="h-full"
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
