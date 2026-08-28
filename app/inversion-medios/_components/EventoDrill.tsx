"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type {
  AdsMetricasEvento,
  DrillGrid,
  DrillPlataformaRow,
  PlanDiarioRow,
  SerieResultadoRow,
  TicketsEvento,
} from "@/lib/queries/inversion-medios";
import { PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";
import { esDiaEvento, tituloDiaEvento } from "@/lib/inversion-medios/evento";
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
import { saveEtapasAction } from "../actions";
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
const ETAPA_COLORS: { bg: string; text: string }[] = [
  { bg: "#E6F1FB", text: "#185FA5" }, // azul
  { bg: "#FAEEDA", text: "#854F0B" }, // ámbar
  { bg: "#FAECE7", text: "#993C1D" }, // coral
  { bg: "#FCEBEB", text: "#A32D2D" }, // rojo
  { bg: "#EAF3DE", text: "#3B6D11" }, // verde
  { bg: "#EEEDFE", text: "#534AB7" }, // púrpura
  { bg: "#FBEAF0", text: "#993556" }, // rosa
  { bg: "#E1F5EE", text: "#0F6E56" }, // teal
  { bg: "#F1EFE8", text: "#444441" }, // gris
  { bg: "#E8F0FE", text: "#1A56DB" }, // azul 2
  { bg: "#FCE8F3", text: "#9B1C6B" }, // fucsia 2
  { bg: "#ECFDF5", text: "#047857" }, // esmeralda 2
];
function etapaColor(i: number) {
  return ETAPA_COLORS[i % ETAPA_COLORS.length];
}

/** Sub-etiqueta de remarketing. NO saca a la campaña de su tipo: el total de
 *  Ventas sigue incluyéndola, porque el presupuesto se planifica por tipo. */
function RmktBadge() {
  return (
    <span
      className="rounded-full bg-[#F0EFFE] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#534AB7]"
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

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/inversion-medios"
            className="inline-flex items-center gap-1 font-sans text-sm text-[#666666] hover:text-[#333333]"
          >
            <ArrowLeft className="h-4 w-4" /> Inversión en medios
          </Link>
          <h1 className="mt-1 font-display text-3xl font-bold text-[#333333]">{nombre || eventoId}</h1>
          <p className="mt-1 font-sans text-sm text-[#666666]">
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

      {/* Sábana horizontal: filas = plataforma (expandibles a tipo→campaña).
          `isolate`: los sticky internos (z-10/20/30) quedan contenidos en su
          propio stacking context y no pintan sobre la GroupNav (z-30). */}
      <div className="isolate overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="max-h-[600px] overflow-auto overscroll-x-contain">
          <table className="border-separate border-spacing-0 font-sans text-sm">
            <thead>
              {/* Bandas de etapa (pre-registro, awareness, …) por rango de días. */}
              {hayEtapas && (
                <tr>
                  <th
                    style={{ height: BAND_H }}
                    className="sticky left-0 top-0 z-30 w-40 min-w-40 max-w-40 border-b border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-[#999999]"
                  >
                    Etapa
                  </th>
                  {etapaSegs.map((s, i) => {
                    const col = s.colorIdx !== null ? etapaColor(s.colorIdx) : null;
                    return (
                      <th
                        key={i}
                        colSpan={s.span}
                        className="sticky top-0 z-20 truncate border-b border-l border-[#E5E5E5] px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wide"
                        style={{
                          height: BAND_H,
                          ...(col ? { backgroundColor: col.bg, color: col.text } : { backgroundColor: "#FFFFFF" }),
                        }}
                        title={s.nombre ?? undefined}
                      >
                        {s.nombre ?? ""}
                      </th>
                    );
                  })}
                  <th
                    style={{ height: BAND_H }}
                    className="sticky top-0 z-20 w-24 min-w-24 max-w-24 border-b border-l border-[#E5E5E5] bg-[#FAFAFA]"
                  />
                </tr>
              )}
              <tr>
                <th
                  style={{ top: hayEtapas ? BAND_H : 0 }}
                  className="sticky left-0 z-30 w-40 min-w-40 max-w-40 border-b border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2 text-left text-xs font-medium text-[#666666]"
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
                      className={`sticky z-20 w-16 min-w-16 max-w-16 border-b border-[#E5E5E5] px-0 py-1.5 text-center text-xs font-medium ${
                        diaEvento
                          ? "bg-[#FAEEDA] text-[#854F0B]"
                          : esHoy
                            ? "bg-[#F0EFFE] text-[#9F99F8]"
                            : primerDia
                              ? "bg-white text-[#333333]"
                              : "bg-[#FAFAFA] text-[#666666]"
                      } ${primerDia && i > 0 ? "border-l" : ""}`}
                    >
                      <span className="block text-[10px] font-normal uppercase text-[#999999]">
                        {primerDia ? `${MESES[Number(fecha.slice(5, 7)) - 1]} ${fecha.slice(2, 4)}` : DIAS_SEMANA[dow]}
                      </span>
                      {dia}
                    </th>
                  );
                })}
                <th
                  style={{ top: hayEtapas ? BAND_H : 0 }}
                  className="sticky z-20 w-24 min-w-24 max-w-24 border-b border-l border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-right text-xs font-medium text-[#666666]"
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
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#E5E5E5] bg-white px-4 py-2 align-top group-hover:bg-[#FAFAFA]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#333333]">
                        <button
                          onClick={() => toggleCanal(p.plataforma)}
                          className="inline-flex h-4 w-4 items-center justify-center rounded text-[#999999] hover:bg-[#F0F0F0] hover:text-[#333333]"
                          aria-label={abierto ? "Colapsar" : "Desagregar por tipo"}
                        >
                          {abierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAT_COLOR[p.label] }} />
                        {p.label}
                      </span>
                      <p className="mt-0.5 pl-6 text-xs tabular-nums text-[#999999]">
                        plan <span className="font-medium text-[#534AB7]">{fmtUsd(p.totalPlan, 0)}</span>{" "}
                        · real <span className="font-medium text-[#333333]">{fmtUsd(p.totalReal, 0)}</span>
                      </p>
                    </td>
                    {p.dias.map((cell) => (
                      <td
                        key={cell.fecha}
                        className={`w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] p-0 text-center align-top ${
                          cell.fecha === hoy ? "bg-[#F0EFFE]/40" : ""
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
                    <td className="border-l border-t border-[#E5E5E5] px-3 py-2 text-right align-top tabular-nums text-xs">
                      <span className="block font-medium text-[#534AB7]">{fmtUsd(p.totalPlan)}</span>
                      <span className="block text-[#333333]">{fmtUsd(p.totalReal)}</span>
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
                    <tr key={`tipo-${tk}`} className="bg-[#FBFBFD]">
                      <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#F0F0F0] bg-[#FBFBFD] py-1.5 pl-7 pr-3 align-top">
                        <span className="inline-flex items-center gap-1 text-xs text-[#333333]">
                          {campanas.length > 0 ? (
                            <button
                              onClick={() => toggleTipo(tk)}
                              className="inline-flex h-4 w-4 items-center justify-center rounded text-[#999999] hover:bg-[#F0F0F0] hover:text-[#333333]"
                              aria-label={tAbierto ? "Colapsar" : "Ver campañas"}
                            >
                              {tAbierto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          ) : (
                            <span className="inline-block h-4 w-4" />
                          )}
                          <span className={f.tipoKey === SIN_TIPO ? "italic text-[#999999]" : ""}>
                            {f.label}
                          </span>
                          {!f.editable && (
                            <span
                              className="text-[10px] uppercase tracking-wide text-[#BBBBBB]"
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
                        </span>
                        <p className="mt-0.5 pl-5 text-[11px] tabular-nums text-[#999999]">
                          plan <span className="font-medium text-[#534AB7]">{fmtUsd(f.totalPlan, 0)}</span>{" "}
                          · real <span className="font-medium text-[#333333]">{fmtUsd(totalReal, 0)}</span>
                        </p>
                      </td>
                      {dias.map((fecha, i) => (
                        <td
                          key={fecha}
                          className={`w-16 min-w-16 max-w-16 border-t border-[#F0F0F0] p-0 text-center align-top ${
                            fecha === hoy ? "bg-[#F0EFFE]/40" : ""
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
                          />
                        </td>
                      ))}
                      <td className="border-l border-t border-[#F0F0F0] px-3 py-1.5 text-right align-top tabular-nums text-xs">
                        <span className="block font-medium text-[#534AB7]">{fmtUsd(f.totalPlan)}</span>
                        <span className="block text-[#333333]">{fmtUsd(totalReal)}</span>
                      </td>
                    </tr>,
                  );
                  if (tAbierto) {
                    for (let ci = 0; ci < campanas.length; ci++) {
                      const c = campanas[ci];
                      rows.push(
                        <tr key={`camp-${tk}-${ci}`}>
                          <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 truncate border-r border-t border-[#F5F5F5] bg-white py-1 pl-12 pr-3 align-top text-[11px] text-[#999999]" title={c.nombre}>
                            {c.esRmkt && <RmktBadge />} {c.nombre}
                          </td>
                          {dias.map((fecha, i) => (
                            <ReadCell key={fecha} value={c.dias[i]} hoy={fecha === hoy} muted />
                          ))}
                          <td className="border-l border-t border-[#F5F5F5] px-3 py-1 text-right align-top tabular-nums text-[11px] text-[#999999]">
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
                  <tr className="bg-[#FAFAFA]">
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#E5E5E5] bg-[#FAFAFA] px-4 py-1.5 align-top">
                      <button
                        onClick={() => setExpRes((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#333333] hover:text-[#9F99F8]"
                        title="Tickets vendidos por día de la orden. No hay CPA ni conversiones por día: la plataforma las imputa al día del clic, no al de la compra."
                      >
                        {expRes ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Resultado del día
                      </button>
                    </td>
                    {dias.map((fecha) => (
                      <td
                        key={fecha}
                        className={`w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] bg-[#FAFAFA] p-0 ${
                          fecha === hoy ? "bg-[#F9F9FF]" : ""
                        }`}
                      />
                    ))}
                    <td className="border-l border-t border-[#E5E5E5] bg-[#FAFAFA]" />
                  </tr>

                  <tr className={expRes ? "" : "hidden"}>
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#F0F0F0] bg-white py-1 pl-7 pr-3 align-top text-[11px] text-[#666666]">
                      Tickets vendidos
                    </td>
                    {dias.map((fecha, i) => (
                      <ResultCell key={fecha} value={serieCols.tx[i]} hoy={fecha === hoy} />
                    ))}
                    <td className="border-l border-t border-[#F0F0F0] px-3 py-1 text-right align-top tabular-nums text-[11px] font-medium text-[#666666]">
                      {formatInt(tickets.transacciones)}
                    </td>
                  </tr>

                  {hayFilaPersonas && (
                    <tr className={expRes ? "" : "hidden"}>
                      <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#F5F5F5] bg-white py-1 pl-7 pr-3 align-top text-[11px] text-[#999999]">
                        Personas
                      </td>
                      {dias.map((fecha, i) => (
                        <ResultCell key={fecha} value={serieCols.pe[i]} hoy={fecha === hoy} muted />
                      ))}
                      <td className="border-l border-t border-[#F5F5F5] px-3 py-1 text-right align-top tabular-nums text-[11px] text-[#999999]">
                        {formatInt(tickets.personas)}
                      </td>
                    </tr>
                  )}

                  {refInterpretable && (
                    <tr className={expRes ? "" : "hidden"}>
                      <td
                        className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#F5F5F5] bg-white py-1 pl-7 pr-3 align-top text-[11px] text-[#999999]"
                        title="Órdenes que llegaron a la ticketera con una etiqueta PM_ de campaña de venta."
                      >
                        Órdenes con PM_
                      </td>
                      {dias.map((fecha, i) => (
                        <ResultCell key={fecha} value={serieCols.pm[i]} hoy={fecha === hoy} muted />
                      ))}
                      <td className="border-l border-t border-[#F5F5F5] px-3 py-1 text-right align-top tabular-nums text-[11px] text-[#999999]">
                        {formatInt(tickets.pmOrdenes)}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-30 w-40 min-w-40 max-w-40 border-r border-t border-[#E5E5E5] bg-white px-4 py-2 text-xs font-medium text-[#333333]">
                  Total diario (plan / real)
                </td>
                {totalDia.map((d) => (
                  <td
                    key={d.fecha}
                    className="sticky bottom-0 z-20 w-16 min-w-16 max-w-16 border-t border-[#E5E5E5] bg-white px-1 py-2 text-center tabular-nums text-xs"
                  >
                    <span className="block font-medium text-[#534AB7]">{d.plan > 0 ? fmtUsd(d.plan, 0) : "·"}</span>
                    <span className="block text-[#333333]">{d.real > 0 ? fmtUsd(d.real, 0) : "·"}</span>
                  </td>
                ))}
                <td className="sticky bottom-0 z-20 w-24 min-w-24 max-w-24 border-l border-t border-[#E5E5E5] bg-white px-3 py-2 text-right tabular-nums text-xs font-medium text-[#534AB7]">
                  {fmtUsd(totalPlan)}
                  <span className="block font-normal text-[#333333]">{fmtUsd(totalReal)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="font-sans text-xs text-[#999999]">
        El presupuesto se planifica <span className="text-[#333333]">por tipo de campaña y día</span>:
        en cada fila de tipo, <span className="font-medium text-[#534AB7]">plan editable</span> (arriba,
        en morado) y <span className="font-medium text-[#333333]">gasto real</span> (abajo, en negro).
        La fila del canal es la suma de sus tipos (solo lectura). El real se clasifica solo, desde el
        objetivo declarado en la plataforma; <span className="text-[#333333]">RMKT</span> es una marca
        de la campaña y suma dentro de su tipo. <span className="italic text-[#999999]">Sin tipo</span>{" "}
        es el plan cargado antes del desglose — muévelo a su tipo (carga el monto en el tipo correcto y
        vacía la celda de Sin tipo). El real de hoy es parcial (los datos de ads llegan a las 09:45). Las filas de{" "}
        <span className="text-[#666666]">Resultado del día</span> van en gris y de una línea: son
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
        <h2 className="font-display text-lg font-bold text-[#333333]">Campañas por tipo</h2>
        <span className="font-sans text-xs text-[#999999]">
          gasto real del período en pantalla · tipo según el objetivo declarado en la plataforma
        </span>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6 text-center font-sans text-sm text-[#999999]">
          Sin gasto real en el período.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                  Campaña
                </th>
                <th className="w-28 px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">
                  Gasto
                </th>
                <th className="w-24 px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">
                  % del tipo
                </th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(({ plat, tipo }) => (
                <Fragment key={`${plat.plataforma}::${tipo.tipo}`}>
                  <tr className="border-b border-[#E5E5E5] bg-[#FBFBFD]">
                    <td className="px-4 py-2">
                      <span className="inline-flex flex-wrap items-center gap-2 font-sans text-sm font-medium text-[#333333]">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PLAT_COLOR[plat.label] }}
                        />
                        {plat.label} · {tipo.tipo}
                        <span className="font-normal text-[#999999]">
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
                    <td className="px-4 py-2 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                      {fmtUsd(tipo.total)}
                    </td>
                    <td className="px-4 py-2" />
                  </tr>
                  {tipo.campanas.map((c) => (
                    <tr
                      key={c.nombre}
                      className="border-b border-[#E5E5E5] transition-colors duration-150 hover:bg-[#FAFAFA]"
                    >
                      <td className="px-4 py-2.5 pl-10 font-sans text-sm text-[#333333]">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {c.esRmkt && <RmktBadge />}
                          {c.nombre}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#666666]">
                        {fmtUsd(c.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#999999]">
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
        muted ? "border-[#F5F5F5] text-[11px] text-[#999999]" : "border-[#F0F0F0] text-xs text-[#666666]"
      } ${hoy ? "bg-[#F0EFFE]/40" : ""}`}
    >
      {value > 0 ? fmtUsd(value, 0) : <span className="text-[#E5E5E5]">·</span>}
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
          ? "border-[#F5F5F5] text-[11px] text-[#999999]"
          : "border-[#F0F0F0] text-xs text-[#666666]"
      } ${hoy ? "bg-[#F9F9FF]" : ""}`}
    >
      {value == null ? (
        <span className="text-[#E5E5E5]">—</span>
      ) : value > 0 ? (
        compactInt(value)
      ) : (
        <span className="text-[#E5E5E5]">·</span>
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
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold leading-none ${tone === "neg" ? "text-[#ED75A0]" : "text-[#333333]"}`}>
        {value}
      </p>
      {hint && <p className="mt-2 font-sans text-[11px] text-[#999999]">{hint}</p>}
    </div>
  );
}

// ---------- Editor de etapas de campaña ----------

type EtapaDraft = { nombre: string; fechaInicio: string };

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
    "rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm text-[#333333] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-sans text-sm font-medium text-[#333333]">Etapas de campaña</span>
        <span className="font-sans text-xs text-[#999999]">
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F5F5F5]"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333]"
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
              <span className={`font-sans text-xs ${msg.ok ? "text-[#666666]" : "text-[#ED75A0]"}`}>
                {msg.text}
              </span>
            )}
          </div>
          <p className="mt-1 font-sans text-xs text-[#999999]">
            El inicio de cada etapa es el fin de la anterior; la última corre hasta el final del
            calendario. El orden define el color. Solo las etapas con fecha pintan banda.
          </p>
        </div>
      )}
    </div>
  );
}
