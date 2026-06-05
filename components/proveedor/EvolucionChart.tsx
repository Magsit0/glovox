"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisTick,
  gridProps,
  seriesColor,
  seriesFillSoft,
} from "@/lib/chart-colors";
import type { MensualRow } from "@/lib/queries/proveedor";
import {
  compactCurrency,
  formatCurrency,
  formatNumber,
  monthLabel,
  monthLabelShort,
} from "@/components/proveedor/format";

interface Props {
  rows: MensualRow[];
}

type Metric = "gasto" | "docs";

const METRICS: { id: Metric; label: string }[] = [
  { id: "gasto", label: "Gasto" },
  { id: "docs", label: "Documentos" },
];

type Datum = {
  mes: string;
  label: string;
  gasto: number;
  docs: number;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Datum }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{monthLabel(p.mes)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(0) }}
        />
        {formatCurrency(p.gasto)}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-[#666666]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: seriesColor(4) }}
        />
        {formatNumber(p.docs)} documentos
      </p>
    </div>
  );
}

export default function EvolucionChart({ rows }: Props) {
  const [metric, setMetric] = useState<Metric>("gasto");

  const data: Datum[] = useMemo(
    () =>
      rows.map((r) => ({
        mes: r.mes,
        label: monthLabelShort(r.mes),
        gasto: r.gasto,
        docs: r.docs,
      })),
    [rows],
  );

  const color = metric === "gasto" ? seriesColor(0) : seriesColor(4);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Evolución en el tiempo
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Gasto mensual según la fecha del documento.
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
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                tick={axisTick}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={64}
                tickFormatter={(v: number) =>
                  metric === "gasto" ? compactCurrency(v) : formatNumber(v)
                }
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "#E5E5E5" }}
              />
              <Area
                type="monotone"
                name={metric === "gasto" ? "Gasto" : "Documentos"}
                dataKey={metric}
                stroke={color}
                strokeWidth={2}
                fill={seriesFillSoft(color, 0.15)}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
