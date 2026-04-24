"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { UtmTrafficRow } from "@/lib/queries/marketing";

type Props = {
  data: UtmTrafficRow[];
};

const PIE_COLORS = ["#FF0000", "#0000FF", "#000000", "#FFFF00"];
const SCATTER_COLORS = ["#FF0000", "#0000FF", "#000000", "#FFFF00"];

// ---------- Grouping logic (same pattern as SalesOriginTable) ----------

type MediumGroup = {
  medium: string;
  totalSessions: number;
  pct: number;
  children: UtmTrafficRow[];
};

type Entry = { type: "group"; group: MediumGroup } | { type: "single"; row: UtmTrafficRow };

function buildEntries(data: UtmTrafficRow[], totalSessions: number): Entry[] {
  const mediumMap = new Map<string, UtmTrafficRow[]>();
  for (const row of data) {
    const key = row.medium;
    if (!mediumMap.has(key)) mediumMap.set(key, []);
    mediumMap.get(key)!.push(row);
  }

  const entries: Entry[] = [];
  for (const [medium, rows] of mediumMap) {
    const mediumSessions = rows.reduce((s, r) => s + r.sessions, 0);
    if (rows.length === 1) {
      entries.push({ type: "single", row: rows[0] });
    } else {
      entries.push({
        type: "group",
        group: {
          medium,
          totalSessions: mediumSessions,
          pct: totalSessions > 0 ? Math.round((mediumSessions / totalSessions) * 100) : 0,
          children: rows.sort((a, b) => b.sessions - a.sessions),
        },
      });
    }
  }

  entries.sort((a, b) => {
    const sa = a.type === "group" ? a.group.totalSessions : a.row.sessions;
    const sb = b.type === "group" ? b.group.totalSessions : b.row.sessions;
    return sb - sa;
  });

  return entries;
}

// ---------- Scatter data: aggregate by source for the bubble chart ----------

type ScatterPoint = {
  name: string;
  medium: string;
  sessions: number;
  engPerSession: number;
};

export default function UtmTrafficTable({ data }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const totalSessions = data.reduce((sum, r) => sum + r.sessions, 0);

  const entries = useMemo(() => buildEntries(data, totalSessions), [data, totalSessions]);

  const pieData = useMemo(() => {
    const agg = new Map<string, number>();
    for (const row of data) {
      const key = `${row.medium} / ${row.source}`;
      agg.set(key, (agg.get(key) ?? 0) + row.sessions);
    }
    return [...agg.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  const scatterData: ScatterPoint[] = useMemo(() => {
    const agg = new Map<string, { sessions: number; engTotal: number; medium: string }>();
    for (const row of data) {
      const key = `${row.source}`;
      const existing = agg.get(key);
      if (existing) {
        existing.sessions += row.sessions;
        existing.engTotal += row.engPerSession * row.sessions;
      } else {
        agg.set(key, {
          sessions: row.sessions,
          engTotal: row.engPerSession * row.sessions,
          medium: row.medium,
        });
      }
    }
    return [...agg.entries()]
      .map(([name, v]) => ({
        name,
        medium: v.medium,
        sessions: v.sessions,
        engPerSession: v.sessions > 0 ? Math.round((v.engTotal / v.sessions) * 10) / 10 : 0,
      }))
      .filter((p) => p.sessions > 0);
  }, [data]);

  const avgSessions = scatterData.length > 0
    ? scatterData.reduce((s, p) => s + p.sessions, 0) / scatterData.length
    : 0;
  const avgEng = scatterData.length > 0
    ? scatterData.reduce((s, p) => s + p.engPerSession, 0) / scatterData.length
    : 0;

  // Color by medium
  const mediums = useMemo(() => [...new Set(scatterData.map((p) => p.medium))], [scatterData]);

  function toggle(medium: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(medium)) next.delete(medium);
      else next.add(medium);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div>
          <p className="font-mono-data uppercase text-xs mb-2 font-bold">Sessions por Medium / Source</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                strokeWidth={2}
                stroke="#000"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
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
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Scatter: engagement vs sessions */}
        <div>
          <p className="font-mono-data uppercase text-xs mb-2 font-bold">Volumen vs Calidad de Engagement</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="sessions"
                type="number"
                name="Sessions"
                tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
                stroke="#000"
                label={{
                  value: "Sessions →",
                  position: "insideBottom",
                  offset: -10,
                  fontFamily: "var(--font-ibm-plex-mono)",
                  fontSize: 10,
                  fill: "#000",
                }}
              />
              <YAxis
                dataKey="engPerSession"
                type="number"
                name="Eng/Session"
                tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
                stroke="#000"
                label={{
                  value: "Eng / Session",
                  angle: -90,
                  position: "insideLeft",
                  fontFamily: "var(--font-ibm-plex-mono)",
                  fontSize: 10,
                  fill: "#000",
                }}
              />
              <ReferenceLine
                x={avgSessions}
                stroke="#000"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
              <ReferenceLine
                y={avgEng}
                stroke="#000"
                strokeWidth={1}
                strokeOpacity={0.4}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "4px solid #000",
                  borderRadius: 0,
                  fontFamily: "var(--font-ibm-plex-mono)",
                  fontSize: 12,
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  if (name === "Sessions") return [Number(value).toLocaleString("es-CL"), "Sessions"];
                  return [Number(value).toFixed(1), "Eng/Session"];
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(_: any, payload: any) =>
                  payload?.[0]?.payload?.name ?? ""
                }
              />
              {mediums.map((medium, mi) => (
                <Scatter
                  key={medium}
                  name={medium}
                  data={scatterData.filter((p) => p.medium === medium)}
                  fill={SCATTER_COLORS[mi % SCATTER_COLORS.length]}
                  stroke="#000"
                  strokeWidth={2}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-2">
            {mediums.map((medium, mi) => (
              <div key={medium} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 border-2 border-black rounded-none"
                  style={{ backgroundColor: SCATTER_COLORS[mi % SCATTER_COLORS.length] }}
                />
                <span className="font-mono-data text-xs uppercase">{medium}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grouped table by medium */}
      <div className="border-4 border-black rounded-none w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-black text-white">
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Medium</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Source</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Content</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Term</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Sessions</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">%</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Eng/S</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Bounce</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.type === "single" ? (
                <SingleRow key={`s-${entry.row.medium}-${entry.row.source}`} row={entry.row} totalSessions={totalSessions} />
              ) : (
                <GroupRows
                  key={`g-${entry.group.medium}`}
                  group={entry.group}
                  totalSessions={totalSessions}
                  isExpanded={expanded.has(entry.group.medium)}
                  onToggle={() => toggle(entry.group.medium)}
                />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SingleRow({ row, totalSessions }: { row: UtmTrafficRow; totalSessions: number }) {
  return (
    <tr className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150">
      <td className="font-mono-data text-sm px-4 py-3">{row.medium}</td>
      <td className="font-mono-data text-sm px-4 py-3">{row.source}</td>
      <td className="font-mono-data text-sm px-4 py-3 max-w-[200px] truncate">{row.content || "—"}</td>
      <td className="font-mono-data text-sm px-4 py-3">{row.term || "—"}</td>
      <td className="font-mono-data text-sm px-4 py-3 text-right">{row.sessions.toLocaleString("es-CL")}</td>
      <td className="font-mono-data text-sm px-4 py-3 text-right">
        {totalSessions > 0 ? Math.round((row.sessions / totalSessions) * 100) : 0}%
      </td>
      <td className="font-mono-data text-sm px-4 py-3 text-right">{row.engPerSession.toFixed(1)}</td>
      <td className="font-mono-data text-sm px-4 py-3 text-right">{(row.bounceRate * 100).toFixed(0)}%</td>
    </tr>
  );
}

function GroupRows({
  group,
  totalSessions,
  isExpanded,
  onToggle,
}: {
  group: MediumGroup;
  totalSessions: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const avgEng = group.children.length > 0
    ? group.children.reduce((s, r) => s + r.engPerSession * r.sessions, 0) / group.totalSessions
    : 0;
  const avgBounce = group.children.length > 0
    ? group.children.reduce((s, r) => s + r.bounceRate * r.sessions, 0) / group.totalSessions
    : 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b-2 border-black cursor-pointer hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <td className="font-mono-data text-sm px-4 py-3 font-bold" colSpan={4}>
          <span className="mr-2">{isExpanded ? "▼" : "▶"}</span>
          {group.medium}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">
          {group.totalSessions.toLocaleString("es-CL")}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{group.pct}%</td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{avgEng.toFixed(1)}</td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{(avgBounce * 100).toFixed(0)}%</td>
      </tr>
      {isExpanded &&
        group.children.map((row, i) => (
          <tr
            key={`${row.source}-${row.content}-${row.term}-${i}`}
            className="border-b border-black/30 bg-black/5 transition-colors duration-150"
          >
            <td className="font-mono-data text-xs px-4 py-2 pl-10 text-black/60">{row.medium}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-black/60">{row.source}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-black/60 max-w-[200px] truncate">{row.content || "—"}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-black/60">{row.term || "—"}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">
              {row.sessions.toLocaleString("es-CL")}
            </td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">
              {totalSessions > 0 ? Math.round((row.sessions / totalSessions) * 100) : 0}%
            </td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">{row.engPerSession.toFixed(1)}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">{(row.bounceRate * 100).toFixed(0)}%</td>
          </tr>
        ))}
    </>
  );
}
