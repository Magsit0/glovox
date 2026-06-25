"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox } from "lucide-react";
import { useFilters } from "@/components/cierre-mensual/context/DashboardContext";
import { BrutalTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import { axisTick, gridProps, seriesColor, SURFACE } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

export default function CategoryExpenseChart() {
  const { filteredRows } = useFilters();

  const data = useMemo(() => {
    const map: Record<string, number> = {};
    filteredRows.forEach((row) => {
      Object.entries(row.categoriasGasto).forEach(([cat, value]) => {
        map[cat] = (map[cat] || 0) + value;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, gasto]) => ({ label, gasto }));
  }, [filteredRows]);

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin categorías de gasto
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(320, data.length * 38 + 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis
          type="number"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
          tickFormatter={(v: number) => compactCurrency(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
          width={180}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: SURFACE.canvas }}
          content={({ active, label, payload }) => (
            <BrutalTooltip
              active={active}
              label={label}
              items={(payload ?? []).map((p) => ({
                name: "Gasto",
                color: String(p.payload?.fill ?? p.color),
                formatted: formatCurrency(Number(p.value)),
              }))}
            />
          )}
        />
        <Bar
          dataKey="gasto"
          radius={[0, 4, 4, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
