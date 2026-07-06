"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisTick,
  fmtCLP,
  fmtCLPCompact,
  fmtNum,
  gridProps,
  GlovoxTooltip,
  promoMarks,
  rangoDe,
} from "./chart-utils";

export type JwTimelinePoint = {
  slotLabel: string;
  venta: number;
  qtty: number;
};

export default function JwTimelineChart({ data }: { data: JwTimelinePoint[] }) {
  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <h3 className="font-display text-lg font-bold text-[#333333]">
        Consumo Johnnie Walker durante la noche
      </h3>
      <p className="mt-1 font-sans text-sm text-[#666666]">
        Venta CLP y unidades por bloque de 30 minutos (categoría JW de barra).
        Cada punto es el bloque que termina a esa hora — el punto 23:00 es lo
        vendido entre 22:30 y 23:00. La banda morada marca la ventana efectiva
        de la promo: 21:30 a 23:00.
      </p>
      <div className="mt-6 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 40, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="slotLabel"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              interval={1}
            />
            <YAxis
              yAxisId="venta"
              tick={axisTick}
              tickFormatter={(v: number) => fmtCLPCompact(v)}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <YAxis
              yAxisId="qtty"
              orientation="right"
              tick={axisTick}
              tickFormatter={(v: number) => fmtNum(v)}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            {promoMarks("venta")}
            <Tooltip
              cursor={{ stroke: "#E5E5E5" }}
              content={
                <GlovoxTooltip
                  labelFormatter={rangoDe}
                  formatter={(v, key) => (key === "venta" ? fmtCLP(v) : fmtNum(v))}
                />
              }
            />
            <Legend
              wrapperStyle={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                color: "#666666",
              }}
              iconType="circle"
              iconSize={8}
            />
            <Area
              yAxisId="venta"
              type="monotone"
              dataKey="venta"
              name="Venta CLP"
              stroke="#9F99F8"
              strokeWidth={2}
              fill="#9F99F8"
              fillOpacity={0.15}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="qtty"
              type="monotone"
              dataKey="qtty"
              name="Cantidad"
              stroke="#B1D750"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
