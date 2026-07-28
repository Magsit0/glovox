"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import type { MensualCategoriaRow } from "@/lib/queries/interno";
import {
  compactCurrency,
  formatCurrency,
  monthLabel,
  monthLabelShort,
} from "@/components/proveedor/format";

interface Props {
  rows: MensualCategoriaRow[];
}

type Granularity = "mes" | "anio" | "temporada";

const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
  { id: "temporada", label: "Temporada" },
];

const SUBTITLES: Record<Granularity, string> = {
  mes: "Gasto mensual apilado por categoría oficial, según la fecha del documento.",
  anio: "Gasto por año apilado por categoría oficial.",
  temporada: "Gasto por temporada (julio–junio) apilado por categoría oficial.",
};

/** Categorías con serie propia; el resto se agrupa en "Otras". */
const TOP_SERIES = 5;
const OTRAS = "Otras";

/**
 * Datum plano para recharts: las categorías (SIEMPRE en mayúsculas, más
 * "Otras") van como claves top-level junto a las claves internas en
 * minúsculas — sin riesgo de colisión.
 */
type Datum = {
  key: string;
  label: string;
  tooltip: string;
  sort: number;
} & Record<string, number | string>;

/** "YYYY-MM" → clave de bucket según granularidad (temporada = jul→jun). */
function bucketKey(
  mes: string,
  gran: Granularity,
): { key: string; label: string; tooltip: string; sort: number } | null {
  const [yearStr, monthStr] = mes.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (gran === "mes") {
    return {
      key: mes,
      label: monthLabelShort(mes),
      tooltip: monthLabel(mes),
      sort: year * 100 + month,
    };
  }
  if (gran === "anio") {
    return {
      key: String(year),
      label: String(year),
      tooltip: `Año ${year}`,
      sort: year,
    };
  }
  const start = month >= 7 ? year : year - 1;
  const key = `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
  return {
    key,
    label: key,
    tooltip: `Temporada ${key} (jul–jun)`,
    sort: start,
  };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    fill?: string;
    payload: Datum;
  }[];
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  const entries = payload
    .filter((e) => typeof e.value === "number" && e.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const total = entries.reduce((a, e) => a + (e.value ?? 0), 0);
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{datum.tooltip}</p>
      {entries.map((e) => (
        <p
          key={e.name}
          className="mt-1 flex items-center gap-1.5 text-xs text-[#666666]"
        >
          <span
            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: e.color ?? e.fill }}
          />
          {e.name}: {formatCurrency(e.value ?? 0)}
        </p>
      ))}
      <p className="mt-1 border-t border-[#F0F0F0] pt-1 text-xs font-medium text-[#333333]">
        Total {formatCurrency(total)}
      </p>
    </div>
  );
}

export default function MensualCategoriaChart({ rows }: Props) {
  const [gran, setGran] = useState<Granularity>("mes");

  // Series: top-N categorías por gasto total; el resto colapsa en "Otras".
  const series = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.categoria, (totals.get(r.categoria) ?? 0) + r.gasto);
    }
    const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = ordered.slice(0, TOP_SERIES).map(([cat]) => cat);
    return ordered.length > TOP_SERIES ? [...top, OTRAS] : top;
  }, [rows]);

  const data = useMemo(() => {
    const topSet = new Set(series.filter((c) => c !== OTRAS));
    const map = new Map<string, Datum>();
    for (const r of rows) {
      const bucket = bucketKey(r.mes, gran);
      if (!bucket) continue;
      let d = map.get(bucket.key);
      if (!d) {
        d = { ...bucket } as Datum;
        for (const cat of series) d[cat] = 0;
        map.set(bucket.key, d);
      }
      const cat = topSet.has(r.categoria) ? r.categoria : OTRAS;
      d[cat] = ((d[cat] as number) ?? 0) + r.gasto;
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort);
  }, [rows, gran, series]);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Evolución por categoría
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">{SUBTITLES[gran]}</p>
        </div>
        <div
          role="group"
          aria-label="Granularidad temporal"
          className="flex flex-wrap gap-1 self-start rounded-lg border border-[#E5E5E5] bg-white p-1"
        >
          {GRANULARITIES.map((o) => {
            const isActive = gran === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setGran(o.id)}
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
      </header>

      {data.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              barCategoryGap="30%"
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
                tickFormatter={(v: number) => compactCurrency(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#FAFAFA" }} />
              <Legend
                wrapperStyle={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  color: "#666666",
                }}
                iconType="circle"
                iconSize={8}
              />
              {series.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  stackId="g"
                  fill={seriesColor(i)}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined}
                  animationDuration={400}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
