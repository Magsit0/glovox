"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyActivationRow } from "@/lib/queries/comunidad";

export default function NewSellersChart({ data }: { data: MonthlyActivationRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="newSellersGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontWeight: 600 }}
          itemStyle={{ color: "#a1a1aa" }}
          formatter={(v) => [v, "New sellers"]}
        />
        <Area
          type="monotone"
          dataKey="new_sellers"
          name="New sellers"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#newSellersGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
