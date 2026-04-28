"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import chroma from "chroma-js";
import { BRAND, axisTick, gridProps } from "@/lib/chart-colors";
import { GlovoxTooltip } from "@/components/peru/ChartTooltip";
import { fmtNumber } from "@/lib/peru-format";

export type HourlyPoint = { hour: number; ventas: number };

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

function pad(h: number) {
  return String(h).padStart(2, "0") + ":00";
}

export default function HourlyChart({ data }: { data: HourlyPoint[] }) {
  const byHour = new Map(data.map((d) => [d.hour, d.ventas]));
  const max = Math.max(...data.map((d) => d.ventas), 1);
  const formatted = ALL_HOURS.map((h) => ({
    label: pad(h),
    ventas: byHour.get(h) ?? 0,
  }));

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formatted}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "#E5E5E5" }}
            tick={axisTick}
            interval={3}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={(v) => fmtNumber(Number(v))}
          />
          <Tooltip
            content={<GlovoxTooltip formatter={(v) => fmtNumber(Number(v ?? 0))} />}
            cursor={{ fill: "#FAFAFA" }}
          />
          <Bar dataKey="ventas" name="Tickets" radius={[4, 4, 0, 0]}>
            {formatted.map((d, i) => (
              <Cell
                key={i}
                fill={chroma(BRAND.yellow)
                  .mix(BRAND.orange, d.ventas / max, "lab")
                  .hex()}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
