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
type Granularity = "mes" | "anio" | "temporada";

const METRICS: { id: Metric; label: string }[] = [
  { id: "gasto", label: "Gasto" },
  { id: "docs", label: "Documentos" },
];

const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
  { id: "temporada", label: "Temporada" },
];

type Datum = {
  key: string;
  label: string;
  tooltip: string;
  gasto: number;
  docs: number;
};

/**
 * Re-agrupa la serie mensual ("YYYY-MM") según la granularidad elegida.
 * Temporada: julio→junio del año siguiente (ej. jul-2024..jun-2025 = "2024/25").
 */
function bucketize(rows: MensualRow[], gran: Granularity): Datum[] {
  if (gran === "mes") {
    return rows.map((r) => ({
      key: r.mes,
      label: monthLabelShort(r.mes),
      tooltip: monthLabel(r.mes),
      gasto: r.gasto,
      docs: r.docs,
    }));
  }

  const map = new Map<string, { gasto: number; docs: number; sort: number }>();
  for (const r of rows) {
    const [yearStr, monthStr] = r.mes.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) continue;

    let key: string;
    let sort: number;
    if (gran === "anio") {
      key = String(year);
      sort = year;
    } else {
      const start = month >= 7 ? year : year - 1;
      key = `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
      sort = start;
    }
    const cur = map.get(key) ?? { gasto: 0, docs: 0, sort };
    cur.gasto += r.gasto;
    cur.docs += r.docs;
    map.set(key, cur);
  }

  return [...map.entries()]
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([key, v]) => ({
      key,
      label: key,
      tooltip: gran === "anio" ? `Año ${key}` : `Temporada ${key} (jul–jun)`,
      gasto: v.gasto,
      docs: v.docs,
    }));
}

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
      <p className="font-medium">{p.tooltip}</p>
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

const SUBTITLES: Record<Granularity, string> = {
  mes: "Gasto mensual según la fecha del documento.",
  anio: "Gasto por año según la fecha del documento.",
  temporada: "Gasto por temporada (julio–junio) según la fecha del documento.",
};

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1"
    >
      {options.map((o) => {
        const isActive = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
              isActive
                ? "bg-[#F0EFFE] text-[#9F99F8]"
                : "text-[#666666] hover:text-[#333333]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function EvolucionChart({ rows }: Props) {
  const [metric, setMetric] = useState<Metric>("gasto");
  const [gran, setGran] = useState<Granularity>("mes");

  const data = useMemo(() => bucketize(rows, gran), [rows, gran]);

  const color = metric === "gasto" ? seriesColor(0) : seriesColor(4);
  const showDots = gran !== "mes";

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Evolución en el tiempo
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">{SUBTITLES[gran]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            value={gran}
            options={GRANULARITIES}
            onChange={setGran}
            ariaLabel="Granularidad temporal"
          />
          <ToggleGroup
            value={metric}
            options={METRICS}
            onChange={setMetric}
            ariaLabel="Métrica"
          />
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
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#E5E5E5" }} />
              <Area
                type="monotone"
                name={metric === "gasto" ? "Gasto" : "Documentos"}
                dataKey={metric}
                stroke={color}
                strokeWidth={2}
                fill={seriesFillSoft(color, 0.15)}
                dot={showDots ? { r: 3, fill: color, strokeWidth: 0 } : false}
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
