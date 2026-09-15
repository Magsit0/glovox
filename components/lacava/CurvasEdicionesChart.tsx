"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurvaPoint } from "@/lib/marketing/curvas";
import { MetricToggle } from "./VentaDiariaChart";
import {
  LACAVA,
  lacavaAxisTick,
  lacavaGridProps,
  lacavaSeriesColor,
} from "./theme";

export type CurvaEdicionSerie = {
  key: string;
  label: string;
  total: number;
  enVenta: boolean;
  /** Día relativo hasta el que la curva es observable (su "hoy"). */
  diasCorte: number;
};

/** Una combinación métrica × escala precalculada en el servidor (buildCurvas). */
export type CurvaVariant = {
  metric: "personas" | "venta";
  normalizar: boolean;
  points: CurvaPoint[];
  series: CurvaEdicionSerie[];
  minDias: number;
  maxDias: number;
};

const PRESETS = [30, 60, 90] as const;

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const unDecimal = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function labelDia(dias: number): string {
  if (dias === 0) return "Día del evento";
  if (dias > 0) return `${entero.format(dias)} días antes`;
  return `${entero.format(-dias)} días después`;
}

/**
 * Curvas de venta acumulada de todas las ediciones de La Cava, alineadas por
 * días de compra anticipada — la misma lectura que /marketing/curvas, acotada
 * a la familia JUMBO. Toggles de métrica (Personas / Recaudación) y de escala
 * (absoluta / % del total propio) sin ir al servidor: las cuatro variantes
 * vienen precalculadas.
 */
export default function CurvasEdicionesChart({ variants }: { variants: CurvaVariant[] }) {
  const [metric, setMetric] = useState<"personas" | "venta">("personas");
  const [normalizar, setNormalizar] = useState(false);
  const [ventana, setVentana] = useState<number | null>(null); // null = todo

  const variant =
    variants.find((v) => v.metric === metric && v.normalizar === normalizar) ??
    variants[0];

  const visibles = useMemo(() => {
    if (!variant) return [];
    if (ventana == null) return variant.points;
    return variant.points.filter((p) => p.dias <= ventana);
  }, [variant, ventana]);

  if (!variant || variant.points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
          Sin datos para dibujar las curvas.
        </p>
      </div>
    );
  }

  const colorByKey = new Map(
    variant.series.map((s, i) => [s.key, lacavaSeriesColor(i)]),
  );

  const fmtValor = (v: number) => {
    if (normalizar) return `${unDecimal.format(v)}%`;
    if (metric === "venta") return `$${entero.format(Math.round(v))}`;
    return entero.format(Math.round(v));
  };
  const fmtEje = (v: number) => {
    if (normalizar) return `${entero.format(v)}%`;
    if (metric === "venta") return `$${compacto.format(v)}`;
    return compacto.format(v);
  };

  // Marca el punto donde una curva en venta se corta (su "hoy"), para que el
  // final abrupto no se lea como falta de datos.
  const cortes = variant.series.flatMap((s) => {
    if (!s.enVenta) return [];
    if (ventana != null && s.diasCorte > ventana) return [];
    const punto = visibles.find((p) => p.dias === s.diasCorte);
    const y = punto?.[s.key];
    if (y == null) return [];
    return [{ key: s.key, x: s.diasCorte, y, color: colorByKey.get(s.key) ?? LACAVA.tinta }];
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg border bg-white p-1"
          style={{ borderColor: LACAVA.borde }}
        >
          {PRESETS.map((d) => (
            <VentanaButton
              key={d}
              active={ventana === d}
              label={`${d}d`}
              onClick={() => setVentana(d)}
            />
          ))}
          <VentanaButton
            active={ventana == null}
            label="Todo"
            onClick={() => setVentana(null)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className="flex cursor-pointer items-center gap-2 font-sans text-sm"
            style={{ color: LACAVA.tintaSuave }}
          >
            <input
              type="checkbox"
              checked={normalizar}
              onChange={(e) => setNormalizar(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: LACAVA.verde }}
            />
            % del total de cada edición
          </label>
          <MetricToggle metric={metric} onChange={setMetric} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={visibles} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid {...lacavaGridProps} />
          <XAxis
            dataKey="dias"
            type="number"
            reversed
            domain={["dataMin", "dataMax"]}
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: LACAVA.borde }}
            tick={lacavaAxisTick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={lacavaAxisTick}
            tickFormatter={fmtEje}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: LACAVA.borde }}
            content={<CurvasTooltip colorByKey={colorByKey} fmtValor={fmtValor} />}
          />
          <ReferenceLine
            x={0}
            stroke={LACAVA.tintaSutil}
            strokeDasharray="4 4"
            label={{
              value: "Día del evento",
              position: "insideTopRight",
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fill: LACAVA.tintaSutil,
            }}
          />
          {variant.series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.enVenta ? `${s.label} · en venta` : s.label}
              stroke={colorByKey.get(s.key)}
              strokeWidth={s.enVenta ? 3 : 2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {cortes.map((c) => (
            <ReferenceDot
              key={`corte-${c.key}`}
              x={c.x}
              y={c.y}
              r={5}
              fill={c.color}
              stroke={LACAVA.cremaClara}
              strokeWidth={2}
              label={{
                value: "hoy",
                position: "top",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fill: c.color,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-4">
        {variant.series.map((s, i) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 font-sans text-xs"
            style={{ color: s.enVenta ? LACAVA.tinta : LACAVA.tintaSuave }}
          >
            <span
              className="rounded-full"
              style={{
                backgroundColor: lacavaSeriesColor(i),
                width: s.enVenta ? 10 : 8,
                height: s.enVenta ? 10 : 8,
              }}
            />
            {s.enVenta ? `${s.label} · en venta` : s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function VentanaButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors"
      style={
        active
          ? { backgroundColor: LACAVA.verde, color: LACAVA.marfil }
          : { color: LACAVA.tintaSuave }
      }
    >
      {label}
    </button>
  );
}

type TooltipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
};

function CurvasTooltip({
  active,
  label,
  payload,
  colorByKey,
  fmtValor,
}: {
  active?: boolean;
  label?: number | string;
  payload?: TooltipEntry[];
  colorByKey: Map<string, string>;
  fmtValor: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => p.value != null)
    .map((p) => ({
      key: String(p.dataKey ?? ""),
      name: String(p.name ?? ""),
      value: typeof p.value === "number" ? p.value : Number(p.value),
    }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => b.value - a.value);
  if (rows.length === 0) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{ backgroundColor: LACAVA.cremaClara, borderColor: LACAVA.borde }}
    >
      <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
        {labelDia(Number(label))}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between gap-4 font-sans text-sm"
            style={{ color: LACAVA.tinta }}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: colorByKey.get(r.key) ?? LACAVA.tinta }}
              />
              {r.name}
            </span>
            <span className="tabular-nums">{fmtValor(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
