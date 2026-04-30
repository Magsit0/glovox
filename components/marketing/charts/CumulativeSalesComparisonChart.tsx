"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { CumulativeSalesRelativeRow } from "@/lib/queries/marketing";

type EventInfo = {
  eventoId: string;
  nombre: string;
};

type Props = {
  series: CumulativeSalesRelativeRow[];
  mainEventoId: string;
  events: EventInfo[];
  goalTickets?: number;
  saleStartDaysToEvent?: number;
};

// Brutalist secondary palette cycled across comparators.
// Main event uses red (#FF0000); bars use blue (#0000FF).
const COMPARE_COLORS = [
  "#00AA00",
  "#FF00FF",
  "#FF8800",
  "#8800FF",
  "#00AAAA",
  "#AA0000",
];

type ChartRow = {
  daysToEvent: number;
  dailyMain: number | null;
  target?: number | null;
} & Record<`cum_${string}`, number | null>;

export default function CumulativeSalesComparisonChart({
  series,
  mainEventoId,
  events,
  goalTickets,
  saleStartDaysToEvent,
}: Props) {
  const { chartData, eventOrder, labelByEventoId } = useMemo(() => {
    const labelByEventoId = new Map<string, string>();
    for (const ev of events) {
      labelByEventoId.set(ev.eventoId, `${ev.eventoId} — ${ev.nombre}`);
    }

    const eventIdsInData = new Set(series.map((r) => r.eventoId));
    const orderedComparators = events
      .map((e) => e.eventoId)
      .filter((id) => id !== mainEventoId && eventIdsInData.has(id));
    const eventOrder = [mainEventoId, ...orderedComparators];

    const byDay = new Map<number, ChartRow>();
    for (const row of series) {
      let bucket = byDay.get(row.daysToEvent);
      if (!bucket) {
        bucket = { daysToEvent: row.daysToEvent, dailyMain: null } as ChartRow;
        byDay.set(row.daysToEvent, bucket);
      }
      const cumKey = `cum_${row.eventoId}` as `cum_${string}`;
      bucket[cumKey] = row.cumulativeTickets;
      if (row.eventoId === mainEventoId) {
        bucket.dailyMain = row.dailyTickets;
      }
    }

    const hasTarget =
      saleStartDaysToEvent != null &&
      saleStartDaysToEvent > 0 &&
      goalTickets != null &&
      goalTickets > 0;

    if (hasTarget) {
      for (const d of [saleStartDaysToEvent, 0]) {
        if (!byDay.has(d)) {
          byDay.set(d, { daysToEvent: d, dailyMain: null } as ChartRow);
        }
      }
      for (const bucket of byDay.values()) {
        const d = bucket.daysToEvent;
        if (d > saleStartDaysToEvent || d < 0) {
          bucket.target = null;
        } else {
          bucket.target =
            (goalTickets * (saleStartDaysToEvent - d)) / saleStartDaysToEvent;
        }
      }
    }

    const chartData = Array.from(byDay.values()).sort(
      (a, b) => b.daysToEvent - a.daysToEvent,
    );

    return { chartData, eventOrder, labelByEventoId };
  }, [series, mainEventoId, events, saleStartDaysToEvent, goalTickets]);

  if (chartData.length === 0) {
    return (
      <p className="font-mono-data text-sm text-black/50">
        Sin datos de venta para los eventos seleccionados.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart
        data={chartData}
        margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
      >
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="daysToEvent"
          type="number"
          reversed
          domain={["dataMin", "dataMax"]}
          allowDecimals={false}
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          tickFormatter={(v: number) => String(v)}
          stroke="#000"
        />
        <YAxis
          yAxisId="cumulative"
          orientation="left"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
        />
        <YAxis
          yAxisId="daily"
          orientation="right"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "4px solid #000",
            borderRadius: 0,
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 12,
          }}
          labelFormatter={(label) => {
            const v = Number(label);
            if (!Number.isFinite(v)) return String(label);
            if (v === 0) return "Día del evento";
            if (v > 0) return `${v} días antes`;
            return `${-v} días después`;
          }}
        />
        <Legend
          wrapperStyle={{
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 11,
            paddingTop: 8,
          }}
        />
        <Bar
          yAxisId="daily"
          dataKey="dailyMain"
          fill="#0000FF"
          name="Tickets / día (principal)"
          opacity={0.4}
        />
        {eventOrder.map((id, idx) => {
          const isMain = id === mainEventoId;
          const stroke = isMain
            ? "#FF0000"
            : COMPARE_COLORS[(idx - 1) % COMPARE_COLORS.length];
          return (
            <Area
              key={id}
              yAxisId="cumulative"
              type="monotone"
              dataKey={`cum_${id}`}
              stroke={stroke}
              strokeWidth={isMain ? 3 : 2}
              fill="none"
              name={labelByEventoId.get(id) ?? id}
              connectNulls
              dot={false}
              isAnimationActive={false}
            />
          );
        })}
        {saleStartDaysToEvent != null &&
          saleStartDaysToEvent > 0 &&
          goalTickets != null &&
          goalTickets > 0 && (
            <Line
              yAxisId="cumulative"
              type="linear"
              dataKey="target"
              stroke="#000"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              name="Objetivo lineal"
              isAnimationActive={false}
              connectNulls
            />
          )}
<ReferenceLine
          yAxisId="cumulative"
          x={0}
          stroke="#FF0000"
          strokeWidth={2}
          label={{
            value: "Día del evento",
            position: "top",
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 11,
            fill: "#FF0000",
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
