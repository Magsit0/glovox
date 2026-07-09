"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { TrafficTimelineRow } from "@/lib/queries/marketing";

const AREA_COLORS = ["#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#00FF00", "#FF8000"];
const MAX_CANALES = 5; // los demás se agrupan en "Otros"

// Internal series key for the overflow bucket. Kept distinct from any real
// `canal` value so it can never collide with a channel literally named "Otros"
// (that would produce duplicate React keys and silently stack two series).
// The visible label is resolved via `canalLabel`.
const OTROS_KEY = "__otros__";
const canalLabel = (canal: string) => (canal === OTROS_KEY ? "Otros" : canal);

type Props = {
  data: TrafficTimelineRow[];
};

type Point = { date: string; ordenes: number } & Record<string, number | string>;

function buildSeries(data: TrafficTimelineRow[]): { points: Point[]; canales: string[] } {
  // Top N canales por sesiones totales; el resto colapsa en el bucket OTROS_KEY.
  const totales = new Map<string, number>();
  for (const r of data) totales.set(r.canal, (totales.get(r.canal) ?? 0) + r.sessions);
  const top = [...totales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CANALES)
    .map(([canal]) => canal);
  const canales = totales.size > top.length ? [...top, OTROS_KEY] : top;

  const porDia = new Map<string, Point>();
  for (const r of data) {
    if (!porDia.has(r.date)) {
      const base: Point = { date: r.date, ordenes: r.ordenes };
      for (const c of canales) base[c] = 0;
      porDia.set(r.date, base);
    }
    const punto = porDia.get(r.date)!;
    const key = top.includes(r.canal) ? r.canal : OTROS_KEY;
    punto[key] = (punto[key] as number) + r.sessions;
    // ordenes viene repetida por canal del mismo día; basta la primera
  }

  return { points: [...porDia.values()].sort((a, b) => (a.date < b.date ? -1 : 1)), canales };
}

export default function TrafficTimelineChart({ data }: Props) {
  const { points, canales } = useMemo(() => buildSeries(data), [data]);

  if (points.length === 0) return null;

  return (
    <div>
      <p className="font-mono-data uppercase text-xs mb-2 font-bold">
        Tráfico diario por canal vs órdenes de compra
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
            stroke="#000"
          />
          <YAxis
            yAxisId="sesiones"
            tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
            stroke="#000"
            label={{
              value: "Sesiones",
              angle: -90,
              position: "insideLeft",
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 10,
              fill: "#000",
            }}
          />
          <YAxis
            yAxisId="ordenes"
            orientation="right"
            tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
            stroke="#000"
            label={{
              value: "Órdenes",
              angle: 90,
              position: "insideRight",
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 10,
              fill: "#000",
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "4px solid #000",
              borderRadius: 0,
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 12,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [Number(value).toLocaleString("es-CL"), name]}
          />
          {/* Custom legend: recharts pulls the swatch color from Area.stroke,
              which is black here, so all swatches render identical. We paint
              our own swatches with each area's fill color instead — same
              order as the stack, plus the red Órdenes line at the end. */}
          <Legend
            wrapperStyle={{
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 10,
              textTransform: "uppercase",
            }}
            content={() => (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 font-mono-data uppercase text-xs">
                {canales.map((canal, i) => (
                  <div key={canal} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-3.5 h-3.5 border-2 border-black"
                      style={{
                        backgroundColor: AREA_COLORS[i % AREA_COLORS.length],
                      }}
                    />
                    <span>{canalLabel(canal)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block w-4 h-[3px] bg-[#FF0000]"
                  />
                  <span>Órdenes (tickets reales)</span>
                </div>
              </div>
            )}
          />
          {canales.map((canal, i) => (
            <Area
              key={canal}
              yAxisId="sesiones"
              type="monotone"
              dataKey={canal}
              name={canalLabel(canal)}
              stackId="trafico"
              fill={AREA_COLORS[i % AREA_COLORS.length]}
              stroke="#000"
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
          <Line
            yAxisId="ordenes"
            type="monotone"
            dataKey="ordenes"
            name="Órdenes (tickets reales)"
            stroke="#FF0000"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="font-mono-data text-xs text-black/50 mt-2">
        Cómo leer: las áreas apiladas son las sesiones de cada día por canal
        (eje izquierdo); la línea roja son las órdenes de compra reales de
        tickets (eje derecho). Si el tráfico sube y la línea no, ese empuje
        trajo visitas pero no ventas; si la línea sube sin tráfico, la venta
        ocurrió fuera del sitio medido (portal, día de estreno).
      </p>
    </div>
  );
}
