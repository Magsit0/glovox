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
import {
  axisTick,
  gridProps,
  legendProps,
  seriesColor,
} from "@/lib/chart-colors";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { TicketingEvolucionRow } from "@/lib/queries/ticketing";

interface Props {
  rows: TicketingEvolucionRow[];
}

interface TooltipEntry {
  payload: ChartDatum;
}

type ChartDatum = {
  label: string;
  nombre: string;
  fechaEvento: string;
  qtty: number;
  ticketPromedio: number;
};

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
      <p className="font-medium">{p.nombre}</p>
      <p className="text-xs text-[#999999]">{p.fechaEvento}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(0) }}
        />
        {formatNumber(p.qtty)} tickets
      </p>
      <p className="flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(2) }}
        />
        {formatCurrency(p.ticketPromedio)} ticket promedio
      </p>
    </div>
  );
}

export default function EvolucionChart({ rows }: Props) {
  const data: ChartDatum[] = rows.map((r) => ({
    label: r.nombre || r.eventoId,
    nombre: r.nombre || r.eventoId,
    fechaEvento: r.fechaEvento,
    qtty: r.qtty,
    ticketPromedio: r.qtty > 0 ? r.venta / r.qtty : 0,
  }));

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Evolución entre eventos
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Cantidad de tickets y ticket promedio por evento, en orden cronológico.
        </p>
      </header>
      {data.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">
          Sin tickets para los filtros seleccionados.
        </p>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                tick={axisTick}
                interval="preserveStartEnd"
                tickFormatter={(v: string) =>
                  v.length > 14 ? `${v.slice(0, 13)}…` : v
                }
              />
              <YAxis
                yAxisId="qtty"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                yAxisId="precio"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => compactCurrency(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
              <Legend {...legendProps} />
              <Bar
                yAxisId="qtty"
                name="Tickets"
                dataKey="qtty"
                fill={seriesColor(0)}
                radius={[4, 4, 0, 0]}
                barSize={28}
                animationDuration={400}
              />
              <Line
                yAxisId="precio"
                name="Ticket promedio"
                type="monotone"
                dataKey="ticketPromedio"
                stroke={seriesColor(2)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={400}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
