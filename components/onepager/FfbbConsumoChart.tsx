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

// Paleta legible sobre blanco (evita amarillo puro, invisible como línea).
const LINE_PALETTE = [
  "#0000FF",
  "#FF0000",
  "#00A000",
  "#C800C8",
  "#FF8800",
  "#00A0A0",
  "#7A00FF",
  "#A85400",
  "#0055AA",
  "#000000",
];

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
      color: LINE_PALETTE[i % LINE_PALETTE.length],
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
            className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-white text-black hover:bg-[#FFFF00] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}

        <div className="ml-auto flex items-end gap-3">
          {/* Toggle métrica */}
          <div className="flex flex-col gap-1">
            <span className="font-mono-data uppercase text-[10px] text-black/70">
              Métrica
            </span>
            <div className="flex border-2 border-black">
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
                    className={`font-mono-data uppercase text-xs leading-none px-3 py-2 cursor-pointer transition-colors duration-150 ${
                      i === 0 ? "border-r-2 border-black" : ""
                    } ${
                      active
                        ? "bg-black text-[#FFFF00]"
                        : "bg-white text-black hover:bg-[#FFFF00]"
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
            <span className="font-mono-data uppercase text-[10px] text-black/70">
              Per cápita
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={perCapita}
              onClick={() => setPerCapita((v) => !v)}
              className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black cursor-pointer transition-colors duration-150 ${
                perCapita
                  ? "bg-black text-[#FFFF00]"
                  : "bg-white text-black hover:bg-[#FFFF00]"
              }`}
            >
              {perCapita ? "÷ Asistentes ✓" : "÷ Asistentes"}
            </button>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">
          No hay eventos en la vista actual.
        </p>
      ) : !hasValues ? (
        <p className="font-mono-data text-sm text-black/50">
          Sin consumo FF&BB para los filtros seleccionados
          {perCapita ? " (o los eventos no tienen asistentes registrados)" : ""}.
        </p>
      ) : (
        <div className="border-4 border-black bg-white p-3">
          <ResponsiveContainer width="100%" height={380}>
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 72, left: 8 }}
            >
              <CartesianGrid
                stroke="#000"
                strokeDasharray="2 3"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="nombre"
                stroke="#000"
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={78}
                tick={{ fontFamily: "monospace", fontSize: 10, fill: "#000" }}
              />
              <YAxis
                stroke="#000"
                tickLine={false}
                tickFormatter={(v: number) => fmtAxis(v, metric, perCapita)}
                tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: "#000", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={
                  <ConsumoTooltip metric={metric} perCapita={perCapita} series={series} />
                }
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="plainline"
                wrapperStyle={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "#000",
                  paddingBottom: 4,
                }}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={3}
                  dot={{ r: 3, fill: s.color, stroke: s.color }}
                  activeDot={{ r: 5, stroke: "#000", strokeWidth: 2, fill: s.color }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 font-mono-data uppercase text-[10px] text-black/50">
            {unitLabel(metric, perCapita)} · orden cronológico
          </p>
        </div>
      )}
    </div>
  );
}

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
  payload?: Record<string, string | number | null>;
};

function ConsumoTooltip({
  active,
  payload,
  label,
  metric,
  perCapita,
  series,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  metric: Metric;
  perCapita: boolean;
  series: { key: string; label: string; color: string }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const fecha = payload[0]?.payload?.fecha;
  const fechaStr = typeof fecha === "string" ? fmtFecha(fecha) : "";
  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none px-3 py-2 font-mono-data text-xs">
      <div className="font-bold uppercase mb-0.5 truncate max-w-[260px]">
        {typeof label === "string" ? label : String(label ?? "")}
      </div>
      {fechaStr && (
        <div className="text-[10px] text-black/60 mb-1">{fechaStr}</div>
      )}
      {series.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        const v = entry?.value;
        return (
          <div key={s.key} className="flex items-center gap-2 mt-1">
            <span
              className="inline-block w-3 h-0.5 flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="uppercase truncate max-w-[180px]">{s.label}</span>
            <span className="ml-auto font-bold whitespace-nowrap">
              {typeof v === "number" ? fmtValue(v, metric, perCapita) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
