"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  CANAL_SIN_ORIGEN,
  SERIE_OTROS,
  TOP_CANALES_DIA,
  agruparPorDiaCanal,
  diaProvisional,
  type OrdenCanalDiaRow,
  type PuntoCanalDia,
  type SerieCanalDia,
} from "@/lib/marketing/atribucion";
import { fmtFechaCorta } from "@/lib/marketing/formato";
import { BloqueTitulo, Nota, TICK_STYLE, TOOLTIP_STYLE, fmtNum, plural } from "./ui";

type Props = {
  rows: OrdenCanalDiaRow[];
  desde: string;
  hasta: string;
  etlHasta: string | null; // el último día cargado (y los siguientes) es provisional
};

// Opacidad de las barras de un día provisional: la misma lectura "tenue" de SaludMedicion.
const OPACIDAD_PROVISIONAL = 0.35;

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block w-3.5 h-3.5 border-2 border-black shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function TooltipDia({
  active,
  payload,
  series,
  etlHasta,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  series: SerieCanalDia[];
  etlHasta: string | null;
}) {
  const punto = payload?.[0]?.payload as PuntoCanalDia | undefined;
  if (!active || !punto) return null;
  // De arriba hacia abajo, como se apilan las barras.
  const filas = [...series].reverse().filter((s) => Number(punto[s.key]) > 0);
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontWeight: 700 }}>
        {fmtFechaCorta(punto.date)} · {plural(punto.total, "orden", "órdenes")}
      </div>
      {filas.length === 0 ? (
        <div>Sin órdenes web</div>
      ) : (
        filas.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Swatch color={s.color} />
            <span>
              {s.label}: {fmtNum(Number(punto[s.key]))}
            </span>
          </div>
        ))
      )}
      {diaProvisional(punto.date, etlHasta) && (
        <div style={{ opacity: 0.6 }}>Dato provisional: GA4 puede seguir procesando este día.</div>
      )}
    </div>
  );
}

/**
 * "Compras por día y canal": barras apiladas de las órdenes web medidas por día
 * (DATE(FechaOrden), como el resto de la página) y canal real. Top 5 canales,
 * «Otros canales» y «Sin origen conocido». Cada canal tiene color fijo
 * (COLOR_CANAL), así conserva su color entre eventos.
 */
export default function ComprasDiaCanalChart({ rows, desde, hasta, etlHasta }: Props) {
  const { series, puntos } = useMemo(() => agruparPorDiaCanal(rows, { desde, hasta }), [rows, desde, hasta]);
  const total = series.reduce((s, x) => s + x.total, 0);

  return (
    <div className="min-w-0">
      <BloqueTitulo sub={`Órdenes web medidas por día y canal real · ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)}`}>
        Compras por día y canal
      </BloqueTitulo>

      {total === 0 ? (
        <p className="font-mono-data text-sm text-black/60">Sin órdenes web en la ventana medida.</p>
      ) : (
        <figure>
          <figcaption className="sr-only">
            Órdenes web por día y canal: {plural(total, "orden", "órdenes")} en {plural(puntos.length, "día", "días")}.{" "}
            {series.map((s) => `${s.label} ${fmtNum(s.total)}`).join(", ")}.
          </figcaption>
          <div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="15%">
                <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => fmtFechaCorta(d)}
                  tick={TICK_STYLE}
                  stroke="#000"
                  minTickGap={8}
                />
                <YAxis
                  allowDecimals={false}
                  tick={TICK_STYLE}
                  stroke="#000"
                  width={44}
                  label={{
                    value: "Órdenes web",
                    angle: -90,
                    position: "insideLeft",
                    ...TICK_STYLE,
                  }}
                />
                <Tooltip
                  content={<TooltipDia series={series} etlHasta={etlHasta} />}
                  cursor={{ fill: "#000", fillOpacity: 0.06 }}
                />
                {series.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="dia"
                    fill={s.color}
                    stroke="#000"
                    strokeWidth={1}
                    maxBarSize={48}
                    isAnimationActive={false}
                  >
                    {puntos.map((p) => (
                      <Cell
                        key={p.date}
                        fillOpacity={diaProvisional(p.date, etlHasta) ? OPACIDAD_PROVISIONAL : 1}
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Leyenda propia: recharts toma el color del stroke (negro en todas). */}
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 font-mono-data uppercase text-xs">
            {series.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-1.5"
                title={s.key === SERIE_OTROS ? `Incluye: ${s.canales.join(", ")}` : undefined}
              >
                <Swatch color={s.color} />
                <span>
                  {s.label} <span className="text-black/60 tabular-nums">{fmtNum(s.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </figure>
      )}

      <Nota>
        Cómo leer: cada barra es un día de la ventana medida y cada orden va a su canal real, el mismo de «Origen
        real de la venta». Se muestran los {TOP_CANALES_DIA} canales con más órdenes; el resto se suma en «Otros
        canales». «{CANAL_SIN_ORIGEN}» = órdenes que GA4 no registró y que no traen Referido en el link. El último día
        cargado es provisional (barra tenue).
      </Nota>
    </div>
  );
}
