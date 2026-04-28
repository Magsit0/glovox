"use client";

import {
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BRAND, axisTick, gridProps, legendProps } from "@/lib/chart-colors";
import { GlovoxTooltip } from "@/components/peru/ChartTooltip";
import { fmtMonthYear, fmtNumber, fmtPenShort } from "@/lib/peru-format";

export type MonthlyPoint = {
  ym: string;
  ventas: number;
  cortesias: number;
  revenue: number;
};

export default function MonthlyEvolutionChart({
  data,
}: {
  data: MonthlyPoint[];
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: fmtMonthYear(d.ym),
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={formatted}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "#E5E5E5" }}
            tick={axisTick}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={(v) => fmtNumber(Number(v))}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={axisTick}
            tickFormatter={(v) => fmtPenShort(Number(v))}
          />
          <Tooltip
            content={
              <GlovoxTooltip
                formatter={(value, name) =>
                  name === "Revenue"
                    ? fmtPenShort(Number(value ?? 0))
                    : fmtNumber(Number(value ?? 0))
                }
              />
            }
            cursor={{ fill: "#FAFAFA" }}
          />
          <Legend {...legendProps} />
          <Bar
            yAxisId="left"
            dataKey="ventas"
            name="Ventas"
            fill={BRAND.purple}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="left"
            dataKey="cortesias"
            name="Cortesías"
            fill={BRAND.teal}
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={BRAND.pink}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
