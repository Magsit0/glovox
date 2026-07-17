"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import type { DayCell, EventoGridRow, NoAtribuidoRow } from "@/lib/queries/inversion-medios";
import { fmtDiaCorto, fmtUsd } from "./format";

type Disponible = { eventoId: string; nombre: string; fecha: string };

type Props = {
  desde: string; // YYYY-MM-DD, inicio del rango cargado
  hasta: string; // YYYY-MM-DD, fin del rango cargado
  grid: EventoGridRow[];
  /** Totales del evento COMPLETO (histórico), no solo del rango cargado. */
  totales: Record<string, { totalPlan: number; totalReal: number }>;
  noAtribuido: NoAtribuidoRow[];
  disponibles: Disponible[];
  realMaxFecha: string;
  hoy: string;
  /** false → sin "Agregar evento" (la planificación es superadmin-only). */
  canEdit: boolean;
};

// Geometría fija de la grilla (box-border: el ancho incluye el borde).
const COL_W = 64; // w-16
const STICKY_W = 224; // w-56

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
  disponibles,
  realMaxFecha,
  hoy,
  canEdit,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [filtro, setFiltro] = useState("");
  // Eventos agregados a mano (aún sin plan ni gasto): fila sintética visible
  // hasta que se guarde su primera celda (ahí llega desde el server).
  const [temporales, setTemporales] = useState<Disponible[]>([]);
  // Resumen superior: KPIs globales o desglose por canal (mismo tramo visible).
  const [modo, setModo] = useState<"resumen" | "canal">("resumen");

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

  // Filas sintéticas para los eventos recién agregados, ordenadas junto al resto
  // por fecha del evento.
  const rows = useMemo<EventoGridRow[]>(() => {
    const sintetica = (t: Disponible): EventoGridRow => ({
      eventoId: t.eventoId,
      nombre: t.nombre,
      fechaEvento: t.fecha,
      ordenFecha: t.fecha || "9999-12-31",
      techoUsd: null,
      days: dias.map((fecha) => ({
        fecha,
        plan: null,
        planNota: null,
        real: null,
        metaUsd: 0,
        googleUsd: 0,
        tiktokUsd: 0,
        otrasUsd: 0,
        fxImputado: false,
        sinFx: false,
      })),
      totalPlan: 0,
      totalReal: 0,
      pctPlanVsTecho: 0,
      pctRealVsTecho: 0,
    });
    const enGrid = new Set(grid.map((g) => g.eventoId));
    const extra = temporales.filter((t) => !enGrid.has(t.eventoId)).map(sintetica);
    // ordenFecha viene de mergeGrid (Fecha del evento, o último día con datos
    // para eventos sin Fecha) — el re-sort solo intercala las filas sintéticas.
    return [...grid, ...extra].sort(
      (a, b) =>
        a.ordenFecha.localeCompare(b.ordenFecha) || a.eventoId.localeCompare(b.eventoId),
    );
  }, [grid, temporales, dias]);

  // Índices con datos por fila (para la visibilidad según viewport).
  const dataIdx = useMemo(
    () => rows.map((r) => r.days.map((d) => d.plan != null || d.real != null)),
    [rows],
  );

  const noAtribuidoByFecha = useMemo(
    () => new Map(noAtribuido.map((r) => [r.fecha, r])),
    [noAtribuido],
  );

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
  const visibleIds = useMemo(() => {
    const tempIds = new Set(temporales.map((t) => t.eventoId));
    const out = new Set<string>();
    rows.forEach((r, i) => {
      if (tempIds.has(r.eventoId)) {
        out.add(r.eventoId); // recién agregado: se muestra
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
  }, [rows, dataIdx, view, temporales]);

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

  return (
    <div className="flex flex-col gap-6">
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
          {canEdit && (
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
            >
              <Plus className="h-4 w-4" /> Agregar evento
            </button>
          )}
        </div>
      </header>

      {addOpen && (
        <AddEventoCard
          disponibles={disponibles.filter(
            (d) => !temporales.some((t) => t.eventoId === d.eventoId),
          )}
          filtro={filtro}
          setFiltro={setFiltro}
          onAdd={(e) => {
            setTemporales((prev) => [...prev, e]);
            setAddOpen(false);
            if (e.fecha) irA(e.fecha);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}

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

      {/* Calendario */}
      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
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
                    <span className="block text-[#333333]">
                      {d.plan > 0 ? fmtUsd(d.plan, 0) : "·"}
                    </span>
                    <span className="block text-[#999999]">
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

      <p className="font-sans text-xs text-[#999999]">
        Cada celda: plan total del día (arriba) y real (abajo). El plan se edita{" "}
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
          Plan {fmtUsd(totalPlanEvento, 0)} · Real {fmtUsd(totalRealEvento, 0)}
        </p>
      </td>
      {ev.days.map((cell) => (
        <td
          key={cell.fecha}
          className={`w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] p-0 text-center align-top ${
            cell.fecha === hoy ? "bg-[#F0EFFE]/40" : ""
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
      <span className="text-center tabular-nums text-xs text-[#333333]">
        {cell.plan != null ? fmtUsd(cell.plan, 0) : <span className="text-[#E5E5E5]">·</span>}
      </span>
      <span
        className="mt-0.5 text-center tabular-nums text-[11px] leading-tight text-[#999999]"
        title={cell.real != null ? `Real ${fmtUsd(cell.real)}` : cell.sinFx ? "gasto sin FX a USD" : ""}
      >
        {cell.sinFx ? (
          <>
            {cell.real != null && cell.real > 0 ? `${fmtUsd(cell.real, 0)} ` : ""}
            <span className="font-medium text-[#EF8C34]">+sin FX</span>
          </>
        ) : cell.real != null && cell.real > 0 ? (
          <>
            {fmtUsd(cell.real, 0)}
            {parcial ? "…" : ""}
          </>
        ) : (
          "·"
        )}
      </span>
    </div>
  );
}

// ---------- Agregar evento (fila sintética hasta su primera celda) ----------

function AddEventoCard({
  disponibles,
  filtro,
  setFiltro,
  onAdd,
  onClose,
}: {
  disponibles: Disponible[];
  filtro: string;
  setFiltro: (v: string) => void;
  onAdd: (e: Disponible) => void;
  onClose: () => void;
}) {
  const matches = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    const base = f
      ? disponibles.filter(
          (e) =>
            e.eventoId.toLowerCase().includes(f) || e.nombre.toLowerCase().includes(f),
        )
      : disponibles;
    return base.slice(0, 12);
  }, [disponibles, filtro]);

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <input
          autoFocus
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar evento por nombre o EventoID…"
          className="w-full max-w-md rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        />
        <button
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F5F5F5]"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 font-sans text-xs text-[#999999]">
        El evento queda en la grilla al guardar su primera celda de plan.
      </p>
      <ul className="mt-3 grid grid-cols-1 gap-1 md:grid-cols-2">
        {matches.map((e) => (
          <li key={e.eventoId}>
            <button
              onClick={() => onAdd(e)}
              className="w-full rounded-lg px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:bg-[#FAFAFA]"
            >
              <span className="font-medium">{e.nombre || e.eventoId}</span>
              <span className="ml-2 text-xs text-[#999999]">
                {e.eventoId}
                {e.fecha ? ` · ${e.fecha}` : ""}
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-3 py-2 font-sans text-sm text-[#999999]">Sin resultados</li>
        )}
      </ul>
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
