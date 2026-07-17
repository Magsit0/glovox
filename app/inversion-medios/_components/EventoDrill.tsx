"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { DrillGrid } from "@/lib/queries/inversion-medios";
import { bulkUpsertAction } from "../actions";
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
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const PLAT_COLOR: Record<string, string> = {
  Meta: "#9F99F8",
  Google: "#B1D750",
  TikTok: "#87DACD",
  Otras: "#B4B2A9",
};

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
}: Props) {
  const { dias, plataformas, totalDia, totalPlan, totalReal } = drill;

  // Disponible = techo − plan (lo que queda por planificar contra el techo).
  const disponible = techoUsd != null ? techoUsd - totalPlan : null;
  const pctPlan = techoUsd && techoUsd > 0 ? (totalPlan / techoUsd) * 100 : null;
  const pctReal = techoUsd && techoUsd > 0 ? (totalReal / techoUsd) * 100 : null;

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

      {canEdit && <RellenarRango eventoId={eventoId} from={from} to={to} />}

      {/* Sábana horizontal: filas = plataforma, columnas = días */}
      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="max-h-[600px] overflow-auto overscroll-x-contain">
          <table className="border-separate border-spacing-0 font-sans text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-40 min-w-40 max-w-40 border-b border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2 text-left text-xs font-medium text-[#666666]">
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
                      className={`sticky top-0 z-20 w-16 min-w-16 max-w-16 border-b border-[#E5E5E5] px-0 py-1.5 text-center text-xs font-medium ${
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
                <th className="sticky top-0 z-20 w-24 min-w-24 max-w-24 border-b border-l border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-right text-xs font-medium text-[#666666]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {plataformas.map((p) => (
                <tr key={p.plataforma} className="group">
                  <td className="sticky left-0 z-10 w-40 min-w-40 max-w-40 border-r border-t border-[#E5E5E5] bg-white px-4 py-2 align-top group-hover:bg-[#FAFAFA]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#333333]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLAT_COLOR[p.label] }} />
                      {p.label}
                    </span>
                    <p className="mt-0.5 text-xs tabular-nums text-[#999999]">
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
                </tr>
              ))}
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
        Cada celda: <span className="text-[#333333]">plan editable</span> (arriba) y gasto real
        (abajo), por plataforma. El total diario suma Meta + Google + TikTok. El real de hoy es
        parcial (los datos de ads llegan a las 09:45). Por ahora el plan es por plataforma; el
        detalle por tipo de campaña vendrá después.
      </p>
    </div>
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
