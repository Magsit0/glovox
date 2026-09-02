"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OnepagerLlegadaRow } from "@/lib/queries/onepager";
import {
  axisTick,
  BRAND,
  gridProps,
  INK,
  legendProps,
  seriesColor,
  seriesFillSoft,
  SURFACE,
} from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import MultiFilter from "./MultiFilter";

type Props = {
  data: OnepagerLlegadaRow[];
};

const SLOT_MIN = 15;
const LLEGADAS_COLOR = seriesColor(0); // morado: personas por slot (área)
const ACUM_COLOR = seriesColor(1); // verde: % acumulado (línea)
const PEAK_COLOR = BRAND.pink; // marcador del peak

const TIPO_LABEL: Record<string, string> = { VENTA: "Venta", CORTESIA: "Cortesía" };
const TIPO_KEY: Record<string, string> = { Venta: "VENTA", "Cortesía": "CORTESIA" };

type SerieRow = {
  slotIso: string;
  slotLabel: string;
  fecha: string;
  personas: number;
  acum: number;
  acumPct: number;
};

function fmtNum(v: number) {
  return Math.round(v).toLocaleString("es-CL");
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// El slotIso es hora LOCAL del evento sin zona; se parsea como UTC para que la
// aritmética de slots no dependa de la zona del navegador.
function isoToDate(iso: string): Date {
  return new Date(iso + "Z");
}

function dateToIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

function labelOf(iso: string): string {
  return iso.slice(11, 16);
}

function fechaCorta(fecha: string): string {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : fecha;
}

/** "22:15 – 22:30" (rango explícito del slot, como en FF&BB). */
function slotRange(iso: string): string {
  const start = isoToDate(iso);
  const end = new Date(start.getTime() + SLOT_MIN * 60_000);
  return `${labelOf(iso)} – ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
}

/**
 * Curva de hora de llegada (tickets quemados por slot de 15 min, en personas)
 * con el peak marcado y el % acumulado de público adentro. Slots vacíos entre
 * el primer y el último ingreso se rellenan con 0 para que la forma sea real.
 */
export default function LlegadasChart({ data }: Props) {
  const [tipos, setTipos] = useState<Set<string>>(new Set());

  const tiposOpts = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) set.add(TIPO_LABEL[r.ventaNoventa] ?? r.ventaNoventa);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [data]);

  const serie = useMemo<SerieRow[]>(() => {
    const selectedKeys = new Set(Array.from(tipos).map((t) => TIPO_KEY[t] ?? t));
    const filtered =
      selectedKeys.size === 0 ? data : data.filter((r) => selectedKeys.has(r.ventaNoventa));
    if (filtered.length === 0) return [];

    const byIso = new Map<string, number>();
    for (const r of filtered) byIso.set(r.slotIso, (byIso.get(r.slotIso) ?? 0) + r.personas);

    const isos = Array.from(byIso.keys()).sort();
    const first = isoToDate(isos[0]);
    const last = isoToDate(isos[isos.length - 1]);
    // Guard: un evento con quemados sueltos semanas después (re-scans, pruebas)
    // haría una serie kilométrica; se acota a 7 días desde el primer ingreso.
    // 7 y no 48 h porque hay festivales de 3 días (GLO181: 21–23 nov).
    const maxEnd = new Date(first.getTime() + 7 * 24 * 3600_000);
    const end = last < maxEnd ? last : maxEnd;

    const out: SerieRow[] = [];
    let acum = 0;
    for (let t = first.getTime(); t <= end.getTime(); t += SLOT_MIN * 60_000) {
      const iso = dateToIso(new Date(t));
      const personas = byIso.get(iso) ?? 0;
      acum += personas;
      out.push({ slotIso: iso, slotLabel: labelOf(iso), fecha: iso.slice(0, 10), personas, acum, acumPct: 0 });
    }
    // Lo que quedó fuera de la ventana de 48 h igual cuenta en el total.
    const total = filtered.reduce((a, r) => a + r.personas, 0);
    for (const row of out) row.acumPct = total > 0 ? (row.acum / total) * 100 : 0;
    return out;
  }, [data, tipos]);

  const total = useMemo(() => serie.length ? serie[serie.length - 1].acum : 0, [serie]);
  const multiDay = useMemo(() => new Set(serie.map((r) => r.fecha)).size > 1, [serie]);

  const peak = useMemo(() => {
    let best: SerieRow | null = null;
    for (const r of serie) if (!best || r.personas > best.personas) best = r;
    return best && best.personas > 0 ? best : null;
  }, [serie]);

  const mitad = useMemo(() => serie.find((r) => r.acumPct >= 50) ?? null, [serie]);

  if (data.length === 0) {
    return (
      <p className="font-sans text-sm text-[#999999]">
        Sin registros de ingreso (tickets quemados con hora) para este evento.
      </p>
    );
  }

  const tickLabel = (iso: string) =>
    multiDay ? `${fechaCorta(iso.slice(0, 10))} ${labelOf(iso)}` : labelOf(iso);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <MultiFilter
          label="Tipo de ticket"
          selected={tipos}
          onChange={setTipos}
          options={tiposOpts}
          searchPlaceholder="Buscar tipo…"
        />
        {tipos.size > 0 && (
          <button
            type="button"
            onClick={() => setTipos(new Set())}
            className="rounded-lg px-3 py-2 font-sans font-medium text-sm text-[#666666] hover:text-[#333333] hover:bg-[#F5F5F5] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
        <span className="font-sans text-xs text-[#666666]">
          Slots de {SLOT_MIN} min · hora local del evento · {fmtNum(total)} personas
        </span>
      </div>

      {/* Peak y mitad del público: las dos horas que importan para operación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="flex items-center gap-2 font-sans text-xs text-[#666666]">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: PEAK_COLOR }} />
            Peak de llegada
          </p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {peak ? slotRange(peak.slotIso) : "—"}
          </p>
          {peak && multiDay && (
            <p className="mt-2 font-sans text-xs text-[#999999]">{fechaCorta(peak.fecha)}</p>
          )}
        </div>
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">Personas en el peak</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {peak ? fmtNum(peak.personas) : "—"}
          </p>
          {peak && total > 0 && (
            <p className="mt-2 font-sans text-xs text-[#999999]">
              {((peak.personas / total) * 100).toFixed(1)}% del público en {SLOT_MIN} min
            </p>
          )}
        </div>
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="flex items-center gap-2 font-sans text-xs text-[#666666]">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: ACUM_COLOR }} />
            Mitad del público adentro
          </p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {mitad ? labelOf(mitad.slotIso) : "—"}
          </p>
          {mitad && (
            <p className="mt-2 font-sans text-xs text-[#999999]">
              {mitad.acumPct.toFixed(1)}% acumulado al cierre del slot
            </p>
          )}
        </div>
      </div>

      {serie.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          Sin ingresos para el filtro seleccionado.
        </p>
      ) : (
        <div className="border border-[#E5E5E5] bg-white rounded-lg p-3">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={serie} margin={{ top: 24, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="slotIso"
                tickFormatter={tickLabel}
                axisLine={{ stroke: SURFACE.divider }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
                tick={axisTick}
              />
              <YAxis
                yAxisId="personas"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtNum}
                tick={axisTick}
                width={48}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${Math.round(v)}%`}
                tick={axisTick}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: SURFACE.divider, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  const iso = typeof label === "string" ? label : String(label ?? "");
                  const row = payload?.[0]?.payload as SerieRow | undefined;
                  const head = iso
                    ? `${multiDay && row ? fechaCorta(row.fecha) + " · " : ""}${slotRange(iso)}${
                        peak && iso === peak.slotIso ? " · Peak" : ""
                      }`
                    : undefined;
                  return (
                    <ChartTooltip
                      active={active}
                      label={head}
                      items={(payload ?? []).map((p) => {
                        const key = String(p.dataKey ?? "");
                        const num = Number(p.value);
                        return key === "personas"
                          ? { name: "Ingresos", color: LLEGADAS_COLOR, formatted: fmtNum(num) }
                          : { name: "Acumulado", color: ACUM_COLOR, formatted: `${num.toFixed(1)}%` };
                      })}
                    />
                  );
                }}
              />
              <Legend {...legendProps} verticalAlign="top" height={28} />
              <Area
                yAxisId="personas"
                type="monotone"
                dataKey="personas"
                name="Ingresos por slot"
                fill={seriesFillSoft(LLEGADAS_COLOR, 0.15)}
                stroke={LLEGADAS_COLOR}
                strokeWidth={2}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="acumPct"
                name="% acumulado"
                stroke={ACUM_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              {peak && (
                <>
                  <ReferenceLine
                    yAxisId="personas"
                    x={peak.slotIso}
                    stroke={PEAK_COLOR}
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  <ReferenceDot
                    yAxisId="personas"
                    x={peak.slotIso}
                    y={peak.personas}
                    r={5}
                    fill={PEAK_COLOR}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    label={{
                      value: `Peak ${labelOf(peak.slotIso)} · ${fmtNum(peak.personas)}`,
                      position: "top",
                      fill: INK.primary,
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
