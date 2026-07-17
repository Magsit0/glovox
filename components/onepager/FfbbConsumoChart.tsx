"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OnepagerFfbbConsumoRow } from "@/lib/queries/onepager";
import { axisTick, gridProps, legendProps, seriesColor, SURFACE } from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import MultiFilter from "./MultiFilter";

export type FfbbConsumoEvento = {
  eventoId: string;
  nombre: string;
  fecha: string; // YYYY-MM-DD
  asistentes: number | null;
};

type Props = {
  /** Eventos en pantalla (ya acotados por los filtros de la vista global). */
  events: FfbbConsumoEvento[];
  /** Desglose FF&BB completo (todos los eventos); se filtra por scope acá. */
  consumo: OnepagerFfbbConsumoRow[];
};

type Metric = "venta" | "cantidad";

// Clave de la serie "agregada" cuando no hay categoría seleccionada.
const ALL_KEY = "__todas__";
const ALL_LABEL = "FF&BB (todas)";

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function fmtClpShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return "$" + (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return "$" + Math.round(value / 1_000) + "K";
  return "$" + Math.round(value);
}

function fmtNumShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return Math.round(value / 1_000) + "K";
  return String(Math.round(value));
}

function fmtFecha(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values))
    .filter((v) => v.length > 0)
    .sort((a, b) => a.localeCompare(b, "es-CL"));
}

function fmtValue(value: number, metric: Metric, perCapita: boolean): string {
  if (metric === "venta") {
    return fmtClp(value); // $/asistente también en pesos redondeados
  }
  // cantidad
  return perCapita
    ? value.toLocaleString("es-CL", { maximumFractionDigits: 2 })
    : Math.round(value).toLocaleString("es-CL");
}

function fmtAxis(value: number, metric: Metric, perCapita: boolean): string {
  if (metric === "venta") return fmtClpShort(value);
  if (perCapita) return value.toLocaleString("es-CL", { maximumFractionDigits: 1 });
  return fmtNumShort(value);
}

function unitLabel(metric: Metric, perCapita: boolean): string {
  if (metric === "venta") return perCapita ? "Venta $ / asist." : "Venta CLP";
  return perCapita ? "Unidades / asist." : "Cantidad (u.)";
}

export default function FfbbConsumoChart({ events, consumo }: Props) {
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [productos, setProductos] = useState<Set<string>>(new Set());
  const [metric, setMetric] = useState<Metric>("venta");
  const [perCapita, setPerCapita] = useState(false);

  // Consumo acotado a los eventos en pantalla.
  const eventoIds = useMemo(
    () => new Set(events.map((e) => e.eventoId)),
    [events],
  );
  const scopedConsumo = useMemo(
    () => consumo.filter((r) => eventoIds.has(r.eventoId)),
    [consumo, eventoIds],
  );

  const categoriasOpts = useMemo(
    () => uniqueSorted(scopedConsumo.map((r) => r.categoria)),
    [scopedConsumo],
  );

  // Productos acotados a las categorías seleccionadas (cascada).
  const productosOpts = useMemo(() => {
    const set = new Set<string>();
    for (const r of scopedConsumo) {
      if (categorias.size === 0 || categorias.has(r.categoria)) {
        if (r.producto) set.add(r.producto);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [scopedConsumo, categorias]);

  // Descarta productos elegidos que ya no están disponibles (sin perder el
  // estado crudo de `productos`).
  const effectiveProductos = useMemo(() => {
    if (productos.size === 0) return productos;
    const valid = new Set(productosOpts);
    const next = new Set<string>();
    for (const p of productos) if (valid.has(p)) next.add(p);
    return next;
  }, [productos, productosOpts]);

  // Series (líneas): una por categoría seleccionada, o una agregada si no hay
  // ninguna categoría marcada.
  const series = useMemo<{ key: string; label: string; color: string }[]>(() => {
    const keys =
      categorias.size === 0
        ? [ALL_KEY]
        : Array.from(categorias).sort((a, b) => a.localeCompare(b, "es-CL"));
    return keys.map((key, i) => ({
      key,
      label: key === ALL_KEY ? ALL_LABEL : key,
      color: seriesColor(i),
    }));
  }, [categorias]);

  // Índice consumo por evento para acumular en una sola pasada.
  const byEvento = useMemo(() => {
    const m = new Map<string, OnepagerFfbbConsumoRow[]>();
    for (const r of scopedConsumo) {
      const arr = m.get(r.eventoId);
      if (arr) arr.push(r);
      else m.set(r.eventoId, [r]);
    }
    return m;
  }, [scopedConsumo]);

  // Datos del gráfico: un punto por evento, orden cronológico (evolución).
  const chartData = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted.map((ev) => {
      const point: Record<string, string | number | null> = {
        nombre: ev.nombre,
        fecha: ev.fecha,
      };
      const rows = byEvento.get(ev.eventoId) ?? [];
      const sums = new Map<string, number>();
      for (const r of rows) {
        if (effectiveProductos.size > 0 && !effectiveProductos.has(r.producto))
          continue;
        const val = metric === "venta" ? r.venta : r.qtty;
        if (categorias.size === 0) {
          sums.set(ALL_KEY, (sums.get(ALL_KEY) ?? 0) + val);
        } else if (categorias.has(r.categoria)) {
          sums.set(r.categoria, (sums.get(r.categoria) ?? 0) + val);
        }
      }
      for (const sKey of series) {
        const raw = sums.get(sKey.key) ?? 0;
        if (perCapita) {
          const a = ev.asistentes;
          point[sKey.key] = a && a > 0 ? raw / a : null;
        } else {
          point[sKey.key] = raw;
        }
      }
      return point;
    });
  }, [events, byEvento, series, categorias, effectiveProductos, metric, perCapita]);

  // ¿Hay algún valor no nulo/no cero para mostrar?
  const hasValues = useMemo(
    () =>
      chartData.some((p) =>
        series.some((s) => {
          const v = p[s.key];
          return typeof v === "number" && v !== 0;
        }),
      ),
    [chartData, series],
  );

  const hasActiveFilter = categorias.size > 0 || effectiveProductos.size > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: filtros + métrica + per cápita */}
      <div className="flex flex-wrap items-end gap-3">
        <MultiFilter
          label="Categoría FF&BB"
          selected={categorias}
          onChange={setCategorias}
          options={categoriasOpts}
          searchPlaceholder="Buscar categoría…"
        />
        <MultiFilter
          label="Producto"
          selected={effectiveProductos}
          onChange={setProductos}
          options={productosOpts}
          searchPlaceholder="Buscar producto…"
        />
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setCategorias(new Set());
              setProductos(new Set());
            }}
            className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-xs font-medium leading-none text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}

        <div className="ml-auto flex items-end gap-3">
          {/* Toggle métrica */}
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#666666]">
              Métrica
            </span>
            <div className="flex border border-[#E5E5E5] rounded-lg overflow-hidden">
              {(
                [
                  { key: "venta", label: "Venta ($)" },
                  { key: "cantidad", label: "Cantidad (u.)" },
                ] as { key: Metric; label: string }[]
              ).map((m, i) => {
                const active = metric === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMetric(m.key)}
                    className={`font-sans text-xs leading-none px-3 py-2 cursor-pointer transition-colors duration-150 ${
                      i === 0 ? "border-r border-[#E5E5E5]" : ""
                    } ${
                      active
                        ? "bg-[#F0EFFE] text-[#9F99F8]"
                        : "bg-white text-[#666666] hover:text-[#333333]"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Switch per cápita */}
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs text-[#666666]">
              Per cápita
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={perCapita}
              onClick={() => setPerCapita((v) => !v)}
              className={`font-sans text-xs leading-none px-3 py-2 rounded-lg border cursor-pointer transition-colors duration-150 ${
                perCapita
                  ? "bg-[#F0EFFE] text-[#9F99F8] border-[#9F99F8]"
                  : "bg-white text-[#666666] border-[#E5E5E5] hover:text-[#333333]"
              }`}
            >
              {perCapita ? "÷ Asistentes ✓" : "÷ Asistentes"}
            </button>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          No hay eventos en la vista actual.
        </p>
      ) : !hasValues ? (
        <p className="font-sans text-sm text-[#999999]">
          Sin consumo FF&BB para los filtros seleccionados
          {perCapita ? " (o los eventos no tienen asistentes registrados)" : ""}.
        </p>
      ) : (
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-sm">
          <ResponsiveContainer width="100%" height={380}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 72, left: 8 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="nombre"
                axisLine={{ stroke: SURFACE.divider }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={78}
                tick={{ ...axisTick, fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtAxis(v, metric, perCapita)}
                tick={axisTick}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: SURFACE.divider }}
                content={({ active, payload, label }) => {
                  const fecha = (
                    payload?.[0]?.payload as
                      | Record<string, string | number | null>
                      | undefined
                  )?.fecha;
                  const fechaStr = typeof fecha === "string" ? fmtFecha(fecha) : "";
                  const nombre =
                    typeof label === "string" ? label : String(label ?? "");
                  return (
                    <ChartTooltip
                      active={active}
                      label={
                        <span className="flex flex-col">
                          <span className="font-medium text-[#333333] truncate max-w-[240px]">
                            {nombre}
                          </span>
                          {fechaStr && (
                            <span className="text-[#999999]">{fechaStr}</span>
                          )}
                        </span>
                      }
                      items={(payload ?? []).map((p) => {
                        const v = p.value;
                        return {
                          name: String(p.name ?? ""),
                          color: String(p.color ?? ""),
                          formatted:
                            typeof v === "number"
                              ? fmtValue(v, metric, perCapita)
                              : "—",
                        };
                      })}
                    />
                  );
                }}
              />
              <Legend {...legendProps} verticalAlign="top" height={28} />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 font-sans text-xs text-[#999999]">
            {unitLabel(metric, perCapita)} · orden cronológico
          </p>
        </div>
      )}
    </div>
  );
}
