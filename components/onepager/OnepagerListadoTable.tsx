"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import BrutalChartPanel from "./BrutalChartPanel";
import MarcaMatrixSheet, {
  type MatrixEvento,
} from "./MarcaMatrixSheet";
import type { MarcaCliente } from "@/db/schema";
import type { MarcaMatrixCell } from "@/lib/queries/marca";

export type OnepagerListadoTableRow = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  categoriaEvento2: string;
  fechaEvento: string;
  ventaTickets: number;
  ticketsComprados: number;
  ventaFfBb: number;
  ventaMarcas: number;
  asistentes: number | null;
};

type CategoriaAgg = {
  categoria: string;
  eventos: number;
  ventaTickets: number;
  ticketsComprados: number;
  ventaFfBb: number;
  ventaMarcas: number;
  asistentes: number;
  asistentesKnown: boolean;
};

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
  if (!iso) return "—";
  // Vienen como "YYYY-MM-DD". Formato simple "DD-MM-YYYY" para legibilidad.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Mapa de calor para la columna Total. Devuelve un `t ∈ [0, 1]` relativo
 * al rango visible (min..max). Si todo es igual, t = 0.
 */
function heatT(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Estilo de calor: blanco (t=0) → tomate-rojo (t=1) usando alpha sobre el
 * fondo blanco de la celda. Mantiene el texto legible incluso en t=1.
 */
function heatStyle(t: number): React.CSSProperties {
  const alpha = t * 0.65;
  return { backgroundColor: `rgba(255, 80, 30, ${alpha})` };
}

const SIN_CATEGORIA = "(Sin categoría)";
const SIN_GRUPO = "(Sin grupo)";

type Mode = "eventos" | "categorias";
type Metric =
  | "total"
  | "tickets"
  | "comprados"
  | "ffbb"
  | "marcas"
  | "asistentes";
type SortMode = "fecha-asc" | "valor-desc";

const METRICS: { key: Metric; label: string }[] = [
  { key: "total",      label: "Total" },
  { key: "tickets",    label: "Tickets ($)" },
  { key: "comprados",  label: "Comprados (#)" },
  { key: "ffbb",       label: "FF&BB" },
  { key: "marcas",     label: "Marcas" },
  { key: "asistentes", label: "Asistentes" },
];

function metricValue(r: OnepagerListadoTableRow, m: Metric): number {
  switch (m) {
    case "total":
      return r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
    case "tickets":
      return r.ventaTickets;
    case "comprados":
      return r.ticketsComprados;
    case "ffbb":
      return r.ventaFfBb;
    case "marcas":
      return r.ventaMarcas;
    case "asistentes":
      return r.asistentes ?? 0;
  }
}

function isMetricCurrency(m: Metric): boolean {
  return m === "total" || m === "tickets" || m === "ffbb" || m === "marcas";
}

function fmtMetric(value: number, m: Metric): string {
  return isMetricCurrency(m)
    ? fmtClp(value)
    : Math.round(value).toLocaleString("es-CL");
}

function fmtMetricAxis(value: number, m: Metric): string {
  return isMetricCurrency(m) ? fmtClpShort(value) : fmtNumShort(value);
}

export default function OnepagerListadoTable({
  rows,
  marcaClientes,
  marcaMatrix,
}: {
  rows: OnepagerListadoTableRow[];
  marcaClientes: MarcaCliente[];
  marcaMatrix: MarcaMatrixCell[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("eventos");
  // Multi-select: Set vacío = "todas/todos" (sin filtro).
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [grupos, setGrupos] = useState<Set<string>>(new Set());
  // Estado del bar chart inferior.
  const [metric, setMetric] = useState<Metric>("total");
  const [sortMode, setSortMode] = useState<SortMode>("fecha-asc");
  // Sheet global para imputar marcas (matriz cliente × evento).
  const [marcaSheetOpen, setMarcaSheetOpen] = useState(false);

  // Eventos que recibe el sheet — usa el dataset completo, no el filtrado de
  // la tabla, así el sheet puede aplicar su propio filtro de categoría.
  const matrixEventos = useMemo<MatrixEvento[]>(
    () =>
      rows.map((r) => ({
        eventoId: r.eventoId,
        nombre: r.nombre || r.eventoId,
        categoriaEvento: r.categoriaEvento,
        fechaEvento: r.fechaEvento,
      })),
    [rows],
  );

  const categoriasOpts = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.categoriaEvento) set.add(r.categoriaEvento);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [rows]);

  const gruposOpts = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.categoriaEvento2) set.add(r.categoriaEvento2);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [rows]);

  const filtered = useMemo(
    () =>
      categorias.size === 0
        ? rows
        : rows.filter((r) => categorias.has(r.categoriaEvento)),
    [rows, categorias],
  );

  // En modo "comparar categorías": el filtro es por CategoriaEvento2 (grupo
  // amplio). El agregado por categoría se calcula sobre los eventos que caen
  // dentro de los grupos seleccionados (Set vacío = todos).
  const rowsForAgg = useMemo(
    () =>
      grupos.size === 0
        ? rows
        : rows.filter((r) => grupos.has(r.categoriaEvento2 || SIN_GRUPO)),
    [rows, grupos],
  );

  function toggleCategoria(c: string) {
    setCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function toggleGrupo(g: string) {
    setGrupos((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  const aggByCategoria = useMemo<CategoriaAgg[]>(() => {
    const map = new Map<string, CategoriaAgg>();
    for (const r of rowsForAgg) {
      const key = r.categoriaEvento || SIN_CATEGORIA;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          categoria: key,
          eventos: 0,
          ventaTickets: 0,
          ticketsComprados: 0,
          ventaFfBb: 0,
          ventaMarcas: 0,
          asistentes: 0,
          asistentesKnown: false,
        };
        map.set(key, agg);
      }
      agg.eventos += 1;
      agg.ventaTickets += r.ventaTickets;
      agg.ticketsComprados += r.ticketsComprados;
      agg.ventaFfBb += r.ventaFfBb;
      agg.ventaMarcas += r.ventaMarcas;
      if (r.asistentes != null) {
        agg.asistentes += r.asistentes;
        agg.asistentesKnown = true;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.ventaTickets +
        b.ventaFfBb +
        b.ventaMarcas -
        (a.ventaTickets + a.ventaFfBb + a.ventaMarcas),
    );
  }, [rowsForAgg]);

  // Eventos para el bar chart: respeta el filtro del modo activo.
  // - eventos: usa la selección de Categorías (filtered).
  // - categorias: usa la selección de Grupos (rowsForAgg, los eventos que
  //   caen dentro de esos CategoriaEvento2).
  const chartEvents = mode === "eventos" ? filtered : rowsForAgg;

  const chartData = useMemo(() => {
    const data = chartEvents.map((r) => ({
      eventoId: r.eventoId,
      nombre: r.nombre || r.eventoId,
      fecha: r.fechaEvento,
      categoria: r.categoriaEvento,
      value: metricValue(r, metric),
    }));
    if (sortMode === "fecha-asc") {
      data.sort((a, b) => a.fecha.localeCompare(b.fecha));
    } else {
      data.sort((a, b) => b.value - a.value);
    }
    return data;
  }, [chartEvents, metric, sortMode]);

  // Rango de calor para colorear barras (idéntico al de la columna Total).
  const chartHeat = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of chartData) {
      if (r.value < min) min = r.value;
      if (r.value > max) max = r.value;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    return { min, max };
  }, [chartData]);

  if (rows.length === 0) {
    return (
      <BrutalChartPanel title="Listado de eventos">
        <p className="font-mono-data text-sm text-black/50">Sin eventos.</p>
      </BrutalChartPanel>
    );
  }

  function go(eventoId: string) {
    router.push(`/onepager?event=${encodeURIComponent(eventoId)}`);
  }

  const totalTickets = filtered.reduce((a, r) => a + r.ventaTickets, 0);
  const totalCompr = filtered.reduce((a, r) => a + r.ticketsComprados, 0);
  const totalFfBb = filtered.reduce((a, r) => a + r.ventaFfBb, 0);
  const totalMarcas = filtered.reduce((a, r) => a + r.ventaMarcas, 0);
  const totalAsist = filtered.reduce((a, r) => a + (r.asistentes ?? 0), 0);

  // Rango de calor para la columna Total — relativo al subset visible.
  const eventosHeat = (() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of filtered) {
      const t = r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    return { min, max };
  })();

  const categoriasHeat = (() => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of aggByCategoria) {
      const t = r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;
    return { min, max };
  })();

  const aggTotalTickets = aggByCategoria.reduce((a, r) => a + r.ventaTickets, 0);
  const aggTotalCompr = aggByCategoria.reduce(
    (a, r) => a + r.ticketsComprados,
    0,
  );
  const aggTotalFfBb = aggByCategoria.reduce((a, r) => a + r.ventaFfBb, 0);
  const aggTotalMarcas = aggByCategoria.reduce((a, r) => a + r.ventaMarcas, 0);
  const aggTotalAsist = aggByCategoria.reduce((a, r) => a + r.asistentes, 0);
  const aggTotalEventos = aggByCategoria.reduce((a, r) => a + r.eventos, 0);

  const compareActive = mode === "categorias";

  return (
    <div className="space-y-6">
      <BrutalChartPanel title="Listado de eventos">
        <div className="space-y-4">
          {/* Header con toggle de modo + filtros de categoría/grupo */}
          <div className="flex flex-wrap items-center gap-2">
            {mode === "eventos" ? (
              <>
                <span className="font-mono-data uppercase text-[10px] text-black/70 mr-1">
                  Categoría
                </span>
                <button
                  type="button"
                  onClick={() => setCategorias(new Set())}
                  className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                    categorias.size === 0
                      ? "bg-black text-[#FFFF00]"
                      : "bg-white text-black hover:bg-[#FFFF00]"
                  }`}
                >
                  Todas
                </button>
                {categoriasOpts.map((c) => {
                  const active = categorias.has(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCategoria(c)}
                      className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                        active
                          ? "bg-black text-[#FFFF00]"
                          : "bg-white text-black hover:bg-[#FFFF00]"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
                <span className="font-mono-data uppercase text-[10px] text-black/70">
                  {filtered.length} de {rows.length} evento
                  {rows.length === 1 ? "" : "s"}
                  {categorias.size > 0
                    ? ` · ${categorias.size} seleccionada${categorias.size === 1 ? "" : "s"}`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono-data uppercase text-[10px] text-black/70 mr-1">
                  Grupo
                </span>
                <button
                  type="button"
                  onClick={() => setGrupos(new Set())}
                  className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                    grupos.size === 0
                      ? "bg-black text-[#FFFF00]"
                      : "bg-white text-black hover:bg-[#FFFF00]"
                  }`}
                >
                  Todos
                </button>
                {gruposOpts.map((g) => {
                  const active = grupos.has(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleGrupo(g)}
                      className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                        active
                          ? "bg-black text-[#FFFF00]"
                          : "bg-white text-black hover:bg-[#FFFF00]"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
                <span className="font-mono-data uppercase text-[10px] text-black/70">
                  {aggByCategoria.length} categoría
                  {aggByCategoria.length === 1 ? "" : "s"} · {rowsForAgg.length}{" "}
                  evento{rowsForAgg.length === 1 ? "" : "s"}
                  {grupos.size > 0
                    ? ` · ${grupos.size} grupo${grupos.size === 1 ? "" : "s"} seleccionado${grupos.size === 1 ? "" : "s"}`
                    : ""}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => setMarcaSheetOpen(true)}
              className="ml-auto font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] bg-[#FFFF00] text-black hover:bg-black hover:text-[#FFFF00] cursor-pointer transition-colors duration-150"
            >
              + Imputar marcas
            </button>
            <button
              type="button"
              onClick={() =>
                setMode(compareActive ? "eventos" : "categorias")
              }
              aria-pressed={compareActive}
              className={`font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] cursor-pointer transition-colors duration-150 ${
                compareActive
                  ? "bg-black text-[#FFFF00] hover:bg-[#FFFF00] hover:text-black"
                  : "bg-white text-black hover:bg-[#FFFF00]"
              }`}
            >
              {compareActive ? "Ver eventos" : "Comparar categorías"}
            </button>
          </div>

          {mode === "eventos" ? (
            <div className="border-4 border-black bg-white max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-black text-white">
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                      Evento
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                      Fecha
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Tickets
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Comprados
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      FF&BB
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Marcas
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Total
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Asistentes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const total = r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
                    const t = heatT(total, eventosHeat.min, eventosHeat.max);
                    return (
                      <tr
                        key={r.eventoId}
                        role="link"
                        tabIndex={0}
                        aria-label={`Ver detalle de ${r.nombre || r.eventoId}`}
                        onClick={() => go(r.eventoId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            go(r.eventoId);
                          }
                        }}
                        className="border-b-2 border-black hover:bg-[#FFFF00] focus:bg-[#FFFF00] focus:outline-none cursor-pointer transition-colors duration-150"
                      >
                        <td className="font-mono-data text-sm px-3 py-2 font-bold border-r-2 border-black">
                          {r.nombre || r.eventoId}
                        </td>
                        <td className="font-mono-data text-xs px-3 py-2 border-r-2 border-black tabular-nums">
                          {fmtFecha(r.fechaEvento)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {fmtClp(r.ventaTickets)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {r.ticketsComprados.toLocaleString("es-CL")}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {fmtClp(r.ventaFfBb)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {fmtClp(r.ventaMarcas)}
                        </td>
                        <td
                          style={heatStyle(t)}
                          className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums"
                        >
                          {fmtClp(total)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">
                          {r.asistentes != null
                            ? r.asistentes.toLocaleString("es-CL")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#FFFF00]">
                    <td className="font-mono-data text-sm px-3 py-2 font-bold uppercase border-r-2 border-black">
                      Total ({filtered.length} evento
                      {filtered.length === 1 ? "" : "s"})
                    </td>
                    <td className="font-mono-data text-xs px-3 py-2 border-r-2 border-black" />
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(totalTickets)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {totalCompr.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(totalFfBb)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(totalMarcas)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(totalTickets + totalFfBb + totalMarcas)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold tabular-nums">
                      {totalAsist.toLocaleString("es-CL")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-4 border-black bg-white max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-black text-white">
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                      Categoría
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Eventos
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Tickets
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Comprados
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      FF&BB
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Marcas
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Total
                    </th>
                    <th className="bg-black font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                      Asistentes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggByCategoria.map((r) => {
                    const total = r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
                    const t = heatT(total, categoriasHeat.min, categoriasHeat.max);
                    return (
                      <tr
                        key={r.categoria}
                        className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
                      >
                        <td className="font-mono-data text-sm px-3 py-2 font-bold border-r-2 border-black">
                          {r.categoria}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {r.eventos.toLocaleString("es-CL")}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {fmtClp(r.ventaTickets)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {r.ticketsComprados.toLocaleString("es-CL")}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {fmtClp(r.ventaFfBb)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                          {fmtClp(r.ventaMarcas)}
                        </td>
                        <td
                          style={heatStyle(t)}
                          className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums"
                        >
                          {fmtClp(total)}
                        </td>
                        <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">
                          {r.asistentesKnown
                            ? r.asistentes.toLocaleString("es-CL")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#FFFF00]">
                    <td className="font-mono-data text-sm px-3 py-2 font-bold uppercase border-r-2 border-black">
                      Total ({aggByCategoria.length} categoría
                      {aggByCategoria.length === 1 ? "" : "s"})
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {aggTotalEventos.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(aggTotalTickets)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {aggTotalCompr.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(aggTotalFfBb)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(aggTotalMarcas)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(aggTotalTickets + aggTotalFfBb + aggTotalMarcas)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold tabular-nums">
                      {aggTotalAsist.toLocaleString("es-CL")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BrutalChartPanel>

      <BrutalChartPanel title="Comparar eventos">
        <ComparativoChart
          data={chartData}
          metric={metric}
          setMetric={setMetric}
          sortMode={sortMode}
          setSortMode={setSortMode}
          heat={chartHeat}
        />
      </BrutalChartPanel>

      <MarcaMatrixSheet
        open={marcaSheetOpen}
        onClose={() => setMarcaSheetOpen(false)}
        eventos={matrixEventos}
        clientes={marcaClientes}
        matrix={marcaMatrix}
      />
    </div>
  );
}

// ---------------------------------------------------------- Bar chart panel

type ChartDatum = {
  eventoId: string;
  nombre: string;
  fecha: string;
  categoria: string;
  value: number;
};

function ComparativoChart({
  data,
  metric,
  setMetric,
  sortMode,
  setSortMode,
  heat,
}: {
  data: ChartDatum[];
  metric: Metric;
  setMetric: (m: Metric) => void;
  sortMode: SortMode;
  setSortMode: (s: SortMode) => void;
  heat: { min: number; max: number };
}) {
  const sortLabel =
    sortMode === "fecha-asc" ? "Fecha ↑" : "Valor ↓";

  // Color por barra usando el mismo mapa de calor de la columna Total —
  // permite leer la magnitud de un vistazo, no sólo por altura.
  function barColor(value: number): string {
    const t = heatT(value, heat.min, heat.max);
    // mezclamos con blanco para que las barras chicas no queden invisibles
    const r = Math.round(255 * (1 - t) + 255 * t);
    const g = Math.round(255 * (1 - t) + 80 * t);
    const b = Math.round(255 * (1 - t) + 30 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono-data uppercase text-[10px] text-black/70 mr-1">
          ¿Qué variable querés graficar?
        </span>
        {METRICS.map((m) => {
          const active = metric === m.key;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={active}
              onClick={() => setMetric(m.key)}
              className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                active
                  ? "bg-black text-[#FFFF00]"
                  : "bg-white text-black hover:bg-[#FFFF00]"
              }`}
            >
              {m.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            setSortMode(sortMode === "fecha-asc" ? "valor-desc" : "fecha-asc")
          }
          aria-label="Cambiar orden"
          className="ml-auto font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black bg-white shadow-[4px_4px_0px_#000] cursor-pointer hover:bg-[#FFFF00] transition-colors duration-150"
        >
          {sortLabel}
        </button>
      </div>

      {data.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">
          Sin eventos para graficar con el filtro actual.
        </p>
      ) : (
        <div className="border-4 border-black bg-white p-3">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 64, left: 8 }}
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
                height={70}
                tick={{ fontFamily: "monospace", fontSize: 10, fill: "#000" }}
              />
              <YAxis
                stroke="#000"
                tickLine={false}
                tickFormatter={(v: number) => fmtMetricAxis(v, metric)}
                tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
                width={64}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,0,0.15)" }}
                content={<ChartTooltip metric={metric} />}
              />
              <Bar
                dataKey="value"
                stroke="#000"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.eventoId} fill={barColor(d.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

type TooltipPayloadEntry = {
  value?: number | string;
  payload?: ChartDatum;
};

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  metric: Metric;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none px-3 py-2 font-mono-data text-xs">
      <div className="font-bold uppercase mb-1 truncate max-w-[260px]">
        {d.nombre}
      </div>
      <div className="text-[10px] text-black/60 mb-1">
        {fmtFecha(d.fecha)}
        {d.categoria ? ` · ${d.categoria}` : ""}
      </div>
      <div className="flex items-center gap-2">
        <span className="uppercase">
          {METRICS.find((m) => m.key === metric)?.label ?? metric}
        </span>
        <span className="ml-auto font-bold whitespace-nowrap">
          {fmtMetric(d.value, metric)}
        </span>
      </div>
    </div>
  );
}
