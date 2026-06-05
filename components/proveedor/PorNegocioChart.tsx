"use client";

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
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import type { NegocioBreakdownRow } from "@/lib/queries/proveedor";
import {
  compactCurrency,
  formatCurrency,
  formatNumber,
} from "@/components/proveedor/format";

interface Props {
  rows: NegocioBreakdownRow[];
}

const TOP = 12;

function truncate(text: string, max = 28): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: NegocioBreakdownRow & { _label: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="max-w-[280px] rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.nombre || `Negocio ${p.negocioId}`}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(0) }}
        />
        {formatCurrency(p.gasto)}
      </p>
      <p className="text-xs text-[#666666]">{formatNumber(p.docs)} documentos</p>
    </div>
  );
}

export default function PorNegocioChart({ rows }: Props) {
  const data = rows.slice(0, TOP).map((r) => ({
    ...r,
    _label: truncate(r.nombre || `Negocio ${r.negocioId}`),
  }));

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Gasto por negocio
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          {rows.length > TOP
            ? `Top ${TOP} negocios por gasto (de ${formatNumber(rows.length)}).`
            : "Negocios donde se imputó gasto de este proveedor."}
        </p>
      </header>

      {data.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div style={{ height: Math.max(220, data.length * 38) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              barCategoryGap="30%"
            >
              <CartesianGrid {...gridProps} horizontal={false} vertical />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v: number) => compactCurrency(v)}
              />
              <YAxis
                type="category"
                dataKey="_label"
                width={170}
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                tick={axisTick}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#FAFAFA" }} />
              <Bar dataKey="gasto" radius={[0, 4, 4, 0]} animationDuration={400}>
                {data.map((_, i) => (
                  <Cell key={i} fill={seriesColor(0)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
