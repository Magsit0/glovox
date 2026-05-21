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
import type { RrssRow } from "@/lib/queries/cierreTrimestral";

interface Props {
  data: RrssRow[];
}

interface TooltipPayloadItem {
  value?: number | string;
  payload?: { date?: string };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const date = item?.payload?.date ?? "";
  const value =
    typeof item?.value === "number"
      ? item.value.toLocaleString("es-CL")
      : String(item?.value ?? "");
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 shadow-sm">
      <p className="font-sans text-xs text-[#666666]">{date}</p>
      <p className="font-display text-sm font-bold text-[#333333]">
        {value} followers
      </p>
    </div>
  );
}

export default function RrssFollowersChart({ data }: Props) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const chartData = sorted.map((r) => ({
    date: r.date,
    totalFollowers: r.totalFollowers,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#F0F0F0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontFamily: "var(--font-sans)", fontSize: 11, fill: "#999999" }}
          tickFormatter={(v: string) => (typeof v === "string" ? v.slice(5) : v)}
          stroke="#E5E5E5"
          tickLine={false}
        />
        <YAxis
          tick={{ fontFamily: "var(--font-sans)", fontSize: 11, fill: "#999999" }}
          stroke="#E5E5E5"
          tickLine={false}
          domain={["dataMin - 500", "dataMax + 500"]}
          tickFormatter={(v: number) => v.toLocaleString("es-CL")}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#E5E5E5" }} />
        <Line
          type="monotone"
          dataKey="totalFollowers"
          stroke="#9F99F8"
          strokeWidth={2}
          dot={false}
          name="Followers"
          animationDuration={400}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
