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
import { netoFromPrecio } from "@/lib/constants/mesasVip";
import { seriesColor, gridProps, legendProps, axisTick, SURFACE } from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import {
  disponibles,
  enConflicto,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { normalizarSeleccion } from "@/lib/filters/url";

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
// Key de la faceta Cliente (lib/filters/facetas).
const CLIENTE_KEY = "cliente";

const porNombre = (a: string, b: string) => a.localeCompare(b, "es-CL");

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

  // Faceta Cliente sobre las imputaciones en scope. El scope (Categoría/Grupo
  // del listado) acota las OPCIONES, nunca la selección: `seleccion` se usa
  // cruda en todo el componente y solo la escriben el dropdown y "Limpiar".
  const facetas = useMemo<Faceta<MesasVipMatrixCell>[]>(
    () => [{ key: CLIENTE_KEY, valores: (c) => nombreById.get(c.clienteId) ?? null }],
    [nombreById],
  );
  const selecciones = useMemo(() => ({ [CLIENTE_KEY]: seleccion }), [seleccion]);

  // Clientes con imputación en los eventos en pantalla.
  const conDatos = useMemo(
    () => disponibles(scopedMatrix, facetas, {})[CLIENTE_KEY],
    [scopedMatrix, facetas],
  );

  // Catálogo de clientes (da el orden de las opciones) y los que tienen datos
  // en scope, en orden alfabético.
  const todosLosClientes = useMemo(
    () => clientes.map((c) => c.nombre).sort(porNombre),
    [clientes],
  );
  const clienteOpts = useMemo(
    () => todosLosClientes.filter((n) => conDatos.has(n)),
    [todosLosClientes, conDatos],
  );
  // Universo completo de Cliente: los clientes con imputación (distinta de
  // cero, como en scope) en cualquier evento de la matrix, sin el scope del
  // listado. Contra este se normaliza la selección.
  const universoClientes = useMemo(
    () => disponibles(matrix.filter((c) => c.precio !== 0), facetas, {})[CLIENTE_KEY],
    [matrix, facetas],
  );

  // Opciones del dropdown: los clientes con datos en scope + los ya elegidos
  // (atenuados vía `available` si quedaron sin datos).
  const clienteItems = useMemo(
    () =>
      opcionesVisibles(todosLosClientes, conDatos, seleccion).map((v) => ({
        value: v,
        label: v,
      })),
    [todosLosClientes, conDatos, seleccion],
  );

  // Selección cruda ordenada, y los elegidos sin imputación en scope (se
  // conservan, pero no se grafican y se avisa debajo del filtro).
  const elegidos = useMemo(() => Array.from(seleccion).sort(porNombre), [seleccion]);
  const sinDatos = useMemo(
    () => (grouping === "cliente" ? elegidos.filter((n) => !conDatos.has(n)) : []),
    [grouping, elegidos, conDatos],
  );

  // Ningún cliente elegido tiene datos en scope: aviso en vez de caer en
  // silencio a "una línea por cada cliente". Solo aplica en modo "cliente"
  // (en "evento" la selección no participa). Sin imputaciones en los eventos
  // en pantalla no hay choque que reportar (limpiar el cliente no traería
  // datos): ahí aplica el mensaje de vacío, igual que en FfbbConsumoChart.
  const conflicts = useMemo(
    () =>
      grouping === "cliente" && scopedMatrix.length > 0
        ? enConflicto(scopedMatrix, facetas, selecciones).map((key) => ({
            key,
            label: "Cliente",
          }))
        : [],
    [grouping, scopedMatrix, facetas, selecciones],
  );

  // Marcar el universo entero de clientes se guarda como "Todos": dibuja lo
  // mismo (una línea por cliente con datos). El universo son los clientes con
  // imputaciones en TODOS los eventos (universoClientes), como Producto en
  // FfbbConsumoChart: el scope de eventos es otro filtro acotando y no puede
  // decidir qué se guarda, así que "Seleccionar todos" con el listado acotado
  // queda como lista. Tampoco es el catálogo, que trae clientes sin
  // imputaciones que nunca aparecen como opción y harían que "Seleccionar
  // todos" no llegue nunca a "Todos".
  const onSeleccion = (next: Set<string>) =>
    setSeleccion(new Set(normalizarSeleccion(next, universoClientes)));

  // Series (líneas):
  //  - "evento" → una línea agregada (suma de todos los clientes).
  //  - "cliente" → una línea por cliente elegido CON datos en scope (el color
  //    sale de su posición en la selección, así no cambia cuando otro elegido
  //    queda sin datos); si no hay selección, una línea por cada cliente con
  //    datos.
  const series = useMemo<{ key: string; label: string; color: string }[]>(() => {
    if (grouping === "evento") {
      return [{ key: ALL_KEY, label: ALL_LABEL, color: seriesColor(0) }];
    }
    const nombres = seleccion.size > 0 ? elegidos : clienteOpts;
    return nombres.flatMap((nombre, i) => {
      const id = idByNombre.get(nombre);
      if (!id || !conDatos.has(nombre)) return [];
      return [{ key: id, label: nombre, color: seriesColor(i) }];
    });
  }, [grouping, seleccion, elegidos, clienteOpts, conDatos, idByNombre]);

  // Índice por evento → cliente con bruto (lo cobrado) y neto (exento aporta
  // completo; afecto ÷1,19), para acumular en una sola pasada.
  const byEvento = useMemo(() => {
    const m = new Map<string, Map<string, { bruto: number; neto: number }>>();
    for (const c of scopedMatrix) {
      let inner = m.get(c.eventoId);
      if (!inner) {
        inner = new Map();
        m.set(c.eventoId, inner);
      }
      const acc = inner.get(c.clienteId) ?? { bruto: 0, neto: 0 };
      acc.bruto += c.precio;
      acc.neto += netoFromPrecio(c.precio, c.exento);
      inner.set(c.clienteId, acc);
    }
    return m;
  }, [scopedMatrix]);

  // Datos del gráfico: un punto por evento, orden cronológico (evolución).
  const chartData = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pick = (v: { bruto: number; neto: number }) =>
      metric === "neto" ? v.neto : v.bruto;
    return sorted.map((ev) => {
      const point: Record<string, string | number | null> = {
        nombre: ev.nombre,
        fecha: ev.fecha,
      };
      const inner = byEvento.get(ev.eventoId);
      if (grouping === "evento") {
        let sum = 0;
        if (inner) for (const v of inner.values()) sum += pick(v);
        point[ALL_KEY] = sum;
      } else {
        for (const s of series) {
          const v = inner?.get(s.key);
          point[s.key] = v ? pick(v) : 0;
        }
      }
      return point;
    });
  }, [events, byEvento, grouping, series, metric]);

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

  const hasActiveFilter = seleccion.size > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: switch por evento/cliente + filtro de cliente + neto/bruto */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Switch de agrupación */}
        <div className="flex flex-col gap-1">
          <span className="font-sans text-xs text-[#666666]">
            Ver
          </span>
          <div className="flex border border-[#E5E5E5] rounded-lg overflow-hidden">
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
                  className={`font-sans text-xs leading-none px-3 py-2 cursor-pointer transition-colors duration-150 ${
                    i === 0 ? "border-r border-[#E5E5E5]" : ""
                  } ${
                    active
                      ? "bg-[#F0EFFE] text-[#9F99F8]"
                      : "bg-white text-[#666666] hover:text-[#333333]"
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
            <StandardMultiFilter
              label="Cliente"
              selected={seleccion}
              onChange={onSeleccion}
              options={clienteItems}
              available={conDatos}
              searchPlaceholder="Buscar cliente…"
            />
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => setSeleccion(new Set())}
                className="font-sans text-xs leading-none px-3 py-2 rounded-lg border border-[#E5E5E5] bg-white text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333] transition-colors duration-150 cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </>
        )}

        <div className="ml-auto flex flex-col gap-1">
          <span className="font-sans text-xs text-[#666666]">
            Monto
          </span>
          <div className="flex border border-[#E5E5E5] rounded-lg overflow-hidden">
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
      </div>

      {events.length > 0 && conflicts.length === 0 && sinDatos.length > 0 && (
        <p
          role="status"
          className="flex items-center gap-2 font-sans text-xs text-[var(--ink-muted)]"
        >
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF8C34]" />
          Sin ingresos en los eventos en pantalla (no se grafican): {sinDatos.join(", ")}.
        </p>
      )}

      {events.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          No hay eventos en la vista actual.
        </p>
      ) : conflicts.length > 0 ? (
        <FilterConflictNotice
          conflicts={conflicts}
          onClear={() => setSeleccion(new Set())}
        />
      ) : !hasValues ? (
        <p className="font-sans text-sm text-[#999999]">
          Sin ingresos de mesas VIP para los filtros seleccionados.
        </p>
      ) : (
        <div className="border border-[#E5E5E5] bg-white rounded-lg p-3">
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
                tick={axisTick}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtClpShort(v)}
                tick={axisTick}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: SURFACE.divider, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  const fecha = payload?.[0]?.payload?.fecha;
                  const fechaStr = typeof fecha === "string" ? fmtFecha(fecha) : "";
                  const nombre =
                    typeof label === "string" ? label : String(label ?? "");
                  const header = fechaStr ? `${nombre} · ${fechaStr}` : nombre;
                  return (
                    <ChartTooltip
                      active={active}
                      label={header}
                      items={(payload ?? []).map((p) => ({
                        name: String(p.name ?? ""),
                        color: String(p.color ?? ""),
                        formatted:
                          typeof p.value === "number" ? fmtClp(p.value) : "—",
                      }))}
                    />
                  );
                }}
              />
              <Legend
                {...legendProps}
                verticalAlign="top"
                height={28}
              />
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
            {unitLabel(metric)} · {grouping === "evento" ? "total por evento" : "por cliente"} · orden cronológico
          </p>
        </div>
      )}
    </div>
  );
}
