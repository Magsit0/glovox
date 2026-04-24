"use client";

import { useMemo } from "react";
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
import { Inbox } from "lucide-react";
import { useFilters } from "@/components/unabase/context/DashboardContext";
import { BrutalTooltip } from "@/components/unabase/charts/ChartTooltip";
import { axisTick, BRAND, gridProps, legendProps, SURFACE } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

function parseDateToYM(dateStr: string): string | null {
  if (!dateStr || dateStr === "Sin dato") return null;
  if (/^\d{4}-\d{2}/.test(dateStr)) return dateStr.slice(0, 7);
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [, m, y] = dateStr.split("-");
    return `${y}-${m}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function MonthlyEvolutionChart() {
  const { filteredRows } = useFilters();

  const data = useMemo(() => {
    const map = new Map<string, { ingreso: number; gasto: number; presupuesto: number }>();
    filteredRows.forEach((r) => {
      const ym = parseDateToYM(r.fechaAsignacion);
      if (!ym) return;
      const curr = map.get(ym) ?? { ingreso: 0, gasto: 0, presupuesto: 0 };
      curr.ingreso += r.ingreso;
      curr.gasto += r.gasto;
      curr.presupuesto += r.presupuesto;
      map.set(ym, curr);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => {
        const [y, mo] = ym.split("-");
        return { label: `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y.slice(2)}`, ...v };
      });
  }, [filteredRows]);

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos mensuales
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart
        data={data}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => compactCurrency(v)}
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
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="gasto"
          name="Gasto"
          fill={BRAND.pink}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
        <Line
          type="monotone"
          dataKey="presupuesto"
          name="Presupuesto"
          stroke={BRAND.purple}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
