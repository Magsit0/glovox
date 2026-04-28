"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { BRAND, axisTick, gridProps } from "@/lib/chart-colors";
import { GlovoxTooltip } from "@/components/peru/ChartTooltip";
import { fmtNumber } from "@/lib/peru-format";

export type TipoPoint = {
  tipo: string;
  ventas: number;
};

export default function TipoTicketChart({ data }: { data: TipoPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label:
      d.tipo.length > 20 ? d.tipo.slice(0, 18) + "…" : d.tipo,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formatted}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          barCategoryGap="25%"
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
            width={160}
          />
          <Tooltip
            content={<GlovoxTooltip formatter={(v) => fmtNumber(Number(v ?? 0))} />}
            cursor={{ fill: "#FAFAFA" }}
          />
          <Bar
            dataKey="ventas"
            name="Tickets"
            fill={BRAND.green}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
