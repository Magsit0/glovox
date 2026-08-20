"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import {
  INK,
  SURFACE,
  axisTick,
  gridProps,
  legendProps,
  seriesColor,
} from "@/lib/chart-colors";
import type {
  CurvaMetric,
  CurvaVista,
  CurvaPoint,
  CurvaSerie,
} from "@/lib/marketing/curvas";

interface Props {
  points: CurvaPoint[];
  series: CurvaSerie[];
  promedioKey: string | null;
  /** Cuantas series cerradas promedia `promedioKey` (para la leyenda). */
  promedioBase: number;
  minDias: number;
  maxDias: number;
  metric: CurvaMetric;
  vista: CurvaVista;
  normalizar: boolean;
}

/** Ventana inicial del eje: más atrás que esto la curva suele ser plana. */
const VENTANA_DEFAULT = 120;

const PRESETS = [30, 60, 90, 120] as const;

const compact = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const unDecimal = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Etiqueta humana de un día relativo al evento. */
function labelDia(dias: number): string {
  if (dias === 0) return "Día del evento";
  if (dias > 0) return `${entero.format(dias)} días antes`;
  return `${entero.format(-dias)} días después`;
}

export default function CurvasCompraChart({
  points,
  series,
  promedioKey,
  promedioBase,
  minDias,
  maxDias,
  metric,
  vista,
  normalizar,
}: Props) {
  // El slider trabaja en "tiempo" (-dias) para que avanzar hacia la derecha sea
  // avanzar en el calendario, igual que el eje invertido del gráfico.
  const tMin = -maxDias;
  const tMax = -minDias;
  const [ventana, setVentana] = useState<[number, number]>(() => [
    Math.max(tMin, -VENTANA_DEFAULT),
    tMax,
  ]);

  // Al cambiar los filtros cambia el dominio pero el estado sobrevive: se
  // recorta para que los thumbs nunca queden fuera del rango disponible.
  const clamp = (v: number) => Math.min(Math.max(v, tMin), tMax);
  const tA = Math.min(clamp(ventana[0]), clamp(ventana[1]));
  const tB = Math.max(clamp(ventana[0]), clamp(ventana[1]));

  const desde = -tA; // día más anticipado visible
  const hasta = -tB; // día más tardío visible

  const visibles = useMemo(
    () => points.filter((p) => p.dias <= desde && p.dias >= hasta),
    [points, desde, hasta],
  );

  // El color se fija al orden de la tabla (el que ve el usuario), no al orden en
  // que se dibujan las lineas: mas abajo las series en venta se renderizan al
  // final para quedar ENCIMA, y eso no debe mover ningun color.
  const colorByKey = useMemo(
    () => new Map(series.map((s, i) => [s.key, seriesColor(i)])),
    [series],
  );

  const formatValue = (value: number): string => {
    if (normalizar) return `${unDecimal.format(value)}%`;
    if (metric === "venta") return `$${entero.format(Math.round(value))}`;
    return entero.format(Math.round(value));
  };

  const formatAxis = (value: number): string => {
    if (normalizar) return `${entero.format(value)}%`;
    if (metric === "venta") return `$${compact.format(value)}`;
    return compact.format(value);
  };

  if (points.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <LineChartIcon className="h-6 w-6 text-[#999999]" />
        <p className="font-sans text-sm text-[#999999]">
          Sin ventas para los filtros seleccionados.
        </p>
      </div>
    );
  }

  const rangoCompleto = tA === tMin && tB === tMax;
  const leftPct = ((tA - tMin) / Math.max(1, tMax - tMin)) * 100;
  const rightPct = ((tB - tMin) / Math.max(1, tMax - tMin)) * 100;

  // Las series en venta se dibujan AL FINAL para quedar encima: se cortan en la
  // zona donde todas las curvas vienen bunched y quedaban tapadas.
  const ordenRender = [
    ...series.filter((s) => !s.enVenta),
    ...series.filter((s) => s.enVenta),
  ];

  // recharts arma la leyenda con el orden de las <Line>, que arriba se altero
  // por z-order. Se reordena al orden de la tabla (por volumen) con un content
  // propio, y de paso se resaltan las series en venta.
  const rankByKey = new Map(series.map((s, i) => [s.key, i]));
  const enVentaKeys = new Set(series.filter((s) => s.enVenta).map((s) => s.key));

  // Punto donde se corta cada curva en venta = su "hoy". Marcarlo evita que el
  // corte se lea como un hueco de datos. Solo en la vista acumulada (la diaria
  // no se trunca) y solo si el dia cae dentro de la ventana visible.
  const cortes =
    vista === "acumulado"
      ? series.flatMap((s) => {
          if (!s.enVenta) return [];
          if (s.diasCorte > desde || s.diasCorte < hasta) return [];
          const punto = visibles.find((p) => p.dias === s.diasCorte);
          const y = punto?.[s.key];
          if (y == null) return [];
          return [{ key: s.key, x: s.diasCorte, y, color: colorByKey.get(s.key) ?? INK.subtle }];
        })
      : [];

  const sliderClass =
    "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-grab " +
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#9F99F8] " +
    "[&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 " +
    "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full " +
    "[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#9F99F8] [&::-moz-range-thumb]:bg-white";

  return (
    <div className="flex flex-col gap-4">
      {/* Periodo: recorta el eje sin volver a consultar (el acumulado sigue
          calculado desde el primer día de venta real de cada evento). */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">
            Periodo · {labelDia(desde)} → {labelDia(hasta)}
          </span>
          <div className="relative h-6">
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[#E5E5E5]" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#9F99F8]"
              style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
            />
            <input
              type="range"
              aria-label="Día inicial de la ventana"
              min={tMin}
              max={tMax}
              value={tA}
              onChange={(e) =>
                setVentana([Math.min(Number(e.target.value), tB - 1), tB])
              }
              className={sliderClass}
            />
            <input
              type="range"
              aria-label="Día final de la ventana"
              min={tMin}
              max={tMax}
              value={tB}
              onChange={(e) =>
                setVentana([tA, Math.max(Number(e.target.value), tA + 1)])
              }
              className={sliderClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1">
          {PRESETS.map((d) => {
            const activo = tA === Math.max(tMin, -d) && tB === tMax;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setVentana([Math.max(tMin, -d), tMax])}
                className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                  activo
                    ? "bg-[#F0EFFE] text-[#9F99F8]"
                    : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {d}d
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setVentana([tMin, tMax])}
            className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
              rangoCompleto
                ? "bg-[#F0EFFE] text-[#9F99F8]"
                : "text-[#666666] hover:text-[#333333]"
            }`}
          >
            Todo
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={visibles} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="dias"
            type="number"
            reversed
            domain={["dataMin", "dataMax"]}
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: SURFACE.divider }}
            tick={axisTick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={formatAxis}
            width={64}
          />
          <Tooltip
            cursor={{ stroke: SURFACE.divider }}
            content={
              <CurvasTooltip
                colorByKey={colorByKey}
                promedioKey={promedioKey}
                formatValue={formatValue}
              />
            }
          />
          <Legend
            {...legendProps}
            content={({ payload }: { payload?: readonly LegendEntry[] }) => (
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2">
                {[...(payload ?? [])]
                  .sort(
                    (a, b) =>
                      (rankByKey.get(String(a.dataKey)) ?? 999) -
                      (rankByKey.get(String(b.dataKey)) ?? 999),
                  )
                  .map((e) => {
                    const live = enVentaKeys.has(String(e.dataKey));
                    return (
                      <li
                        key={String(e.dataKey)}
                        className={`flex items-center gap-1.5 font-sans text-xs ${
                          live ? "font-medium text-[#333333]" : "text-[#666666]"
                        }`}
                      >
                        <span
                          className="rounded-full"
                          style={{
                            backgroundColor: e.color,
                            width: live ? 10 : 8,
                            height: live ? 10 : 8,
                          }}
                        />
                        {String(e.value ?? "")}
                      </li>
                    );
                  })}
              </ul>
            )}
          />
          <ReferenceLine
            x={0}
            stroke={INK.subtle}
            strokeDasharray="4 4"
            label={{
              value: "Día del evento",
              position: "insideTopRight",
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              fill: INK.subtle,
            }}
          />
          {ordenRender.map((s) => (
            <Line
              key={s.key}
              type={vista === "acumulado" ? "monotone" : "linear"}
              dataKey={s.key}
              name={s.enVenta ? `${s.label} · en venta` : s.label}
              stroke={colorByKey.get(s.key) ?? INK.subtle}
              strokeWidth={s.enVenta ? 3.5 : 2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
          {promedioKey && (
            <Line
              type="monotone"
              dataKey={promedioKey}
              name={`Promedio de ${promedioBase} cerradas`}
              stroke={INK.primary}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {cortes.map((c) => (
            <ReferenceDot
              key={`corte-${c.key}`}
              x={c.x}
              y={c.y}
              r={5}
              fill={c.color}
              stroke={SURFACE.card}
              strokeWidth={2}
              label={
                cortes.length <= 3
                  ? {
                      value: "hoy",
                      position: "top",
                      fontFamily: "var(--font-sans)",
                      fontSize: 11,
                      fill: c.color,
                    }
                  : undefined
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Lo que recharts pasa al `content` de la leyenda (payload readonly). */
type LegendEntry = {
  dataKey?: unknown;
  value?: unknown;
  color?: string;
};

type TooltipEntry = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
};

function CurvasTooltip({
  active,
  label,
  payload,
  colorByKey,
  promedioKey,
  formatValue,
}: {
  active?: boolean;
  label?: number | string;
  payload?: TooltipEntry[];
  colorByKey: Map<string, string>;
  promedioKey: string | null;
  formatValue: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((p) => p.value != null)
    .map((p) => ({
      key: String(p.dataKey ?? ""),
      name: String(p.name ?? ""),
      value: typeof p.value === "number" ? p.value : Number(p.value),
      color:
        String(p.dataKey) === promedioKey
          ? INK.primary
          : (colorByKey.get(String(p.dataKey)) ?? p.color ?? INK.subtle),
    }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  if (rows.length === 0) return null;

  return (
    <div className="max-w-[320px] rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 shadow-md">
      <p className="font-sans text-xs text-[#666666]">
        {labelDia(Number(label))}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex items-center justify-between gap-3 font-sans text-sm text-[#333333]"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: r.color }}
              />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="shrink-0 tabular-nums">{formatValue(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
