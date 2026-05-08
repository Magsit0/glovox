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
import type { ProveedorBreakdown } from "@/lib/unabase/cierreNegocio";

interface Props {
  rows: ProveedorBreakdown[];
}

interface TooltipPayload {
  value: number;
  payload: ProveedorBreakdown;
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
      <p className="font-medium">{p.proveedor}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatCurrency(p.totalGasto)}</p>
      <p className="text-xs text-[#666666]">
        {formatNumber(p.nFacturas)} {p.nFacturas === 1 ? "documento" : "documentos"}
      </p>
    </div>
  );
}

export default function TopProveedoresChart({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Top proveedores
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin gastos registrados.</p>
      </article>
    );
  }

  const data = [...rows].reverse().map((r) => ({
    ...r,
    label: r.proveedor.length > 28 ? `${r.proveedor.slice(0, 27)}…` : r.proveedor,
  }));

  // Altura dinámica: ~40px por proveedor + padding
  const chartHeight = Math.max(280, data.length * 40 + 40);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Top proveedores
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Ranking por gasto real con número de documentos.
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
              dataKey="totalGasto"
              fill={seriesColor(0)}
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
