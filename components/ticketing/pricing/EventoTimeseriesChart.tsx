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
import { getEventCampaignsAction, getEventTimeseriesAction } from "@/app/ticketing/actions";
import type { EventCampaignRow, EventTimeseriesPoint } from "@/lib/queries/ticketing";

type Datum = {
  fecha: string;
  ticketsAcum: number;
  gastoPm: number;
  rrssDelta: number | null;
};

const SERIES = [
  { key: "ticketsAcum", label: "Tickets (acum.)", axis: "left", color: seriesColor(0), money: false },
  { key: "gastoPm", label: "PM (gasto/día)", axis: "right", color: seriesColor(1), money: true },
  // RRSS en su propio eje (oculto) para que no la aplaste la escala del PM.
  { key: "rrssDelta", label: "RRSS (Δ seguidores/día)", axis: "rrss", color: seriesColor(2), money: false },
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

interface Props {
  eventoId: string;
  /** Etapas con su fecha de inicio, para dibujar las bandas del eje X. */
  etapas?: { etapa: string; fechaInicio: string }[];
}

const BAND_FILL = ["#9F99F8", "#87DACD"]; // tintes alternados muy tenues por etapa

export default function EventoTimeseriesChart({ eventoId, etapas }: Props) {
  const [data, setData] = useState<Datum[] | null>(null);
  const [campaigns, setCampaigns] = useState<EventCampaignRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    ticketsAcum: true,
    gastoPm: true,
    rrssDelta: true,
  });

  // Fetch al montar / cambiar de evento. Todos los setState ocurren dentro del
  // callback de la promesa (tras el await), no de forma síncrona en el effect.
  useEffect(() => {
    if (!eventoId) return;
    let cancel = false;
    Promise.all([getEventTimeseriesAction(eventoId), getEventCampaignsAction(eventoId)]).then(
      ([tsRes, campRes]) => {
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
        setLoading(false);
      },
    );
    return () => {
      cancel = true;
    };
  }, [eventoId]);

  // Bandas por etapa: tramos [inicio_i, inicio_{i+1}) recortados a la ventana
  // del gráfico (fechas fuera del rango se ajustan al borde; tramos vacíos se
  // descartan). El último tramo cierra en el día del evento. (useMemo antes de
  // cualquier return para no romper las reglas de hooks.)
  const bands = useMemo(() => {
    if (!data || data.length === 0 || !etapas?.length) return [];
    const first = data[0].fecha;
    const last = data[data.length - 1].fecha;
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
  }, [data, etapas]);

  if (!eventoId) return null;

  const active = SERIES.filter((s) => visible[s.key]);
  const showLeft = active.some((s) => s.axis === "left");
  const showRight = active.some((s) => s.axis === "right");
  const showRrss = active.some((s) => s.axis === "rrss");
  // Eje válido para bandas / líneas de referencia (cualquiera activo).
  const refAxis = showLeft ? "left" : showRight ? "right" : "rrss";
  const tickInterval = data && data.length > 10 ? Math.floor(data.length / 8) : 0;
  // La serie termina en el día del evento (spine hasta MIN(FechaEvento)).
  const eventDate = data && data.length > 0 ? data[data.length - 1].fecha : undefined;

  // Resumen de campañas PM por objetivo (tipo de campaña).
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
            Tickets vendidos (acumulado), gasto de paid media y seguidores de Instagram, desde el
            inicio de venta hasta el día del evento.
          </p>
        </div>
        {/* Toggle de métricas */}
        <div className="flex flex-wrap gap-2">
          {SERIES.map((s) => {
            const on = visible[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-xs transition-colors ${
                  on
                    ? "border-[#E5E5E5] text-[#333333]"
                    : "border-[#E5E5E5] text-[#999999] line-through"
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
        {!loading && !error && data && data.length === 0 && (
          <div className="flex h-full items-center justify-center font-sans text-sm text-[#999999]">
            No hay datos para este evento.
          </div>
        )}
        {!loading && !error && data && data.length > 0 && active.length === 0 && (
          <div className="flex h-full items-center justify-center font-sans text-sm text-[#999999]">
            Elegí al menos una métrica.
          </div>
        )}
        {!loading && !error && data && data.length > 0 && active.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
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
                <YAxis
                  yAxisId="left"
                  tick={axisTick}
                  tickFormatter={(v) => formatNumber(v)}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
              )}
              {showRight && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={axisTick}
                  tickFormatter={(v) => compactCurrency(v)}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
              )}
              {/* Eje propio de RRSS, oculto: solo escala el delta para que sea visible. */}
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
              {eventDate && (
                <ReferenceLine
                  x={eventDate}
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
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detalle de campañas PM (las que alimentan la curva de gasto) */}
      {!loading && campaigns.length > 0 && (
        <div className="mt-6 border-t border-[#E5E5E5] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-sans text-sm font-medium text-[#333333]">
              Campañas de paid media{" "}
              <span className="font-normal text-[#999999]">
                ({campaigns.length} · {compactCurrency(gastoTotal)})
              </span>
            </h4>
            {/* Resumen por objetivo / tipo de campaña */}
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
