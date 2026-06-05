"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/chart-colors";
import type { CategoriaBreakdownRow } from "@/lib/queries/proveedor";
import { compactCurrency, formatCurrency } from "@/components/proveedor/format";

interface Props {
  rows: CategoriaBreakdownRow[];
}

type Slice = {
  key: string;
  label: string;
  gasto: number;
};

function ChartTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: Slice }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pct = total > 0 ? (p.gasto / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="mt-1 text-xs text-[#666666]">
        {formatCurrency(p.gasto)} · {pct.toFixed(1)}%
      </p>
    </div>
  );
}

export default function CategoriaDonut({ rows }: Props) {
  // 6 slices + "Otras": el donut no se lee con más.
  const top = rows.slice(0, 6).map((r) => ({
    key: r.categoria,
    label: r.categoria,
    gasto: r.gasto,
  }));
  const rest = rows.slice(6);
  const slices: Slice[] = rest.length
    ? [
        ...top,
        {
          key: "__rest__",
          label: `Otras (${rest.length})`,
          gasto: rest.reduce((a, r) => a + r.gasto, 0),
        },
      ]
    : top;

  const total = slices.reduce((a, r) => a + r.gasto, 0);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Gasto por categoría
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Distribución del gasto entre categorías de ítem.
        </p>
      </header>

      {slices.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative h-48 w-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="gasto"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="100%"
                  stroke="none"
                  animationDuration={400}
                >
                  {slices.map((r, i) => (
                    <Cell key={r.key} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold leading-none text-[#333333]">
                {compactCurrency(total)}
              </span>
              <span className="mt-1 font-sans text-xs text-[#999999]">gasto</span>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-left text-[#666666]">
                  <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide">
                    Categoría
                  </th>
                  <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide">
                    Gasto
                  </th>
                  <th className="py-2 text-right text-xs font-medium uppercase tracking-wide">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {slices.map((r, i) => (
                  <tr
                    key={r.key}
                    className="border-b border-[#F0F0F0] last:border-b-0"
                  >
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-2 text-[#333333]">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: seriesColor(i) }}
                        />
                        <span className="truncate" title={r.label}>
                          {r.label}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[#333333]">
                      {compactCurrency(r.gasto)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#666666]">
                      {total > 0 ? `${((r.gasto / total) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}
