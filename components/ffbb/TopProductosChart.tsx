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
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { FfbbProductoRow } from "@/lib/ffbb/types";

interface Props {
  rows: FfbbProductoRow[];
}

interface TooltipPayload {
  value: number;
  payload: FfbbProductoRow & { label: string };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.producto}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatCurrency(p.ventas)}</p>
      <p className="text-xs text-[#666666]">
        {formatNumber(p.unidades)} {p.unidades === 1 ? "unidad" : "unidades"}
      </p>
    </div>
  );
}

export default function TopProductosChart({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Top productos
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin ventas registradas.</p>
      </article>
    );
  }

  const data = [...rows].reverse().map((r) => ({
    ...r,
    label: r.producto.length > 28 ? `${r.producto.slice(0, 27)}…` : r.producto,
  }));

  const chartHeight = Math.max(280, data.length * 32 + 40);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Top productos
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Ranking por venta total, con unidades vendidas.
        </p>
      </header>
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
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
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              tick={axisTick}
              width={180}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
            <Bar
              dataKey="ventas"
              fill={seriesColor(0)}
              radius={[0, 4, 4, 0]}
              barSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
