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
  LabelList,
} from "recharts";
import type { UtmTrafficRow } from "@/lib/queries/marketing";

type Props = {
  data: UtmTrafficRow[];
};

const PIE_COLORS = [
  "#FF0000",
  "#0000FF",
  "#000000",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#00FF00",
  "#FF8000",
];
const SCATTER_COLORS = PIE_COLORS;

// ---------- Agrupación por canal (la vista marts.ga4_utm clasifica el
// source/medium informal — meta/venta_*, mt/pm, ff/ref — en canales) ----------

type CanalGroup = {
  canal: string;
  totalSessions: number;
  pct: number;
  children: UtmTrafficRow[];
};

type Entry = { type: "group"; group: CanalGroup } | { type: "single"; row: UtmTrafficRow };

function buildEntries(data: UtmTrafficRow[], totalSessions: number): Entry[] {
  const canalMap = new Map<string, UtmTrafficRow[]>();
  for (const row of data) {
    const key = row.canal;
    if (!canalMap.has(key)) canalMap.set(key, []);
    canalMap.get(key)!.push(row);
  }

  const entries: Entry[] = [];
  for (const [canal, rows] of canalMap) {
    const canalSessions = rows.reduce((s, r) => s + r.sessions, 0);
    if (rows.length === 1) {
      entries.push({ type: "single", row: rows[0] });
    } else {
      entries.push({
        type: "group",
        group: {
          canal,
          totalSessions: canalSessions,
          pct: totalSessions > 0 ? Math.round((canalSessions / totalSessions) * 100) : 0,
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

// ---------- Scatter: volumen vs calidad, UN punto por canal ----------
// Por source el gráfico era una nube ilegible (60+ puntos aplastados por el
// eje lineal, colores repetidos, fuentes de 1 sesión disparadas en Y). Un punto
// por canal con etiqueta responde una sola pregunta bien: ¿qué canal trae
// volumen Y calidad? El detalle por fuente vive en la tabla expandible.

// Canales con menos sesiones que esto no entran al scatter: con 2 visitas el
// "engagement promedio" es ruido, no señal.
const MIN_SESSIONS_SCATTER = 100;

type ScatterPoint = {
  name: string;
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
      agg.set(row.canal, (agg.get(row.canal) ?? 0) + row.sessions);
    }
    return [...agg.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  const scatterData: ScatterPoint[] = useMemo(() => {
    const agg = new Map<string, { sessions: number; engTotal: number }>();
    for (const row of data) {
      const existing = agg.get(row.canal);
      if (existing) {
        existing.sessions += row.sessions;
        existing.engTotal += row.engPerSession * row.sessions;
      } else {
        agg.set(row.canal, {
          sessions: row.sessions,
          engTotal: row.engPerSession * row.sessions,
        });
      }
    }
    return [...agg.entries()]
      .map(([name, v]) => ({
        name,
        sessions: v.sessions,
        engPerSession: v.sessions > 0 ? Math.round((v.engTotal / v.sessions) * 10) / 10 : 0,
      }))
      .filter((p) => p.sessions >= MIN_SESSIONS_SCATTER);
  }, [data]);

  const avgSessions = scatterData.length > 0
    ? scatterData.reduce((s, p) => s + p.sessions, 0) / scatterData.length
    : 0;
  const avgEng = scatterData.length > 0
    ? scatterData.reduce((s, p) => s + p.engPerSession, 0) / scatterData.length
    : 0;

  function toggle(canal: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(canal)) next.delete(canal);
      else next.add(canal);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div>
          <p className="font-mono-data uppercase text-xs mb-2 font-bold">Sessions por Canal</p>
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
          <p className="font-mono-data text-xs text-black/50 mt-2">
            Cómo leer: de todas las sesiones del período de venta, qué porción
            entró por cada canal. «Directo / sin etiqueta» = links sin UTM
            (WhatsApp, stories, escribir la URL).
          </p>
        </div>

        {/* Scatter: volumen vs calidad, un punto por canal */}
        <div>
          <p className="font-mono-data uppercase text-xs mb-2 font-bold">Volumen vs Calidad por Canal</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 24, right: 60, bottom: 20, left: 10 }}>
              <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="sessions"
                type="number"
                name="Sessions"
                scale="log"
                domain={[50, "auto"]}
                tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
                stroke="#000"
                label={{
                  value: "Sessions (escala log) →",
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
              <Scatter data={scatterData} stroke="#000" strokeWidth={2}>
                {scatterData.map((_, i) => (
                  <Cell key={i} fill={SCATTER_COLORS[i % SCATTER_COLORS.length]} />
                ))}
                <LabelList
                  dataKey="name"
                  position="top"
                  style={{
                    fontFamily: "var(--font-ibm-plex-mono)",
                    fontSize: 10,
                    fill: "#000",
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="font-mono-data text-xs text-black/50 mt-2">
            Cómo leer: un punto por canal (mínimo {MIN_SESSIONS_SCATTER} sesiones).
            Derecha = trae más visitas; arriba = visitas que interactúan más.
            Arriba-derecha = canal estrella; abajo-derecha = mucho tráfico que
            no engancha; arriba-izquierda = candidato a escalar.
          </p>
        </div>
      </div>

      {/* Grouped table by canal */}
      <div className="border-4 border-black rounded-none w-full overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-black text-white">
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Canal</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Source</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Medium</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Content</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Sessions</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">%</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Eng/S</th>
              <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Bounce</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              entry.type === "single" ? (
                <SingleRow
                  key={`s-${entry.row.canal}-${entry.row.source}-${entry.row.medium}`}
                  row={entry.row}
                  totalSessions={totalSessions}
                />
              ) : (
                <GroupRows
                  key={`g-${entry.group.canal}`}
                  group={entry.group}
                  totalSessions={totalSessions}
                  isExpanded={expanded.has(entry.group.canal)}
                  onToggle={() => toggle(entry.group.canal)}
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
      <td className="font-mono-data text-sm px-4 py-3 font-bold">{row.canal}</td>
      <td className="font-mono-data text-sm px-4 py-3">{row.source}</td>
      <td className="font-mono-data text-sm px-4 py-3 max-w-[160px] truncate">{row.medium}</td>
      <td className="font-mono-data text-sm px-4 py-3 max-w-[200px] truncate">{row.content || "—"}</td>
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
  group: CanalGroup;
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
          {group.canal}
          <span className="ml-2 font-normal text-black/50">({group.children.length} fuentes)</span>
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">
          {group.totalSessions.toLocaleString("es-CL")}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{group.pct}%</td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{avgEng.toFixed(1)}</td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{(avgBounce * 100).toFixed(0)}%</td>
      </tr>
      {isExpanded && (
        <tr className="border-b-2 border-black">
          <td colSpan={8} className="p-0">
            {/* Scroll interno: canales como Vendedores traen cientos de fuentes */}
            <div className="max-h-80 overflow-y-auto bg-black/5">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[22%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <tbody>
                  {group.children.map((row, i) => (
                    <tr
                      key={`${row.source}-${row.medium}-${row.content}-${i}`}
                      className="border-b border-black/30 transition-colors duration-150"
                    >
                      <td className="font-mono-data text-xs px-4 py-2 pl-10 text-black/60 truncate">{row.canal}</td>
                      <td className="font-mono-data text-xs px-4 py-2 text-black/60 truncate">{row.source}</td>
                      <td className="font-mono-data text-xs px-4 py-2 text-black/60 truncate">{row.medium}</td>
                      <td className="font-mono-data text-xs px-4 py-2 text-black/60 truncate">{row.content || "—"}</td>
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
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
