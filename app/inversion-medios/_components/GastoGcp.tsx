"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GcpSemanaRow } from "@/lib/queries/inversion-medios";
import { axisTick, INK, seriesColor } from "@/lib/chart-colors";
import { fmtDiaCorto, fmtUsd } from "./format";

// Servicios con banda propia; el resto se suma en "Otros" para que la leyenda
// no crezca cada vez que se prende un servicio nuevo con centavos de gasto.
const MAX_SERVICIOS = 5;
const OTROS = "Otros";

type Semana = {
  semana: string;
  label: string;
  total: number;
  totalClp: number | null;
  parcial: boolean;
  hasta: string;
  [servicio: string]: number | string | boolean | null;
};

/** '2026-10-05' + 6 días → '2026-10-11' (domingo de esa semana). */
function finSemana(lunes: string): string {
  const d = new Date(`${lunes}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function buildSemanas(rows: GcpSemanaRow[]): { semanas: Semana[]; series: string[] } {
  const totalPorServicio = new Map<string, number>();
  for (const r of rows) totalPorServicio.set(r.servicio, (totalPorServicio.get(r.servicio) ?? 0) + r.costoUsd);
  const ranking = [...totalPorServicio.entries()].sort((a, b) => b[1] - a[1]).map(([sv]) => sv);
  const top = ranking.length > MAX_SERVICIOS + 1 ? ranking.slice(0, MAX_SERVICIOS) : ranking;
  const topSet = new Set(top);
  const series = ranking.length > top.length ? [...top, OTROS] : top;

  // El export llega con ~1-2 días de latencia: una semana es parcial si el último
  // día con dato (de toda la serie) cae antes de su domingo.
  const maxFecha = rows.reduce((m, r) => (r.maxFecha > m ? r.maxFecha : m), "");

  const porSemana = new Map<string, Semana>();
  for (const r of rows) {
    let w = porSemana.get(r.semana);
    if (!w) {
      const fin = finSemana(r.semana);
      w = {
        semana: r.semana,
        label: fmtDiaCorto(r.semana),
        total: 0,
        totalClp: 0,
        parcial: maxFecha < fin,
        hasta: maxFecha < fin ? maxFecha : fin,
      };
      for (const sv of series) w[sv] = 0;
      porSemana.set(r.semana, w);
    }
    const key = topSet.has(r.servicio) ? r.servicio : OTROS;
    w[key] = (w[key] as number) + r.costoUsd;
    w.total += r.costoUsd;
    w.totalClp = w.totalClp == null || r.costoClp == null ? null : w.totalClp + r.costoClp;
  }
  const semanas = [...porSemana.values()].sort((a, b) => a.semana.localeCompare(b.semana));
  return { semanas, series };
}

function colorServicio(series: string[], sv: string): string {
  return sv === OTROS ? INK.subtle : seriesColor(series.indexOf(sv));
}

function GcpTooltip({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | string; payload?: Semana }[];
  series: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const w = payload[0]?.payload;
  if (!w) return null;
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 font-sans text-sm text-[var(--ink)] shadow-md">
      <p className="text-xs text-[var(--ink-muted)]">
        Semana del {fmtDiaCorto(w.semana)} al {fmtDiaCorto(finSemana(w.semana))}
        {w.parcial && <> · parcial, datos hasta el {fmtDiaCorto(w.hasta)}</>}
      </p>
      {[...payload].reverse().map((p) =>
        Number(p.value) > 0 ? (
          <p key={String(p.dataKey)} className="mt-1 flex items-center gap-1.5 tabular-nums">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: colorServicio(series, String(p.dataKey)) }}
            />
            {String(p.dataKey)}
            <span className="ml-auto pl-3 font-medium">{fmtUsd(Number(p.value) || 0)}</span>
          </p>
        ) : null,
      )}
      <p className="mt-1.5 border-t border-[var(--grid)] pt-1 text-xs text-[var(--ink-muted)]">
        Total <span className="font-medium text-[var(--ink)]">{fmtUsd(w.total)}</span>
        {w.totalClp != null && (
          <> · CLP {w.totalClp.toLocaleString("es-CL", { maximumFractionDigits: 0 })}</>
        )}
      </p>
    </div>
  );
}

function Kpi({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
      <p className="font-sans text-xs text-[var(--ink-muted)]">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none text-[var(--ink)]">{value}</p>
      <p className="mt-3 font-sans text-xs text-[var(--ink-subtle)]">{caption}</p>
    </div>
  );
}

/**
 * Gasto semanal de Google Cloud (infra de datos), apilado por servicio. Sale del
 * export nativo de Cloud Billing vía `marts.gcp_gasto_diario`. `rows === null`
 * = la vista no se pudo leer; `[]` = el export todavía no trae datos.
 */
export default function GastoGcp({ rows }: { rows: GcpSemanaRow[] | null }) {
  const { semanas, series } = useMemo(() => buildSemanas(rows ?? []), [rows]);

  const completas = semanas.filter((w) => !w.parcial);
  const ultima = completas.at(-1);
  const ult4 = completas.slice(-4);
  const prom4 = ult4.length ? ult4.reduce((a, w) => a + w.total, 0) / ult4.length : 0;
  const enCurso = semanas.at(-1)?.parcial ? semanas.at(-1) : undefined;

  const header = (
    <div>
      <h2 className="font-display text-lg font-bold text-[var(--ink)]">Google Cloud (GCP)</h2>
      <p className="max-w-3xl font-sans text-xs text-[var(--ink-muted)]">
        Gasto semanal de la infraestructura de datos (Cloud Run, BigQuery, etc.), neto de créditos y
        en USD. Sale del export de facturación de Google Cloud, no de la tarjeta Cardda.
      </p>
    </div>
  );

  if (rows === null || semanas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 text-center font-sans text-sm text-[var(--ink-subtle)]">
          {rows === null
            ? "No se pudo leer el gasto de Google Cloud."
            : "Sin datos todavía: el export de facturación se activó el 10 oct y carga desde el 1 sep."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Kpi
          label={ultima ? `Semana del ${fmtDiaCorto(ultima.semana)}` : "Última semana completa"}
          value={ultima ? fmtUsd(ultima.total) : "—"}
          caption="última semana completa"
        />
        <Kpi
          label="Promedio semanal"
          value={ult4.length ? fmtUsd(prom4) : "—"}
          caption={`últimas ${ult4.length} semanas completas`}
        />
        <Kpi
          label="Semana en curso"
          value={enCurso ? fmtUsd(enCurso.total) : "—"}
          caption={enCurso ? `parcial, datos hasta el ${fmtDiaCorto(enCurso.hasta)}` : "sin semana parcial"}
        />
      </div>

      <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-sans text-sm text-[var(--ink)]">Gasto semanal apilado por servicio</p>
          <div className="flex flex-wrap items-center gap-3 font-sans text-xs text-[var(--ink-muted)]">
            {series.map((sv) => (
              <span key={sv} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorServicio(series, sv) }} />
                {sv}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={semanas} barCategoryGap="30%" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--divider)" }}
                tick={axisTick}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v: number) => `$${Math.round(v)}`}
                width={48}
              />
              <ChartTooltip
                content={<GcpTooltip series={series} />}
                cursor={{ fill: "var(--surface-alt)" }}
              />
              {series.map((sv, i) => (
                <Bar
                  key={sv}
                  dataKey={sv}
                  stackId="total"
                  fill={colorServicio(series, sv)}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="font-sans text-xs text-[var(--ink-subtle)]">
        Semanas de lunes a domingo. La última suele ser parcial porque el export llega con 1 a 2 días
        de atraso. Incluye todos los proyectos de la cuenta de facturación. El cargo mensual de GCP a
        la tarjeta también aparece en &ldquo;Otras&rdquo; de la facturación Cardda.
      </p>
    </div>
  );
}
