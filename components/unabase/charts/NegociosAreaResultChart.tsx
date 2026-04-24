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
import { BrutalTooltip } from "@/components/unabase/charts/ChartTooltip";
import { axisTick, BRAND, gridProps, legendProps, SURFACE } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { NegocioRow } from "@/lib/unabase/types";

interface Props {
  rows: NegocioRow[];
}

export default function NegociosAreaResultChart({ rows }: Props) {
  const data = useMemo(() => {
    const map = new Map<string, { area: string; ingreso: number; gasto: number; margen: number }>();
    rows.forEach((row) => {
      const area = row.area_negocio || "Sin área";
      const ingreso = parseFloat(row.total_neto) || 0;
      const gasto = parseFloat(row.costo_real) || 0;
      const curr = map.get(area) ?? { area, ingreso: 0, gasto: 0, margen: 0 };
      curr.ingreso += ingreso;
      curr.gasto += gasto;
      curr.margen += ingreso - gasto;
      map.set(area, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.ingreso - a.ingreso);
  }, [rows]);

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }} barCategoryGap="30%">
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="area"
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
          name="Ingreso (total neto)"
          fill={BRAND.green}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="gasto"
          name="Gasto (costo real)"
          fill={BRAND.pink}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
        <Bar
          dataKey="margen"
          name="Margen"
          fill={BRAND.purple}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
