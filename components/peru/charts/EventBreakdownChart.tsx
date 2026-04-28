"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BRAND, axisTick, gridProps, legendProps } from "@/lib/chart-colors";
import { GlovoxTooltip } from "@/components/peru/ChartTooltip";
import { fmtNumber, fmtPenShort } from "@/lib/peru-format";

export type EventPoint = {
  nombre: string;
  fechaEvento: string;
  ventas: number;
  cortesias: number;
  revenue: number;
};

export default function EventBreakdownChart({ data }: { data: EventPoint[] }) {
  const reversed = [...data].reverse();
  const labels = reversed.map((d) => {
    const words = d.nombre.split(" ");
    return words.length > 4 ? words.slice(0, 4).join(" ") + "…" : d.nombre;
  });
  const formatted = reversed.map((d, i) => ({
    ...d,
    label: labels[i],
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formatted}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          barCategoryGap="30%"
        >
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: "#E5E5E5" }}
            tick={axisTick}
            tickFormatter={(v) => fmtNumber(Number(v))}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ ...axisTick, textAnchor: "end" }}
            width={140}
          />
          <Tooltip
            content={
              <GlovoxTooltip
                formatter={(value, name) =>
                  name === "Revenue (S/)" ? fmtPenShort(Number(value ?? 0)) : fmtNumber(Number(value ?? 0))
                }
              />
            }
            cursor={{ fill: "#FAFAFA" }}
          />
          <Legend {...legendProps} />
          <Bar dataKey="ventas" name="Ventas" fill={BRAND.purple} radius={[0, 4, 4, 0]} />
          <Bar dataKey="cortesias" name="Cortesías" fill={BRAND.teal} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
