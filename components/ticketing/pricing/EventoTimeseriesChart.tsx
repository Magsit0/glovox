"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import {
  getEventCampaignsAction,
  getEventTimeseriesAction,
  getForecastAction,
} from "@/app/ticketing/actions";
import type { EventCampaignRow, EventTimeseriesPoint, PacePoint } from "@/lib/queries/ticketing";
import type { ComparableEvent } from "@/lib/queries/pricing";

type Datum = {
  fecha: string;
  ticketsAcum: number | null;
  gastoPm: number | null;
  rrssDelta: number | null;
  esperado?: number | null;
};

const SERIES = [
  { key: "ticketsAcum", label: "Tickets (acum.)", axis: "left", color: seriesColor(0), money: false, dashed: false },
  { key: "esperado", label: "Esperado (tickets)", axis: "left", color: "#C5C1F5", money: false, dashed: true },
  { key: "gastoPm", label: "PM (gasto/día)", axis: "right", color: seriesColor(1), money: true, dashed: false },
  { key: "rrssDelta", label: "RRSS (Δ seguidores/día)", axis: "rrss", color: seriesColor(2), money: false, dashed: false },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtTick(f: string): string {
  const [, m, d] = f.split("-");
  return `${d} ${MESES[Number(m) - 1] ?? ""}`;
}
function fmtVal(v: number, money: boolean): string {
  return money ? compactCurrency(v) : formatNumber(v);
}
function daysTo(fecha: string, eventDate: string): number {
  const ms = new Date(`${eventDate}T00:00:00`).getTime() - new Date(`${fecha}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

interface Props {
  eventoId: string;
  /** Etapas con su fecha de inicio, para dibujar las bandas del eje X. */
  etapas?: { etapa: string; fechaInicio: string }[];
  /** Magnitud del forecast = tickets objetivo del plan (Σ a vender). */
  magnitud?: number;
  /** Fecha del evento (categoriaEvento.Fecha), ancla del forecast. */
  eventDate?: string;
}

const BAND_FILL = ["#9F99F8", "#87DACD"]; // tintes alternados muy tenues por etapa

export default function EventoTimeseriesChart({ eventoId, etapas, magnitud = 0, eventDate }: Props) {
  const [data, setData] = useState<Datum[] | null>(null);
  const [campaigns, setCampaigns] = useState<EventCampaignRow[]>([]);
  const [pace, setPace] = useState<PacePoint[]>([]);
  const [comparables, setComparables] = useState<ComparableEvent[]>([]);
  const [marca, setMarca] = useState("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    ticketsAcum: true,
    esperado: true,
    gastoPm: true,
    rrssDelta: true,
  });

  // Fetch al montar / cambiar de evento. setState solo dentro del callback.
  useEffect(() => {
    if (!eventoId) return;
    let cancel = false;
    Promise.all([
      getEventTimeseriesAction(eventoId),
      getEventCampaignsAction(eventoId),
      getForecastAction(eventoId),
    ]).then(([tsRes, campRes, fcRes]) => {
      if (cancel) return;
      if (!tsRes.ok) {
        setError(tsRes.error);
        setData([]);
      } else {
        let acc = 0;
        const pts: Datum[] = (tsRes.data ?? []).map((p: EventTimeseriesPoint) => {
          acc += p.tickets;
          return { fecha: p.fecha, ticketsAcum: acc, gastoPm: p.gastoPm, rrssDelta: p.rrssDelta };
        });
        setError(null);
        setData(pts);
      }
      setCampaigns(campRes.ok ? (campRes.data ?? []) : []);
      if (fcRes.ok && fcRes.data) {
        setPace(fcRes.data.pace);
        setComparables(fcRes.data.comparables);
        setMarca(fcRes.data.marca);
      }
      setExcluded([]);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [eventoId]);

  // Ajuste manual de comparables: recalcula el pace con los eventos incluidos.
  function toggleComparable(id: string) {
    const next = excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id];
    setExcluded(next);
    const refs = comparables.filter((c) => !next.includes(c.eventoId)).map((c) => c.eventoId);
    if (refs.length === 0) {
      setPace([]);
      return;
    }
    setForecastLoading(true);
    getForecastAction(eventoId, refs).then((res) => {
      if (res.ok && res.data) setPace(res.data.pace);
      setForecastLoading(false);
    });
  }

  // Serie unificada: datos reales + curva esperada (forecast) por fecha.
  const chartData = useMemo<Datum[]>(() => {
    const paceMap = new Map(pace.map((p) => [p.diasAlEvento, p.pctAcum]));
    const expectedAt = (fecha: string): number | null => {
      if (!eventDate || magnitud <= 0 || pace.length === 0) return null;
      const d = Math.max(0, Math.min(120, daysTo(fecha, eventDate)));
      const pct = paceMap.get(d);
      return pct == null ? null : Math.round(magnitud * pct);
    };
    if (data && data.length > 0) {
      return data.map((pt) => ({ ...pt, esperado: expectedAt(pt.fecha) }));
    }
    // Sin ventas: si hay forecast, generar un spine [eventDate−120 … eventDate].
    if (eventDate && magnitud > 0 && pace.length > 0) {
      const out: Datum[] = [];
      for (let dd = 120; dd >= 0; dd--) {
        const fecha = addDays(eventDate, -dd);
        out.push({ fecha, ticketsAcum: null, gastoPm: null, rrssDelta: null, esperado: expectedAt(fecha) });
      }
      return out;
    }
    return data ?? [];
  }, [data, pace, magnitud, eventDate]);

  // Bandas por etapa (sobre el spine actual, real o de forecast).
  const bands = useMemo(() => {
    if (chartData.length === 0 || !etapas?.length) return [];
    const first = chartData[0].fecha;
    const last = chartData[chartData.length - 1].fecha;
    const clamp = (d: string) => (d < first ? first : d > last ? last : d);
    const sorted = etapas
      .filter((e) => e.fechaInicio)
      .slice()
      .sort((a, b) => (a.fechaInicio < b.fechaInicio ? -1 : 1));
    const out: { etapa: string; x1: string; x2: string }[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const x1 = clamp(sorted[i].fechaInicio);
      const x2 = i + 1 < sorted.length ? clamp(sorted[i + 1].fechaInicio) : last;
      if (x1 >= x2) continue;
      out.push({ etapa: sorted[i].etapa, x1, x2 });
    }
    return out;
  }, [chartData, etapas]);

  if (!eventoId) return null;

  const active = SERIES.filter((s) => visible[s.key]);
  const showLeft = active.some((s) => s.axis === "left");
  const showRight = active.some((s) => s.axis === "right");
  const showRrss = active.some((s) => s.axis === "rrss");
  const refAxis = showLeft ? "left" : showRight ? "right" : "rrss";
  const tickInterval = chartData.length > 10 ? Math.floor(chartData.length / 8) : 0;
  const eventMarker = eventDate ?? (chartData.length > 0 ? chartData[chartData.length - 1].fecha : undefined);
  const sinVentas = !!data && data.length === 0;
  const usados = comparables.length - excluded.length;

  const gastoTotal = campaigns.reduce((a, c) => a + c.gasto, 0);
  const porObjetivo = Object.entries(
    campaigns.reduce<Record<string, { gasto: number; n: number }>>((acc, c) => {
      const k = c.objective || "—";
      acc[k] = acc[k] ?? { gasto: 0, n: 0 };
      acc[k].gasto += c.gasto;
      acc[k].n += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].gasto - a[1].gasto);

  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#333333]">Evolución del evento</h3>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Tickets reales (acum.), curva <strong>esperada</strong> (forecast), gasto PM y Δ
            seguidores, hasta el día del evento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERIES.map((s) => {
            const on = visible[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-xs transition-colors ${
                  on ? "border-[#E5E5E5] text-[#333333]" : "border-[#E5E5E5] text-[#999999] line-through"
                }`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: on ? s.color : "#CCCCCC" }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 h-[360px] w-full">
        {loading && (
          <div className="flex h-full items-center justify-center font-sans text-sm text-[#999999]">
            Cargando datos del evento…
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center font-sans text-sm text-[#A8336B]">
            {error}
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center font-sans text-sm text-[#999999]">
            <span>Este evento todavía no registra ventas.</span>
            <span className="text-xs">
              {magnitud <= 0
                ? "Cargá 'a vender' por tipo (o stock) para ver la curva esperada."
                : pace.length === 0
                  ? "Sin eventos comparables para proyectar la curva esperada."
                  : "La curva aparecerá cuando empiecen las órdenes."}
            </span>
          </div>
        )}
        {!loading && !error && chartData.length > 0 && active.length === 0 && (
          <div className="flex h-full items-center justify-center font-sans text-sm text-[#999999]">
            Elegí al menos una métrica.
          </div>
        )}
        {!loading && !error && chartData.length > 0 && active.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="fecha"
                tick={axisTick}
                tickFormatter={fmtTick}
                interval={tickInterval}
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
              />
              {showLeft && (
                <YAxis yAxisId="left" tick={axisTick} tickFormatter={(v) => formatNumber(v)} tickLine={false} axisLine={false} width={56} />
              )}
              {showRight && (
                <YAxis yAxisId="right" orientation="right" tick={axisTick} tickFormatter={(v) => compactCurrency(v)} tickLine={false} axisLine={false} width={56} />
              )}
              {showRrss && <YAxis yAxisId="rrss" orientation="right" hide />}
              {bands.map((b, i) => (
                <ReferenceArea
                  key={`area-${b.etapa}-${i}`}
                  yAxisId={refAxis}
                  x1={b.x1}
                  x2={b.x2}
                  fill={BAND_FILL[i % BAND_FILL.length]}
                  fillOpacity={0.07}
                  ifOverflow="extendDomain"
                  label={{ value: b.etapa, position: "insideTop", fontSize: 10, fill: "#999999" }}
                />
              ))}
              {bands.map((b, i) => (
                <ReferenceLine
                  key={`vline-${b.etapa}-${i}`}
                  yAxisId={refAxis}
                  x={b.x1}
                  stroke="#9F99F8"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                />
              ))}
              <Tooltip content={<ChartTooltip />} />
              {eventMarker && (
                <ReferenceLine
                  x={eventMarker}
                  yAxisId={refAxis}
                  stroke="#333333"
                  strokeDasharray="4 3"
                  label={{ value: "Evento", position: "insideTopRight", fontSize: 11, fill: "#666666" }}
                />
              )}
              {active.map((s) => (
                <Line
                  key={s.key}
                  yAxisId={s.axis}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Forecast: comparables usados (ajustables) */}
      {!loading && comparables.length > 0 && (
        <details className="mt-4 border-t border-[#E5E5E5] pt-3">
          <summary className="cursor-pointer font-sans text-sm text-[#666666]">
            Curva esperada: marca <strong className="text-[#333333]">{marca || "—"}</strong> ·{" "}
            {usados}/{comparables.length} eventos de referencia
            {forecastLoading ? " · recalculando…" : ""}
            {sinVentas ? " · proyección (sin ventas aún)" : ""}
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {comparables.map((c) => {
              const off = excluded.includes(c.eventoId);
              return (
                <label key={c.eventoId} className="flex items-center gap-2 font-sans text-xs text-[#666666]">
                  <input type="checkbox" checked={!off} onChange={() => toggleComparable(c.eventoId)} />
                  <span className={off ? "text-[#999999] line-through" : "text-[#333333]"}>
                    {c.eventoId} — {c.nombre} {c.temporada ? `(${c.temporada})` : ""} ·{" "}
                    {formatNumber(c.tickets)} tickets
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      )}

      {/* Detalle de campañas PM */}
      {!loading && campaigns.length > 0 && (
        <div className="mt-6 border-t border-[#E5E5E5] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-sans text-sm font-medium text-[#333333]">
              Campañas de paid media{" "}
              <span className="font-normal text-[#999999]">
                ({campaigns.length} · {compactCurrency(gastoTotal)})
              </span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {porObjetivo.map(([obj, v]) => (
                <span
                  key={obj}
                  className="inline-flex items-center gap-1 rounded-full bg-[#FAFAFA] px-2.5 py-1 font-sans text-xs text-[#666666]"
                  title={`${v.n} campaña(s)`}
                >
                  {obj}
                  <span className="tabular-nums text-[#333333]">{compactCurrency(v.gasto)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full font-sans text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                  <th className="px-3 py-2 text-left font-medium text-[#666666]">Campaña</th>
                  <th className="px-3 py-2 text-left font-medium text-[#666666]">Objetivo</th>
                  <th className="px-3 py-2 text-left font-medium text-[#666666]">Plataforma</th>
                  <th className="px-3 py-2 text-right font-medium text-[#666666]">Gasto</th>
                  <th className="px-3 py-2 text-right font-medium text-[#666666]">Impresiones</th>
                  <th className="px-3 py-2 text-right font-medium text-[#666666]">Clics</th>
                  <th className="px-3 py-2 text-left font-medium text-[#666666]">Período</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={`${c.campaignName}-${i}`} className="border-b border-[#E5E5E5] last:border-0">
                    <td className="px-3 py-2 text-[#333333]">{c.campaignName}</td>
                    <td className="px-3 py-2 text-[#666666]">{c.objective || "—"}</td>
                    <td className="px-3 py-2 text-[#666666]">{c.plataforma || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#333333]">{formatCurrency(c.gasto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#666666]">{formatNumber(c.impresiones)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#666666]">{formatNumber(c.clics)}</td>
                    <td className="px-3 py-2 text-[#666666]">
                      {c.desde}
                      {c.hasta && c.hasta !== c.desde ? ` → ${c.hasta}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

interface TooltipEntry {
  dataKey: string;
  value: number | null;
  color: string;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-md">
      <p className="mb-1 font-sans text-xs font-medium text-[#333333]">{label}</p>
      {payload.map((e) => {
        const meta = SERIES.find((s) => s.key === e.dataKey);
        if (!meta || e.value == null) return null;
        return (
          <p key={e.dataKey} className="flex items-center gap-2 font-sans text-xs text-[#666666]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
            {meta.label}: <span className="tabular-nums text-[#333333]">{fmtVal(e.value, meta.money)}</span>
          </p>
        );
      })}
    </div>
  );
}
