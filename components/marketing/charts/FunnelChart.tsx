"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { FunnelRow } from "@/lib/queries/marketing";

const COLORS = ["#0000FF", "#000000", "#FF0000", "#FFFF00"];

type Props = {
  data: FunnelRow[];
};

export default function FunnelChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          type="number"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
        />
        <YAxis
          type="category"
          dataKey="step"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
          width={120}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "4px solid #000",
            borderRadius: 0,
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="users" name="Usuarios">
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
