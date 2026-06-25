"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox } from "lucide-react";
import { useFilters } from "@/components/cierre-mensual/context/DashboardContext";
import { BrutalTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import { axisTick, BRAND, gridProps, legendProps, SURFACE } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import { sortRowsByFechaAsc } from "@/lib/unabase/dates";

export default function BusinessResultChart() {
  const { filteredRows } = useFilters();

  const data = useMemo(
    () =>
      sortRowsByFechaAsc(filteredRows).map((r) => ({
        label: r.EventoID,
        ingreso: r.ingreso,
        gasto: r.gasto,
        margen: r.margen,
      })),
    [filteredRows],
  );

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin negocios visibles
      </div>
    );
  }

  const height = Math.max(360, Math.min(780, data.length * 28 + 80));

  return (
    <ResponsiveContainer width="100%" height={height}>
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
          width={140}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: SURFACE.canvas }}
          content={({ active, label, payload }) => (
            <BrutalTooltip
              active={active}
              label={label}
              items={(payload ?? []).map((p) => ({
                name: String(p.name),
                color: String(p.color),
                formatted: formatCurrency(Number(p.value)),
              }))}
            />
          )}
        />
        <Legend {...legendProps} />
        <Bar
          dataKey="ingreso"
          name="Ingreso"
          fill={BRAND.green}
          radius={[0, 4, 4, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="gasto"
          name="Gasto"
          fill={BRAND.pink}
          radius={[0, 4, 4, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="margen"
          name="Margen"
          fill={BRAND.purple}
          radius={[0, 4, 4, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
