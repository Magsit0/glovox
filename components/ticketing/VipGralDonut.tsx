"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/chart-colors";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { TicketingVipGralRow } from "@/lib/queries/ticketing";

interface Props {
  rows: TicketingVipGralRow[];
}

interface TooltipEntry {
  payload: TicketingVipGralRow;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.vipGral}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatCurrency(p.venta)}</p>
      <p className="text-xs text-[#666666]">{formatNumber(p.qtty)} tickets</p>
    </div>
  );
}

export default function VipGralDonut({ rows }: Props) {
  const totalVenta = rows.reduce((a, r) => a + r.venta, 0);
  const totalQtty = rows.reduce((a, r) => a + r.qtty, 0);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          VIP vs General
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Mezcla del producto entre acceso VIP y general.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">
          Sin tickets para los filtros seleccionados.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative h-48 w-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="venta"
                  nameKey="vipGral"
                  innerRadius="60%"
                  outerRadius="100%"
                  stroke="none"
                  animationDuration={400}
                >
                  {rows.map((r, i) => (
                    <Cell key={r.vipGral} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold leading-none text-[#333333]">
                {formatNumber(totalQtty)}
              </span>
              <span className="mt-1 font-sans text-xs text-[#999999]">tickets</span>
            </div>
          </div>

          <div className="flex-1">
            <table className="w-full border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-left text-[#666666]">
                  <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide">
                    Acceso
                  </th>
                  <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide">
                    Tickets
                  </th>
                  <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide">
                    Venta
                  </th>
                  <th className="py-2 text-right text-xs font-medium uppercase tracking-wide">
                    % Venta
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.vipGral}
                    className="border-b border-[#F0F0F0] last:border-b-0"
                  >
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-2 text-[#333333]">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: seriesColor(i) }}
                        />
                        {r.vipGral}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[#333333]">
                      {formatNumber(r.qtty)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[#333333]">
                      {formatCurrency(r.venta)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#666666]">
                      {totalVenta > 0
                        ? `${((r.venta / totalVenta) * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}
