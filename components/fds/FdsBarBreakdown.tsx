"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

export interface BarRow {
  label: string;
  value: number;
  sub?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  rows: BarRow[];
  colorIndex?: number;
  emptyText?: string;
}

interface TooltipPayload {
  payload: BarRow & { shortLabel: string };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatCurrency(p.value)}</p>
      {p.sub && <p className="text-xs text-[#666666]">{p.sub}</p>}
    </div>
  );
}

export default function FdsBarBreakdown({
  title,
  subtitle,
  rows,
  colorIndex = 0,
  emptyText = "Sin datos registrados.",
}: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">{title}</h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">{emptyText}</p>
      </article>
    );
  }

  const data = [...rows].reverse().map((r) => ({
    ...r,
    shortLabel: r.label.length > 30 ? `${r.label.slice(0, 29)}…` : r.label,
  }));
  const chartHeight = Math.max(240, data.length * 34 + 40);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">{title}</h2>
        {subtitle && <p className="mt-1 font-sans text-sm text-[#666666]">{subtitle}</p>}
      </header>
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }}>
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
              width={190}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
            <Bar dataKey="value" fill={seriesColor(colorIndex)} radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
