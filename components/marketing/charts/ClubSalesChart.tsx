"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { ClubSalesRow } from "@/lib/queries/marketing";

type Props = {
  data: ClubSalesRow[];
};

export default function ClubSalesChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data}>
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
          dataKey="tickets"
          fill="#FFFF00"
          stroke="#000"
          strokeWidth={1}
          name="Tickets / día"
        />
        <Area
          yAxisId="cumulative"
          type="monotone"
          dataKey="cumulativeTickets"
          stroke="#FF0000"
          strokeWidth={3}
          fill="#FF0000"
          fillOpacity={0.08}
          name="Acumulado"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
