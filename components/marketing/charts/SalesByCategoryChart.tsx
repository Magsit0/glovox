"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CategorySalesRow } from "@/lib/queries/marketing";

const COLORS = ["#FF0000", "#0000FF", "#000000", "#FFFF00"];

type Props = {
  data: CategorySalesRow[];
};

export default function SalesByCategoryChart({ data }: Props) {
  const { pivoted, categories } = useMemo(() => {
    const cats = [...new Set(data.map((r) => r.category))];
    const byDate = new Map<string, Record<string, number>>();
    for (const r of data) {
      if (!byDate.has(r.date)) byDate.set(r.date, { date: 0 } as unknown as Record<string, number>);
      const entry = byDate.get(r.date)!;
      (entry as Record<string, unknown>).date = r.date;
      entry[r.category] = r.tickets;
    }
    return { pivoted: [...byDate.values()], categories: cats };
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={pivoted}>
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          tickFormatter={(v: string) => v.slice(5)}
          stroke="#000"
        />
        <YAxis
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
        <Legend
          wrapperStyle={{
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 11,
            textTransform: "uppercase",
          }}
        />
        {categories.map((cat, i) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={COLORS[i % COLORS.length]}
            stroke={cat === "FFFF00" ? "#000" : undefined}
            strokeWidth={cat === "FFFF00" ? 1 : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
