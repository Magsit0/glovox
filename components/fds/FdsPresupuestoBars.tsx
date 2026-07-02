"use client";

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
import { axisTick, gridProps, legendProps, seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { FdsFinanzasItem } from "@/lib/fds/types";

interface Props {
  rows: FdsFinanzasItem[];
}

interface TooltipPayload {
  payload: FdsFinanzasItem & { shortLabel: string };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const tone = p.diferencia > 0 ? "#ED75A0" : "#B1D750";
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.categoria}</p>
      <p className="mt-1 text-xs text-[#666666]">Presupuestado: {formatCurrency(p.presupuestado)}</p>
      <p className="text-xs text-[#666666]">Real: {formatCurrency(p.real)}</p>
      <p className="text-xs" style={{ color: tone }}>
        {p.diferencia > 0 ? "Sobregasto" : "Ahorro"}: {formatCurrency(Math.abs(p.diferencia))}
      </p>
    </div>
  );
}

export default function FdsPresupuestoBars({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Presupuesto vs. gasto real
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin líneas de presupuesto.</p>
      </article>
    );
  }

  const data = [...rows].reverse().map((r) => ({
    ...r,
    shortLabel: r.categoria.length > 26 ? `${r.categoria.slice(0, 25)}…` : r.categoria,
  }));
  const chartHeight = Math.max(280, data.length * 46 + 40);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Presupuesto vs. gasto real
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Gasto presupuestado y real por categoría del negocio.
        </p>
      </header>
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
            barCategoryGap="24%"
          >
            <CartesianGrid {...gridProps} horizontal={false} vertical={true} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickFormatter={(v) => compactCurrency(v)}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              tick={axisTick}
              width={170}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
            <Legend {...legendProps} />
            <Bar name="Presupuestado" dataKey="presupuestado" fill={seriesColor(4)} radius={[0, 4, 4, 0]} barSize={10} />
            <Bar name="Real" dataKey="real" fill={seriesColor(0)} radius={[0, 4, 4, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
