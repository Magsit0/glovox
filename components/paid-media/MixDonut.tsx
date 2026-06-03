"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/chart-colors";
import type { BreakdownRow } from "@/lib/queries/paidMedia";
import {
  compactMoney,
  formatInt,
  formatMoney,
  formatRatio,
  plataformaLabel,
} from "@/components/paid-media/format";

interface Props {
  title: string;
  subtitle: string;
  rows: BreakdownRow[];
  currency: string;
  /** Si true, formatea las etiquetas (meta/google) bonito. */
  labelIsPlataforma?: boolean;
  /** Texto cuando no hay datos. */
  emptyText?: string;
}

interface TooltipEntry {
  payload: BreakdownRow & { _label: string };
}

function ChartTooltip({
  active,
  payload,
  currency,
  totalGasto,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  currency: string;
  totalGasto: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pct = totalGasto > 0 ? (p.gasto / totalGasto) * 100 : 0;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p._label}</p>
      <p className="mt-1 text-xs text-[#666666]">
        {formatMoney(p.gasto, currency)} · {pct.toFixed(1)}%
      </p>
      <p className="text-xs text-[#666666]">{formatInt(p.clics)} clics</p>
      <p className="text-xs text-[#666666]">CTR {formatRatio(p.ctr)}</p>
    </div>
  );
}

export default function MixDonut({
  title,
  subtitle,
  rows,
  currency,
  labelIsPlataforma = false,
  emptyText = "Sin datos para los filtros seleccionados.",
}: Props) {
  // Cap visual: 6 slices + "Otros". El donut no necesita más para leerse.
  const annotated = rows.map((r) => ({
    ...r,
    _label: labelIsPlataforma ? plataformaLabel(r.label) : r.label || r.key,
  }));
  const top = annotated.slice(0, 6);
  const restRows = annotated.slice(6);
  const slices = restRows.length
    ? [
        ...top,
        restRows.reduce(
          (acc, r) => ({
            ...acc,
            gasto: acc.gasto + r.gasto,
            impresiones: acc.impresiones + r.impresiones,
            clics: acc.clics + r.clics,
            conversiones: acc.conversiones + r.conversiones,
          }),
          {
            key: "__rest__",
            label: "Otros",
            _label: `Otros (${restRows.length})`,
            extra: undefined,
            gasto: 0,
            impresiones: 0,
            clics: 0,
            conversiones: 0,
            valorConversion: 0,
            ctr: 0,
            cpc: 0,
            cpm: 0,
            roas: 0,
          },
        ),
      ]
    : top;

  const totalGasto = slices.reduce((a, r) => a + r.gasto, 0);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          {title}
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">{subtitle}</p>
      </header>

      {slices.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">{emptyText}</p>
      ) : (
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative h-48 w-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="gasto"
                  nameKey="_label"
                  innerRadius="60%"
                  outerRadius="100%"
                  stroke="none"
                  animationDuration={400}
                >
                  {slices.map((r, i) => (
                    <Cell key={r.key} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip currency={currency} totalGasto={totalGasto} />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold leading-none text-[#333333]">
                {compactMoney(totalGasto, currency)}
              </span>
              <span className="mt-1 font-sans text-xs text-[#999999]">gasto</span>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-left text-[#666666]">
                  <th className="py-2 pr-4 text-xs font-medium uppercase tracking-wide">
                    Segmento
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
                        <span className="truncate" title={r._label}>
                          {r._label}
                        </span>
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[#333333]">
                      {compactMoney(r.gasto, currency)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-[#666666]">
                      {totalGasto > 0
                        ? `${((r.gasto / totalGasto) * 100).toFixed(1)}%`
                        : "—"}
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
