"use client";

import { Fragment } from "react";
import {
  CartesianGrid,
  ErrorBar,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, legendProps, seriesColor } from "@/lib/chart-colors";
import { formatNumber, formatCurrency, compactCurrency } from "@/lib/unabase/formatting";
import { proyectarDemanda, type ProyeccionMetodo } from "@/lib/ticketing/demanda-forecast";
import type { DemandaRow, DemandaGranularidad, DemandaMetrica } from "@/lib/queries/ticketing";

interface Props {
  rows: DemandaRow[];
  granularidad: DemandaGranularidad;
  metrica: DemandaMetrica;
  proyeccion: ProyeccionMetodo;
}

type Datum = Record<string, number | string | boolean | null>;

// Etiqueta corta para el eje X (semana/mes usan la fecha; evento/categoría el nombre).
function fmtAxisLabel(row: { periodo: string; label: string }, gran: DemandaGranularidad): string {
  if (gran === "EVENTO" || gran === "CATEGORIA") {
    const name = row.label || row.periodo;
    return name.length > 18 ? `${name.slice(0, 17)}…` : name;
  }
  const iso = row.label || row.periodo;
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (gran === "MONTH") return d.toLocaleDateString("es-CL", { month: "short", year: "numeric" });
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

// Header completo para el tooltip.
function fmtTooltipHeader(row: { periodo: string; label: string }, gran: DemandaGranularidad): string {
  if (gran === "EVENTO" || gran === "CATEGORIA") return row.label || row.periodo;
  const iso = row.label || row.periodo;
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (gran === "MONTH") return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return `Semana del ${d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}`;
}

// Etiqueta del punto proyectado: para semana/mes infiere el próximo periodo a
// partir de la fecha del último punto; para evento/categoría no hay fecha futura.
function nextPeriodLabels(
  rows: DemandaRow[],
  gran: DemandaGranularidad,
): { axis: string; sub: string } {
  if (gran === "EVENTO") return { axis: "Próx. evento", sub: "próximo evento (tendencia)" };
  if (gran === "CATEGORIA") return { axis: "Tendencia", sub: "extrapolación de la tendencia" };
  const lastIso = rows[rows.length - 1]?.periodo ?? "";
  const d = new Date(`${lastIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { axis: "Próx.", sub: "próximo periodo" };
  if (gran === "MONTH") {
    d.setMonth(d.getMonth() + 1);
    return {
      axis: d.toLocaleDateString("es-CL", { month: "short", year: "numeric" }),
      sub: d.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
    };
  }
  d.setDate(d.getDate() + 7);
  return {
    axis: d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }),
    sub: `semana del ${d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}`,
  };
}

const SERIES_TICKETS = [
  { key: "general" as const,    label: "General",             colorIdx: 0 },
  { key: "vip" as const,        label: "VIP",                 colorIdx: 1 },
  { key: "earlyEntry" as const, label: "Early entry / Happy", colorIdx: 2 },
  { key: "free" as const,       label: "Free / Cortesía",     colorIdx: 3 },
  { key: "upgrade" as const,    label: "Upgrade",             colorIdx: 4 },
];
const SERIES_VENTA = [
  { key: "generalVenta" as const,    label: "General",             colorIdx: 0 },
  { key: "vipVenta" as const,        label: "VIP",                 colorIdx: 1 },
  { key: "earlyEntryVenta" as const, label: "Early entry / Happy", colorIdx: 2 },
  { key: "freeVenta" as const,       label: "Free / Cortesía",     colorIdx: 3 },
  { key: "upgradeVenta" as const,    label: "Upgrade",             colorIdx: 4 },
];

function ChartTooltip({
  active,
  payload,
  granularidad,
  metrica,
}: {
  active?: boolean;
  payload?: { payload: Datum }[];
  granularidad: DemandaGranularidad;
  metrica: DemandaMetrica;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const series = metrica === "venta" ? SERIES_VENTA : SERIES_TICKETS;
  const fmt = metrica === "venta" ? formatCurrency : formatNumber;
  const totalKey = metrica === "venta" ? "totalVenta" : "total";
  const isProj = d.isProj === true;
  // En el punto proyectado los valores viven en las claves "*__p" (la línea punteada).
  const valOf = (k: string) => ((isProj ? d[`${k}__p`] : d[k]) as number) ?? 0;
  const loOf = (k: string) => (d[`${k}__lo`] as number) ?? 0;
  const hiOf = (k: string) => (d[`${k}__hi`] as number) ?? 0;
  const header = isProj
    ? `Proyección · ${(d.projSub as string) ?? ""}`
    : fmtTooltipHeader({ periodo: String(d.periodo ?? ""), label: String(d.label ?? "") }, granularidad);
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 font-sans text-sm text-[#333333] shadow-md">
      <p className="mb-1.5 text-xs font-medium text-[#666666]">
        {isProj && (
          <span className="mr-1.5 rounded-sm border border-dashed border-[#9F99F8] px-1 py-px text-[10px] uppercase tracking-wide text-[#9F99F8]">
            est.
          </span>
        )}
        {header}
      </p>
      {series.map(({ key, label, colorIdx }) => (
        <div key={key} className="flex items-center gap-2 text-xs text-[#333333]">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: seriesColor(colorIdx) }}
          />
          <span className="flex-1 text-[#666666]">{label}</span>
          <span className="text-right">
            <span className="tabular-nums font-medium">{fmt(valOf(key))}</span>
            {isProj && (
              <span className="ml-1 text-[10px] text-[#999999]">
                ({fmt(loOf(key))}–{fmt(hiOf(key))})
              </span>
            )}
          </span>
        </div>
      ))}
      <div className="mt-1.5 border-t border-[#E5E5E5] pt-1.5">
        <p className="flex items-center gap-2 text-xs text-[#333333]">
          <span className="flex-1 text-[#999999]">Total</span>
          <span className="text-right">
            <span className="tabular-nums font-medium">{fmt(d[totalKey] as number)}</span>
            {isProj && (
              <span className="ml-1 text-[10px] text-[#999999]">
                ({fmt(loOf(totalKey))}–{fmt(hiOf(totalKey))})
              </span>
            )}
          </span>
        </p>
      </div>
    </div>
  );
}

export default function DemandaLineChart({ rows, granularidad, metrica, proyeccion }: Props) {
  const series = metrica === "venta" ? SERIES_VENTA : SERIES_TICKETS;
  const proj = proyectarDemanda(rows, proyeccion);
  const labels = nextPeriodLabels(rows, granularidad);
  const totalKeyName = metrica === "venta" ? "totalVenta" : "total";
  const fmt = metrica === "venta" ? formatCurrency : formatNumber;
  const metodoLabel = proyeccion === "holt" ? "Holt" : "lineal";

  const data: Datum[] = rows.map((r, i) => {
    const datum: Datum = {
      axisLabel: fmtAxisLabel(r, granularidad),
      isProj: false,
      periodo: r.periodo,
      label: r.label,
      total: r.total,
      totalVenta: r.totalVenta,
    };
    for (const s of series) {
      datum[s.key] = r[s.key];
      // Ancla la línea punteada en el último punto real para que se conecte.
      if (proj && i === rows.length - 1) datum[`${s.key}__p`] = r[s.key];
    }
    return datum;
  });

  if (proj) {
    const projDatum: Datum = {
      axisLabel: labels.axis,
      isProj: true,
      projSub: labels.sub,
      periodo: "__proj__",
      label: "Proyección",
      total: proj.total.value,
      totalVenta: proj.totalVenta.value,
      total__lo: proj.total.low,
      total__hi: proj.total.high,
      totalVenta__lo: proj.totalVenta.low,
      totalVenta__hi: proj.totalVenta.high,
    };
    // Solo las claves "*__p" (línea punteada); la sólida no llega al punto proyectado.
    for (const s of series) {
      projDatum[`${s.key}__p`] = proj[s.key].value;
      projDatum[`${s.key}__err`] = proj[s.key].high - proj[s.key].value; // medio ancho (z·σ)
      projDatum[`${s.key}__lo`] = proj[s.key].low;
      projDatum[`${s.key}__hi`] = proj[s.key].high;
    }
    data.push(projDatum);
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 font-sans text-sm text-[#999999]">
        Sin tickets para los filtros seleccionados.
      </div>
    );
  }

  const yFmt = metrica === "venta"
    ? (v: number) => compactCurrency(v)
    : (v: number) => formatNumber(v);

  return (
    <div>
      {proj && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-dashed border-[#C7C3FB] bg-[#FAFAFE] px-4 py-2.5">
          <span className="font-sans text-xs font-semibold text-[#9F99F8]">
            Proyección {metodoLabel} · {labels.sub}
          </span>
          {series.map(({ key, label, colorIdx }) => (
            <span key={key} className="flex items-center gap-1.5 font-sans text-xs text-[#666666]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: seriesColor(colorIdx) }}
              />
              {label}:{" "}
              <span className="tabular-nums font-medium text-[#333333]">{fmt(proj[key].value)}</span>
              <span className="tabular-nums text-[#999999]">
                ({fmt(proj[key].low)}–{fmt(proj[key].high)})
              </span>
            </span>
          ))}
          <span className="font-sans text-xs text-[#666666]">
            Total:{" "}
            <span className="tabular-nums font-medium text-[#333333]">{fmt(proj[totalKeyName].value)}</span>{" "}
            <span className="tabular-nums text-[#999999]">
              ({fmt(proj[totalKeyName].low)}–{fmt(proj[totalKeyName].high)})
            </span>
          </span>
        </div>
      )}

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
            <CartesianGrid {...gridProps} />
            {proj && data.length >= 2 && (
              <ReferenceArea
                x1={data[data.length - 2].axisLabel as string}
                x2={data[data.length - 1].axisLabel as string}
                fill="#9F99F8"
                fillOpacity={0.06}
                ifOverflow="extendDomain"
              />
            )}
            <XAxis
              dataKey="axisLabel"
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              tick={axisTick}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickFormatter={yFmt}
              width={metrica === "venta" ? 72 : 48}
            />
            <Tooltip
              content={<ChartTooltip granularidad={granularidad} metrica={metrica} />}
              cursor={{ stroke: "#E5E5E5", strokeWidth: 1 }}
            />
            <Legend {...legendProps} />
            {series.map(({ key, label, colorIdx }) => (
              <Fragment key={key}>
                <Line
                  name={label}
                  type="monotone"
                  dataKey={key}
                  stroke={seriesColor(colorIdx)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                  animationDuration={400}
                  animationEasing="ease-out"
                />
                {proj && (
                  <Line
                    name={label}
                    legendType="none"
                    type="monotone"
                    dataKey={`${key}__p`}
                    stroke={seriesColor(colorIdx)}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls={false}
                    animationDuration={400}
                    animationEasing="ease-out"
                  >
                    <ErrorBar
                      dataKey={`${key}__err`}
                      width={4}
                      strokeWidth={1.5}
                      stroke={seriesColor(colorIdx)}
                    />
                  </Line>
                )}
              </Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
