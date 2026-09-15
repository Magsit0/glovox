"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LaCavaDiaRow } from "@/lib/queries/lacava";
import {
  LACAVA,
  lacavaAxisTick,
  lacavaGridProps,
} from "./theme";

type Metric = "personas" | "venta";

type Props = {
  data: LaCavaDiaRow[];
  /** Meta de personas del evento (línea de referencia, solo métrica personas). */
  goalTickets?: number;
  /** YYYY-MM-DD del evento: si es futuro, el eje se extiende hasta esa fecha. */
  fechaEvento?: string;
};

type ChartRow = {
  fecha: string;
  diario: number | null;
  acumulado: number | null;
};

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const fechaCorta = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  // Fechas YYYY-MM-DD parseadas como UTC: formatear en UTC evita el
  // corrimiento de un día en zonas horarias negativas (Chile).
  timeZone: "UTC",
});

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return fechaCorta.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Evolución de venta del evento seleccionado: barras con la venta de cada día
 * y línea con el acumulado, igual que el gráfico de /marketing/weekly. Toggle
 * Personas / Recaudación sin volver al servidor (los dos vienen en `data`).
 */
export default function VentaDiariaChart({ data, goalTickets, fechaEvento }: Props) {
  const [metric, setMetric] = useState<Metric>("personas");

  const chartData: ChartRow[] = useMemo(() => {
    const rows: ChartRow[] = data.map((r) => ({
      fecha: r.fecha,
      diario: metric === "personas" ? r.personas : r.venta,
      acumulado: metric === "personas" ? r.personasAcum : r.ventaAcum,
    }));

    // Evento futuro: se extiende el eje hasta la fecha del evento con días
    // vacíos, para que se lea cuánto camino queda.
    if (!fechaEvento || rows.length === 0) return rows;
    const last = rows[rows.length - 1].fecha;
    if (last >= fechaEvento) return rows;
    const cursor = new Date(`${last}T00:00:00Z`);
    const end = new Date(`${fechaEvento}T00:00:00Z`);
    while (cursor < end) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      rows.push({
        fecha: cursor.toISOString().slice(0, 10),
        diario: null,
        acumulado: null,
      });
    }
    return rows;
  }, [data, metric, fechaEvento]);

  const fmtValor = (v: number) =>
    metric === "venta" ? `$${entero.format(Math.round(v))}` : entero.format(Math.round(v));
  const fmtEje = (v: number) =>
    metric === "venta" ? `$${compacto.format(v)}` : compacto.format(v);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
          Sin ventas registradas para esta edición.
        </p>
      </div>
    );
  }

  const mostrarMeta = metric === "personas" && (goalTickets ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <MetricToggle metric={metric} onChange={setMetric} />
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid {...lacavaGridProps} />
          <XAxis
            dataKey="fecha"
            tickLine={false}
            axisLine={{ stroke: LACAVA.borde }}
            tick={lacavaAxisTick}
            tickFormatter={fmtFecha}
            minTickGap={28}
          />
          <YAxis
            yAxisId="acumulado"
            orientation="left"
            tickLine={false}
            axisLine={false}
            tick={lacavaAxisTick}
            tickFormatter={fmtEje}
            width={64}
          />
          <YAxis
            yAxisId="diario"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={lacavaAxisTick}
            tickFormatter={fmtEje}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: LACAVA.borde }}
            content={<DiarioTooltip fmtValor={fmtValor} />}
          />
          <Bar
            yAxisId="diario"
            dataKey="diario"
            name={metric === "personas" ? "Personas / día" : "Venta / día"}
            fill={LACAVA.dorado}
            radius={[4, 4, 0, 0]}
            barSize={8}
          />
          <Line
            yAxisId="acumulado"
            type="monotone"
            dataKey="acumulado"
            name="Acumulado"
            stroke={LACAVA.verdeMedio}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
          {mostrarMeta && (
            <ReferenceLine
              yAxisId="acumulado"
              y={goalTickets}
              stroke={LACAVA.burdeos}
              strokeDasharray="6 4"
              label={{
                value: `Meta ${entero.format(goalTickets ?? 0)}`,
                position: "insideTopRight",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fill: LACAVA.burdeos,
              }}
            />
          )}
          {fechaEvento && chartData.some((r) => r.fecha === fechaEvento) && (
            <ReferenceLine
              yAxisId="acumulado"
              x={fechaEvento}
              stroke={LACAVA.tintaSutil}
              strokeDasharray="4 4"
              label={{
                value: "Evento",
                position: "insideTopLeft",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fill: LACAVA.tintaSutil,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-4">
        <LegendDot color={LACAVA.dorado} label={metric === "personas" ? "Personas por día (eje derecho)" : "Venta por día (eje derecho)"} />
        <LegendDot color={LACAVA.verdeMedio} label="Acumulado (eje izquierdo)" />
        {mostrarMeta && <LegendDot color={LACAVA.burdeos} label="Meta del evento" />}
      </div>
    </div>
  );
}

export function MetricToggle({
  metric,
  onChange,
}: {
  metric: Metric;
  onChange: (m: Metric) => void;
}) {
  const options: { key: Metric; label: string }[] = [
    { key: "personas", label: "Personas" },
    { key: "venta", label: "Recaudación" },
  ];
  return (
    <div
      className="flex items-center gap-1 rounded-lg border bg-white p-1"
      style={{ borderColor: LACAVA.borde }}
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className="rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors"
          style={
            metric === o.key
              ? { backgroundColor: LACAVA.verde, color: LACAVA.marfil }
              : { color: LACAVA.tintaSuave }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

type TooltipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  stroke?: string;
  fill?: string;
};

function DiarioTooltip({
  active,
  label,
  payload,
  fmtValor,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
  fmtValor: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  if (rows.length === 0) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{ backgroundColor: LACAVA.cremaClara, borderColor: LACAVA.borde }}
    >
      <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
        {label ? fmtFecha(label) : ""}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={String(r.name)}
            className="flex items-center justify-between gap-4 font-sans text-sm"
            style={{ color: LACAVA.tinta }}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: r.stroke ?? r.fill ?? r.color }}
              />
              {String(r.name)}
            </span>
            <span className="tabular-nums">
              {fmtValor(typeof r.value === "number" ? r.value : Number(r.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
