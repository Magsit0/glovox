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
import type { Proyeccion } from "@/lib/lacava/proyeccion";
import { LACAVA, lacavaAxisTick, lacavaGridProps } from "./theme";

type ProyeccionOk = Extract<Proyeccion, { disponible: true }>;

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const compacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const clpCompacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const fechaCorta = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const unDecimal = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return fechaCorta.format(new Date(Date.UTC(y, m - 1, d)));
}

const ESCENARIO_COLORS: Record<string, string> = {
  pesimista: LACAVA.tintaSutil,
  realista: LACAVA.burdeos,
  optimista: LACAVA.dorado,
};

/**
 * Fan chart de la proyección: acumulado real hasta hoy, banda
 * pesimista–optimista y línea realista hasta el día del evento, más los
 * finales por escenario y el estado del tracking. La matemática vive en
 * lib/lacava/proyeccion.ts; acá solo se presenta.
 */
export default function ProyeccionCard({
  proyeccion,
  goalTickets,
  anchorNombre,
}: {
  proyeccion: ProyeccionOk;
  goalTickets?: number;
  anchorNombre: string;
}) {
  const { escenarios, puntos, tracking } = proyeccion;
  const hoy = puntos.find((p) => p.dias === proyeccion.diasRestantes);

  return (
    <div className="flex flex-col gap-6">
      {/* Finales por escenario */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {escenarios.map((e) => {
          const destacado = e.key === "realista";
          return (
            <article
              key={e.key}
              className="rounded-lg border p-4"
              style={{
                borderColor: destacado ? LACAVA.verdeMedio : LACAVA.borde,
                backgroundColor: destacado ? LACAVA.cremaClara : undefined,
              }}
            >
              <p className="flex items-center gap-1.5 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ESCENARIO_COLORS[e.key] }}
                />
                {e.label}
              </p>
              <p
                className="mt-2 font-lacava text-3xl font-bold leading-none"
                style={{ color: LACAVA.verde }}
              >
                {entero.format(e.finalPersonas)}
              </p>
              <p className="mt-2 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
                {e.pctMeta != null && `${e.pctMeta}% de la meta · `}≈ $
                {clpCompacto.format(e.finalVenta)} venta neta
              </p>
              <p className="mt-1 font-sans text-xs" style={{ color: LACAVA.tintaSutil }}>
                +{entero.format(e.colaPersonas)} personas por vender
              </p>
            </article>
          );
        })}
      </div>

      {/* Fan chart */}
      <ResponsiveContainer width="100%" height={360}>
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
          <Tooltip cursor={{ stroke: LACAVA.borde }} content={<FanTooltip />} />
          <Area
            dataKey="banda"
            name="Banda pesimista–optimista"
            stroke="none"
            fill={LACAVA.dorado}
            fillOpacity={0.18}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="realista"
            name="Realista"
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
          {goalTickets != null && goalTickets > 0 && (
            <ReferenceLine
              y={goalTickets}
              stroke={LACAVA.tintaSutil}
              strokeDasharray="6 4"
              label={{
                value: `Meta ${entero.format(goalTickets)}`,
                position: "insideTopLeft",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fill: LACAVA.tintaSutil,
              }}
            />
          )}
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
        <LegendDot color={LACAVA.burdeos} label="Proyección realista" />
        <LegendDot color={LACAVA.dorado} label="Banda pesimista–optimista" soft />
      </div>

      {/* Tracking + supuestos */}
      <div
        className="flex flex-col gap-2 rounded-lg border p-4"
        style={{ borderColor: LACAVA.borde, backgroundColor: LACAVA.crema }}
      >
        <p className="font-sans text-sm" style={{ color: LACAVA.tinta }}>
          {tracking.esperado === 0 ? (
            <>
              <span className="font-medium">Ritmo reciente:</span> aún sin
              recalibración — a esta distancia del evento casi ningún comparable
              tenía la venta abierta, así que no hay expectativa histórica contra la
              cual medir el ritmo. Desde ~3 semanas antes del evento el ajuste se
              activa y los escenarios se corrigen a diario.
            </>
          ) : tracking.confianza < 0.25 ? (
            <>
              <span className="font-medium">Ritmo reciente:</span> señal todavía
              débil ({entero.format(tracking.observado)} personas en{" "}
              {tracking.ventanaDias} días vs {entero.format(tracking.esperado)}{" "}
              esperadas): el ajuste aplicado es leve (×
              {unDecimal.format(tracking.factorAplicado)}).
            </>
          ) : (
            <>
              <span className="font-medium">Ritmo últimos {tracking.ventanaDias} días:</span>{" "}
              {entero.format(tracking.observado)} personas vs{" "}
              {entero.format(tracking.esperado)} esperadas por el realista → factor ×
              {unDecimal.format(tracking.factorAplicado)} aplicado a los tres
              escenarios.
            </>
          )}
        </p>
        <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
          Modelo &quot;base + cola&quot;: lo ya vendido ({entero.format(proyeccion.base)}{" "}
          personas) es dato; los {proyeccion.diasRestantes} días restantes siguen la
          curva mediana de {proyeccion.comparables} ferias comparables (Bocas Moradas y
          La Cava), escalada por la última edición cerrada ({anchorNombre},{" "}
          {entero.format(proyeccion.anchorTotal)} personas) × jornadas nuevas (
          {unDecimal.format(proyeccion.factorJornadas)}) × factor de escenario. La
          recaudación proyecta la cola al ticket promedio reciente (
          {clp.format(proyeccion.ticketPromedioCola)}); si sube el tramo de preventa,
          quedará corta. Bandas calibradas por backtest — ver
          scripts/lacava-backtest-proyeccion.ts.
        </p>
      </div>
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

function FanTooltip({
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
  const realista = get("realista");
  const banda = get("banda");

  const rows: { label: string; color: string; text: string }[] = [];
  if (typeof real === "number")
    rows.push({ label: "Venta real", color: LACAVA.verdeMedio, text: entero.format(real) });
  if (typeof realista === "number")
    rows.push({ label: "Realista", color: LACAVA.burdeos, text: entero.format(realista) });
  if (Array.isArray(banda) && banda[0] !== banda[1])
    rows.push({
      label: "Banda",
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
