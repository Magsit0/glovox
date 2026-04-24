"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { CampaignRow } from "@/lib/queries/marketing";

const COLORS = ["#FF0000", "#0000FF", "#000000", "#FFFF00"];
const DASHES = ["", "8 4", "4 2", "2 2"];

type Props = {
  data: CampaignRow[];
  fechaEvento?: string;
};

export default function CampaignBreakdownChart({ data, fechaEvento }: Props) {
  const { pivoted, campaigns } = useMemo(() => {
    const agg = new Map<string, Map<string, number>>();
    for (const r of data) {
      if (!agg.has(r.date)) agg.set(r.date, new Map());
      const dateMap = agg.get(r.date)!;
      dateMap.set(r.campaign, (dateMap.get(r.campaign) ?? 0) + r.spend);
    }

    const campSet = new Set<string>();
    for (const r of data) campSet.add(r.campaign);
    const camps = [...campSet];

    const dates = [...agg.keys()].sort();

    // Pad to event date if it's in the future
    if (fechaEvento && dates.length > 0) {
      const lastDate = dates[dates.length - 1];
      if (lastDate < fechaEvento) {
        const current = new Date(lastDate);
        current.setDate(current.getDate() + 1);
        const end = new Date(fechaEvento);
        while (current <= end) {
          const dateStr = current.toISOString().slice(0, 10);
          if (!agg.has(dateStr)) {
            agg.set(dateStr, new Map());
            dates.push(dateStr);
          }
          current.setDate(current.getDate() + 1);
        }
        dates.sort();
      }
    }

    const rows: Record<string, unknown>[] = [];
    for (const date of dates) {
      const campMap = agg.get(date)!;
      const row: Record<string, unknown> = { date };
      for (const c of camps) row[c] = campMap.get(c) ?? 0;
      rows.push(row);
    }

    return { pivoted: rows, campaigns: camps };
  }, [data, fechaEvento]);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={pivoted}>
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
        <Legend
          wrapperStyle={{
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 10,
            textTransform: "uppercase",
          }}
        />
        {campaigns.map((camp, i) => (
          <Line
            key={camp}
            type="monotone"
            dataKey={camp}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            strokeDasharray={DASHES[i % DASHES.length]}
            dot={false}
            name={camp}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
