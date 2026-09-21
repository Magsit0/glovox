"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type {
  AdsMetricasEvento,
  DrillGrid,
  DrillPlataformaRow,
  PlanDiarioRow,
  SerieResultadoRow,
  TicketsEvento,
} from "@/lib/queries/inversion-medios";
import { PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";
import { addDiasIso, esDiaEvento, tituloDiaEvento } from "@/lib/inversion-medios/evento";
import {
  computeEtapaSegments,
  ETAPAS_DEFAULT,
  type EtapaCampana,
} from "@/lib/inversion-medios/etapas";
import {
  buildDesglose,
  SIN_TIPO,
  SIN_TIPO_LABEL,
  TIPOS_PLAN,
  type DesgloseRow,
  type TipoNode,
} from "@/lib/inversion-medios/tipos";
import { bulkFillPlanAction, saveEtapasAction } from "../actions";
import CeldaPlan from "./CeldaPlan";
import RendimientoEvento from "./RendimientoEvento";
import { compactInt, fmtUsd, formatInt } from "./format";

type Props = {
  eventoId: string;
  nombre: string;
  venue: string;
  /** PRIMER día del evento (categoriaEvento.Fecha). */
  fechaEvento: string;
  /** Cuántos días dura. Un evento de 2 días marca DOS columnas, no una. */
  diasEvento: number;
  techoUsd: number | null;
  drill: DrillGrid;
  /** Plan diario crudo (con tipo) de la ventana del drill — arma las filas de tipo. */
  planRows: PlanDiarioRow[];
  realMaxFecha: string;
  hoy: string;
  /** false → drill read-only (sin inputs ni rellenar rango). Hoy siempre true:
   *  quien tiene el grant de /inversion-medios puede editar el plan. */
  canEdit: boolean;
  etapas: EtapaCampana[];
  /** Gasto real crudo por (fecha, plataforma, objective, campaña) para el desglose. */
  desgloseRows: DesgloseRow[];
  /** Numeradores de ads del evento en la ventana — alimentan los dos CPA. */
  ads: AdsMetricasEvento;
  /** Conteos de ticket + el estado del referido. */
  tickets: TicketsEvento;
  /** Serie diaria de resultado, para el bloque "Resultado del día". */
  serieResultado: SerieResultadoRow[];
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const PLAT_COLOR: Record<string, string> = {
  Meta: "#9F99F8",
  Google: "#B1D750",
  TikTok: "#87DACD",
  Otras: "#B4B2A9",
};

// Alto de la fila de bandas (px). Se fuerza en las celdas de la banda Y se usa
// como offset sticky de la fila de fechas → no pueden desincronizarse.
const BAND_H = 26;

// Paleta suave por índice de etapa (sigue el orden de la planilla:
// pre-registro→awareness→fomo→last call→día de evento, luego extras). Cubre el
// tope de 12 etapas (MAX_ETAPAS) para que ninguna repita color.
//
// Van por variable CSS (`--etapa-N-bg/-ink`, en app/globals.css) y no como hex:
// los 12 tintes claros quedaban como una franja brillante de 26px cruzando el
// header de la sábana en tema oscuro. Se aplican por `style` inline, donde CSS
// resuelve una custom property igual que en una clase.
const ETAPA_COLORS: { bg: string; text: string }[] = [
  { bg: "var(--etapa-1-bg)", text: "var(--etapa-1-ink)" }, // azul
  { bg: "var(--etapa-2-bg)", text: "var(--etapa-2-ink)" }, // ámbar
  { bg: "var(--etapa-3-bg)", text: "var(--etapa-3-ink)" }, // coral
  { bg: "var(--etapa-4-bg)", text: "var(--etapa-4-ink)" }, // rojo
  { bg: "var(--etapa-5-bg)", text: "var(--etapa-5-ink)" }, // verde
  { bg: "var(--etapa-6-bg)", text: "var(--etapa-6-ink)" }, // púrpura
  { bg: "var(--etapa-7-bg)", text: "var(--etapa-7-ink)" }, // rosa
  { bg: "var(--etapa-8-bg)", text: "var(--etapa-8-ink)" }, // teal
  { bg: "var(--etapa-9-bg)", text: "var(--etapa-9-ink)" }, // gris
  { bg: "var(--etapa-10-bg)", text: "var(--etapa-10-ink)" }, // azul 2
  { bg: "var(--etapa-11-bg)", text: "var(--etapa-11-ink)" }, // fucsia 2
  { bg: "var(--etapa-12-bg)", text: "var(--etapa-12-ink)" }, // esmeralda 2
];
function etapaColor(i: number) {
  return ETAPA_COLORS[i % ETAPA_COLORS.length];
}

/** Sub-etiqueta de remarketing. NO saca a la campaña de su tipo: el total de
 *  Ventas sigue incluyéndola, porque el presupuesto se planifica por tipo. */
function RmktBadge() {
  return (
    <span
      className="rounded-full bg-[var(--purple-tint)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--plan)]"
      title="Campaña de remarketing (suma dentro de su tipo)"
    >
      RMKT
    </span>
  );
}

export default function EventoDrill({
  eventoId,
  nombre,
  venue,
  fechaEvento,
  diasEvento,
  techoUsd,
  drill,
  planRows,
  realMaxFecha,
  hoy,
  canEdit,
  etapas,
  desgloseRows,
  ads,
  tickets,
  serieResultado,
}: Props) {
  const { dias, plataformas, totalDia, totalPlan, totalReal } = drill;

  // Disponible = techo − plan (lo que queda por planificar contra el techo).
  const disponible = techoUsd != null ? techoUsd - totalPlan : null;
  const pctPlan = techoUsd && techoUsd > 0 ? (totalPlan / techoUsd) * 100 : null;
  const pctReal = techoUsd && techoUsd > 0 ? (totalReal / techoUsd) * 100 : null;

  // Segmentos de las bandas de etapa alineados a las columnas de días.
  const etapaSegs = useMemo(() => computeEtapaSegments(dias, etapas), [dias, etapas]);
  const hayEtapas = etapaSegs.some((s) => s.colorIdx !== null);

  // Desglose real por tipo/campaña. El tipo sale del objetivo declarado en la
  // plataforma (única clasificación); la corrida es client-side para que
  // expandir un canal no dispare un refetch.
  const desglose = useMemo(() => buildDesglose(dias, desgloseRows), [dias, desgloseRows]);
  // Los canales parten CERRADOS (pedido del equipo, 2026-08-28). Antes arrancaban
  // todos expandidos "para poder editar el plan", pero eso abría de entrada hasta
  // 12 filas de tipo por evento y la sábana se leía como un muro: el primer
  // pantallazo tiene que ser el resumen por canal, y se abre el canal en el que
  // se va a trabajar.
  const [expCanal, setExpCanal] = useState<Set<string>>(() => new Set());
  const [expTipo, setExpTipo] = useState<Set<string>>(new Set());

  // Serie de resultado alineada a las columnas de día. El memo depende de
  // [dias, serieResultado] y NUNCA del tramo mirado: recalcular al scrollear
  // sobre hasta 474 columnas es justo lo que hay que evitar.
  const serieCols = useMemo(() => {
    const idx = new Map(dias.map((f, i) => [f, i]));
    const mk = () => new Array<number | null>(dias.length).fill(null);
    const tx = mk();
    const pe = mk();
    const pm = mk();
    for (const r of serieResultado) {
      const i = idx.get(r.fecha);
      if (i === undefined) continue;
      tx[i] = r.transacciones;
      pe[i] = r.personas;
      pm[i] = r.pmOrdenes;
    }
    return { tx, pe, pm };
  }, [dias, serieResultado]);

  // El bloque solo existe si hay tickets. Las filas 2 y 3 son condicionales:
  // repetir una fila idéntica a lo largo de cientos de columnas, o pintar una de
  // puros guiones, es peor que no tenerla (las dos unidades ya están SIEMPRE
  // visibles en la card, que es donde la comparación tiene sentido).
  const refInterpretable =
    tickets.estado === "medible" && tickets.propagacionPct >= PM_PROPAGACION_MIN;
  const hayFilaPersonas = tickets.personas !== tickets.transacciones;
  const [expRes, setExpRes] = useState<boolean>(
    () => refInterpretable || hayFilaPersonas,
  );

  // Filas de TIPO por plataforma: los planificables (TIPOS_PLAN, orden fijo,
  // SIEMPRE presentes — plan editable), más "Sin tipo" si hay plan histórico
  // sin tipo, más los tipos con gasto real fuera de la lista (solo lectura).
  // El real por tipo sale del desglose (objective→OBJ_MAP); los labels cruzan
  // por igualdad con TIPOS_PLAN.
  type FilaTipo = {
    label: string; // lo que se muestra ("Ventas", "Sin tipo", "App"…)
    tipoKey: string; // valor en Neon ('' para Sin tipo)
    editable: boolean;
    plan: (number | null)[]; // null = sin plan (≠ $0)
    totalPlan: number;
    realNode: TipoNode | null;
  };
  const filasTipo = useMemo(() => {
    const diaIdx = new Map(dias.map((f, i) => [f, i]));
    // plataforma → tipoKey → serie de plan
    const planDe = new Map<string, Map<string, (number | null)[]>>();
    for (const r of planRows) {
      const col = diaIdx.get(r.fecha);
      if (col === undefined) continue;
      if (!planDe.has(r.plataforma)) planDe.set(r.plataforma, new Map());
      const tipos = planDe.get(r.plataforma)!;
      if (!tipos.has(r.tipo)) tipos.set(r.tipo, new Array(dias.length).fill(null));
      const serie = tipos.get(r.tipo)!;
      serie[col] = (serie[col] ?? 0) + r.montoUsd;
    }
    const out = new Map<string, FilaTipo[]>();
    for (const p of plataformas) {
      const planTipos = planDe.get(p.plataforma) ?? new Map<string, (number | null)[]>();
      const realTipos = desglose.get(p.plataforma) ?? [];
      const realDe = new Map(realTipos.map((t) => [t.tipo, t]));
      const filas: FilaTipo[] = [];
      const mk = (label: string, tipoKey: string, editable: boolean): FilaTipo => {
        const plan = planTipos.get(tipoKey) ?? new Array(dias.length).fill(null);
        return {
          label,
          tipoKey,
          editable,
          plan,
          totalPlan: plan.reduce<number>((a, v) => a + (v ?? 0), 0),
          realNode: realDe.get(label) ?? null,
        };
      };
      // 1) planificables, en el orden fijo de la planilla
      for (const t of TIPOS_PLAN[p.plataforma] ?? []) filas.push(mk(t, t, true));
      // 2) plan histórico sin tipo (solo si existe)
      if (planTipos.has(SIN_TIPO)) filas.push(mk(SIN_TIPO_LABEL, SIN_TIPO, true));
      // 3) tipos con gasto real fuera de la lista (App, Shopping…) — solo lectura
      const conocidos = new Set(filas.map((f) => f.label));
      for (const t of realTipos) {
        if (!conocidos.has(t.tipo)) filas.push({ ...mk(t.tipo, t.tipo, false), realNode: t });
      }
      out.set(p.plataforma, filas);
    }
    return out;
  }, [plataformas, planRows, desglose, dias]);
  const toggleCanal = (p: string) =>
    setExpCanal((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  const toggleTipo = (k: string) =>
    setExpTipo((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  // ---- Rellenar rango: la fila (plataforma × tipo) activa y sus prefills ----
  // `seq` fuerza el remount de la card en cada apertura (key): abrirla desde
  // otra celda de la MISMA fila también tiene que resetear desde/hasta/monto.
  const fillSeq = useRef(0);
  const [fill, setFill] = useState<{
    seq: number;
    plataforma: string;
    platLabel: string;
    tipoKey: string;
    tipoLabel: string;
    desde: string;
    hasta: string;
    monto: string;
  } | null>(null);
  const abrirFill = (t: Omit<NonNullable<typeof fill>, "seq">) =>
    setFill({ ...t, seq: ++fillSeq.current });
  // Prefill del botón de fila: hoy si cae en la ventana, si no el primer día.
  // Hasta queda VACÍO adrede — el rango completo del evento como default fue
  // lo que convirtió al RellenarRango de 2026 en un borrador de planes.
  const fillDesdeDefault =
    dias.length > 0 && hoy >= dias[0] && hoy <= dias[dias.length - 1] ? hoy : dias[0] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/inversion-medios"
            className="inline-flex items-center gap-1 font-sans text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" /> Inversión en medios
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold text-[var(--ink)]">{nombre || eventoId}</h1>
          <p className="mt-1 font-sans text-sm text-[var(--ink-muted)]">
            {eventoId}
            {venue ? ` · ${venue}` : ""}
            {fechaEvento
              ? ` · evento ${fechaEvento}${diasEvento > 1 ? ` (${diasEvento} días)` : ""}`
              : ""}{" "}
            · plan por plataforma en USD
            {realMaxFecha ? ` · real al ${realMaxFecha}` : ""}
          </p>
        </div>
      </header>

      {/* Bloque presupuesto (como el de la planilla, a la izquierda) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="Presupuesto (techo)" value={techoUsd != null ? fmtUsd(techoUsd) : "—"} hint="budgetPm · /admin/eventos" />
        <Stat label="Plan total" value={fmtUsd(totalPlan)} hint={pctPlan != null ? `${pctPlan.toFixed(0)}% del techo` : "sin techo"} />
        <Stat label="Invertido (real)" value={fmtUsd(totalReal)} hint={pctReal != null ? `${pctReal.toFixed(0)}% del techo` : "sin techo"} />
        <Stat
          label="Disponible"
          value={disponible != null ? fmtUsd(disponible) : "—"}
          hint={disponible != null && disponible < 0 ? "plan sobre el techo" : "techo − plan"}
          tone={disponible != null && disponible < 0 ? "neg" : undefined}
        />
        <Stat
          label="Ejecución"
          value={pctReal != null ? `${pctReal.toFixed(0)}%` : "—"}
          hint="real / techo"
          tone={pctReal != null && pctReal > 100 ? "neg" : undefined}
        />
      </div>

      <RendimientoEvento
        ads={ads}
        tickets={tickets}
        hoyEnRango={dias.length > 0 && dias[0] <= hoy && hoy <= dias[dias.length - 1]}
      />

      {canEdit && <EtapasEditor eventoId={eventoId} etapas={etapas} />}

      {canEdit && fill && (
        <RellenarRango
          key={fill.seq}
          eventoId={eventoId}
          plataforma={fill.plataforma}
          platLabel={fill.platLabel}
          tipoKey={fill.tipoKey}
          tipoLabel={fill.tipoLabel}
          init={fill}
          dias={dias}
          plan={filasTipo.get(fill.plataforma)?.find((f) => f.tipoKey === fill.tipoKey)?.plan ?? []}
          onClose={() => setFill(null)}
        />
      )}

      {/* Sábana horizontal: filas = plataforma (expandibles a tipo→campaña).
          `isolate`: los sticky internos (z-10/20/30) quedan contenidos en su
          propio stacking context y no pintan sobre la GroupNav (z-30). */}
      <div className="isolate overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
        <div className="max-h-[600px] overflow-auto overscroll-x-contain">
          <table className="border-separate border-spacing-0 font-sans text-sm">
            <thead>
              {/* Bandas de etapa (pre-registro, awareness, …) por rango de días. */}
              {hayEtapas && (
                <tr>
                  <th
                    style={{ height: BAND_H }}
                    className="sticky left-0 top-0 z-30 w-40 min-w-40 max-w-40 border-b border-r border-[var(--divider)] bg-[var(--surface-alt)] px-4 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--ink-subtle)]"
                  >
                    Etapa
                  </th>
                  {etapaSegs.map((s, i) => {
                    const col = s.colorIdx !== null ? etapaColor(s.colorIdx) : null;
                    return (
                      <th
                        key={i}
                        colSpan={s.span}
                        className="sticky top-0 z-20 truncate border-b border-l border-[var(--divider)] px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wide"
                        style={{
                          height: BAND_H,
                          ...(col ? { backgroundColor: col.bg, color: col.text } : { backgroundColor: "var(--surface)" }),
                        }}
                        title={s.nombre ?? undefined}
                      >
                        {s.nombre ?? ""}
                      </th>
                    );
                  })}
                  <th
                    style={{ height: BAND_H }}
                    className="sticky top-0 z-20 w-24 min-w-24 max-w-24 border-b border-l border-[var(--divider)] bg-[var(--surface-alt)]"
                  />
                </tr>
              )}
              <tr>
                <th
                  style={{ top: hayEtapas ? BAND_H : 0 }}
                  className="sticky left-0 z-30 w-40 min-w-40 max-w-40 border-b border-r border-[var(--divider)] bg-[var(--surface-alt)] px-4 py-2 text-left text-xs font-medium text-[var(--ink-muted)]"
                >
                  Canal
                </th>
                {dias.map((fecha, i) => {
                  const dia = Number(fecha.slice(8, 10));
                  const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay();
                  const esHoy = fecha === hoy;
                  // Todos los días del evento, no solo el primero: GLO197 gastó
                  // $295 y vendió 326 tickets en su segundo día, sin marca.
                  const diaEvento = esDiaEvento(fecha, fechaEvento, diasEvento);
                  const primerDia = dia === 1 || i === 0;
                  return (
                    <th
                      key={fecha}
                      style={{ top: hayEtapas ? BAND_H : 0 }}
                      title={diaEvento ? tituloDiaEvento(fecha, fechaEvento, diasEvento) : undefined}
                      className={`sticky z-20 w-16 min-w-16 max-w-16 border-b border-[var(--divider)] px-0 py-1.5 text-center text-xs font-medium ${
                        diaEvento
                          ? "bg-[var(--evento-tint)] text-[var(--evento-ink)]"
                          : esHoy
                            ? "bg-[var(--purple-tint)] text-[#9F99F8]"
                            : primerDia
                              ? "bg-[var(--surface)] text-[var(--ink)]"
                              : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"
                      } ${primerDia && i > 0 ? "border-l" : ""}`}
                    >
                      <span className="block text-[10px] font-normal uppercase text-[var(--ink-subtle)]">
                        {primerDia ? `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(2, 4)}` : DIAS_SEMANA[dow]}
                      </span>
                      {dia}
                    </th>
                  );
                })}
                <th
                  style={{ top: hayEtapas ? BAND_H : 0 }}
                  className="sticky z-20 w-24 min-w-24 max-w-24 border-b border-l border-[var(--divider)] bg-[var(--surface-alt)] px-3 py-2 text-right text-xs font-medium text-[var(--ink-muted)]"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {plataformas.flatMap((p) => {
                const tipos = filasTipo.get(p.plataforma) ?? [];
                const abierto = expCanal.has(p.plataforma);
                const rows: React.ReactNode[] = [];

                // Fila del CANAL: SUMA de sus tipos, solo lectura (la edición
                // del plan vive en las filas de tipo).
                rows.push(
                  <tr key={`canal-${p.plataforma}`} className="group">
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-2 align-top group-hover:bg-[var(--surface-alt)]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[var(--ink)]">
                        <button
                          onClick={() => toggleCanal(p.plataforma)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded text-[var(--ink-subtle)] hover:bg-[var(--grid)] hover:text-[var(--ink)]"
                          aria-label={abierto ? "Colapsar" : "Desagregar por tipo"}
                        >
                          {abierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAT_COLOR[p.label] }} />
                        {p.label}
                      </span>
                      <p className="mt-0.5 pl-6 text-xs tabular-nums text-[var(--ink-subtle)]">
                        plan <span className="font-medium text-[var(--plan)]">{fmtUsd(p.totalPlan, 0)}</span>{" "}
                        · real <span className="font-medium text-[var(--ink)]">{fmtUsd(p.totalReal, 0)}</span>
                      </p>
                    </td>
                    {p.dias.map((cell) => (
                      <td
                        key={cell.fecha}
                        className={`w-16 min-w-16 max-w-16 border-t border-[var(--divider)] p-0 text-center align-top ${
                          cell.fecha === hoy ? "bg-[var(--purple-tint)]/40" : ""
                        }`}
                      >
                        <CeldaPlan
                          eventoId={eventoId}
                          plataforma={p.plataforma}
                          tipo={SIN_TIPO}
                          cell={cell}
                          parcial={cell.fecha === hoy || cell.fecha > realMaxFecha}
                          canEdit={false}
                        />
                      </td>
                    ))}
                    <td className="border-l border-t border-[var(--divider)] px-3 py-2 text-right align-top tabular-nums text-xs">
                      <span className="block font-medium text-[var(--plan)]">{fmtUsd(p.totalPlan)}</span>
                      <span className="block text-[var(--ink)]">{fmtUsd(p.totalReal)}</span>
                    </td>
                  </tr>,
                );

                if (!abierto) return rows;

                // Filas de TIPO: plan EDITABLE por tipo + real clasificado.
                for (const f of tipos) {
                  const tk = `${p.plataforma}::${f.label}`;
                  const tAbierto = expTipo.has(tk);
                  const campanas = f.realNode?.campanas ?? [];
                  const totalReal = f.realNode?.total ?? 0;
                  const totalRmkt = f.realNode?.totalRmkt ?? 0;
                  rows.push(
                    <tr key={`tipo-${tk}`} className="bg-[var(--surface-sunken)]">
                      <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[var(--grid)] bg-[var(--surface-sunken)] py-1.5 pl-7 pr-3 align-top">
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--ink)]">
                          {campanas.length > 0 ? (
                            <button
                              onClick={() => toggleTipo(tk)}
                              className="inline-flex h-4 w-4 items-center justify-center rounded text-[var(--ink-subtle)] hover:bg-[var(--grid)] hover:text-[var(--ink)]"
                              aria-label={tAbierto ? "Colapsar" : "Ver campañas"}
                            >
                              {tAbierto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          ) : (
                            <span className="inline-block h-4 w-4" />
                          )}
                          <span className={f.tipoKey === SIN_TIPO ? "italic text-[var(--ink-subtle)]" : ""}>
                            {f.label}
                          </span>
                          {!f.editable && (
                            <span
                              className="text-[10px] uppercase tracking-wide text-[var(--ink-subtle)]"
                              title="Tipo fuera de la lista planificable: solo gasto real"
                            >
                              real
                            </span>
                          )}
                          {totalRmkt > 0 && (
                            <span className="text-[10px] text-[#9F99F8]" title="Del total real, en remarketing">
                              rmkt {fmtUsd(totalRmkt, 0)}
                            </span>
                          )}
                          {canEdit && f.editable && f.tipoKey !== SIN_TIPO && (
                            <button
                              onClick={() =>
                                abrirFill({
                                  plataforma: p.plataforma,
                                  platLabel: p.label,
                                  tipoKey: f.tipoKey,
                                  tipoLabel: f.label,
                                  desde: fillDesdeDefault,
                                  hasta: "",
                                  monto: "",
                                })
                              }
                              className="inline-flex h-4 w-4 items-center justify-center rounded text-[var(--ink-subtle)] hover:bg-[var(--grid)] hover:text-[var(--plan)]"
                              title={`Rellenar rango de ${p.label} · ${f.label}`}
                              aria-label={`Rellenar rango de ${p.label} · ${f.label}`}
                            >
                              <CalendarRange className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                        <p className="mt-0.5 pl-5 text-[11px] tabular-nums text-[var(--ink-subtle)]">
                          plan <span className="font-medium text-[var(--plan)]">{fmtUsd(f.totalPlan, 0)}</span>{" "}
                          · real <span className="font-medium text-[var(--ink)]">{fmtUsd(totalReal, 0)}</span>
                        </p>
                      </td>
                      {dias.map((fecha, i) => (
                        <td
                          key={fecha}
                          className={`w-16 min-w-16 max-w-16 border-t border-[var(--grid)] p-0 text-center align-top ${
                            fecha === hoy ? "bg-[var(--purple-tint)]/40" : ""
                          }`}
                        >
                          <CeldaPlan
                            eventoId={eventoId}
                            plataforma={p.plataforma}
                            tipo={f.tipoKey}
                            cell={{
                              fecha,
                              plan: f.plan[i],
                              real: f.realNode ? f.realNode.dias[i] : null,
                              fxImputado: p.dias[i]?.fxImputado ?? false,
                              sinFx: false,
                            }}
                            parcial={fecha === hoy || fecha > realMaxFecha}
                            canEdit={canEdit && f.editable}
                            onFill={
                              // El handle "copiar hacia adelante": celda CON plan
                              // y con al menos un día por delante en la ventana.
                              // Abre la card prellenada con este monto y ~15 días.
                              canEdit && f.editable && f.tipoKey !== SIN_TIPO && f.plan[i] != null && i < dias.length - 1
                                ? () =>
                                    abrirFill({
                                      plataforma: p.plataforma,
                                      platLabel: p.label,
                                      tipoKey: f.tipoKey,
                                      tipoLabel: f.label,
                                      desde: addDiasIso(fecha, 1),
                                      hasta:
                                        addDiasIso(fecha, 15) <= dias[dias.length - 1]
                                          ? addDiasIso(fecha, 15)
                                          : dias[dias.length - 1],
                                      monto: String(f.plan[i]),
                                    })
                                : undefined
                            }
                          />
                        </td>
                      ))}
                      <td className="border-l border-t border-[var(--grid)] px-3 py-1.5 text-right align-top tabular-nums text-xs">
                        <span className="block font-medium text-[var(--plan)]">{fmtUsd(f.totalPlan)}</span>
                        <span className="block text-[var(--ink)]">{fmtUsd(totalReal)}</span>
                      </td>
                    </tr>,
                  );
                  if (tAbierto) {
                    for (let ci = 0; ci < campanas.length; ci++) {
                      const c = campanas[ci];
                      rows.push(
                        <tr key={`camp-${tk}-${ci}`}>
                          <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 truncate border-r border-t border-[var(--grid)] bg-[var(--surface)] py-1 pl-12 pr-3 align-top text-[11px] text-[var(--ink-subtle)]" title={c.nombre}>
                            {c.esRmkt && <RmktBadge />} {c.nombre}
                          </td>
                          {dias.map((fecha, i) => (
                            <ReadCell key={fecha} value={c.dias[i]} hoy={fecha === hoy} muted />
                          ))}
                          <td className="border-l border-t border-[var(--grid)] px-3 py-1 text-right align-top tabular-nums text-[11px] text-[var(--ink-subtle)]">
                            {fmtUsd(c.total, 0)}
                          </td>
                        </tr>,
                      );
                    }
                  }
                }
                return rows;
              })}

              {/* ── Resultado del día ──────────────────────────────────────
                  Tickets de la ticketera alineados a las MISMAS columnas de día
                  que el gasto, bajo las bandas de etapa: es el cruce que esta
                  vista existe para mostrar. Se ocultan por CSS (nunca se
                  desmontan), igual que las filas del calendario.

                  NO hay fila de CPA, ROAS ni conversiones por día: la plataforma
                  imputa la conversión al día del CLIC, así que el CPA diario va
                  de 0,15× a 14,52× el del evento. Tampoco de devueltos: la
                  devolución no se puede fechar. */}
              {tickets.tieneTickets && (
                <>
                  <tr className="bg-[var(--surface-alt)]">
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[var(--divider)] bg-[var(--surface-alt)] px-4 py-1.5 align-top">
                      <button
                        onClick={() => setExpRes((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ink)] hover:text-[#9F99F8]"
                        title="Tickets vendidos por día de la orden. No hay CPA ni conversiones por día: la plataforma las imputa al día del clic, no al de la compra."
                      >
                        {expRes ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Resultado del día
                      </button>
                    </td>
                    {dias.map((fecha) => (
                      <td
                        key={fecha}
                        // Una sola utilidad bg-*: con `bg-[var(--surface-alt)]`
                        // fija + el condicional encima competían dos clases de
                        // igual especificidad y el ganador lo decidía el orden
                        // del CSS generado, no el del string.
                        className={`w-16 min-w-16 max-w-16 border-t border-[var(--divider)] p-0 ${
                          fecha === hoy ? "bg-[var(--purple-tint)]/40" : "bg-[var(--surface-alt)]"
                        }`}
                      />
                    ))}
                    <td className="border-l border-t border-[var(--divider)] bg-[var(--surface-alt)]" />
                  </tr>

                  <tr className={expRes ? "" : "hidden"}>
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[var(--grid)] bg-[var(--surface)] py-1 pl-7 pr-3 align-top text-[11px] text-[var(--ink-muted)]">
                      Tickets vendidos
                    </td>
                    {dias.map((fecha, i) => (
                      <ResultCell key={fecha} value={serieCols.tx[i]} hoy={fecha === hoy} />
                    ))}
                    <td className="border-l border-t border-[var(--grid)] px-3 py-1 text-right align-top tabular-nums text-[11px] font-medium text-[var(--ink-muted)]">
                      {formatInt(tickets.transacciones)}
                    </td>
                  </tr>

                  {hayFilaPersonas && (
                    <tr className={expRes ? "" : "hidden"}>
                      <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[var(--grid)] bg-[var(--surface)] py-1 pl-7 pr-3 align-top text-[11px] text-[var(--ink-subtle)]">
                        Personas
                      </td>
                      {dias.map((fecha, i) => (
                        <ResultCell key={fecha} value={serieCols.pe[i]} hoy={fecha === hoy} muted />
                      ))}
                      <td className="border-l border-t border-[var(--grid)] px-3 py-1 text-right align-top tabular-nums text-[11px] text-[var(--ink-subtle)]">
                        {formatInt(tickets.personas)}
                      </td>
                    </tr>
                  )}

                  {refInterpretable && (
                    <tr className={expRes ? "" : "hidden"}>
                      <td
                        className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[var(--grid)] bg-[var(--surface)] py-1 pl-7 pr-3 align-top text-[11px] text-[var(--ink-subtle)]"
                        title="Órdenes que llegaron a la ticketera con una etiqueta PM_ de campaña de venta."
                      >
                        Órdenes con PM_
                      </td>
                      {dias.map((fecha, i) => (
                        <ResultCell key={fecha} value={serieCols.pm[i]} hoy={fecha === hoy} muted />
                      ))}
                      <td className="border-l border-t border-[var(--grid)] px-3 py-1 text-right align-top tabular-nums text-[11px] text-[var(--ink-subtle)]">
                        {formatInt(tickets.pmOrdenes)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-30 w-40 min-w-40 max-w-40 border-r border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--ink)]">
                  Total diario (plan / real)
                </td>
                {totalDia.map((d) => (
                  <td
                    key={d.fecha}
                    className="sticky bottom-0 z-20 w-16 min-w-16 max-w-16 border-t border-[var(--divider)] bg-[var(--surface)] px-1 py-2 text-center tabular-nums text-xs"
                  >
                    <span className="block font-medium text-[var(--plan)]">{d.plan > 0 ? fmtUsd(d.plan, 0) : "·"}</span>
                    <span className="block text-[var(--ink)]">{d.real > 0 ? fmtUsd(d.real, 0) : "·"}</span>
                  </td>
                ))}
                <td className="sticky bottom-0 z-20 w-24 min-w-24 max-w-24 border-l border-t border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-right tabular-nums text-xs font-medium text-[var(--plan)]">
                  {fmtUsd(totalPlan)}
                  <span className="block font-normal text-[var(--ink)]">{fmtUsd(totalReal)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="font-sans text-xs text-[var(--ink-subtle)]">
        El presupuesto se planifica <span className="text-[var(--ink)]">por tipo de campaña y día</span>:
        en cada fila de tipo, <span className="font-medium text-[var(--plan)]">plan editable</span> (arriba,
        en morado) y <span className="font-medium text-[var(--ink)]">gasto real</span> (abajo, en negro).
        La fila del canal es la suma de sus tipos (solo lectura). El real se clasifica solo, desde el
        objetivo declarado en la plataforma; <span className="text-[var(--ink)]">RMKT</span> es una marca
        de la campaña y suma dentro de su tipo. <span className="italic text-[var(--ink-subtle)]">Sin tipo</span>{" "}
        es el plan cargado antes del desglose — muévelo a su tipo (carga el monto en el tipo correcto y
        vacía la celda de Sin tipo). El real de hoy es parcial (los datos de ads llegan a las 09:45). Las filas de{" "}
        <span className="text-[var(--ink-muted)]">Resultado del día</span> van en gris y de una línea: son
        tickets de la ticketera, no dinero, y se imputan al día de la orden.
      </p>

      <CampanasPorTipo plataformas={plataformas} desglose={desglose} />
    </div>
  );
}

// ---------- Campañas por tipo (nombres completos) ----------

/**
 * Lista canal → tipo → campañas con el nombre COMPLETO. En la sábana el nombre
 * vive en la columna sticky de 160px y sale truncado; acá se lee entero, que es
 * lo que hace falta para saber qué campaña está cayendo en Ventas o Cobertura.
 * Consume el MISMO `desglose` que la sábana, así que sigue el toggle
 * Objetivo↔Nombre y el rango de fechas en pantalla sin lógica duplicada.
 */
function CampanasPorTipo({
  plataformas,
  desglose,
}: {
  plataformas: DrillPlataformaRow[];
  desglose: Map<string, TipoNode[]>;
}) {
  // Orden: el de la sábana (meta → google → tiktok → otras), y dentro por gasto
  // (buildDesglose ya devuelve los tipos y las campañas ordenados desc).
  const grupos = plataformas.flatMap((p) =>
    (desglose.get(p.plataforma) ?? []).map((tipo) => ({ plat: p, tipo })),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">Campañas por tipo</h2>
        <span className="font-sans text-xs text-[var(--ink-subtle)]">
          gasto real del período en pantalla · tipo según el objetivo declarado en la plataforma
        </span>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 text-center font-sans text-sm text-[var(--ink-subtle)]">
          Sin gasto real en el período.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--divider)] bg-[var(--surface-alt)]">
                <th className="px-4 py-3 text-left font-sans text-xs font-medium text-[var(--ink-muted)]">
                  Campaña
                </th>
                <th className="w-28 px-4 py-3 text-right font-sans text-xs font-medium text-[var(--ink-muted)]">
                  Gasto
                </th>
                <th className="w-24 px-4 py-3 text-right font-sans text-xs font-medium text-[var(--ink-muted)]">
                  % del tipo
                </th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(({ plat, tipo }) => (
                <Fragment key={`${plat.plataforma}::${tipo.tipo}`}>
                  <tr className="border-b border-[var(--divider)] bg-[var(--surface-sunken)]">
                    <td className="px-4 py-2">
                      <span className="inline-flex flex-wrap items-center gap-2 font-sans text-sm font-medium text-[var(--ink)]">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PLAT_COLOR[plat.label] }}
                        />
                        {plat.label} · {tipo.tipo}
                        <span className="font-normal text-[var(--ink-subtle)]">
                          {tipo.campanas.length}{" "}
                          {tipo.campanas.length === 1 ? "campaña" : "campañas"}
                        </span>
                        {tipo.totalRmkt > 0 && (
                          <span className="font-normal text-[#9F99F8]">
                            {fmtUsd(tipo.totalRmkt, 0)} en remarketing
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-sans text-sm font-medium tabular-nums text-[var(--ink)]">
                      {fmtUsd(tipo.total)}
                    </td>
                    <td className="px-4 py-2" />
                  </tr>
                  {tipo.campanas.map((c) => (
                    <tr
                      key={c.nombre}
                      className="border-b border-[var(--divider)] transition-colors duration-150 hover:bg-[var(--surface-alt)]"
                    >
                      <td className="px-4 py-2.5 pl-10 font-sans text-sm text-[var(--ink)]">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {c.esRmkt && <RmktBadge />}
                          {c.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[var(--ink-muted)]">
                        {fmtUsd(c.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[var(--ink-subtle)]">
                        {tipo.total > 0 ? `${((c.total / tipo.total) * 100).toFixed(0)}%` : "·"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Celda read-only de gasto real (filas de tipo/campaña del desglose).
function ReadCell({ value, hoy, muted }: { value: number; hoy: boolean; muted?: boolean }) {
  return (
    <td
      className={`w-16 min-w-16 max-w-16 border-t px-1 py-1 text-center tabular-nums ${
        muted ? "border-[var(--grid)] text-[11px] text-[var(--ink-subtle)]" : "border-[var(--grid)] text-xs text-[var(--ink-muted)]"
      } ${hoy ? "bg-[var(--purple-tint)]/40" : ""}`}
    >
      {value > 0 ? fmtUsd(value, 0) : <span className="text-[var(--divider)]">·</span>}
    </td>
  );
}

/**
 * Celda de la serie de resultado. Gemela de `ReadCell` pero de UNA línea y con
 * TRES glifos con tres significados distintos, que es la razón de que no reuse
 * `ReadCell`:
 *   `—`  no hay dato para ese día (la ticketera no reportó nada)
 *   `·`  hay dato y es CERO (día medido sin ventas)
 *   `12` el conteo
 * Confundir los dos primeros es lo que hace que un panel de conteos mienta.
 */
function ResultCell({
  value,
  hoy,
  muted,
}: {
  value: number | null;
  hoy: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`w-16 min-w-16 max-w-16 border-t px-1 py-1 text-center tabular-nums ${
        muted
          ? "border-[var(--grid)] text-[11px] text-[var(--ink-subtle)]"
          : "border-[var(--grid)] text-xs text-[var(--ink-muted)]"
      } ${hoy ? "bg-[var(--purple-tint)]/40" : ""}`}
    >
      {value == null ? (
        <span className="text-[var(--divider)]">—</span>
      ) : value > 0 ? (
        compactInt(value)
      ) : (
        <span className="text-[var(--divider)]">·</span>
      )}
    </td>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neg";
}) {
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
      <p className="font-sans text-xs text-[var(--ink-muted)]">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold leading-none ${tone === "neg" ? "text-[#ED75A0]" : "text-[var(--ink)]"}`}>
        {value}
      </p>
      {hint && <p className="mt-2 font-sans text-[11px] text-[var(--ink-subtle)]">{hint}</p>}
    </div>
  );
}

// ---------- Editor de etapas de campaña ----------

type EtapaDraft = { nombre: string; fechaInicio: string };

// ---------- Rellenar rango (plataforma × TIPO) ----------

/**
 * Card de carga masiva del plan: el MISMO monto diario sobre un tramo de UNA
 * fila (plataforma × tipo). Es la vuelta del "Rellenar rango" eliminado el
 * 2026-08-24, con sus salvaguardas al revés del original:
 * - nace scopeada a la fila desde la que se abrió — no hay selector de
 *   plataforma/tipo que equivocar (el viejo era global y pre-`tipo`);
 * - `hasta` NO viene precargado con la ventana del evento (el default de la
 *   ventana completa fue lo que convertía un clic en un borrado de plan);
 * - el preview cuenta vacías vs. sobrescritas ANTES de escribir y el botón
 *   lleva el número (patrón "Guardar N celdas" del editor de eventos);
 * - server-side es upsert puro (`bulkFillPlanAction`, sin DELETE), así que las
 *   celdas fuera del rango, los otros tipos y las notas quedan intactos.
 * También la abre el handle "copiar hacia adelante" de una celda con plan,
 * prellenada con ese monto y ~15 días.
 */
function RellenarRango({
  eventoId,
  plataforma,
  platLabel,
  tipoKey,
  tipoLabel,
  init,
  dias,
  plan,
  onClose,
}: {
  eventoId: string;
  plataforma: string;
  platLabel: string;
  tipoKey: string;
  tipoLabel: string;
  init: { desde: string; hasta: string; monto: string };
  /** Ventana cargada del drill (las columnas de la sábana). */
  dias: string[];
  /** Plan existente de ESTA fila, alineado a `dias` — alimenta el preview. */
  plan: (number | null)[];
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [desde, setDesde] = useState(init.desde);
  const [hasta, setHasta] = useState(init.hasta);
  const [monto, setMonto] = useState(init.monto);
  const [soloVacios, setSoloVacios] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // La card vive arriba de la sábana y se puede abrir desde una fila lejana.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const min = dias[0] ?? "";
  const max = dias[dias.length - 1] ?? "";

  // Mismo parseo de moneda que CeldaPlan: $, espacios y coma decimal.
  const cleaned = monto.replace(/[$\s]/g, "").replace(",", ".");
  const num = Number(cleaned);
  const montoOk = cleaned !== "" && Number.isFinite(num) && num >= 0;

  // El rango se acota a la ventana CARGADA: es de lo único que se conoce el
  // plan existente y, por lo tanto, lo único que el preview puede contar.
  const rango = useMemo(() => {
    if (!desde || !hasta || desde > hasta) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < dias.length; i++) {
      if (dias[i] >= desde && dias[i] <= hasta) out.push(i);
    }
    return out;
  }, [dias, desde, hasta]);
  const conPlan = rango.reduce((a, i) => a + (plan[i] != null ? 1 : 0), 0);
  const vacias = rango.length - conPlan;
  const escribe = soloVacios ? vacias : rango.length;
  const listo = montoOk && escribe > 0 && !pending;

  const preview = !desde || !hasta
      ? `Elige desde y hasta (la ventana va del ${min} al ${max}).`
      : desde > hasta
        ? "El rango está invertido."
        : rango.length === 0
          ? "El rango cae fuera de la ventana cargada."
          : soloVacios
            ? `Escribe en ${vacias} ${vacias === 1 ? "día vacío" : "días vacíos"}${conPlan > 0 ? `; ${conPlan} con plan no se tocan` : ""}.`
            : conPlan > 0
              ? `Escribe en ${rango.length} días: ${vacias} ${vacias === 1 ? "vacío" : "vacíos"} y ${conPlan} con plan (se sobrescriben).`
              : `Escribe en ${rango.length} ${rango.length === 1 ? "día, vacío" : "días, todos vacíos"}.`;

  function aplicar() {
    if (!listo) return;
    start(async () => {
      const res = await bulkFillPlanAction({
        eventoId,
        plataforma,
        tipo: tipoKey,
        montoUsd: num,
        fechas: rango.map((i) => dias[i]),
        soloVacios,
      });
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      const n = res.data?.escritas ?? escribe;
      setMsg({ ok: true, text: `${n} ${n === 1 ? "día escrito" : "días escritos"}` });
      // La card queda abierta para encadenar otro tramo (otra etapa, otro
      // monto); el refresh trae el plan nuevo y el preview se recalcula solo.
      router.refresh();
    });
  }

  const inputCls =
    "rounded-lg border border-[var(--divider)] px-3 py-2 font-sans text-sm text-[var(--ink)] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div ref={ref} className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-sm font-medium text-[var(--ink)]">
          Rellenar rango — {platLabel} · <span className="text-[var(--plan)]">{tipoLabel}</span>
        </p>
        <button
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-alt)]"
          aria-label="Cerrar rellenar rango"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
          Desde
          <input type="date" value={desde} min={min} max={max} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
          Hasta
          <input type="date" value={hasta} min={min} max={max} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
          USD por día
          <input
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className={`${inputCls} w-28 text-right tabular-nums`}
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 font-sans text-xs text-[var(--ink-muted)]">
          <input
            type="checkbox"
            checked={soloVacios}
            onChange={(e) => setSoloVacios(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#9F99F8]"
          />
          solo días vacíos
        </label>
        <button
          onClick={aplicar}
          disabled={!listo}
          className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
        >
          {escribe > 0 ? `Escribir ${escribe} ${escribe === 1 ? "día" : "días"}` : "Escribir"}
        </button>
        {msg && (
          <span className={`pb-2.5 font-sans text-xs ${msg.ok ? "text-[var(--ink-muted)]" : "text-[#ED75A0]"}`}>
            {msg.text}
          </span>
        )}
      </div>

      <p className="mt-2 font-sans text-xs text-[var(--ink-subtle)]">
        {preview} Solo escribe en esta fila ({platLabel} · {tipoLabel}); las notas de las celdas
        sobrescritas se conservan y el resto del plan no se toca.
      </p>
    </div>
  );
}

function EtapasEditor({ eventoId, etapas }: { eventoId: string; etapas: EtapaCampana[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EtapaDraft[]>(
    etapas.length > 0
      ? etapas.map((e) => ({ nombre: e.nombre, fechaInicio: e.fechaInicio }))
      : ETAPAS_DEFAULT.map((n) => ({ nombre: n, fechaInicio: "" })),
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const resumen =
    etapas.filter((e) => e.fechaInicio).length > 0
      ? etapas
          .filter((e) => e.fechaInicio)
          .map((e) => `${e.nombre} ${e.fechaInicio.slice(8, 10)}/${e.fechaInicio.slice(5, 7)}`)
          .join(" · ")
      : "sin fechas definidas";

  function setRow(i: number, patch: Partial<EtapaDraft>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { nombre: "", fechaInicio: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }
  function guardar() {
    const limpio = rows
      .map((r) => ({ nombre: r.nombre.trim(), fechaInicio: r.fechaInicio.trim() }))
      .filter((r) => r.nombre);
    start(async () => {
      const res = await saveEtapasAction({ eventoId, etapas: limpio });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: "Etapas guardadas" });
        router.refresh();
      }
    });
  }

  const inputCls =
    "rounded-lg border border-[var(--divider)] px-3 py-2 font-sans text-sm text-[var(--ink)] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-sans text-sm font-medium text-[var(--ink)]">Etapas de campaña</span>
        <span className="font-sans text-xs text-[var(--ink-subtle)]">
          {resumen} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r, i) => {
            const col = etapaColor(i);
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: col.bg, border: `1px solid ${col.text}` }}
                />
                <input
                  value={r.nombre}
                  onChange={(e) => setRow(i, { nombre: e.target.value })}
                  placeholder="Nombre de la etapa"
                  className={`${inputCls} flex-1`}
                />
                <input
                  type="date"
                  value={r.fechaInicio}
                  onChange={(e) => setRow(i, { fechaInicio: e.target.value })}
                  className={`${inputCls} w-44`}
                  aria-label={`Fecha de inicio ${r.nombre || i + 1}`}
                />
                <button
                  onClick={() => removeRow(i)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-alt)]"
                  aria-label="Quitar etapa"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--divider)] px-3 py-2 font-sans text-sm text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
            >
              <Plus className="h-4 w-4" /> Agregar etapa
            </button>
            <button
              onClick={guardar}
              disabled={pending}
              className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
            >
              Guardar etapas
            </button>
            {msg && (
              <span className={`font-sans text-xs ${msg.ok ? "text-[var(--ink-muted)]" : "text-[#ED75A0]"}`}>
                {msg.text}
              </span>
            )}
          </div>
          <p className="mt-1 font-sans text-xs text-[var(--ink-subtle)]">
            El inicio de cada etapa es el fin de la anterior; la última corre hasta el final del
            calendario. El orden define el color. Solo las etapas con fecha pintan banda.
          </p>
        </div>
      )}
    </div>
  );
}
