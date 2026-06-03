"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisTick,
  gridProps,
  legendProps,
  seriesColor,
  seriesFillSoft,
} from "@/lib/chart-colors";
import {
  compactInt,
  compactMoney,
  formatDate,
  formatInt,
  formatMoney,
  formatRatio,
} from "@/components/paid-media/format";
import type { DailyRow } from "@/lib/queries/paidMedia";

interface Props {
  rows: DailyRow[];
  currency: string;
}

type Metric = "gasto" | "impresiones" | "clics" | "conversiones";

const METRICS: { id: Metric; label: string }[] = [
  { id: "gasto", label: "Gasto" },
  { id: "impresiones", label: "Impresiones" },
  { id: "clics", label: "Clics" },
  { id: "conversiones", label: "Conversiones" },
];

interface TooltipEntry {
  payload: ChartDatum;
}

type ChartDatum = {
  fecha: string;
  fechaLabel: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  ctr: number;
};

function ChartTooltip({
  active,
  payload,
  metric,
  currency,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  metric: Metric;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  const mainLabel = METRICS.find((m) => m.id === metric)?.label ?? metric;
  const mainValue =
    metric === "gasto"
      ? formatMoney(p.gasto, currency)
      : metric === "impresiones"
        ? formatInt(p.impresiones)
        : metric === "clics"
          ? formatInt(p.clics)
          : formatInt(p.conversiones);

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.fechaLabel}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(0) }}
        />
        {mainValue} {mainLabel.toLowerCase()}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(2) }}
        />
        {formatRatio(p.ctr)} CTR
      </p>
    </div>
  );
}

export default function EvolucionChart({ rows, currency }: Props) {
  const [metric, setMetric] = useState<Metric>("gasto");

  const data: ChartDatum[] = useMemo(
    () =>
      rows.map((r) => ({
        fecha: r.fecha,
        fechaLabel: formatDate(r.fecha),
        gasto: r.gasto,
        impresiones: r.impresiones,
        clics: r.clics,
        conversiones: r.conversiones,
        ctr: r.impresiones > 0 ? r.clics / r.impresiones : 0,
      })),
    [rows],
  );

  const mainColor = seriesColor(0);
  const ctrColor = seriesColor(2);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Evolución diaria
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Serie diaria del KPI seleccionado y CTR como referencia.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1">
          {METRICS.map((m) => {
            const isActive = metric === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#F0EFFE] text-[#9F99F8]"
                    : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </header>

      {data.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            >
              <defs>
                <linearGradient id="paid-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={mainColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={mainColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="fecha"
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                tick={axisTick}
                interval="preserveStartEnd"
                minTickGap={32}
                tickFormatter={(v: string) => {
                  const d = new Date(`${v}T00:00:00`);
                  if (Number.isNaN(d.getTime())) return v;
                  return d.toLocaleDateString("es-CL", {
                    day: "2-digit",
                    month: "short",
                  });
                }}
              />
              <YAxis
                yAxisId="main"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v: number) =>
                  metric === "gasto"
                    ? compactMoney(v, currency)
                    : compactInt(v)
                }
              />
              <YAxis
                yAxisId="ctr"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
              />
              <Tooltip
                content={<ChartTooltip metric={metric} currency={currency} />}
                cursor={{ stroke: "#E5E5E5" }}
              />
              <Legend {...legendProps} />
              <Area
                yAxisId="main"
                type="monotone"
                name={METRICS.find((m) => m.id === metric)?.label}
                dataKey={metric}
                stroke={mainColor}
                strokeWidth={2}
                fill={seriesFillSoft(mainColor, 0.15)}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={400}
              />
              <Line
                yAxisId="ctr"
                type="monotone"
                name="CTR"
                dataKey="ctr"
                stroke={ctrColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={400}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
