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
import type { MarcaClienteRow, MarcaMatrixCell } from "@/lib/queries/marca";
import { netoToBruto } from "@/lib/constants/tax";
import {
  axisTick,
  gridProps,
  legendProps,
  seriesColor,
  SURFACE,
} from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import {
  disponibles,
  enConflicto,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";

type Props = {
  /** Eventos en pantalla (ya acotados por los filtros de la vista global). */
  events: FfbbConsumoEvento[];
  /** Marcas (clientes) con su facturador — da los labels de las series. */
  clientes: MarcaClienteRow[];
  /** Pivot completo de imputaciones (todos los eventos); se acota por scope acá. */
  matrix: MarcaMatrixCell[];
  /** Label de la línea agregada (sin filtro). Default "Marcas (todas)". */
  aggLabel?: string;
  /** Label del filtro multi-select. Default "Marca". */
  filterLabel?: string;
  /** Texto de estado vacío. Default habla de "marcas". */
  emptyLabel?: string;
};

type Metric = "neto" | "bruto";

// Clave de la serie "agregada" cuando no hay marca seleccionada.
const ALL_KEY = "__todas__";
// Key de la faceta Marca (lib/filters/facetas).
const MARCA_KEY = "marca";

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

export default function MarcaEvolucionChart({
  events,
  clientes,
  matrix,
  aggLabel = "Marcas (todas)",
  filterLabel = "Marca",
  emptyLabel = "Sin ingresos de marcas para los filtros seleccionados.",
}: Props) {
  // Selección por nombre de marca (nombre es UNIQUE en marca_clientes).
  const [marcas, setMarcas] = useState<Set<string>>(new Set());
  const [metric, setMetric] = useState<Metric>("neto");

  // Consumo acotado a los eventos en pantalla (y descarta ceros).
  const eventoIds = useMemo(
    () => new Set(events.map((e) => e.eventoId)),
    [events],
  );
  const scopedMatrix = useMemo(
    () => matrix.filter((c) => eventoIds.has(c.eventoId) && c.montoNeto !== 0),
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

  // Faceta Marca sobre las imputaciones en scope. El scope (Categoría/Grupo del
  // listado) acota las OPCIONES, nunca la selección: `marcas` se usa cruda en
  // todo el componente y solo la escriben el dropdown y "Limpiar".
  const facetas = useMemo<Faceta<MarcaMatrixCell>[]>(
    () => [{ key: MARCA_KEY, valores: (c) => nombreById.get(c.clienteId) ?? null }],
    [nombreById],
  );
  const selecciones = useMemo(() => ({ [MARCA_KEY]: marcas }), [marcas]);

  // Marcas con imputación en los eventos en pantalla.
  const conDatos = useMemo(
    () => disponibles(scopedMatrix, facetas, {})[MARCA_KEY],
    [scopedMatrix, facetas],
  );

  // Opciones del dropdown: las marcas con datos en scope + las ya elegidas
  // (atenuadas vía `available` si quedaron sin datos), en orden alfabético.
  const todasLasMarcas = useMemo(
    () => clientes.map((c) => c.nombre).sort(porNombre),
    [clientes],
  );
  const marcaItems = useMemo(
    () =>
      opcionesVisibles(todasLasMarcas, conDatos, marcas).map((v) => ({
        value: v,
        label: v,
      })),
    [todasLasMarcas, conDatos, marcas],
  );

  // Selección cruda ordenada, y las elegidas sin imputación en scope (se
  // conservan, pero no se grafican y se avisa debajo del filtro).
  const elegidas = useMemo(() => Array.from(marcas).sort(porNombre), [marcas]);
  const sinDatos = useMemo(
    () => elegidas.filter((n) => !conDatos.has(n)),
    [elegidas, conDatos],
  );

  // Ninguna marca elegida tiene datos en scope: aviso en vez de caer en
  // silencio a la serie agregada. Sin imputaciones en los eventos en pantalla
  // no hay choque que reportar (limpiar la marca no traería datos): ahí aplica
  // el mensaje de vacío, igual que en FfbbConsumoChart.
  const conflicts = useMemo(
    () =>
      scopedMatrix.length === 0
        ? []
        : enConflicto(scopedMatrix, facetas, selecciones).map((key) => ({
            key,
            label: filterLabel,
          })),
    [scopedMatrix, facetas, selecciones, filterLabel],
  );

  // Series (líneas): una por marca elegida CON datos en scope (key =
  // clienteId), o una agregada si no hay ninguna marcada. El color sale de la
  // posición en la selección, así no cambia cuando otra elegida queda sin datos.
  const series = useMemo<{ key: string; label: string; color: string }[]>(() => {
    if (marcas.size === 0) {
      return [{ key: ALL_KEY, label: aggLabel, color: seriesColor(0) }];
    }
    return elegidas.flatMap((nombre, i) => {
      const id = idByNombre.get(nombre);
      if (!id || !conDatos.has(nombre)) return [];
      return [{ key: id, label: nombre, color: seriesColor(i) }];
    });
  }, [marcas, elegidas, conDatos, idByNombre, aggLabel]);

  // Índice de netos por evento → marca, para acumular en una sola pasada.
  const byEvento = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const c of scopedMatrix) {
      let inner = m.get(c.eventoId);
      if (!inner) {
        inner = new Map();
        m.set(c.eventoId, inner);
      }
      inner.set(c.clienteId, (inner.get(c.clienteId) ?? 0) + c.montoNeto);
    }
    return m;
  }, [scopedMatrix]);

  // Datos del gráfico: un punto por evento, orden cronológico (evolución).
  const chartData = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return sorted.map((ev) => {
      const point: Record<string, string | number | null> = {
        nombre: ev.nombre,
        fecha: ev.fecha,
      };
      const inner = byEvento.get(ev.eventoId);
      if (marcas.size === 0) {
        let sumNeto = 0;
        if (inner) for (const v of inner.values()) sumNeto += v;
        point[ALL_KEY] = metric === "bruto" ? netoToBruto(sumNeto) : sumNeto;
      } else {
        for (const s of series) {
          const neto = inner?.get(s.key) ?? 0;
          point[s.key] = metric === "bruto" ? netoToBruto(neto) : neto;
        }
      }
      return point;
    });
  }, [events, byEvento, marcas, series, metric]);

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

  const hasActiveFilter = marcas.size > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar: filtro de marca + métrica neto/bruto */}
      <div className="flex flex-wrap items-end gap-3">
        <StandardMultiFilter
          label={filterLabel}
          selected={marcas}
          onChange={setMarcas}
          options={marcaItems}
          available={conDatos}
          searchPlaceholder="Buscar marca…"
        />
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => setMarcas(new Set())}
            className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
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
          onClear={() => setMarcas(new Set())}
        />
      ) : !hasValues ? (
        <p className="font-sans text-sm text-[#999999]">{emptyLabel}</p>
      ) : (
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-4">
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
                tickFormatter={(v: number) => fmtClpShort(v)}
                tick={axisTick}
                width={70}
              />
              <Tooltip
                cursor={{ stroke: SURFACE.divider, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  const fecha = payload?.[0]?.payload?.fecha;
                  const fechaStr = typeof fecha === "string" ? fmtFecha(fecha) : "";
                  const title =
                    typeof label === "string" ? label : String(label ?? "");
                  return (
                    <ChartTooltip
                      active={active}
                      label={fechaStr ? `${title} · ${fechaStr}` : title}
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
            {unitLabel(metric)} · orden cronológico
          </p>
        </div>
      )}
    </div>
  );
}
