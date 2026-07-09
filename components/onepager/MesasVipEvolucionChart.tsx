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
import type { FfbbConsumoEvento } from "./FfbbConsumoChart";
import type { MesasVipClienteRow, MesasVipMatrixCell } from "@/lib/queries/mesasVip";
import { brutoToNeto } from "@/lib/constants/tax";
import MultiFilter from "./MultiFilter";

type Props = {
  /** Eventos en pantalla (ya acotados por los filtros de la vista global). */
  events: FfbbConsumoEvento[];
  /** Clientes VIP — dan los labels de las series en modo "por cliente". */
  clientes: MesasVipClienteRow[];
  /** Pivot completo de imputaciones (todos los eventos); se acota por scope acá. */
  matrix: MesasVipMatrixCell[];
};

type Metric = "neto" | "bruto";
type Grouping = "evento" | "cliente";

// Clave de la serie "agregada" en modo por evento.
const ALL_KEY = "__todas__";
const ALL_LABEL = "Mesas VIP (total)";

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

function fmtFecha(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function unitLabel(metric: Metric): string {
  return metric === "bruto" ? "Ingreso bruto (CLP)" : "Ingreso neto (CLP)";
}

export default function MesasVipEvolucionChart({ events, clientes, matrix }: Props) {
  const [grouping, setGrouping] = useState<Grouping>("evento");
  // Selección por nombre de cliente (nombre es UNIQUE).
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  // El usuario imputa el bruto (precio); ese es el default del gráfico.
  const [metric, setMetric] = useState<Metric>("bruto");

  // Imputaciones acotadas a los eventos en pantalla (y descarta ceros).
  const eventoIds = useMemo(
    () => new Set(events.map((e) => e.eventoId)),
    [events],
  );
  const scopedMatrix = useMemo(
    () => matrix.filter((c) => eventoIds.has(c.eventoId) && c.precio !== 0),
    [matrix, eventoIds],
  );

  // Mapeos nombre ↔ clienteId (nombre es único).
  const nombreById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.id, c.nombre);
    return m;
  }, [clientes]);
  const idByNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.nombre, c.id);
    return m;
  }, [clientes]);

  // Opciones del filtro: solo clientes con imputación en los eventos en scope.
  const clienteOpts = useMemo(() => {
    const ids = new Set(scopedMatrix.map((c) => c.clienteId));
    const nombres: string[] = [];
    for (const id of ids) {
      const n = nombreById.get(id);
      if (n) nombres.push(n);
    }
    return nombres.sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [scopedMatrix, nombreById]);

  // Descarta selección que ya no está disponible (sin perder el estado crudo).
  const effectiveSeleccion = useMemo(() => {
    if (seleccion.size === 0) return seleccion;
    const valid = new Set(clienteOpts);
    const next = new Set<string>();
    for (const n of seleccion) if (valid.has(n)) next.add(n);
    return next;
  }, [seleccion, clienteOpts]);

  // Series (líneas):
  //  - "evento" → una línea agregada (suma de todos los clientes).
  //  - "cliente" → una línea por cliente seleccionado; si no hay selección,
  //    una línea por cada cliente con datos.
  const series = useMemo<{ key: string; label: string; color: string }[]>(() => {
    if (grouping === "evento") {
      return [{ key: ALL_KEY, label: ALL_LABEL, color: LINE_PALETTE[0] }];
    }
    const nombres =
      effectiveSeleccion.size > 0
        ? Array.from(effectiveSeleccion).sort((a, b) => a.localeCompare(b, "es-CL"))
        : clienteOpts;
    return nombres.map((nombre, i) => ({
      key: idByNombre.get(nombre) ?? nombre,
      label: nombre,
      color: LINE_PALETTE[i % LINE_PALETTE.length],
    }));
  }, [grouping, effectiveSeleccion, clienteOpts, idByNombre]);

  // clienteIds a graficar en modo "cliente".
  const selectedIds = useMemo(() => {
    const s = new Set<string>();
    const nombres = effectiveSeleccion.size > 0 ? effectiveSeleccion : new Set(clienteOpts);
    for (const nombre of nombres) {
      const id = idByNombre.get(nombre);
      if (id) s.add(id);
    }
    return s;
  }, [effectiveSeleccion, clienteOpts, idByNombre]);

  // Índice de precios (bruto) por evento → cliente, para acumular en una pasada.
  const byEvento = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const c of scopedMatrix) {
      let inner = m.get(c.eventoId);
      if (!inner) {
        inner = new Map();
        m.set(c.eventoId, inner);
      }
      inner.set(c.clienteId, (inner.get(c.clienteId) ?? 0) + c.precio);
    }
    return m;
  }, [scopedMatrix]);

  // Datos del gráfico: un punto por evento, orden cronológico (evolución).
  // `precio` es bruto; el neto se deriva (÷1,19) cuando la métrica es "neto".
  const chartData = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted.map((ev) => {
      const point: Record<string, string | number | null> = {
        nombre: ev.nombre,
        fecha: ev.fecha,
      };
      const inner = byEvento.get(ev.eventoId);
      if (grouping === "evento") {
        let sumBruto = 0;
        if (inner) for (const v of inner.values()) sumBruto += v;
        point[ALL_KEY] = metric === "neto" ? brutoToNeto(sumBruto) : sumBruto;
      } else {
        for (const id of selectedIds) {
          const bruto = inner?.get(id) ?? 0;
          point[id] = metric === "neto" ? brutoToNeto(bruto) : bruto;
        }
      }
      return point;
    });
  }, [events, byEvento, grouping, selectedIds, metric]);

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

  const hasActiveFilter = effectiveSeleccion.size > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: switch por evento/cliente + filtro de cliente + neto/bruto */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Switch de agrupación */}
        <div className="flex flex-col gap-1">
          <span className="font-mono-data uppercase text-[10px] text-black/70">
            Ver
          </span>
          <div className="flex border-2 border-black">
            {(
              [
                { key: "evento", label: "Por evento" },
                { key: "cliente", label: "Por cliente" },
              ] as { key: Grouping; label: string }[]
            ).map((g, i) => {
              const active = grouping === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGrouping(g.key)}
                  className={`font-mono-data uppercase text-xs leading-none px-3 py-2 cursor-pointer transition-colors duration-150 ${
                    i === 0 ? "border-r-2 border-black" : ""
                  } ${
                    active
                      ? "bg-black text-[#FFFF00]"
                      : "bg-white text-black hover:bg-[#FFFF00]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {grouping === "cliente" && (
          <>
            <MultiFilter
              label="Cliente"
              selected={effectiveSeleccion}
              onChange={setSeleccion}
              options={clienteOpts}
              searchPlaceholder="Buscar cliente…"
            />
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-white text-black hover:bg-[#FFFF00] transition-colors duration-150 cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </>
        )}

        <div className="ml-auto flex flex-col gap-1">
          <span className="font-mono-data uppercase text-[10px] text-black/70">
            Monto
          </span>
          <div className="flex border-2 border-black">
            {(
              [
                { key: "neto", label: "Neto" },
                { key: "bruto", label: "Bruto" },
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
      </div>

      {events.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">
          No hay eventos en la vista actual.
        </p>
      ) : !hasValues ? (
        <p className="font-mono-data text-sm text-black/50">
          Sin ingresos de mesas VIP para los filtros seleccionados.
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
                tickFormatter={(v: number) => fmtClpShort(v)}
                tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: "#000", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={<MesasVipTooltip series={series} />}
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
            {unitLabel(metric)} · {grouping === "evento" ? "total por evento" : "por cliente"} · orden cronológico
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

function MesasVipTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
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
              {typeof v === "number" ? fmtClp(v) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
