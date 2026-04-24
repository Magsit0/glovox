"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SellerRow } from "@/lib/queries/comunidad";

function fmClp(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

const COLORS = [
  "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
  "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#6366f1", "#818cf8", "#a5b4fc",
  "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe",
  "#8b5cf6", "#a78bfa", "#c4b5fd",
  "#6366f1", "#818cf8", "#a5b4fc",
  "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#8b5cf6",
];

export default function TopSellersChart({ data }: { data: SellerRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={480}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 80, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={fmClp}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="referido"
          tick={{ fontSize: 12, fill: "#e4e4e7" }}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontWeight: 600 }}
          itemStyle={{ color: "#a1a1aa" }}
          formatter={(value, _name, props) => {
            const row = (props as { payload: SellerRow }).payload;
            const v = Number(value);
            return [
              `${fmClp(v)}  ·  ${row.tickets} tickets  ·  avg ${fmClp(Math.round(row.avg_price))}`,
              "Revenue",
            ];
          }}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
          {data.map((_row, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
