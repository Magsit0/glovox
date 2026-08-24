"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CarddaConsumoRow,
  CarddaFeeRow,
  DayCell,
  EventoGridRow,
  NoAtribuidoCampanaDia,
  NoAtribuidoRow,
} from "@/lib/queries/inversion-medios";
import type { CargoExtra } from "@/db/schema";
import {
  costoMensual,
  costoSemanal,
  METODO_LABEL,
  METODOS_CARGO,
  resumenCargos,
  type MetodoCargo,
} from "@/lib/inversion-medios/cargos";
import {
  buildFacturacion,
  CANAL_FACT_LABEL,
  CANALES_FACT,
  fmtPeriodo,
  resumenFacturacion,
  type CanalFact,
  type FacturacionMes,
} from "@/lib/inversion-medios/facturacion";
import { deleteCargoAction, upsertCargoAction } from "../actions";
import { fmtDiaCorto, fmtUsd } from "./format";

type Props = {
  desde: string; // YYYY-MM-DD, inicio del rango cargado
  hasta: string; // YYYY-MM-DD, fin del rango cargado
  grid: EventoGridRow[];
  /** Totales del evento COMPLETO (histórico), no solo del rango cargado. */
  totales: Record<string, { totalPlan: number; totalReal: number }>;
  noAtribuido: NoAtribuidoRow[];
  /** Gasto diario por campaña del grupo "no atribuido" (sub-filas desplegables). */
  noAtribuidoCampanas: NoAtribuidoCampanaDia[];
  realMaxFecha: string;
  hoy: string;
  cargos: CargoExtra[];
  /** Consumo real de las tarjetas Cardda por mes×canal (facturación histórica). */
  carddaConsumo: CarddaConsumoRow[];
  /** Consumo Cardda por SEMANA (lunes ISO)×canal — granularidad fina del bloque. */
  carddaConsumoSem: CarddaConsumoRow[];
  /** Fee mensual de Cardda por período. */
  carddaFee: CarddaFeeRow[];
  /** Habilita editar los cargos extra. Va con el grant del dashboard, no con el rol. */
  canEdit: boolean;
};

// Geometría fija de la grilla (box-border: el ancho incluye el borde).
const COL_W = 64; // w-16
const STICKY_W = 224; // w-56
// Máximo de sub-filas individuales al desplegar "No atribuido" (el resto se
// agrega en una fila "otras N campañas" para no inflar el DOM).
const NA_MAX_FILAS = 20;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];

function shiftMes(iso: string, delta: number, edge: "inicio" | "fin"): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ym = d.toISOString().slice(0, 7);
  if (edge === "inicio") return `${ym}-01`;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

export default function InversionMediosPanel({
  desde,
  hasta,
  grid,
  totales,
  noAtribuido,
  noAtribuidoCampanas,
  realMaxFecha,
  hoy,
  cargos,
  carddaConsumo,
  carddaConsumoSem,
  carddaFee,
  canEdit,
}: Props) {
  const router = useRouter();
  // Resumen superior: KPIs globales o desglose por canal (mismo tramo visible).
  const [modo, setModo] = useState<"resumen" | "canal">("resumen");
  // Listado de campañas "no atribuido" (desplegable desde su fila). naShown =
  // cuántas van como fila individual; el resto vive agregado en "otras N" y se
  // libera por tandas con "mostrar 20 más" (control del tamaño del DOM).
  const [naOpen, setNaOpen] = useState(false);
  const [naShown, setNaShown] = useState(NA_MAX_FILAS);

  const dias = useMemo(() => {
    const out: string[] = [];
    const d = new Date(`${desde}T00:00:00Z`);
    const end = new Date(`${hasta}T00:00:00Z`);
    while (d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }, [desde, hasta]);

  // Los eventos vienen de la tabla madre categoriaEvento (vía mergeGrid): filas
  // ordenadas por fecha del evento. No hay alta manual.
  const rows = useMemo<EventoGridRow[]>(
    () =>
      [...grid].sort(
        (a, b) =>
          a.ordenFecha.localeCompare(b.ordenFecha) || a.eventoId.localeCompare(b.eventoId),
      ),
    [grid],
  );

  // Índices con datos por fila (para la visibilidad según viewport).
  const dataIdx = useMemo(
    () => rows.map((r) => r.days.map((d) => d.plan != null || d.real != null)),
    [rows],
  );

  const noAtribuidoByFecha = useMemo(
    () => new Map(noAtribuido.map((r) => [r.fecha, r])),
    [noAtribuido],
  );

  // Etiqueta del período CARGADO del calendario (desde–hasta) para los totales
  // de las sub-filas — "en el rango" a secas resultaba ambiguo.
  const rangoCargadoLabel = `${fmtDiaCorto(desde)} – ${fmtDiaCorto(hasta)}`;
  const verMasNa = useCallback(() => setNaShown((n) => n + NA_MAX_FILAS), []);

  // Sub-filas de "No atribuido": una por campaña (las de mayor gasto) + una
  // fila agregada "otras N". Las individuales se liberan por tandas (naShown)
  // para no inflar el DOM (187 campañas × ~200 columnas serían ~40k celdas de
  // una vez); la partición top+otras == fila NA cierra siempre.
  const naCamps = useMemo(() => {
    const idx = new Map(dias.map((f, i) => [f, i]));
    const acc = new Map<
      string,
      { plataforma: string; nombre: string; dias: number[]; total: number }
    >();
    for (const r of noAtribuidoCampanas) {
      const col = idx.get(r.fecha);
      if (col === undefined || !r.gastoUsd) continue;
      const k = `${r.plataforma}|${r.campaignName}`;
      if (!acc.has(k)) {
        acc.set(k, {
          plataforma: r.plataforma,
          nombre: r.campaignName,
          dias: new Array(dias.length).fill(0),
          total: 0,
        });
      }
      const a = acc.get(k)!;
      a.dias[col] += r.gastoUsd;
      a.total += r.gastoUsd;
    }
    const all = [...acc.values()].sort((a, b) => b.total - a.total);
    const top = all.slice(0, naShown);
    let resto: { nombre: string; dias: number[]; total: number; ocultas: number } | null = null;
    if (all.length > naShown) {
      const diasResto = new Array(dias.length).fill(0);
      let total = 0;
      for (const c of all.slice(naShown)) {
        c.dias.forEach((v, i) => (diasResto[i] += v));
        total += c.total;
      }
      resto = {
        nombre: `otras ${all.length - naShown} campañas`,
        dias: diasResto,
        total,
        ocultas: all.length - naShown,
      };
    }
    return { top, resto, totalCampanas: all.length };
  }, [noAtribuidoCampanas, dias, naShown]);

  // ---------- Viewport: qué tramo del calendario se está mirando ----------
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [view, setView] = useState<{ a: number; b: number }>({ a: 0, b: 30 });

  const medirViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const a = Math.max(0, Math.floor(el.scrollLeft / COL_W));
    const visibleCols = Math.max(1, Math.ceil((el.clientWidth - STICKY_W) / COL_W));
    const b = Math.min(dias.length - 1, a + visibleCols - 1);
    setView((v) => (v.a === a && v.b === b ? v : { a, b }));
  }, [dias.length]);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(medirViewport);
  }, [medirViewport]);

  const irA = useCallback(
    (fecha: string, smooth = true) => {
      const el = scrollRef.current;
      const idx = dias.indexOf(fecha);
      if (!el || idx < 0) return;
      el.scrollTo({
        left: Math.max(0, idx * COL_W - COL_W * 2),
        behavior: smooth ? "smooth" : "auto",
      });
    },
    [dias],
  );

  // Al montar: arrancar mirando hoy. Al EXTENDER el rango, mostrar el mes que
  // se acaba de cargar (no volver a hoy — eso haría inalcanzable lo cargado).
  const rangoPrevio = useRef<{ desde: string; hasta: string } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const prev = rangoPrevio.current;
    rangoPrevio.current = { desde, hasta };
    if (prev === null) {
      irA(hoy, false); // primer montaje
    } else if (el && prev.desde !== desde) {
      el.scrollTo({ left: 0, behavior: "auto" }); // se prependió un mes: mostrarlo
    } else if (el && prev.hasta !== hasta) {
      el.scrollTo({ left: el.scrollWidth, behavior: "auto" }); // se apendió: mostrarlo
    }
    medirViewport();
  }, [desde, hasta, irA, medirViewport, hoy]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(medirViewport);
    obs.observe(el);
    return () => obs.disconnect();
  }, [medirViewport]);

  // ---------- Filas visibles: con plan o gasto en el tramo mirado ----------
  // Las filas NO se desmontan (se ocultan por CSS): desmontar descartaría una
  // edición en curso si su fila sale del tramo mientras se escribe.
  // Un evento cuya fecha aún NO pasó al inicio del tramo se muestra SIEMPRE,
  // tenga o no datos: su plan $0 es la alerta de que falta cargar presupuesto.
  const visibleIds = useMemo(() => {
    const out = new Set<string>();
    const inicioTramo = dias[view.a] ?? "";
    rows.forEach((r, i) => {
      if (r.fechaEvento && r.fechaEvento >= inicioTramo) {
        out.add(r.eventoId);
        return;
      }
      const flags = dataIdx[i];
      for (let j = view.a; j <= view.b && j < flags.length; j++) {
        if (flags[j]) {
          out.add(r.eventoId);
          return;
        }
      }
    });
    return out;
  }, [rows, dataIdx, view, dias]);

  // ---------- KPIs del tramo visible ----------
  const kpis = useMemo(() => {
    let plan = 0;
    let real = 0;
    let na = 0;
    for (const r of rows) {
      for (let j = view.a; j <= view.b && j < r.days.length; j++) {
        const c = r.days[j];
        if (c.plan != null) plan += c.plan;
        if (c.real != null) real += c.real;
      }
    }
    for (let j = view.a; j <= view.b && j < dias.length; j++) {
      na += noAtribuidoByFecha.get(dias[j])?.gastoUsd ?? 0;
    }
    return { plan, real, na };
  }, [rows, view, dias, noAtribuidoByFecha]);

  // ---------- Desglose por canal del tramo visible ----------
  // El gasto real trae split por plataforma en cada celda (y en no-atribuido);
  // el presupuesto es un monto diario TOTAL (la hoja nunca tuvo canal), así que
  // el plan se muestra como total y el real se abre por plataforma.
  const canal = useMemo(() => {
    let meta = 0;
    let google = 0;
    let tiktok = 0;
    let otras = 0;
    let plan = 0;
    for (const r of rows) {
      for (let j = view.a; j <= view.b && j < r.days.length; j++) {
        const c = r.days[j];
        meta += c.metaUsd;
        google += c.googleUsd;
        tiktok += c.tiktokUsd;
        otras += c.otrasUsd;
        if (c.plan != null) plan += c.plan;
      }
    }
    // El gasto no atribuido igual ocurrió en alguna plataforma → suma al canal.
    for (let j = view.a; j <= view.b && j < dias.length; j++) {
      const na = noAtribuidoByFecha.get(dias[j]);
      if (na) {
        meta += na.metaUsd;
        google += na.googleUsd;
        tiktok += na.tiktokUsd;
        otras += na.otrasUsd;
      }
    }
    // real incluye "otras" → reconcilia con kpis.real (gasto_usd total).
    return { meta, google, tiktok, otras, plan, real: meta + google + tiktok + otras };
  }, [rows, view, dias, noAtribuidoByFecha]);

  // Totales por día (columna) — sobre todas las filas cargadas.
  const totalesDia = useMemo(
    () =>
      dias.map((fecha, i) => {
        let plan = 0;
        let real = 0;
        for (const ev of rows) {
          const c = ev.days[i];
          if (c.plan != null) plan += c.plan;
          if (c.real != null) real += c.real;
        }
        return { fecha, plan, real };
      }),
    [rows, dias],
  );

  const rangoLabel =
    dias.length > 0
      ? `${fmtDiaCorto(dias[Math.min(view.a, dias.length - 1)])} – ${fmtDiaCorto(dias[Math.min(view.b, dias.length - 1)])}`
      : "";

  // Subtotal por semana (lun→dom): plan vs real de toda la operación (eventos +
  // no atribuido). El semáforo compara real contra el plan TRANSCURRIDO (días ≤
  // real-al), para no pintar verde una semana futura que solo no ocurrió aún.
  // La etiqueta se recorta al rango cargado y se marca "parcial" si está cortada.
  // Cálculo COMPLETO (todas las semanas): pesado, memoizado fuera del scroll.
  // El monto es el total de la semana (7 días), no un parcial del scroll, para
  // que el número no salte al desplazarse; el filtro por viewport es aparte.
  const semanas = useMemo(() => {
    const naByFecha = new Map(noAtribuido.map((r) => [r.fecha, r.gastoUsd]));
    const primero = dias[0];
    const ultimo = dias[dias.length - 1];
    const acc = new Map<
      string,
      {
        inicio: string;
        fin: string;
        plan: number;
        planTrans: number;
        real: number;
        idxMinData: number;
        idxMaxData: number;
      }
    >();
    dias.forEach((fecha, i) => {
      const d = new Date(`${fecha}T00:00:00Z`);
      const offset = (d.getUTCDay() + 6) % 7; // 0=lunes
      const lun = new Date(d);
      lun.setUTCDate(d.getUTCDate() - offset);
      const inicio = lun.toISOString().slice(0, 10);
      if (!acc.has(inicio)) {
        const dom = new Date(lun);
        dom.setUTCDate(lun.getUTCDate() + 6);
        acc.set(inicio, {
          inicio,
          fin: dom.toISOString().slice(0, 10),
          plan: 0,
          planTrans: 0,
          real: 0,
          idxMinData: Infinity,
          idxMaxData: -Infinity,
        });
      }
      const w = acc.get(inicio)!;
      const transcurrido = fecha <= realMaxFecha;
      let conMonto = false; // ¿este día aporta plan/real de la semana?
      for (const r of rows) {
        const c = r.days[i];
        if (c.plan != null) {
          w.plan += c.plan;
          if (transcurrido) w.planTrans += c.plan;
          conMonto = true;
        }
        if (c.real != null) {
          w.real += c.real;
          conMonto = true;
        }
      }
      const na = naByFecha.get(fecha) ?? 0;
      w.real += na;
      if (na > 0) conMonto = true;
      // rango de columnas CON MONTO de la semana: la card aparece cuando uno de
      // esos días entra en el viewport (mismo criterio de data-presencia que la
      // grilla), para no mostrar un total mientras la grilla dice "sin gasto".
      if (conMonto) {
        if (i < w.idxMinData) w.idxMinData = i;
        if (i > w.idxMaxData) w.idxMaxData = i;
      }
    });
    return [...acc.values()]
      .map((w) => ({
        ...w,
        // etiqueta recortada al rango cargado + flags de completitud
        inicioVista: w.inicio < primero ? primero : w.inicio,
        finVista: w.fin > ultimo ? ultimo : w.fin,
        futura: w.inicio > realMaxFecha, // aún no empieza (no hay real posible)
        parcial: w.inicio < primero || w.fin > ultimo || w.fin > realMaxFecha,
      }))
      .filter((w) => w.plan > 0 || w.real > 0)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [dias, rows, noAtribuido, realMaxFecha]);

  // Semanas del TRAMO VISIBLE: la card aparece cuando un día CON MONTO de la
  // semana entra en el viewport. Se mueve junto al calendario. Barato: filtra la
  // lista ya calculada por overlap de los índices con gasto/plan.
  // Lunes de la semana de HOY, la siguiente y la subsiguiente (hoy ya viene en
  // TZ Santiago). Sus cards se destacan en intensidad decreciente (100/50/25)
  // para ver de un vistazo el gasto planificado que viene.
  const lunesDestacados = useMemo(() => {
    const d = new Date(`${hoy}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const actual = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 7);
    const siguiente = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 7);
    const subsiguiente = d.toISOString().slice(0, 10);
    return { actual, siguiente, subsiguiente };
  }, [hoy]);

  const semanasVisibles = useMemo(
    () => semanas.filter((w) => w.idxMaxData >= view.a && w.idxMinData <= view.b),
    [semanas, view],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#333333]">
            Inversión en medios
          </h1>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Plan diario de publicidad digital (USD) vs gasto real por evento.
            Muévete libremente por el calendario: aparecen los eventos con presupuesto o
            gasto en el tramo que estás mirando
            {realMaxFecha ? ` · real al ${realMaxFecha}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Switch resumen ↔ por canal */}
          <div className="flex overflow-hidden rounded-lg border border-[#E5E5E5] bg-white font-sans text-sm">
            {(
              [
                ["resumen", "Resumen"],
                ["canal", "Por canal"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setModo(k)}
                className={`px-3 py-2 transition-colors ${
                  modo === k
                    ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                    : "text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => irA(hoy)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333]"
          >
            <CalendarDays className="h-4 w-4 text-[#666666]" /> Hoy
          </button>
        </div>
      </header>

      {/* Resumen del tramo visible: KPIs globales o desglose por canal */}
      {modo === "resumen" ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Kpi label={`Plan · ${rangoLabel}`} value={fmtUsd(kpis.plan)} />
          <Kpi label={`Real · ${rangoLabel}`} value={fmtUsd(kpis.real)} />
          <Kpi
            label="Varianza (real − plan)"
            value={fmtUsd(kpis.real - kpis.plan)}
            tone={kpis.real > kpis.plan ? "neg" : "pos"}
          />
          <Kpi
            label="No atribuido"
            value={fmtUsd(kpis.na)}
            hint="gasto sin evento en el tramo visible"
          />
        </div>
      ) : (
        <CanalResumen canal={canal} rangoLabel={rangoLabel} noAtribuido={kpis.na} />
      )}

      {/* Calendario. `isolate`: contiene los sticky internos (z-10/20/30) en su
          propio stacking context para que no pinten sobre la GroupNav (z-30). */}
      <div className="isolate overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="max-h-[600px] overflow-auto overscroll-x-contain"
        >
          <table className="border-separate border-spacing-0 font-sans text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-56 min-w-56 max-w-56 border-b border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2 text-left text-xs font-medium text-[#666666]">
                  Evento
                  <span className="block font-normal text-[#999999]">
                    {visibleIds.size} en el tramo visible
                  </span>
                </th>
                {dias.map((fecha, i) => {
                  const dia = Number(fecha.slice(8, 10));
                  const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay();
                  const esHoy = fecha === hoy;
                  const primerDia = dia === 1 || i === 0;
                  return (
                    <th
                      key={fecha}
                      className={`sticky top-0 z-20 w-16 min-w-16 max-w-16 border-b border-[#E5E5E5] px-0 py-1.5 text-center text-xs font-medium ${
                        esHoy
                          ? "bg-[#F0EFFE] text-[#9F99F8]"
                          : primerDia
                            ? "bg-white text-[#333333]"
                            : "bg-[#FAFAFA] text-[#666666]"
                      } ${primerDia && i > 0 ? "border-l" : ""}`}
                    >
                      <span className="block text-[10px] font-normal uppercase text-[#999999]">
                        {primerDia
                          ? `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(2, 4)}`
                          : DIAS_SEMANA[dow]}
                      </span>
                      {dia}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <FilaEvento
                  key={ev.eventoId}
                  ev={ev}
                  totales={totales[ev.eventoId]}
                  hoy={hoy}
                  realMaxFecha={realMaxFecha}
                  hidden={!visibleIds.has(ev.eventoId)}
                />
              ))}
              {visibleIds.size === 0 && (
                <tr>
                  <td className="sticky left-0 z-10 border-t border-r border-[#E5E5E5] bg-white px-4 py-8 text-sm text-[#999999]">
                    Sin eventos con presupuesto o gasto en este tramo
                  </td>
                  <td colSpan={dias.length} className="border-t border-[#E5E5E5]" />
                </tr>
              )}
              {/* Fila NO ATRIBUIDO: el gasto sin evento nunca desaparece */}
              <tr className="bg-[#FAFAFA]">
                <td className="sticky left-0 z-10 w-56 min-w-56 max-w-56 border-r border-t border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2">
                  <span className="font-medium text-[#666666]">No atribuido</span>
                  <p className="text-xs text-[#999999]">campañas sin evento reconocible</p>
                  {naCamps.totalCampanas > 0 && (
                    <button
                      onClick={() => setNaOpen((o) => !o)}
                      className="mt-1 inline-flex items-center gap-1 font-sans text-xs font-medium text-[#534AB7] transition-colors hover:text-[#3F3796]"
                      aria-expanded={naOpen}
                    >
                      {naOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      {naOpen ? "ocultar campañas" : `ver campañas (${naCamps.totalCampanas})`}
                    </button>
                  )}
                </td>
                {dias.map((fecha) => {
                  const r = noAtribuidoByFecha.get(fecha);
                  return (
                    <td
                      key={fecha}
                      className="w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] px-1 py-2 text-center tabular-nums text-xs text-[#666666]"
                    >
                      {r && r.gastoUsd > 0 ? fmtUsd(r.gastoUsd, 0) : "·"}
                    </td>
                  );
                })}
              </tr>
              {/* Sub-filas: campañas del grupo "no atribuido", alineadas a los
                  mismos días. Las de mayor gasto individuales + "otras N"
                  agregada. Se ocultan (CSS) si no tienen gasto en el tramo
                  mirado — misma mecánica que las filas de evento. */}
              {naOpen &&
                naCamps.top.map((c) => (
                  <NaCampRow
                    key={`${c.plataforma}|${c.nombre}`}
                    nombre={c.nombre}
                    dot={PLAT_DOT[c.plataforma] ?? "#B4B2A9"}
                    dotTitle={PLAT_LABEL[c.plataforma] ?? c.plataforma}
                    diasVals={c.dias}
                    total={c.total}
                    rango={rangoCargadoLabel}
                    hidden={!c.dias.slice(view.a, view.b + 1).some((v) => v > 0)}
                  />
                ))}
              {naOpen && naCamps.resto && (
                <NaCampRow
                  nombre={naCamps.resto.nombre}
                  dot="#B4B2A9"
                  dotTitle="Varias plataformas"
                  diasVals={naCamps.resto.dias}
                  total={naCamps.resto.total}
                  rango={rangoCargadoLabel}
                  // La fila agregada SIEMPRE se ve al expandir (aunque no tenga
                  // gasto en el tramo): es donde vive el botón "mostrar más".
                  hidden={false}
                  onVerMas={verMasNa}
                />
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-30 w-56 min-w-56 max-w-56 border-r border-t border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#333333]">
                  Total día (plan / real)
                </td>
                {totalesDia.map((d) => (
                  <td
                    key={d.fecha}
                    className="sticky bottom-0 z-20 w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] bg-white px-1 py-2 text-center tabular-nums text-xs"
                  >
                    <span className="block font-medium text-[#534AB7]">
                      {d.plan > 0 ? fmtUsd(d.plan, 0) : "·"}
                    </span>
                    <span className="block text-[#333333]">
                      {d.real > 0 ? fmtUsd(d.real, 0) : "·"}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Extender el calendario por los bordes */}
        <div className="flex items-center justify-between border-t border-[#E5E5E5] bg-white px-4 py-2">
          <button
            onClick={() =>
              router.push(
                `/inversion-medios?desde=${shiftMes(desde, -1, "inicio")}&hasta=${hasta}`,
              )
            }
            className="inline-flex items-center gap-1 font-sans text-xs text-[#666666] transition-colors hover:text-[#333333]"
          >
            <ChevronLeft className="h-3 w-3" /> cargar {MESES[(Number(desde.slice(5, 7)) + 10) % 12]}
          </button>
          <span className="font-sans text-xs text-[#999999]">
            {fmtDiaCorto(desde)} {desde.slice(0, 4)} → {fmtDiaCorto(hasta)} {hasta.slice(0, 4)}
          </span>
          <button
            onClick={() =>
              router.push(
                `/inversion-medios?desde=${desde}&hasta=${shiftMes(hasta, 1, "fin")}`,
              )
            }
            className="inline-flex items-center gap-1 font-sans text-xs text-[#666666] transition-colors hover:text-[#333333]"
          >
            cargar {MESES[Number(hasta.slice(5, 7)) % 12]} <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Subtotal por semana (lun→dom) — sincronizado con el tramo visible */}
      {semanasVisibles.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="font-display text-lg font-bold text-[#333333]">Subtotal por semana</h2>
            <span className="font-sans text-xs text-[#999999]">
              semanas del tramo visible ({rangoLabel}) · monto de la semana completa
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {semanasVisibles.map((w) => (
              <SemanaCard
                key={w.inicio}
                w={w}
                destacada={
                  w.inicio === lunesDestacados.actual
                    ? "actual"
                    : w.inicio === lunesDestacados.siguiente
                      ? "siguiente"
                      : w.inicio === lunesDestacados.subsiguiente
                        ? "subsiguiente"
                        : null
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Cargos extra CARDDA (pagos recurrentes de plataformas) */}
      <CargosExtra cargos={cargos} canEdit={canEdit} />

      {/* Facturación histórica: lo realmente cobrado a la tarjeta Cardda */}
      <FacturacionHistorica consumo={carddaConsumo} consumoSem={carddaConsumoSem} fee={carddaFee} />

      <p className="font-sans text-xs text-[#999999]">
        Cada celda: <span className="font-medium text-[#534AB7]">plan</span> total del día (arriba, en
        morado) y <span className="font-medium text-[#333333]">real</span> (abajo, en negro). El plan se edita{" "}
        <span className="text-[#333333]">por plataforma</span> abriendo el evento. El techo por
        evento es el budgetPm de la tabla madre (se edita en{" "}
        <Link href="/admin/eventos" className="underline hover:text-[#333333]">
          /admin/eventos
        </Link>
        ). El real de hoy es parcial (los datos de ads llegan a las 09:45). La atribución usa
        el EventoID al inicio del nombre de campaña — lo que no calza queda en &ldquo;No
        atribuido&rdquo;.
      </p>
    </div>
  );
}

// ---------- Sub-fila de campaña "no atribuido" (dentro de la matriz) ----------

const PLAT_DOT: Record<string, string> = {
  meta: "#9F99F8",
  google: "#B1D750",
  tiktok: "#87DACD",
};
const PLAT_LABEL: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

/**
 * Fila de campaña bajo "No atribuido": gasto real diario alineado a las mismas
 * columnas del calendario. Read-only. El nombre completo va en el title (la
 * columna sticky lo trunca). memo: el scroll actualiza `view` constantemente y
 * estas filas solo cambian su flag `hidden`.
 */
const NaCampRow = memo(function NaCampRow({
  nombre,
  dot,
  dotTitle,
  diasVals,
  total,
  rango,
  hidden,
  onVerMas,
}: {
  nombre: string;
  dot: string;
  dotTitle: string;
  diasVals: number[];
  total: number;
  /** Período CARGADO del calendario (desde–hasta), ej. "1 jun – 31 dic". */
  rango: string;
  hidden: boolean;
  /** Solo la fila agregada "otras N": libera 20 filas individuales más. */
  onVerMas?: () => void;
}) {
  return (
    <tr className={`bg-[#FBFBFD] ${hidden ? "hidden" : ""}`}>
      <td className="sticky left-0 z-10 w-56 min-w-56 max-w-56 border-r border-t border-[#F0F0F0] bg-[#FBFBFD] py-1.5 pl-7 pr-3">
        <span className="flex items-center gap-1.5 font-sans text-xs text-[#333333]">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
            title={dotTitle}
          />
          <span className="truncate" title={nombre}>
            {nombre}
          </span>
        </span>
        <p
          className="pl-3 text-[11px] tabular-nums text-[#999999]"
          title={`Gasto total de la campaña en el período cargado del calendario (${rango})`}
        >
          {fmtUsd(total, 0)} · {rango}
        </p>
        {onVerMas && (
          <button
            onClick={onVerMas}
            className="mt-0.5 pl-3 font-sans text-[11px] font-medium text-[#534AB7] transition-colors hover:text-[#3F3796]"
          >
            mostrar 20 más
          </button>
        )}
      </td>
      {diasVals.map((v, i) => (
        <td
          key={i}
          className="w-16 min-w-16 max-w-16 border-t border-[#F0F0F0] px-1 py-1.5 text-center tabular-nums text-[11px] text-[#666666]"
        >
          {v > 0 ? fmtUsd(v, 0) : <span className="text-[#E5E5E5]">·</span>}
        </td>
      ))}
    </tr>
  );
});

// ---------- Card de subtotal semanal ----------

// Escala de destaque de las semanas que vienen: 100% → 50% → 25% del morado de
// marca (#9F99F8 → tintes hacia blanco, como pide la guía: tinte, no opacidad).
const DESTAQUE = {
  actual: {
    box: "border-[#9F99F8] shadow-sm ring-1 ring-[#9F99F8]",
    chip: "bg-[#F0EFFE] text-[#534AB7]",
    label: "Semana actual",
  },
  siguiente: {
    box: "border-[#CFCCFB] ring-1 ring-[#CFCCFB]",
    chip: "bg-[#F5F4FE] text-[#6E67C4]",
    label: "Próxima semana",
  },
  subsiguiente: {
    box: "border-[#E7E6FD]",
    chip: "bg-[#FAFAFE] text-[#8F89D9]",
    label: "En 2 semanas",
  },
} as const;

function SemanaCard({
  w,
  destacada,
}: {
  w: {
    inicio: string;
    fin: string;
    plan: number;
    planTrans: number;
    real: number;
    inicioVista: string;
    finVista: string;
    futura: boolean;
    parcial: boolean;
  };
  /** Destaque en intensidad decreciente: actual (100) → siguiente (50) →
   *  subsiguiente (25). Tintes del morado de marca, no opacidades. */
  destacada: "actual" | "siguiente" | "subsiguiente" | null;
}) {
  // El semáforo compara real contra el plan TRANSCURRIDO (días ≤ real-al), no
  // contra el plan de toda la semana: así una semana futura con plan sembrado
  // pero sin gasto no se pinta verde "cumplida", sino gris "programada".
  const pct = w.planTrans > 0 ? (w.real / w.planTrans) * 100 : w.real > 0 ? 999 : 0;
  const tono = w.futura
    ? { dot: "#CCCCCC", txt: "text-[#999999]" }
    : pct > 100
      ? { dot: "#ED75A0", txt: "text-[#ED75A0]" }
      : pct >= 85
        ? { dot: "#F6C544", txt: "text-[#B8890B]" }
        : { dot: "#B1D750", txt: "text-[#3B6D11]" };
  const estado = w.futura
    ? "programado — aún sin gasto"
    : w.planTrans > 0
      ? `${Math.round(pct)}% del plan${w.parcial ? " a la fecha" : ""}`
      : w.real > 0
        ? "gasto sin plan"
        : "sin plan";
  // Intensidad del destaque: 100 (actual) / 50 (siguiente) / 25 (subsiguiente).
  const nivel = destacada && DESTAQUE[destacada];
  return (
    <div
      className={`rounded-lg border bg-white p-4 ${nivel ? nivel.box : "border-[#E5E5E5]"}`}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-sans text-xs text-[#666666]">
        <span>
          Semana del {fmtDiaCorto(w.inicioVista)} al {fmtDiaCorto(w.finVista)}
        </span>
        {nivel && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${nivel.chip}`}>
            {nivel.label}
          </span>
        )}
        {w.parcial && !w.futura && (
          <span className="ml-1 text-[#999999]" title="La semana aún no cierra: el real está incompleto">
            (parcial)
          </span>
        )}
      </p>
      <p className="mt-1.5 font-sans text-sm tabular-nums text-[#333333]">
        <span className="font-display text-lg font-bold">{fmtUsd(w.plan, 0)}</span>
        <span className="text-[#999999]"> plan</span>
        <span className="mx-1.5 text-[#CCCCCC]">·</span>
        <span className="font-display text-lg font-bold">{fmtUsd(w.real, 0)}</span>
        <span className="text-[#999999]"> real</span>
      </p>
      <p className={`mt-2 inline-flex items-center gap-1.5 font-sans text-xs ${tono.txt}`}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tono.dot }} />
        {estado}
      </p>
    </div>
  );
}

// ---------- Fila de evento ----------

// memo: el scroll actualiza `view` muchas veces por segundo; las props de la
// fila son estables, así que solo re-renderizan header/KPIs, no ~200 celdas.
const FilaEvento = memo(function FilaEvento({
  ev,
  totales,
  hoy,
  realMaxFecha,
  hidden,
}: {
  ev: EventoGridRow;
  totales?: { totalPlan: number; totalReal: number };
  hoy: string;
  realMaxFecha: string;
  hidden: boolean;
}) {
  const totalPlanEvento = totales?.totalPlan ?? ev.totalPlan;
  const totalRealEvento = totales?.totalReal ?? ev.totalReal;
  const pctReal =
    ev.techoUsd && ev.techoUsd > 0 ? (totalRealEvento / ev.techoUsd) * 100 : null;

  return (
    <tr className={`group ${hidden ? "hidden" : ""}`}>
      <td className="sticky left-0 z-10 w-56 min-w-56 max-w-56 border-r border-t border-[#E5E5E5] bg-white px-4 py-2 align-top group-hover:bg-[#FAFAFA]">
        <Link
          href={`/inversion-medios?evento=${ev.eventoId}`}
          className="block truncate font-medium text-[#333333] hover:text-[#9F99F8]"
          title={ev.nombre || ev.eventoId}
        >
          {ev.nombre || ev.eventoId}
        </Link>
        <p className="text-xs text-[#999999]">
          {ev.eventoId}
          {ev.fechaEvento ? ` · ${ev.fechaEvento}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-medium text-[#333333]"
            title="Techo = budgetPm de categoriaEvento (se edita en /admin/eventos)"
          >
            Techo {ev.techoUsd != null ? fmtUsd(ev.techoUsd) : "—"}
          </span>
          {totalPlanEvento === 0 && ev.fechaEvento && ev.fechaEvento >= hoy && (
            <span
              className="inline-flex items-center rounded-full bg-[#FAEEDA] px-2 py-0.5 font-medium text-[#854F0B]"
              title="Evento sin presupuesto diario cargado — abre el evento y llena el plan por plataforma"
            >
              Sin plan
            </span>
          )}
          {pctReal != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-medium text-[#333333]"
              title={`Real histórico ${fmtUsd(totalRealEvento)} vs techo`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  pctReal > 100 ? "bg-[#ED75A0]" : pctReal > 85 ? "bg-[#F6C544]" : "bg-[#B1D750]"
                }`}
              />
              {pctReal.toFixed(0)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs tabular-nums text-[#999999]">
          Plan <span className="font-medium text-[#534AB7]">{fmtUsd(totalPlanEvento, 0)}</span> · Real{" "}
          <span className="font-medium text-[#333333]">{fmtUsd(totalRealEvento, 0)}</span>
        </p>
      </td>
      {ev.days.map((cell) => (
        <td
          key={cell.fecha}
          title={cell.fecha === ev.fechaEvento ? "Día del evento" : undefined}
          className={`w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] p-0 text-center align-top ${
            cell.fecha === ev.fechaEvento
              ? "bg-[#FAEEDA]"
              : cell.fecha === hoy
                ? "bg-[#F0EFFE]/40"
                : ""
          }`}
        >
          <CeldaResumen cell={cell} parcial={cell.fecha === hoy || cell.fecha > realMaxFecha} />
        </td>
      ))}
    </tr>
  );
});

// Celda read-only del grid: plan TOTAL del día (suma plataformas) + real. La
// edición por plataforma vive en el drill del evento.
function CeldaResumen({ cell, parcial }: { cell: DayCell; parcial: boolean }) {
  return (
    <div className="flex min-w-16 flex-col items-stretch px-0.5 py-1.5">
      <span className="text-center tabular-nums text-xs font-medium text-[#534AB7]">
        {cell.plan != null ? fmtUsd(cell.plan, 0) : <span className="text-[#E5E5E5]">·</span>}
      </span>
      <span
        className="mt-0.5 text-center tabular-nums text-[11px] leading-tight text-[#333333]"
        title={
          cell.real != null
            ? `Real ${fmtUsd(cell.real)}${cell.fxImputado ? " · FX imputado (último disponible)" : ""}${parcial ? " · parcial (los ads llegan ~09:45)" : ""}`
            : cell.sinFx
              ? "Gasto en moneda sin ningún FX conocido"
              : ""
        }
      >
        {cell.sinFx ? (
          <>
            {cell.real != null && cell.real > 0 ? `${fmtUsd(cell.real, 0)} ` : ""}
            <span className="font-medium text-[#EF8C34]">+sin FX</span>
          </>
        ) : cell.real != null && cell.real > 0 ? (
          // Sin sufijo "…" para el día parcial (se leía como monto truncado);
          // el aviso va en el title.
          fmtUsd(cell.real, 0)
        ) : (
          <span className="text-[#E5E5E5]">·</span>
        )}
      </span>
    </div>
  );
}

// ---------- Resumen por canal ----------

const CANAL_COLORS: Record<string, string> = {
  Meta: "#9F99F8",
  Google: "#B1D750",
  TikTok: "#87DACD",
  Otras: "#B4B2A9",
};

function CanalResumen({
  canal,
  rangoLabel,
  noAtribuido,
}: {
  canal: { meta: number; google: number; tiktok: number; otras: number; plan: number; real: number };
  rangoLabel: string;
  noAtribuido: number;
}) {
  const canales = [
    { label: "Meta", val: canal.meta },
    { label: "Google", val: canal.google },
    { label: "TikTok", val: canal.tiktok },
    // "Otras" solo aparece si el mart trae gasto fuera de las tres.
    ...(canal.otras > 0 ? [{ label: "Otras", val: canal.otras }] : []),
  ];
  const pctEjec = canal.plan > 0 ? (canal.real / canal.plan) * 100 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Kpi
          label={`Presupuesto · ${rangoLabel}`}
          value={fmtUsd(canal.plan)}
          hint="monto diario total (sin desglose por canal)"
        />
        {canales.map((c) => (
          <PlataformaCard
            key={c.label}
            label={c.label}
            value={fmtUsd(c.val)}
            color={CANAL_COLORS[c.label]}
            share={canal.real > 0 ? (c.val / canal.real) * 100 : 0}
          />
        ))}
      </div>

      {/* Barra de composición + totales */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E5E5] bg-white p-4">
        <p className="font-sans text-sm text-[#333333]">
          Gasto real total{" "}
          <span className="font-display text-lg font-bold">{fmtUsd(canal.real)}</span>
          {pctEjec != null && (
            <span className="ml-2 text-[#666666]">
              · {pctEjec.toFixed(0)}% del presupuesto
            </span>
          )}
          {noAtribuido > 0 && (
            <span className="ml-2 text-[#999999]">
              · incluye {fmtUsd(noAtribuido)} no atribuido
            </span>
          )}
        </p>
        <div className="flex h-2.5 w-full max-w-sm overflow-hidden rounded-full bg-[#F0F0F0]">
          {canal.real > 0 &&
            canales.map((c) => (
              <div
                key={c.label}
                style={{
                  width: `${(c.val / canal.real) * 100}%`,
                  backgroundColor: CANAL_COLORS[c.label],
                }}
                title={`${c.label}: ${fmtUsd(c.val)}`}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function PlataformaCard({
  label,
  value,
  color,
  share,
}: {
  label: string;
  value: string;
  color: string;
  share: number;
}) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <p className="inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
        {value}
      </p>
      <p className="mt-3 font-sans text-xs text-[#666666]">
        {share.toFixed(0)}% del gasto real
      </p>
    </div>
  );
}

// ---------- KPI card ----------

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
        {value}
      </p>
      {(hint || tone) && (
        <p className="mt-3 inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
          {tone && (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                tone === "neg" ? "bg-[#ED75A0]" : "bg-[#B1D750]"
              }`}
            />
          )}
          {hint ?? (tone === "neg" ? "sobre el plan" : "bajo el plan")}
        </p>
      )}
    </div>
  );
}

// ---------- Cargos extra CARDDA (pagos recurrentes de plataformas) ----------

type CargoForm = { proveedor: string; detalle: string; metodo: MetodoCargo; monto: string; diaPago: string };
const CARGO_VACIO: CargoForm = { proveedor: "", detalle: "", metodo: "mensual", monto: "", diaPago: "" };

function CargosExtra({ cargos, canEdit }: { cargos: CargoExtra[]; canEdit: boolean }) {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null); // id en edición, "" = alta nueva, null = cerrado
  const [form, setForm] = useState<CargoForm>(CARGO_VACIO);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const total = useMemo(() => resumenCargos(cargos), [cargos]);

  function abrirAlta() {
    setEditId("");
    setForm(CARGO_VACIO);
    setMsg(null);
  }
  function abrirEdicion(c: CargoExtra) {
    setEditId(c.id);
    setForm({
      proveedor: c.proveedor,
      detalle: c.detalle ?? "",
      metodo: (METODOS_CARGO as readonly string[]).includes(c.metodo) ? (c.metodo as MetodoCargo) : "mensual",
      monto: String(c.montoUsd),
      diaPago: c.diaPago ?? "",
    });
    setMsg(null);
  }
  function guardar() {
    const monto = Number(form.monto.replace(/[$\s]/g, "").replace(",", "."));
    if (!form.proveedor.trim()) return setMsg({ ok: false, text: "Falta el proveedor" });
    if (!Number.isFinite(monto) || monto <= 0) return setMsg({ ok: false, text: "Monto inválido" });
    start(async () => {
      const res = await upsertCargoAction({
        id: editId || undefined,
        proveedor: form.proveedor,
        detalle: form.detalle,
        metodo: form.metodo,
        montoUsd: monto,
        diaPago: form.diaPago,
      });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else {
        setEditId(null);
        setMsg(null);
        router.refresh();
      }
    });
  }
  function borrar(id: string) {
    start(async () => {
      const res = await deleteCargoAction({ id });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  const inputCls =
    "rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm text-[#333333] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#333333]">Cargos extra CARDDA</h2>
          <p className="font-sans text-xs text-[#666666]">
            Pagos recurrentes de plataformas (DRIP, Adobe, Google Workspace, GPT…) normalizados
            para presupuestar.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={abrirAlta}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
          >
            <Plus className="h-4 w-4" /> Agregar proveedor
          </button>
        )}
      </div>

      {/* Resumen normalizado */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">Costo mensual (normalizado)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
            {fmtUsd(total.mensual, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">lo que conviene presupuestar por mes</p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">Costo semanal (normalizado)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
            {fmtUsd(total.semanal, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">promedio por semana</p>
        </div>
      </div>

      {/* Form alta/edición */}
      {canEdit && editId !== null && (
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
              Proveedor
              <input
                value={form.proveedor}
                onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))}
                placeholder="DRIP, Adobe, Google Workspace…"
                className={`${inputCls} w-48`}
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
              Detalle
              <input
                value={form.detalle}
                onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))}
                placeholder="cuenta, plan, notas"
                className={`${inputCls} w-48`}
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
              Método
              <select
                value={form.metodo}
                onChange={(e) => setForm((f) => ({ ...f, metodo: e.target.value as MetodoCargo }))}
                className={inputCls}
              >
                {METODOS_CARGO.map((m) => (
                  <option key={m} value={m}>
                    {METODO_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
              Monto USD
              <input
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                inputMode="decimal"
                placeholder="0.00"
                className={`${inputCls} w-28 text-right tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
              Día de pago
              <input
                value={form.diaPago}
                onChange={(e) => setForm((f) => ({ ...f, diaPago: e.target.value }))}
                placeholder="15 · 1 de marzo · lunes"
                className={`${inputCls} w-40`}
              />
            </label>
            <button
              onClick={guardar}
              disabled={pending}
              className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
            >
              {editId ? "Guardar" : "Agregar"}
            </button>
            <button
              onClick={() => setEditId(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F5F5F5]"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
            {msg && !msg.ok && <span className="font-sans text-xs text-[#ED75A0]">{msg.text}</span>}
          </div>
        </div>
      )}

      {/* Tabla de cargos */}
      {cargos.length === 0 ? (
        <p className="rounded-lg border border-[#E5E5E5] bg-white p-6 text-center font-sans text-sm text-[#999999]">
          Sin cargos extra cargados{canEdit ? " — agregá el primero." : "."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="text-xs text-[#666666]">
                <th className="border-b border-[#E5E5E5] px-4 py-2 text-left font-medium">Proveedor</th>
                <th className="border-b border-[#E5E5E5] px-4 py-2 text-left font-medium">Método</th>
                <th className="border-b border-[#E5E5E5] px-4 py-2 text-right font-medium">Monto</th>
                <th className="border-b border-[#E5E5E5] px-4 py-2 text-left font-medium">Día</th>
                <th className="border-b border-[#E5E5E5] px-4 py-2 text-right font-medium">≈ Mensual</th>
                {canEdit && <th className="border-b border-[#E5E5E5] px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-[#FAFAFA]">
                  <td className="border-t border-[#E5E5E5] px-4 py-2">
                    <span className="font-medium text-[#333333]">{c.proveedor}</span>
                    {c.detalle && <p className="text-xs text-[#999999]">{c.detalle}</p>}
                  </td>
                  <td className="border-t border-[#E5E5E5] px-4 py-2 text-[#666666]">
                    {METODO_LABEL[c.metodo as MetodoCargo] ?? c.metodo}
                  </td>
                  <td className="border-t border-[#E5E5E5] px-4 py-2 text-right tabular-nums text-[#333333]">
                    {fmtUsd(c.montoUsd)}
                  </td>
                  <td className="border-t border-[#E5E5E5] px-4 py-2 text-[#999999]">{c.diaPago || "—"}</td>
                  <td className="border-t border-[#E5E5E5] px-4 py-2 text-right tabular-nums text-[#666666]">
                    {fmtUsd(costoMensual(c), 0)}
                    <span className="block text-[11px] text-[#BBBBBB]">{fmtUsd(costoSemanal(c), 0)}/sem</span>
                  </td>
                  {canEdit && (
                    <td className="border-t border-[#E5E5E5] px-4 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => abrirEdicion(c)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[#666666] hover:bg-[#F0F0F0]"
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => borrar(c.id)}
                          disabled={pending}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-[#666666] hover:bg-[#FCEBEB] hover:text-[#ED75A0]"
                          aria-label="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Facturación histórica (Cardda) ----------

/**
 * Evolución temporal del consumo Cardda como ÁREA APILADA por canal: el eje Y
 * es el consumo total del período y cada plataforma es una banda del total —
 * se lee cuánto pesa cada una y cómo varía respecto del total. X asciende en
 * el tiempo (la tabla va desc; acá se invierte). Fill 15% + stroke 2px según
 * la guía; el orden de apilado fija Meta abajo (la banda dominante).
 */
function FacturacionChart({ filas, gran }: { filas: FacturacionMes[]; gran: "mes" | "semana" }) {
  const data = useMemo(
    () =>
      [...filas].reverse().map((m) => ({
        periodo: m.periodo,
        label: fmtPeriodo(m.periodo),
        meta: Math.round(m.meta),
        google: Math.round(m.google),
        tiktok: Math.round(m.tiktok),
        otras: Math.round(m.otras),
        total: Math.round(m.consumoUsd),
      })),
    [filas],
  );
  if (data.length === 0) {
    return (
      <p className="rounded-lg border border-[#E5E5E5] bg-white p-6 text-center font-sans text-sm text-[#999999]">
        Sin consumo para graficar.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-sm text-[#333333]">
          Consumo {gran === "mes" ? "mensual" : "semanal"} apilado por plataforma
        </p>
        <div className="flex flex-wrap items-center gap-3 font-sans text-xs text-[#666666]">
          {CANALES_FACT.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CANAL_COLORS[CANAL_FACT_LABEL[c]] }}
              />
              {CANAL_FACT_LABEL[c]}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-6 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="#F0F0F0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "#999999" }}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "#999999" }}
              tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
              width={52}
            />
            <ChartTooltip content={<FacturacionTooltip />} cursor={{ stroke: "#E5E5E5" }} />
            {/* Orden de apilado: Meta (dominante) abajo → Otras arriba. */}
            {CANALES_FACT.map((c) => (
              <Area
                key={c}
                type="monotone"
                dataKey={c}
                stackId="total"
                stroke={CANAL_COLORS[CANAL_FACT_LABEL[c]]}
                strokeWidth={2}
                fill={CANAL_COLORS[CANAL_FACT_LABEL[c]]}
                fillOpacity={0.15}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Tooltip del área apilada: dot + canal + monto, y el total del período. */
function FacturacionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string; color?: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((a, p) => a + (Number(p.value) || 0), 0);
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="text-xs text-[#666666]">{label}</p>
      {[...payload].reverse().map((p) => (
        <p key={String(p.dataKey)} className="mt-1 flex items-center gap-1.5 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {CANAL_FACT_LABEL[p.dataKey as CanalFact] ?? String(p.dataKey)}{" "}
          <span className="ml-auto pl-3 font-medium">{fmtUsd(Number(p.value) || 0, 0)}</span>
        </p>
      ))}
      <p className="mt-1.5 border-t border-[#F0F0F0] pt-1 text-xs text-[#666666]">
        Total <span className="font-medium text-[#333333]">{fmtUsd(total, 0)}</span>
      </p>
    </div>
  );
}

function FacturacionHistorica({
  consumo,
  consumoSem,
  fee,
}: {
  consumo: CarddaConsumoRow[];
  consumoSem: CarddaConsumoRow[];
  fee: CarddaFeeRow[];
}) {
  const meses = useMemo<FacturacionMes[]>(() => buildFacturacion(consumo, fee), [consumo, fee]);
  const resumen = useMemo(() => resumenFacturacion(meses), [meses]);
  // Semanal: sin fee (el fee es una boleta MENSUAL; prorratearlo mentiría).
  const semanas = useMemo<FacturacionMes[]>(() => buildFacturacion(consumoSem, []), [consumoSem]);
  const [vista, setVista] = useState<"tabla" | "grafico">("tabla");
  const [gran, setGran] = useState<"mes" | "semana">("mes");
  const filas = gran === "mes" ? meses : semanas;
  const conFee = gran === "mes"; // la columna Fee solo existe a nivel mes

  if (meses.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#333333]">Facturación histórica (Cardda)</h2>
          <p className="font-sans text-xs text-[#666666]">
            Lo realmente cobrado a la tarjeta Cardda con que se pagan los ads.
          </p>
        </div>
        <p className="rounded-lg border border-[#E5E5E5] bg-white p-6 text-center font-sans text-sm text-[#999999]">
          Sin facturación cargada todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-[#333333]">Facturación histórica (Cardda)</h2>
        <p className="max-w-3xl font-sans text-xs text-[#666666]">
          Lo realmente <span className="text-[#333333]">cobrado a la tarjeta Cardda</span> (solo
          cargos aprobados, en USD por fecha). Es distinto del gasto declarado de las cuentas de
          ads de arriba: acá manda el cargo real a la tarjeta.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">Consumo tarjeta (histórico)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
            {fmtUsd(resumen.consumoTotal, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">todos los comercios, aprobado</p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">Fee de Cardda (histórico)</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
            {fmtUsd(resumen.feeTotal, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">costo del servicio Cardda</p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">
            Consumo {resumen.ultimoPeriodo ? fmtPeriodo(resumen.ultimoPeriodo) : "último mes"}
          </p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
            {fmtUsd(resumen.consumoUltimoMes, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">último mes con datos</p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">
            Fee {resumen.ultimoPeriodo ? fmtPeriodo(resumen.ultimoPeriodo) : "último mes"}
          </p>
          <p className="mt-2 font-display text-3xl font-bold leading-none text-[#333333]">
            {fmtUsd(resumen.feeUltimoMes, 0)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">fee del último mes</p>
        </div>
      </div>

      {/* Controles: Tabla↔Gráfico y Mes↔Semana */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-[#E5E5E5] bg-white font-sans text-sm">
          {(
            [
              ["tabla", "Tabla"],
              ["grafico", "Gráfico"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setVista(k)}
              className={`px-4 py-2 transition-colors ${
                vista === k
                  ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                  : "text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-[#E5E5E5] bg-white font-sans text-sm">
          {(
            [
              ["mes", "Mes"],
              ["semana", "Semana"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setGran(k)}
              className={`px-4 py-2 transition-colors ${
                gran === k
                  ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                  : "text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {gran === "semana" && (
          <span className="font-sans text-xs text-[#999999]">
            semanas de lunes a domingo · el fee de Cardda es mensual (no se muestra por semana)
          </span>
        )}
      </div>

      {vista === "grafico" ? (
        <FacturacionChart filas={filas} gran={gran} />
      ) : (
        <>
      {/* Tabla por período×canal + fee (scrolleable, header sticky) */}
      <div className="max-h-[440px] overflow-auto rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-xs text-[#666666] [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left font-medium">Período</th>
              {CANALES_FACT.map((c) => (
                <th key={c} className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CANAL_COLORS[CANAL_FACT_LABEL[c]] }}
                    />
                    {CANAL_FACT_LABEL[c]}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium text-[#333333]">Consumo total</th>
              {conFee && <th className="px-4 py-3 text-right font-medium">Fee Cardda</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.periodo} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA]">
                <td className="px-4 py-2.5 text-left font-medium text-[#333333]">{fmtPeriodo(m.periodo)}</td>
                {CANALES_FACT.map((c) => (
                  <td key={c} className="px-4 py-2.5 text-right tabular-nums text-[#666666]">
                    {m[c] > 0 ? fmtUsd(m[c], 0) : "·"}
                  </td>
                ))}
                <td
                  className="px-4 py-2.5 text-right font-medium tabular-nums text-[#333333]"
                  title={`CLP ${m.consumoClp.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`}
                >
                  {fmtUsd(m.consumoUsd, 0)}
                </td>
                {conFee && (
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#666666]">
                    {m.feeUsd > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        {fmtUsd(m.feeUsd, 0)}
                        {m.feeStatus === "draft" && (
                          <span className="rounded-full bg-[#FBF3D6] px-1.5 py-0.5 text-[10px] text-[#B8890B]">
                            borrador
                          </span>
                        )}
                      </span>
                    ) : (
                      "·"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA] text-[#333333]">
              <td className="px-4 py-3 text-left font-medium">Total histórico</td>
              {CANALES_FACT.map((c) => (
                <td key={c} className="px-4 py-3 text-right font-medium tabular-nums">
                  {fmtUsd(resumen.porCanalTotal[c], 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold tabular-nums">{fmtUsd(resumen.consumoTotal, 0)}</td>
              {conFee && (
                <td className="px-4 py-3 text-right font-medium tabular-nums">{fmtUsd(resumen.feeTotal, 0)}</td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
        </>
      )}

      <p className="font-sans text-xs text-[#999999]">
        &ldquo;Otras&rdquo; agrupa SaaS y otros comercios (Drip, Adobe, Webflow, Workspace…) — se
        solapa con los cargos extra de arriba. Meta = Facebook/Instagram; Google = solo Google Ads
        (Workspace/Cloud caen en Otras); montos convertidos a USD con el tipo de cambio del día.
      </p>
    </div>
  );
}
