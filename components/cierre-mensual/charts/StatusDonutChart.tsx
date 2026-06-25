"use client";

import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Inbox } from "lucide-react";
import { useFilters } from "@/components/unabase/context/DashboardContext";
import { BrutalTooltip } from "@/components/unabase/charts/ChartTooltip";
import { legendProps, seriesColor } from "@/lib/chart-colors";
import { formatNumber } from "@/lib/unabase/formatting";

export default function StatusDonutChart() {
  const { filteredRows } = useFilters();

  const data = useMemo(() => {
    const counts = filteredRows.reduce<Record<string, number>>((acc, r) => {
      acc[r.estado] = (acc[r.estado] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={1}
            stroke="none"
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <BrutalTooltip
                active={active}
                items={(payload ?? []).map((p) => ({
                  name: String(p.name),
                  color: p.payload?.fill,
                  formatted: `${formatNumber(Number(p.value))} negocios`,
                }))}
              />
            )}
          />
          <Legend {...legendProps} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-6">
        <span className="font-display text-3xl font-extrabold leading-none tracking-tight text-[#333333]">
          {formatNumber(total)}
        </span>
        <span className="mt-1 font-sans text-xs text-[#666666]">negocios</span>
      </div>
    </div>
  );
}
