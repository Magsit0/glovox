"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { FfbbCategoriaRow } from "@/lib/ffbb/types";

interface Props {
  rows: FfbbCategoriaRow[];
}

interface TooltipPayload {
  value: number;
  payload: FfbbCategoriaRow;
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
      <p className="font-medium">{p.categoria}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatCurrency(p.ventas)}</p>
      <p className="text-xs text-[#666666]">
        {formatNumber(p.unidades)} {p.unidades === 1 ? "unidad" : "unidades"}
        {" · "}
        {p.sharePct.toFixed(1)}%
      </p>
    </div>
  );
}

export default function CategoriaBreakdownFfbb({ rows }: Props) {
  const total = rows.reduce((acc, r) => acc + r.ventas, 0);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Ventas por categoría
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Participación de cada categoría en el total vendido.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">Sin categorías registradas.</p>
      ) : (
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="ventas"
                  nameKey="categoria"
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="92%"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {rows.map((_, i) => (
                    <Cell key={i} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold leading-none text-[#333333]">
                {compactCurrency(total)}
              </span>
              <span className="mt-1 font-sans text-xs text-[#999999]">total</span>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={r.categoria} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seriesColor(i) }}
                />
                <span className="min-w-0 flex-1 truncate font-sans text-sm text-[#333333]">
                  {r.categoria}
                </span>
                <span className="font-sans text-sm tabular-nums text-[#666666]">
                  {r.sharePct.toFixed(1)}%
                </span>
                <span className="w-24 text-right font-sans text-sm tabular-nums text-[#333333]">
                  {compactCurrency(r.ventas)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
