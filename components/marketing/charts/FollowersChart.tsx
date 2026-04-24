"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { FollowerRow } from "@/lib/queries/marketing";

type Props = {
  data: FollowerRow[];
};

export default function FollowersChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          tickFormatter={(v: string) => v.slice(5)}
          stroke="#000"
        />
        <YAxis
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
          domain={["dataMin - 100", "dataMax + 100"]}
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
        <Line
          type="monotone"
          dataKey="totalFollowers"
          stroke="#0000FF"
          strokeWidth={3}
          dot={false}
          name="Followers"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
