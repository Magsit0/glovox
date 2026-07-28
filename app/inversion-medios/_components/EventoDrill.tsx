"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type { DrillGrid } from "@/lib/queries/inversion-medios";
import {
  computeEtapaSegments,
  ETAPAS_DEFAULT,
  type EtapaCampana,
} from "@/lib/inversion-medios/etapas";
import {
  buildDesglose,
  type DesgloseRow,
  type ModoTipo,
} from "@/lib/inversion-medios/tipos";
import { bulkUpsertAction, saveEtapasAction } from "../actions";
import CeldaPlan from "./CeldaPlan";
import { fmtUsd } from "./format";

type Props = {
  eventoId: string;
  nombre: string;
  venue: string;
  fechaEvento: string;
  techoUsd: number | null;
  drill: DrillGrid;
  from: string;
  to: string;
  realMaxFecha: string;
  hoy: string;
  /** false → drill read-only (grant sin rol superadmin): sin inputs ni rellenar rango. */
  canEdit: boolean;
  etapas: EtapaCampana[];
  /** Gasto real crudo por (fecha, plataforma, objective, campaña) para el desglose. */
  desgloseRows: DesgloseRow[];
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

export default function EventoDrill({
  eventoId,
  nombre,
  venue,
  fechaEvento,
  techoUsd,
  drill,
  from,
  to,
  realMaxFecha,
  hoy,
  canEdit,
  etapas,
  desgloseRows,
}: Props) {
  const { dias, plataformas, totalDia, totalPlan, totalReal } = drill;

  // Disponible = techo − plan (lo que queda por planificar contra el techo).
  const disponible = techoUsd != null ? techoUsd - totalPlan : null;
  const pctPlan = techoUsd && techoUsd > 0 ? (totalPlan / techoUsd) * 100 : null;
  const pctReal = techoUsd && techoUsd > 0 ? (totalReal / techoUsd) * 100 : null;

  // Segmentos de las bandas de etapa alineados a las columnas de días.
  const etapaSegs = useMemo(() => computeEtapaSegments(dias, etapas), [dias, etapas]);
  const hayEtapas = etapaSegs.some((s) => s.colorIdx !== null);

  // Desglose real por tipo/campaña (clasificación client-side → toggle instantáneo).
  const [modoTipo, setModoTipo] = useState<ModoTipo>("objetivo");
  const desglose = useMemo(
    () => buildDesglose(dias, desgloseRows, modoTipo),
    [dias, desgloseRows, modoTipo],
  );
  const [expCanal, setExpCanal] = useState<Set<string>>(new Set());
  const [expTipo, setExpTipo] = useState<Set<string>>(new Set());
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
    <div className="flex flex-col gap-6">
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
            {fechaEvento ? ` · evento ${fechaEvento}` : ""} · plan por plataforma en USD
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

      {canEdit && <EtapasEditor eventoId={eventoId} etapas={etapas} />}

      {canEdit && <RellenarRango eventoId={eventoId} from={from} to={to} />}

      {/* Barra: cómo se clasifican los tipos al abrir un canal */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs text-[#666666]">
          Al abrir un canal, clasificar el tipo por:
        </span>
        <div className="flex overflow-hidden rounded-lg border border-[#E5E5E5] bg-white font-sans text-xs">
          {(
            [
              ["objetivo", "Objetivo"],
              ["nombre", "Nombre"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setModoTipo(k)}
              className={`px-3 py-1.5 transition-colors ${
                modoTipo === k
                  ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                  : "text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="font-sans text-xs text-[#999999]">
          {modoTipo === "objetivo"
            ? "objetivo de la campaña (Ventas, Cobertura, P.Max…)"
            : "parseado del nombre de campaña (capta RMKT)"}
        </span>
      </div>

      {/* Sábana horizontal: filas = plataforma (expandibles a tipo→campaña) */}
      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
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
                  const primerDia = dia === 1 || i === 0;
                  return (
                    <th
                      key={fecha}
                      style={{ top: hayEtapas ? BAND_H : 0 }}
                      className={`sticky z-20 w-16 min-w-16 max-w-16 border-b border-[#E5E5E5] px-0 py-1.5 text-center text-xs font-medium ${
                        esHoy ? "bg-[#F0EFFE] text-[#9F99F8]" : primerDia ? "bg-white text-[#333333]" : "bg-[#FAFAFA] text-[#666666]"
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
                const tipos = desglose.get(p.plataforma) ?? [];
                const abierto = expCanal.has(p.plataforma);
                const rows: React.ReactNode[] = [];

                // Fila del CANAL (plan editable + real).
                rows.push(
                  <tr key={`canal-${p.plataforma}`} className="group">
                    <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#E5E5E5] bg-white px-4 py-2 align-top group-hover:bg-[#FAFAFA]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#333333]">
                        {tipos.length > 0 ? (
                          <button
                            onClick={() => toggleCanal(p.plataforma)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded text-[#999999] hover:bg-[#F0F0F0] hover:text-[#333333]"
                            aria-label={abierto ? "Colapsar" : "Desagregar por tipo"}
                          >
                            {abierto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        ) : (
                          <span className="inline-block h-4 w-4" />
                        )}
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAT_COLOR[p.label] }} />
                        {p.label}
                      </span>
                      <p className="mt-0.5 pl-6 text-xs tabular-nums text-[#999999]">
                        plan {fmtUsd(p.totalPlan, 0)} · real {fmtUsd(p.totalReal, 0)}
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
                          cell={cell}
                          parcial={cell.fecha === hoy || cell.fecha > realMaxFecha}
                          canEdit={canEdit}
                        />
                      </td>
                    ))}
                    <td className="border-l border-t border-[#E5E5E5] px-3 py-2 text-right align-top tabular-nums text-xs">
                      <span className="block font-medium text-[#333333]">{fmtUsd(p.totalPlan)}</span>
                      <span className="block text-[#999999]">{fmtUsd(p.totalReal)}</span>
                    </td>
                  </tr>,
                );

                if (!abierto) return rows;

                // Filas de TIPO (real only) + campañas al expandir.
                for (const t of tipos) {
                  const tk = `${p.plataforma}::${t.tipo}`;
                  const tAbierto = expTipo.has(tk);
                  rows.push(
                    <tr key={`tipo-${tk}`} className="bg-[#FBFBFD]">
                      <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#F0F0F0] bg-[#FBFBFD] py-1.5 pl-7 pr-3 align-top">
                        <span className="inline-flex items-center gap-1 text-xs text-[#333333]">
                          {t.campanas.length > 1 ? (
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
                          {t.tipo}
                          <span className="text-[#BBBBBB]">· {fmtUsd(t.total, 0)}</span>
                        </span>
                      </td>
                      {dias.map((fecha, i) => (
                        <ReadCell key={fecha} value={t.dias[i]} hoy={fecha === hoy} />
                      ))}
                      <td className="border-l border-t border-[#F0F0F0] px-3 py-1.5 text-right align-top tabular-nums text-xs text-[#666666]">
                        {fmtUsd(t.total)}
                      </td>
                    </tr>,
                  );
                  if (tAbierto) {
                    for (let ci = 0; ci < t.campanas.length; ci++) {
                      const c = t.campanas[ci];
                      rows.push(
                        <tr key={`camp-${tk}-${ci}`}>
                          <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 truncate border-r border-t border-[#F5F5F5] bg-white py-1 pl-12 pr-3 align-top text-[11px] text-[#999999]" title={c.nombre}>
                            {c.nombre}
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
                    <span className="block text-[#333333]">{d.plan > 0 ? fmtUsd(d.plan, 0) : "·"}</span>
                    <span className="block text-[#999999]">{d.real > 0 ? fmtUsd(d.real, 0) : "·"}</span>
                  </td>
                ))}
                <td className="sticky bottom-0 z-20 w-24 min-w-24 max-w-24 border-l border-t border-[#E5E5E5] bg-white px-3 py-2 text-right tabular-nums text-xs font-medium text-[#333333]">
                  {fmtUsd(totalPlan)}
                  <span className="block font-normal text-[#999999]">{fmtUsd(totalReal)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="font-sans text-xs text-[#999999]">
        En la fila de canal: <span className="text-[#333333]">plan editable</span> (arriba) y gasto
        real (abajo). El chevron desagrega el gasto real por tipo de campaña, y cada tipo se abre en
        sus campañas. El plan es por plataforma (el detalle por tipo llegará en otra fase). El real
        de hoy es parcial (los datos de ads llegan a las 09:45).
      </p>
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

// ---------- Rellenar rango (por plataforma) ----------

function RellenarRango({ eventoId, from, to }: { eventoId: string; from: string; to: string }) {
  const router = useRouter();
  const [plataforma, setPlataforma] = useState("meta");
  const [desde, setDesde] = useState(from);
  const [hasta, setHasta] = useState(to);
  const [monto, setMonto] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dias = useMemo(() => {
    const out: string[] = [];
    if (!desde || !hasta || desde > hasta) return out;
    const d = new Date(`${desde}T00:00:00Z`);
    const end = new Date(`${hasta}T00:00:00Z`);
    while (d <= end) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
  }, [desde, hasta]);

  function aplicar() {
    const cleaned = monto.replace(/[$\s]/g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!cleaned || !Number.isFinite(num) || num < 0 || dias.length === 0) {
      setMsg({ ok: false, text: "Revisá rango y monto" });
      return;
    }
    const rows = dias.map((fecha) => ({ eventoId, fecha, plataforma, montoUsd: num }));
    start(async () => {
      const res = await bulkUpsertAction({ rows });
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: `${res.data?.upserted ?? rows.length} días de ${plataforma}` });
        setMonto("");
        router.refresh();
      }
    });
  }

  const inputCls =
    "rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm text-[#333333] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <p className="mr-2 font-sans text-sm font-medium text-[#333333]">Rellenar rango</p>
        <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
          Plataforma
          <select value={plataforma} onChange={(e) => setPlataforma(e.target.value)} className={inputCls}>
            <option value="meta">Meta</option>
            <option value="google">Google</option>
            <option value="tiktok">TikTok</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
          USD por día
          <input
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            className={`${inputCls} w-28 text-right tabular-nums`}
          />
        </label>
        <button
          onClick={aplicar}
          disabled={pending}
          className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
        >
          Aplicar
        </button>
        {msg && (
          <span className={`font-sans text-xs ${msg.ok ? "text-[#666666]" : "text-[#ED75A0]"}`}>{msg.text}</span>
        )}
      </div>
      <p className="mt-2 font-sans text-xs text-[#999999]">
        Fija el mismo monto diario a una plataforma en todo el rango (sobrescribe esa plataforma en esos días).
      </p>
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
