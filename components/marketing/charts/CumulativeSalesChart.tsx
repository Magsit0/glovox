"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { CumulativeSalesRow } from "@/lib/queries/marketing";

type Props = {
  data: CumulativeSalesRow[];
  goalTickets?: number;
  fechaEvento?: string;
};

type ChartRow = {
  date: string;
  dailyTickets: number | null;
  cumulativeTickets: number | null;
};

export default function CumulativeSalesChart({ data, goalTickets, fechaEvento }: Props) {
  const chartData: ChartRow[] = useMemo(() => {
    const rows: ChartRow[] = data.map((r) => ({
      date: r.date,
      dailyTickets: r.dailyTickets,
      cumulativeTickets: r.cumulativeTickets,
    }));

    if (!fechaEvento || data.length === 0) return rows;

    const lastDate = data[data.length - 1].date;
    if (lastDate >= fechaEvento) return rows;

    const current = new Date(lastDate);
    current.setDate(current.getDate() + 1);
    const end = new Date(fechaEvento);

    while (current <= end) {
      rows.push({
        date: current.toISOString().slice(0, 10),
        dailyTickets: null,
        cumulativeTickets: null,
      });
      current.setDate(current.getDate() + 1);
    }

    return rows;
  }, [data, fechaEvento]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData}>
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          tickFormatter={(v: string) => v.slice(5)}
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
        />
        <Bar
          yAxisId="daily"
          dataKey="dailyTickets"
          fill="#0000FF"
          name="Tickets / día"
          opacity={0.4}
        />
        <Area
          yAxisId="cumulative"
          type="monotone"
          dataKey="cumulativeTickets"
          stroke="#FF0000"
          strokeWidth={3}
          fill="none"
          name="Acumulado"
          connectNulls={false}
        />
        {goalTickets != null && goalTickets > 0 && (
          <ReferenceLine
            yAxisId="cumulative"
            y={goalTickets}
            stroke="#000"
            strokeDasharray="8 4"
            strokeWidth={2}
            label={{
              value: `Meta: ${goalTickets.toLocaleString("es-CL")}`,
              position: "insideTopRight",
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 11,
              fill: "#000",
            }}
          />
        )}
        {fechaEvento && (
          <ReferenceLine
            yAxisId="cumulative"
            x={fechaEvento}
            stroke="#FF0000"
            strokeWidth={2}
            label={{
              value: "Evento",
              position: "insideTopLeft",
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 11,
              fill: "#FF0000",
            }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
