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
import { axisTick, BRAND, gridProps, heatmapScale, SURFACE } from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import BrutalChartPanel from "./BrutalChartPanel";
import MarcaMatrixSheet, {
  type MatrixEvento,
} from "./MarcaMatrixSheet";
import FfbbConsumoChart, {
  type FfbbConsumoEvento,
} from "./FfbbConsumoChart";
import MarcaEvolucionChart from "./MarcaEvolucionChart";
import MesasVipCard from "./MesasVipCard";
import MediosMatrixSheet from "./MediosMatrixSheet";
import ProductoMatrixSheet from "./ProductoMatrixSheet";
import type { MarcaClienteRow, MarcaMatrixCell } from "@/lib/queries/marca";
import type { MarcaClienteTagRow } from "@/lib/queries/medios";
import type {
  MarcaClienteProductoTagRow,
  ProductoMatrixCell,
} from "@/lib/queries/producto";
import type {
  MesasVipClienteRow,
  MesasVipMatrixCell,
} from "@/lib/queries/mesasVip";
import type { OnepagerFfbbConsumoRow } from "@/lib/queries/onepager";
import { brutoToNeto } from "@/lib/constants/tax";
import {
  currentSeasonLabel,
  isCurrentSeasonCategory,
} from "@/lib/utils/season";

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
  // Unabase (marts.finanzas_gastos / finanzas_ventas), NETO. null = el evento no
  // tiene negocio vigente con datos → se pinta "—" y no suma al total.
  costos: number | null;
  facturado: number | null;
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
  costos: number;
  costosKnown: boolean;
  facturado: number;
  facturadoKnown: boolean;
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
 * Estilo de calor: usa la escala morada de marca (t=0 → #FAFAFA, t=1 → morado
 * #9F99F8). Mantiene el texto legible sobre la celda.
 */
function heatStyle(t: number): React.CSSProperties {
  return { backgroundColor: heatmapScale(t).hex() };
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
  | "costos"
  | "facturado"
  | "asistentes";
type SortMode = "fecha-asc" | "valor-desc";

const METRICS: { key: Metric; label: string }[] = [
  { key: "total",      label: "Total" },
  { key: "tickets",    label: "Tickets ($)" },
  { key: "comprados",  label: "Comprados (#)" },
  { key: "ffbb",       label: "FF&BB" },
  { key: "marcas",     label: "Marcas" },
  { key: "costos",     label: "Costos" },
  { key: "facturado",  label: "Facturado" },
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
    case "costos":
      return r.costos ?? 0;
    case "facturado":
      return r.facturado ?? 0;
    case "asistentes":
      return r.asistentes ?? 0;
  }
}

function isMetricCurrency(m: Metric): boolean {
  return (
    m === "total" ||
    m === "tickets" ||
    m === "ffbb" ||
    m === "marcas" ||
    m === "costos" ||
    m === "facturado"
  );
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
  ffbbConsumo,
  mesasVipClientes,
  mesasVipMatrix,
  mediosMarcas,
  mediosMatrix,
  productoMarcas,
  productoMatrix,
}: {
  rows: OnepagerListadoTableRow[];
  marcaClientes: MarcaClienteRow[];
  marcaMatrix: MarcaMatrixCell[];
  ffbbConsumo: OnepagerFfbbConsumoRow[];
  mesasVipClientes: MesasVipClienteRow[];
  mesasVipMatrix: MesasVipMatrixCell[];
  mediosMarcas: MarcaClienteTagRow[];
  mediosMatrix: MarcaMatrixCell[];
  productoMarcas: MarcaClienteProductoTagRow[];
  productoMatrix: ProductoMatrixCell[];
}) {
  const router = useRouter();
  const temporadaActual = useMemo(() => currentSeasonLabel(), []);
  const [mode, setMode] = useState<Mode>("eventos");
  // Multi-select: Set vacío = "todas/todos" (sin filtro).
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [grupos, setGrupos] = useState<Set<string>>(new Set());
  // Estado del bar chart inferior.
  const [metric, setMetric] = useState<Metric>("total");
  const [sortMode, setSortMode] = useState<SortMode>("fecha-asc");
  // Sheet global para imputar marcas (matriz cliente × evento).
  const [marcaSheetOpen, setMarcaSheetOpen] = useState(false);
  // Sheet global para imputar medios (plan de medios por marca × evento).
  const [mediosSheetOpen, setMediosSheetOpen] = useState(false);
  // Sheet global para imputar producto (plan de producto por marca × evento).
  const [productoSheetOpen, setProductoSheetOpen] = useState(false);
  // Marcas con plan de medios activo (filas del gráfico evolutivo de medios).
  const mediosClientes = useMemo<MarcaClienteRow[]>(
    () => mediosMarcas.filter((m) => m.tienePlanMedios),
    [mediosMarcas],
  );
  // Marcas con plan de producto activo (filas del gráfico evolutivo de producto).
  const productoClientes = useMemo<MarcaClienteRow[]>(
    () => productoMarcas.filter((m) => m.tienePlanProducto),
    [productoMarcas],
  );
  // Matriz neta para el gráfico de producto: el precio afecto trae IVA incluido
  // (neto = ÷1,19); el exento ya ES neto. MarcaEvolucionChart consume montoNeto.
  const productoChartMatrix = useMemo<MarcaMatrixCell[]>(
    () =>
      productoMatrix.map((c) => ({
        clienteId: c.clienteId,
        eventoId: c.eventoId,
        montoNeto: c.exento ? Math.round(c.precio) : brutoToNeto(c.precio),
      })),
    [productoMatrix],
  );

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
          costos: 0,
          costosKnown: false,
          facturado: 0,
          facturadoKnown: false,
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
      if (r.costos != null) {
        agg.costos += r.costos;
        agg.costosKnown = true;
      }
      if (r.facturado != null) {
        agg.facturado += r.facturado;
        agg.facturadoKnown = true;
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

  // Eventos en scope (mismos que alimentan "Comparar eventos") para el
  // gráfico de consumo FF&BB, con asistentes para el modo per cápita.
  const consumoEventos = useMemo<FfbbConsumoEvento[]>(
    () =>
      chartEvents.map((r) => ({
        eventoId: r.eventoId,
        nombre: r.nombre || r.eventoId,
        fecha: r.fechaEvento,
        asistentes: r.asistentes,
      })),
    [chartEvents],
  );

  if (rows.length === 0) {
    return (
      <BrutalChartPanel title="Listado de eventos">
        <p className="font-sans text-sm text-[#999999]">Sin eventos.</p>
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
  const totalCostos = filtered.reduce((a, r) => a + (r.costos ?? 0), 0);
  const totalFacturado = filtered.reduce((a, r) => a + (r.facturado ?? 0), 0);

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
  const aggTotalCostos = aggByCategoria.reduce((a, r) => a + r.costos, 0);
  const aggTotalFacturado = aggByCategoria.reduce((a, r) => a + r.facturado, 0);
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
                <span className="font-sans text-xs text-[#666666] mr-1">
                  Categoría
                </span>
                <button
                  type="button"
                  onClick={() => setCategorias(new Set())}
                  className={`font-sans text-xs leading-none px-3 py-2 rounded-full border cursor-pointer transition-colors duration-150 ${
                    categorias.size === 0
                      ? "bg-[#F0EFFE] text-[#9F99F8] border-[#E5E5E5]"
                      : "bg-white text-[#666666] border-[#E5E5E5] hover:text-[#333333]"
                  }`}
                >
                  Todas
                </button>
                {categoriasOpts.map((c) => {
                  const active = categorias.has(c);
                  const currentSeason = isCurrentSeasonCategory(
                    c,
                    temporadaActual,
                  );
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={active}
                      title={
                        currentSeason
                          ? `Temporada actual ${temporadaActual}`
                          : undefined
                      }
                      onClick={() => toggleCategoria(c)}
                      className={`font-sans text-xs leading-none px-3 py-2 rounded-full border cursor-pointer transition-colors duration-150 ${
                        active
                          ? "bg-[#F0EFFE] text-[#9F99F8] border-[#E5E5E5]"
                          : currentSeason
                            ? "bg-[#FAFAFA] text-[#333333] font-medium border-[#E5E5E5] hover:text-[#333333]"
                          : "bg-white text-[#666666] border-[#E5E5E5] hover:text-[#333333]"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
                <span className="font-sans text-xs text-[#666666]">
                  {filtered.length} de {rows.length} evento
                  {rows.length === 1 ? "" : "s"}
                  {categorias.size > 0
                    ? ` · ${categorias.size} seleccionada${categorias.size === 1 ? "" : "s"}`
                    : ""}
                </span>
              </>
            ) : (
              <>
                <span className="font-sans text-xs text-[#666666] mr-1">
                  Grupo
                </span>
                <button
                  type="button"
                  onClick={() => setGrupos(new Set())}
                  className={`font-sans text-xs leading-none px-3 py-2 rounded-full border cursor-pointer transition-colors duration-150 ${
                    grupos.size === 0
                      ? "bg-[#F0EFFE] text-[#9F99F8] border-[#E5E5E5]"
                      : "bg-white text-[#666666] border-[#E5E5E5] hover:text-[#333333]"
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
                      className={`font-sans text-xs leading-none px-3 py-2 rounded-full border cursor-pointer transition-colors duration-150 ${
                        active
                          ? "bg-[#F0EFFE] text-[#9F99F8] border-[#E5E5E5]"
                          : "bg-white text-[#666666] border-[#E5E5E5] hover:text-[#333333]"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
                <span className="font-sans text-xs text-[#666666]">
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
              onClick={() =>
                setMode(compareActive ? "eventos" : "categorias")
              }
              aria-pressed={compareActive}
              className={`ml-auto rounded-lg border px-4 py-2 font-sans font-medium text-sm cursor-pointer transition-colors duration-150 ${
                compareActive
                  ? "border-[#E5E5E5] bg-[#F0EFFE] text-[#9F99F8]"
                  : "border-[#333333] bg-white text-[#333333] hover:bg-[#FAFAFA]"
              }`}
            >
              {compareActive ? "Ver eventos" : "Comparar categorías"}
            </button>
          </div>

          {mode === "eventos" ? (
            <div className="bg-white border border-[#E5E5E5] rounded-lg max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
                      Evento
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
                      Fecha
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Tickets
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Comprados
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      FF&BB
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Marcas
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Total
                    </th>
                    <th
                      className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right"
                      title="Gasto neto documentado en Unabase (marts.finanzas_gastos)"
                    >
                      Costos
                    </th>
                    <th
                      className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right"
                      title="Venta neta facturada en Unabase (marts.finanzas_ventas)"
                    >
                      Facturado
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
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
                        className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] focus:bg-[#FAFAFA] focus:outline-none cursor-pointer transition-colors duration-150"
                      >
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 font-bold border-r border-[#E5E5E5]">
                          {r.nombre || r.eventoId}
                        </td>
                        <td className="font-sans text-xs text-[#666666] px-4 py-3 border-r border-[#E5E5E5] tabular-nums">
                          {fmtFecha(r.fechaEvento)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {fmtClp(r.ventaTickets)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.ticketsComprados.toLocaleString("es-CL")}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {fmtClp(r.ventaFfBb)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {fmtClp(r.ventaMarcas)}
                        </td>
                        <td
                          style={heatStyle(t)}
                          className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums"
                        >
                          {fmtClp(total)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.costos != null ? fmtClp(r.costos) : "—"}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.facturado != null ? fmtClp(r.facturado) : "—"}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                          {r.asistentes != null
                            ? r.asistentes.toLocaleString("es-CL")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#FAFAFA] border-t border-[#E5E5E5]">
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 font-bold border-r border-[#E5E5E5]">
                      Total ({filtered.length} evento
                      {filtered.length === 1 ? "" : "s"})
                    </td>
                    <td className="font-sans text-xs text-[#666666] px-4 py-3 border-r border-[#E5E5E5]" />
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(totalTickets)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {totalCompr.toLocaleString("es-CL")}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(totalFfBb)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(totalMarcas)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(totalTickets + totalFfBb + totalMarcas)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(totalCostos)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(totalFacturado)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold tabular-nums">
                      {totalAsist.toLocaleString("es-CL")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E5E5] rounded-lg max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
                      Categoría
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Eventos
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Tickets
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Comprados
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      FF&BB
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Marcas
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                      Total
                    </th>
                    <th
                      className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right"
                      title="Gasto neto documentado en Unabase (marts.finanzas_gastos)"
                    >
                      Costos
                    </th>
                    <th
                      className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right"
                      title="Venta neta facturada en Unabase (marts.finanzas_ventas)"
                    >
                      Facturado
                    </th>
                    <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
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
                        className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                      >
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 font-bold border-r border-[#E5E5E5]">
                          {r.categoria}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.eventos.toLocaleString("es-CL")}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {fmtClp(r.ventaTickets)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.ticketsComprados.toLocaleString("es-CL")}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {fmtClp(r.ventaFfBb)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {fmtClp(r.ventaMarcas)}
                        </td>
                        <td
                          style={heatStyle(t)}
                          className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums"
                        >
                          {fmtClp(total)}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.costosKnown ? fmtClp(r.costos) : "—"}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right border-r border-[#E5E5E5] tabular-nums">
                          {r.facturadoKnown ? fmtClp(r.facturado) : "—"}
                        </td>
                        <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                          {r.asistentesKnown
                            ? r.asistentes.toLocaleString("es-CL")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-[#FAFAFA] border-t border-[#E5E5E5]">
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 font-bold border-r border-[#E5E5E5]">
                      Total ({aggByCategoria.length} categoría
                      {aggByCategoria.length === 1 ? "" : "s"})
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {aggTotalEventos.toLocaleString("es-CL")}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(aggTotalTickets)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {aggTotalCompr.toLocaleString("es-CL")}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(aggTotalFfBb)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(aggTotalMarcas)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(aggTotalTickets + aggTotalFfBb + aggTotalMarcas)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(aggTotalCostos)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold border-r border-[#E5E5E5] tabular-nums">
                      {fmtClp(aggTotalFacturado)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-bold tabular-nums">
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

      <BrutalChartPanel title="FF&BB — Consumo por evento">
        <FfbbConsumoChart events={consumoEventos} consumo={ffbbConsumo} />
      </BrutalChartPanel>

      <BrutalChartPanel title="Marcas — Ingresos por evento">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setMarcaSheetOpen(true)}
            className="rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer transition-colors duration-150"
          >
            + Imputar marcas
          </button>
        </div>
        <MarcaEvolucionChart
          events={consumoEventos}
          clientes={marcaClientes}
          matrix={marcaMatrix}
        />
      </BrutalChartPanel>

      <BrutalChartPanel title="MEDIOS — Ingresos por evento">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setMediosSheetOpen(true)}
            className="rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer transition-colors duration-150"
          >
            + Imputar medios
          </button>
        </div>
        <MarcaEvolucionChart
          events={consumoEventos}
          clientes={mediosClientes}
          matrix={mediosMatrix}
          aggLabel="Medios (todos)"
          filterLabel="Marca (medios)"
          emptyLabel="Sin ingresos de medios para los filtros seleccionados."
        />
      </BrutalChartPanel>

      <BrutalChartPanel title="PRODUCTO — Ingresos por evento">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setProductoSheetOpen(true)}
            className="rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer transition-colors duration-150"
          >
            + Imputar producto
          </button>
        </div>
        <MarcaEvolucionChart
          events={consumoEventos}
          clientes={productoClientes}
          matrix={productoChartMatrix}
          aggLabel="Producto (todos)"
          filterLabel="Marca (producto)"
          emptyLabel="Sin ingresos de producto para los filtros seleccionados."
        />
      </BrutalChartPanel>

      <MesasVipCard
        eventos={matrixEventos}
        scopedEvents={consumoEventos}
        clientes={mesasVipClientes}
        matrix={mesasVipMatrix}
      />

      <MarcaMatrixSheet
        open={marcaSheetOpen}
        onClose={() => setMarcaSheetOpen(false)}
        eventos={matrixEventos}
        clientes={marcaClientes}
        matrix={marcaMatrix}
      />

      <MediosMatrixSheet
        open={mediosSheetOpen}
        onClose={() => setMediosSheetOpen(false)}
        eventos={matrixEventos}
        marcas={mediosMarcas}
        matrix={mediosMatrix}
      />

      <ProductoMatrixSheet
        open={productoSheetOpen}
        onClose={() => setProductoSheetOpen(false)}
        eventos={matrixEventos}
        marcas={productoMarcas}
        matrix={productoMatrix}
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
  // permite leer la magnitud de un vistazo, no sólo por altura. Usa la
  // escala morada de marca (heatmapScale) para mantener la coherencia.
  function barColor(value: number): string {
    const t = heatT(value, heat.min, heat.max);
    return heatmapScale(t).hex();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-sans text-xs text-[#666666] mr-1">
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
              className={`font-sans text-xs leading-none px-3 py-2 rounded-full border cursor-pointer transition-colors duration-150 ${
                active
                  ? "bg-[#F0EFFE] text-[#9F99F8] border-[#E5E5E5]"
                  : "bg-white text-[#666666] border-[#E5E5E5] hover:text-[#333333]"
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
          className="ml-auto rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
        >
          {sortLabel}
        </button>
      </div>

      {data.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          Sin eventos para graficar con el filtro actual.
        </p>
      ) : (
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-3">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 64, left: 8 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="nombre"
                axisLine={{ stroke: SURFACE.divider }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={70}
                tick={axisTick}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtMetricAxis(v, metric)}
                tick={axisTick}
                width={64}
              />
              <Tooltip
                cursor={{ fill: SURFACE.canvas }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as ChartDatum | undefined;
                  return (
                    <ChartTooltip
                      active={active}
                      label={
                        d
                          ? `${d.nombre} · ${fmtFecha(d.fecha)}${
                              d.categoria ? ` · ${d.categoria}` : ""
                            }`
                          : undefined
                      }
                      items={(payload ?? []).map((p) => ({
                        name: METRICS.find((m) => m.key === metric)?.label ?? metric,
                        color: BRAND.purple,
                        formatted: fmtMetric((p.payload as ChartDatum).value, metric),
                      }))}
                    />
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
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
