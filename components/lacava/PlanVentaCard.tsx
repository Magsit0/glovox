"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoTrayectoria } from "@/lib/lacava/proyeccion";
import { LACAVA, lacavaAxisTick, lacavaGridProps } from "./theme";

/**
 * Un compromiso comercial de la edición (mínimo / objetivo / meta). Son metas
 * DECLARADAS por el negocio, no salidas de un modelo — la card los presenta
 * como tales, con el avance real y el ritmo diario requerido contra cada uno.
 */
export type PlanTarget = {
  key: string;
  label: string;
  valor: number;
  color: string;
};

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const fechaCorta = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return fechaCorta.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Plan de venta contra compromisos comerciales: abanico desde la venta real
 * de hoy hacia cada compromiso (banda mínimo–meta, línea central al
 * objetivo), donde cada trayectoria sigue la forma histórica de compra de las
 * ferias comparables. Las trayectorias las calcula
 * `buildPlanTrayectorias` (lib/lacava/proyeccion.ts); acá solo se presentan.
 */
export default function PlanVentaCard({
  puntos,
  base,
  diasRestantes,
  targets,
}: {
  puntos: PuntoTrayectoria[];
  base: number;
  diasRestantes: number;
  targets: PlanTarget[];
}) {
  if (puntos.length === 0) {
    return (
      <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
        Sin ventas registradas para esta edición.
      </p>
    );
  }

  const hoy = puntos.find((p) => p.dias === diasRestantes);

  return (
    <div className="flex flex-col gap-6">
      {/* Compromisos y avance */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {targets.map((t) => {
          const avance = t.valor > 0 ? Math.min(100, Math.round((base / t.valor) * 100)) : 0;
          const faltan = Math.max(0, t.valor - base);
          const ritmo = diasRestantes > 0 ? Math.ceil(faltan / diasRestantes) : faltan;
          return (
            <article
              key={t.key}
              className="rounded-lg border p-4"
              style={{ borderColor: LACAVA.borde }}
            >
              <p className="flex items-center gap-1.5 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.label}
              </p>
              <p
                className="mt-2 font-lacava text-3xl font-bold leading-none"
                style={{ color: LACAVA.verde }}
              >
                {entero.format(t.valor)}
              </p>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: LACAVA.grid }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${avance}%`, backgroundColor: t.color }}
                />
              </div>
              <p className="mt-2 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
                {avance}% de avance
                {faltan > 0
                  ? ` · faltan ${entero.format(faltan)} (${entero.format(ritmo)}/día)`
                  : " · cumplido"}
              </p>
            </article>
          );
        })}
      </div>

      {/* Abanico hacia los compromisos */}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={puntos} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
            tickLine={false}
            axisLine={false}
            tick={lacavaAxisTick}
            tickFormatter={(v: number) => compacto.format(v)}
            width={56}
          />
          <Tooltip cursor={{ stroke: LACAVA.borde }} content={<PlanTooltip />} />
          <Area
            dataKey="banda"
            name="Banda mínimo–meta"
            stroke="none"
            fill={LACAVA.dorado}
            fillOpacity={0.18}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="objetivo"
            name="Trayectoria al objetivo"
            stroke={LACAVA.burdeos}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="realAcum"
            name="Venta real"
            stroke={LACAVA.verdeMedio}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          {targets.map((t) => (
            <ReferenceLine
              key={t.key}
              y={t.valor}
              stroke={t.color}
              strokeOpacity={0.55}
              strokeDasharray="2 5"
              label={{
                value: `${t.label} ${entero.format(t.valor)}`,
                position: "insideTopLeft",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fill: t.color,
              }}
            />
          ))}
          {hoy && (
            <ReferenceLine
              x={hoy.fecha}
              stroke={LACAVA.tintaSutil}
              strokeDasharray="4 4"
              label={{
                value: "hoy",
                position: "insideTopRight",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fill: LACAVA.tintaSutil,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-4">
        <LegendDot color={LACAVA.verdeMedio} label="Venta real acumulada" />
        <LegendDot color={LACAVA.burdeos} label="Trayectoria al objetivo" />
        <LegendDot color={LACAVA.dorado} label="Banda mínimo–meta" soft />
      </div>

      <p className="font-sans text-xs" style={{ color: LACAVA.tintaSutil }}>
        Las trayectorias reparten lo que falta para cada compromiso según la
        estacionalidad histórica de compra de las ferias Glovox (la venta se
        concentra en las últimas semanas): son el camino a la meta, no una
        predicción.
      </p>
    </div>
  );
}

function LegendDot({
  color,
  label,
  soft = false,
}: {
  color: string;
  label: string;
  soft?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color, opacity: soft ? 0.35 : 1 }}
      />
      {label}
    </span>
  );
}

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string | [number, number];
};

function PlanTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  const real = get("realAcum");
  const objetivo = get("objetivo");
  const banda = get("banda");

  const rows: { label: string; color: string; text: string }[] = [];
  if (typeof real === "number")
    rows.push({ label: "Venta real", color: LACAVA.verdeMedio, text: entero.format(real) });
  if (typeof objetivo === "number")
    rows.push({ label: "Camino al objetivo", color: LACAVA.burdeos, text: entero.format(objetivo) });
  if (Array.isArray(banda) && banda[0] !== banda[1])
    rows.push({
      label: "Mínimo – meta",
      color: LACAVA.dorado,
      text: `${entero.format(banda[0])} – ${entero.format(banda[1])}`,
    });
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
            key={r.label}
            className="flex items-center justify-between gap-4 font-sans text-sm"
            style={{ color: LACAVA.tinta }}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.color }} />
              {r.label}
            </span>
            <span className="tabular-nums">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
