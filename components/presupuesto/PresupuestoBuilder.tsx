"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, Save, Trash2 } from "lucide-react";
import type { PresupuestoEvento } from "@/db/schema";
import type { EventInfo } from "@/lib/queries/ticketing";
import {
  coerceDoc,
  fiscalForCountry,
  formatMoney,
  type PresupuestoDoc,
} from "@/lib/budget-forecast/config";
import { cascade, marginSummary, projectRevenue } from "@/lib/budget-forecast/formulas";
import { formatNumber } from "@/lib/unabase/formatting";
import {
  deletePresupuestoAction,
  getForecastDefaultsAction,
  savePresupuestoAction,
  type ForecastDefaults,
} from "@/app/presupuesto/actions";
import CascadeChart from "./CascadeChart";

interface Props {
  presupuesto: PresupuestoEvento;
  /** Info general del evento (de glovox.categoriaEvento); null si no está mapeado. */
  eventInfo: EventInfo | null;
}

interface CatState {
  key: string;
  label: string;
  pctStr: string; // % en UI (0..100)
  overrideStr: string; // monto absoluto; "" = usar pct
}

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Cantidades/montos enteros: el "." en es-CL/es-PE es separador de miles.
function parseEntero(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/[\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
}

function numToStr(v: number | null): string {
  return v == null ? "" : String(Math.round(v));
}

function pctToStr(v: number): string {
  return String(+(v * 100).toFixed(1));
}

function initCats(doc: PresupuestoDoc): CatState[] {
  return doc.categorias.map((c) => ({
    key: c.key,
    label: c.label,
    pctStr: pctToStr(c.pct),
    overrideStr: numToStr(c.montoOverride),
  }));
}

export default function PresupuestoBuilder({ presupuesto, eventInfo }: Props) {
  const router = useRouter();
  const initialDoc = useMemo(() => coerceDoc(presupuesto.doc), [presupuesto.doc]);
  const country = presupuesto.country;
  // Derivados con consts planas: el React Compiler los memoiza (memo manual bloqueada).
  const fiscal = fiscalForCountry(country);
  const money = (v: number) => formatMoney(v, fiscal);

  const eventoId = initialDoc.eventoId;

  const [nombre, setNombre] = useState(presupuesto.nombre);
  const [fechaEvento, setFechaEvento] = useState(presupuesto.fechaEvento ?? "");
  const [asistentesStr, setAsistentesStr] = useState(numToStr(initialDoc.asistentes));
  const [ticketPcStr, setTicketPcStr] = useState(numToStr(initialDoc.ticketPerCapita));
  const [fbPcStr, setFbPcStr] = useState(numToStr(initialDoc.fbPerCapita));
  const [otrosStr, setOtrosStr] = useState(numToStr(initialDoc.ingresoMarcasOtros));
  const [marginStr, setMarginStr] = useState(pctToStr(initialDoc.targetMargin));
  const [cats, setCats] = useState<CatState[]>(() => initCats(initialDoc));

  const [savePending, startSave] = useTransition();
  const [defaultsPending, startDefaults] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [defaultsInfo, setDefaultsInfo] = useState<ForecastDefaults | null>(null);

  // --- Derivados (fórmulas puras) ---
  const revenue = projectRevenue({
    asistentes: parseEntero(asistentesStr),
    ticketPerCapita: parseEntero(ticketPcStr),
    fbPerCapita: parseEntero(fbPcStr),
    ingresoMarcasOtros: parseEntero(otrosStr),
  });
  const margin = (parseNum(marginStr) ?? 0) / 100;
  const summary = marginSummary(revenue.total, "markup", margin);
  const ceiling = summary.ceiling;

  const catList = cats.map((c) => ({
    key: c.key,
    label: c.label,
    pct: (parseNum(c.pctStr) ?? 0) / 100,
    montoOverride: parseEntero(c.overrideStr),
  }));
  const casc = cascade(ceiling, catList);

  function setCat(i: number, patch: Partial<CatState>) {
    setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function buildDoc(): PresupuestoDoc {
    return {
      eventoId,
      asistentes: parseEntero(asistentesStr),
      ticketPerCapita: parseEntero(ticketPcStr),
      fbPerCapita: parseEntero(fbPcStr),
      ingresoMarcasOtros: parseEntero(otrosStr),
      marginMode: "markup",
      targetMargin: margin,
      categorias: catList,
    };
  }

  function save() {
    setMsg(null);
    startSave(async () => {
      const res = await savePresupuestoAction(
        presupuesto.id,
        { nombre, country, fechaEvento: fechaEvento || null },
        buildDoc(),
      );
      setMsg(res.ok ? { kind: "ok", text: "Presupuesto guardado." } : { kind: "err", text: res.error });
      if (res.ok) router.refresh();
    });
  }

  function usarHistorico() {
    setMsg(null);
    startDefaults(async () => {
      const res = await getForecastDefaultsAction(eventoId);
      if (!res.ok || !res.data) {
        setMsg({ kind: "err", text: res.ok ? "Sin datos históricos" : res.error });
        return;
      }
      const d = res.data;
      setDefaultsInfo(d);
      if (d.perCapita.asistentes != null) setAsistentesStr(numToStr(d.perCapita.asistentes));
      if (d.perCapita.ticketPerCapita != null) setTicketPcStr(numToStr(d.perCapita.ticketPerCapita));
      if (d.perCapita.fbPerCapita != null) setFbPcStr(numToStr(d.perCapita.fbPerCapita));
      if (d.costShares.source === "comparables") {
        const pctByKey = new Map(d.costShares.buckets.map((b) => [b.key, b.pct]));
        setCats((prev) =>
          prev.map((c) => ({ ...c, pctStr: pctToStr(pctByKey.get(c.key as never) ?? 0) })),
        );
      }
    });
  }

  function remove() {
    if (!confirm("¿Borrar este presupuesto? No se puede deshacer.")) return;
    startSave(async () => {
      const res = await deletePresupuestoAction(presupuesto.id);
      if (res.ok) router.push("/presupuesto");
      else setMsg({ kind: "err", text: res.error });
    });
  }

  const paisLabel = country === "PE" ? "Perú" : "Chile";

  return (
    <div className="flex flex-col gap-8">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/presupuesto")}
          className="inline-flex items-center gap-2 font-sans text-sm text-[#666666] transition-colors hover:text-[#333333]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={savePending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ED75A0] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#E55C8F] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Borrar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={savePending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savePending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-lg border bg-white p-3 ${
            msg.kind === "ok" ? "border-[#B1D750]" : "border-[#ED75A0]"
          }`}
        >
          <span
            className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
              msg.kind === "ok" ? "bg-[#B1D750]" : "bg-[#ED75A0]"
            }`}
          />
          <p className="flex-1 font-sans text-sm text-[#333333]">{msg.text}</p>
        </div>
      )}

      {/* Cabecera */}
      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="font-sans text-xs text-[#666666]">Nombre del evento</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-[#666666]">Fecha del evento</span>
            <input
              type="date"
              value={fechaEvento}
              onChange={(e) => setFechaEvento(e.target.value)}
              className={inputCls}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-[#666666]">Evento</span>
            <p className="pt-2 font-sans text-sm text-[#333333]">
              {eventoId || "—"} · {paisLabel}
              {eventInfo?.venue ? ` · ${eventInfo.venue}` : ""}
            </p>
          </div>
        </div>
      </section>

      {/* Ingresos */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Supuestos de ingreso
            </h2>
            <button
              type="button"
              onClick={usarHistorico}
              disabled={defaultsPending || !eventoId}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-sans text-xs font-medium text-[#666666] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333] disabled:opacity-50"
            >
              <History className="h-3.5 w-3.5" />
              {defaultsPending ? "Buscando…" : "Usar histórico"}
            </button>
          </div>
          <NumberField label="Asistentes esperados" value={asistentesStr} onChange={setAsistentesStr} />
          <NumberField
            label={`Venta de tickets por asistente (${fiscal.currency})`}
            value={ticketPcStr}
            onChange={setTicketPcStr}
          />
          <NumberField
            label={`Consumo F&B por asistente (${fiscal.currency})`}
            value={fbPcStr}
            onChange={setFbPcStr}
          />
          <NumberField
            label={`Ingreso por marcas u otros (${fiscal.currency})`}
            value={otrosStr}
            onChange={setOtrosStr}
          />
          {defaultsInfo && (
            <DefaultsNote defaults={defaultsInfo} money={money} />
          )}
        </div>

        {/* Ingreso proyectado */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Ingreso proyectado
            </h2>
            <dl className="mt-4 flex flex-col gap-3">
              <Row label="Tickets" value={money(revenue.tickets)} />
              <Row label="F&B" value={money(revenue.fb)} />
              <Row label="Marcas u otros" value={money(revenue.otros)} />
            </dl>
          </div>
          <div className="rounded-xl bg-[#9F99F8] p-8">
            <p className="font-sans text-xs text-white/80">Ingreso total proyectado</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none text-white">
              {money(revenue.total)}
            </p>
            <p className="mt-4 font-sans text-sm text-white/80">
              {formatNumber(parseEntero(asistentesStr) ?? 0)} asistentes
            </p>
          </div>
        </div>
      </section>

      {/* Margen → techo */}
      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Margen objetivo → techo presupuestario
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-[#666666]">Margen objetivo (%)</span>
            <input
              value={marginStr}
              onChange={(e) => setMarginStr(e.target.value)}
              inputMode="decimal"
              className={inputCls}
            />
            <span className="font-sans text-xs text-[#999999]">Markup sobre costo</span>
          </label>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="font-sans text-xs text-[#666666]">Techo presupuestario</span>
            <p className="font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {money(ceiling)}
            </p>
            <span className="font-sans text-xs text-[#999999]">
              {money(revenue.total)} / (1 + {(margin * 100).toFixed(1)}%) = {money(ceiling)} ·
              ganancia {money(summary.profit)} ({(summary.profitOverRevenue * 100).toFixed(1)}% del
              ingreso)
            </span>
          </div>
        </div>
      </section>

      {/* Cascada por categoría */}
      <section className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Cascada por categoría
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Cada categoría toma un % del techo. Podés fijar un monto absoluto que manda sobre el %.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="px-4 py-3 text-left font-medium text-[#666666]">Categoría</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">% del techo</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Monto</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">Override</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c, i) => (
                <tr key={c.key} className="border-b border-[#E5E5E5] last:border-0">
                  <td className="px-4 py-3 font-medium text-[#333333]">{c.label}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      value={c.pctStr}
                      onChange={(e) => setCat(i, { pctStr: e.target.value })}
                      inputMode="decimal"
                      className={`${numInputCls} ${casc.rows[i]?.esOverride ? "opacity-40" : ""}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                    {money(casc.rows[i]?.monto ?? 0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      value={c.overrideStr}
                      onChange={(e) => setCat(i, { overrideStr: e.target.value })}
                      placeholder="—"
                      inputMode="numeric"
                      className={numInputCls}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FAFAFA]">
                <td className="px-4 py-3 font-medium text-[#333333]">Asignado</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#666666]">
                  {(casc.pctAsignado * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-[#333333]">
                  {money(casc.asignado)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Restante / sobre-asignado */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                casc.sobreAsignado ? "bg-[#ED75A0]" : "bg-[#B1D750]"
              }`}
            />
            {casc.sobreAsignado
              ? `Sobre-asignado ${money(-casc.restante)}`
              : `Restante ${money(casc.restante)}`}
          </span>
          <div className="h-2 flex-1 basis-48 overflow-hidden rounded-full bg-[#F0F0F0]">
            <div
              className={`h-full rounded-full ${casc.sobreAsignado ? "bg-[#ED75A0]" : "bg-[#9F99F8]"}`}
              style={{ width: `${Math.min(100, casc.pctAsignado * 100)}%` }}
            />
          </div>
        </div>
      </section>

      <CascadeChart
        rows={casc.rows.map((r) => ({ key: r.key, label: r.label, monto: r.monto }))}
        ceiling={ceiling}
        money={money}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-xs text-[#666666]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="0"
        className={inputCls}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-sans text-sm text-[#666666]">{label}</dt>
      <dd className="font-sans text-sm tabular-nums text-[#333333]">{value}</dd>
    </div>
  );
}

function DefaultsNote({
  defaults,
  money,
}: {
  defaults: ForecastDefaults;
  money: (v: number) => string;
}) {
  const { perCapita, costShares } = defaults;
  const r = perCapita.ranges;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 font-sans text-xs text-[#666666]">
      <p>
        Fuente:{" "}
        {perCapita.source === "own"
          ? "histórico propio del evento"
          : perCapita.source === "comparables"
            ? `promedio de ${perCapita.n} eventos comparables`
            : "sin histórico"}
        .
      </p>
      {perCapita.ticketPromedio != null && (
        <p className="mt-1">
          Ticket promedio (venta por ticket vendido): {money(perCapita.ticketPromedio)}
          {r.ticketPromedio ? ` · rango ${money(r.ticketPromedio.min)}–${money(r.ticketPromedio.max)}` : ""}.
          <span className="text-[#999999]"> Referencia; el cálculo usa la venta por asistente.</span>
        </p>
      )}
      {r.fbPerCapita && (
        <p className="mt-1">
          F&B por asistente: rango {money(r.fbPerCapita.min)}–{money(r.fbPerCapita.max)}.
        </p>
      )}
      {costShares.source === "comparables" && (
        <p className="mt-1">% por categoría desde {costShares.nEventos} eventos.</p>
      )}
      {costShares.sinMapear.length > 0 && (
        <p className="mt-1 text-[#EF8C34]">
          Sin mapear (cae en “Otras”): {costShares.sinMapear.slice(0, 5).map((x) => `${x.categoria} (${money(x.monto)})`).join(", ")}
          {costShares.sinMapear.length > 5 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

const numInputCls =
  "w-28 rounded-lg border border-[#E5E5E5] bg-white px-2 py-1.5 text-right font-sans text-sm tabular-nums text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";
