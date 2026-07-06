"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerCapitaSerie } from "@/lib/queries/grid-kiki";
import {
  axisTick,
  fmtNum,
  gridProps,
  GlovoxTooltip,
  MetricToggle,
  rangoDe,
} from "./chart-utils";

const COLORS = ["#9F99F8", "#B1D750", "#ED75A0"];

const SLOT_MIN_START = 19 * 60;      // 19:00 del día del evento
const SLOT_MIN_END   = 24 * 60 + 5.5 * 60; // 05:30 del día siguiente

function slotLabelDe(min: number): string {
  const m = min % 1440;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String((m % 60)).padStart(2, "0")}`;
}

export default function PerCapitaChart({ series }: { series: PerCapitaSerie[] }) {
  const [metric, setMetric] = useState<"venta" | "qtty">("qtty");

  const chartData = useMemo(() => {
    const slots: number[] = [];
    for (let m = SLOT_MIN_START; m <= SLOT_MIN_END; m += 30) slots.push(m);

    return slots.map((slotMin) => {
      const point: Record<string, number | string | undefined> = {
        // Label = hora de FIN del bloque, consistente con los demás gráficos
        slotLabel: slotLabelDe(slotMin + 30),
      };
      for (const serie of series) {
        if (serie.asistentes === 0 || serie.rows.length === 0) continue;
        const first = serie.rows[0].slotMin;
        const last = serie.rows[serie.rows.length - 1].slotMin;
        if (slotMin < first || slotMin > last) continue; // antes de abrir / después de cerrar
        const row = serie.rows.find((r) => r.slotMin === slotMin);
        const venta = row?.venta ?? 0;
        const qtty = row?.qtty ?? 0;
        point[serie.eventoId] =
          metric === "venta"
            ? venta / serie.asistentes
            : (qtty / serie.asistentes) * 1000;
      }
      return point;
    });
  }, [series, metric]);

  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#333333]">
            Consumo Johnnie Walker per cápita por evento
          </h3>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Normalizado por asistentes de cada evento (productos Johnnie Walker
            en barra). La banda marca la ventana de la promo, que solo existió
            en KI/KI.
          </p>
        </div>
        <MetricToggle
          metric={metric}
          onChange={setMetric}
          labels={{ venta: "CLP por asistente", qtty: "Unidades por 1.000" }}
        />
      </div>
      <div className="mt-6 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 24, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="slotLabel"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              interval={1}
            />
            <YAxis
              tick={axisTick}
              tickFormatter={(v: number) => fmtNum(v, metric === "venta" ? 0 : 1)}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceArea
              x1="21:30"
              x2="23:00"
              fill="#9F99F8"
              fillOpacity={0.07}
              label={{
                value: "Ventana promo (solo KI/KI)",
                position: "insideTop",
                fontSize: 10,
                fill: "#9F99F8",
                fontFamily: "var(--font-sans)",
              }}
            />
            <Tooltip
              cursor={{ stroke: "#E5E5E5" }}
              content={
                <GlovoxTooltip
                  labelFormatter={rangoDe}
                  formatter={(v) =>
                    metric === "venta"
                      ? `$${fmtNum(v, 0)} /asistente`
                      : `${fmtNum(v, 1)} /1.000`
                  }
                />
              }
            />
            {series.map((serie, i) => (
              <Line
                key={serie.eventoId}
                type="monotone"
                dataKey={serie.eventoId}
                name={serie.label}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {series.map((serie, i) => (
          <div key={serie.eventoId} className="flex items-center gap-1.5 font-sans text-xs text-[#666666]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            {serie.label} · {fmtNum(serie.asistentes)} asistentes
          </div>
        ))}
      </div>
    </section>
  );
}
