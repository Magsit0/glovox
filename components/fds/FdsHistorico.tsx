"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, legendProps, seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { FdsHistoricoRow } from "@/lib/fds/types";

interface Props {
  rows: FdsHistoricoRow[];
}

interface TooltipPayload {
  payload: FdsHistoricoRow;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">
        {p.nombre} <span className="text-xs text-[#999999]">{p.eventoId}</span>
      </p>
      <p className="mt-1 text-xs text-[#666666]">Tickets: {formatCurrency(p.ventaTickets)}</p>
      <p className="text-xs text-[#666666]">FF&amp;BB: {formatCurrency(p.ventaFfbb)}</p>
      {p.asistentes != null && (
        <p className="text-xs text-[#666666]">Asistentes: {formatNumber(p.asistentes)}</p>
      )}
      {p.perCapitaFfbb != null && (
        <p className="text-xs text-[#666666]">Per cápita FF&amp;BB: {formatCurrency(p.perCapitaFfbb)}</p>
      )}
    </div>
  );
}

export default function FdsHistorico({ rows }: Props) {
  const data = rows.map((r) => ({ ...r, x: r.nombre || r.eventoId }));

  return (
    <div className="flex flex-col gap-6">
      <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Ingresos y asistentes por edición
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Venta de tickets y FF&amp;BB (barras apiladas) y asistentes (línea) a lo largo de las ediciones.
          </p>
        </header>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="x" tickLine={false} axisLine={{ stroke: "#E5E5E5" }} tick={axisTick} />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => compactCurrency(v)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
              <Legend {...legendProps} />
              <Bar yAxisId="left" name="Tickets" dataKey="ventaTickets" stackId="v" fill={seriesColor(0)} radius={[0, 0, 0, 0]} barSize={26} />
              <Bar yAxisId="left" name="FF&BB" dataKey="ventaFfbb" stackId="v" fill={seriesColor(1)} radius={[4, 4, 0, 0]} barSize={26} />
              <Line
                yAxisId="right"
                name="Asistentes"
                type="monotone"
                dataKey="asistentes"
                stroke={seriesColor(2)}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left">
                <th className="px-4 py-3 font-medium text-[#666666]">Edición</th>
                <th className="px-4 py-3 font-medium text-[#666666]">Fecha</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Asistentes</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Venta tickets</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Venta FF&amp;BB</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Per cápita FF&amp;BB</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Facturado</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Margen</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr
                  key={r.eventoId}
                  className="border-b border-[#E5E5E5] transition-colors last:border-0 hover:bg-[#FAFAFA]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[#333333]">
                    <span className="font-medium">{r.nombre}</span>
                    <span className="ml-2 text-xs text-[#999999]">{r.eventoId}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#666666]">
                    {r.fechaEvento
                      ? new Date(r.fechaEvento).toLocaleDateString("es-CL", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                    {r.asistentes ? formatNumber(r.asistentes) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#333333]" title={formatCurrency(r.ventaTickets)}>
                    {compactCurrency(r.ventaTickets)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                    {r.ventaFfbb > 0 ? compactCurrency(r.ventaFfbb) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                    {r.perCapitaFfbb != null ? formatCurrency(r.perCapitaFfbb) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                    {r.facturado != null ? compactCurrency(r.facturado) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: r.margen != null && r.margen < 0 ? "#ED75A0" : "#333333" }}>
                    {r.margen != null ? compactCurrency(r.margen) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
