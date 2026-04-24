"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyRow } from "@/lib/queries/comunidad";

function fmClp(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

export default function MonthlyEvolutionChart({ data }: { data: MonthlyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="revenue"
          tickFormatter={fmClp}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontWeight: 600 }}
          itemStyle={{ color: "#a1a1aa" }}
          formatter={(value, name) => {
            const v = Number(value);
            if (name === "Revenue") return [fmClp(v), name as string];
            return [v.toLocaleString("es-CL"), name as string];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
        />
        <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="#6366f1" radius={[3, 3, 0, 0]} />
        <Line yAxisId="count" dataKey="tickets" name="Tickets" stroke="#f59e0b" dot={false} strokeWidth={2} />
        <Line yAxisId="count" dataKey="referrers" name="Referrers" stroke="#10b981" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
