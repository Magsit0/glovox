import { fmtDate, fmtNumber, fmtPen, fmtPct } from "@/lib/peru-format";
import type { PeruEventRow } from "@/lib/queries/peru";

export default function EventsTable({ data }: { data: PeruEventRow[] }) {
  const headers = [
    "Evento",
    "Fecha",
    "Ventas",
    "Cortesías",
    "Mix venta",
    "Revenue",
    "Precio prom.",
  ];

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
      <div className="overflow-auto max-h-[480px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
              {headers.map((h) => (
                <th
                  key={h}
                  className="font-sans text-xs font-medium text-[#666666] px-4 py-3 text-left whitespace-nowrap sticky top-0 z-10 bg-[#FAFAFA]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const total = row.ventas + row.cortesias;
              const mixPct = total > 0 ? (row.ventas / total) * 100 : 0;
              return (
                <tr
                  key={row.eventoId}
                  className={`border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150 ${i === data.length - 1 ? "border-b-0" : ""}`}
                >
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 font-medium">
                    {row.nombre}
                  </td>
                  <td className="font-sans text-sm text-[#666666] px-4 py-3 whitespace-nowrap">
                    {fmtDate(row.fechaEvento)}
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                    {fmtNumber(row.ventas)}
                  </td>
                  <td className="font-sans text-sm text-[#666666] px-4 py-3 text-right tabular-nums">
                    {fmtNumber(row.cortesias)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#9F99F8]"
                          style={{ width: `${mixPct}%` }}
                        />
                      </div>
                      <span className="font-sans text-xs text-[#666666] tabular-nums w-10 text-right">
                        {fmtPct(mixPct, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                    {fmtPen(row.revenue, 0)}
                  </td>
                  <td className="font-sans text-sm text-[#666666] px-4 py-3 text-right tabular-nums">
                    {row.avgPrice > 0 ? fmtPen(row.avgPrice, 2) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
