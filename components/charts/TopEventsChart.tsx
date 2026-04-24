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
import type { EventRow } from "@/lib/queries/comunidad";

function fmClp(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function shortName(name: string): string {
  return name.length > 32 ? name.slice(0, 30) + "…" : name;
}

const COLORS = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#059669", "#047857", "#065f46", "#d1fae5", "#6ee7b7", "#34d399"];

export default function TopEventsChart({ data }: { data: EventRow[] }) {
  const display = data.map((r) => ({ ...r, shortEvento: shortName(r.evento) }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={display}
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
          dataKey="shortEvento"
          tick={{ fontSize: 11, fill: "#e4e4e7" }}
          tickLine={false}
          axisLine={false}
          width={180}
        />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontWeight: 600 }}
          itemStyle={{ color: "#a1a1aa" }}
          formatter={(value, _name, props) => {
            const row = (props as { payload: EventRow }).payload;
            const v = Number(value);
            return [
              `${fmClp(v)}  ·  ${row.tickets} tickets  ·  ${row.referrers} referrers`,
              "Revenue",
            ];
          }}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
          {display.map((_row, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
