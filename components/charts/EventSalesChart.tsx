"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import type { EventSalesRow } from "@/lib/queries/comunidad";

const TODAY = new Date().toISOString().slice(0, 10);

function isPast(fecha: string) {
  return fecha < TODAY;
}

function fmClp(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

type Filter = "all" | "past" | "upcoming";
type SortOrder = "date" | "sales";

function Pill<T extends string>({
  buttons,
  active,
  onChange,
}: {
  buttons: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
      {buttons.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === b.id
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

export default function EventSalesChart({ data }: { data: EventSalesRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [country, setCountry] = useState<"all" | "chile" | "peru">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date");
  const [chartLimit, setChartLimit] = useState(20);

  const byCountry =
    country === "chile"
      ? data.filter((r) => r.evento_id.startsWith("GLO"))
      : country === "peru"
      ? data.filter((r) => r.evento_id.startsWith("GLP"))
      : data;

  const byTime =
    filter === "past"
      ? byCountry.filter((r) => isPast(r.fecha_evento))
      : filter === "upcoming"
      ? byCountry.filter((r) => !isPast(r.fecha_evento))
      : byCountry;

  const filtered = [...byTime].sort((a, b) =>
    sortOrder === "date"
      ? a.fecha_evento.localeCompare(b.fecha_evento)
      : b.venta_con_cargo - a.venta_con_cargo
  );

  const chartSlice =
    sortOrder === "date"
      ? filtered.slice(-chartLimit)
      : filtered.slice(0, chartLimit);

  const chartData = chartSlice.map((r) => ({
    label: r.evento_id,
    venta: r.venta_con_cargo,
    pct: r.pct_cantidad,
    nombre: r.evento,
  }));

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `Todos (${byCountry.length})` },
    { id: "upcoming", label: `Próximos (${byCountry.filter((r) => !isPast(r.fecha_evento)).length})` },
    { id: "past", label: `Pasados (${byCountry.filter((r) => isPast(r.fecha_evento)).length})` },
  ];

  const countryButtons: { id: "all" | "chile" | "peru"; label: string }[] = [
    { id: "all",   label: "🌍 Todos" },
    { id: "chile", label: "🇨🇱 Chile" },
    { id: "peru",  label: "🇵🇪 Perú" },
  ];

  const sortButtons: { id: SortOrder; label: string }[] = [
    { id: "date",  label: "📅 Por fecha" },
    { id: "sales", label: "📊 Por ventas" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Pill buttons={countryButtons} active={country} onChange={setCountry} />
        <Pill buttons={tabs} active={filter} onChange={setFilter} />
        <Pill buttons={sortButtons} active={sortOrder} onChange={setSortOrder} />
      </div>

      {/* Chart */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {sortOrder === "date" ? "Últimos" : "Top"} {Math.min(chartLimit, filtered.length)} eventos
          </p>
          <div className="flex gap-1">
            {[10, 20, 50].map((n) => (
              <button
                key={n}
                onClick={() => setChartLimit(n)}
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  chartLimit === n
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-400"
                }`}
              >
                {sortOrder === "date" ? "Últimos" : "Top"} {n}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 48, left: 8, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="venta"
              tickFormatter={fmClp}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e4e4e7", fontWeight: 600 }}
              itemStyle={{ color: "#a1a1aa" }}
              labelFormatter={(label, payload) => {
                const nombre = payload?.[0]?.payload?.nombre ?? label;
                return `${nombre} (${label})`;
              }}
              formatter={(value, name) => {
                if (name === "venta") return [fmClp(Number(value)), "Venta comunidad"];
                return [`${value}%`, "% tickets comunidad"];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
              formatter={(v) => (v === "venta" ? "Venta comunidad (CLP)" : "% tickets comunidad")}
            />
            <Bar yAxisId="venta" dataKey="venta" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="pct"
              dataKey="pct"
              stroke="#f59e0b"
              dot={{ r: 3, fill: "#f59e0b" }}
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="pb-3 pr-3">ID</th>
              <th className="pb-3 pr-4">Evento</th>
              <th className="pb-3 pr-4">Fecha</th>
              <th className="pb-3 pr-4 text-right">Tickets</th>
              <th className="pb-3 pr-4 text-right">Venta (CLP)</th>
              <th className="pb-3 pr-4 text-right">% Tickets</th>
              <th className="pb-3 text-right">% Venta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {filtered.map((r) => {
              const past = isPast(r.fecha_evento);
              return (
                <tr key={r.evento_id} className="transition-colors hover:bg-zinc-800/40">
                  <td className="py-2.5 pr-3 font-mono text-xs text-zinc-500">{r.evento_id}</td>
                  <td className="py-2.5 pr-4 font-medium text-zinc-100">{r.evento}</td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">{r.fecha_evento}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          past
                            ? "bg-zinc-800 text-zinc-500"
                            : "bg-emerald-950 text-emerald-400"
                        }`}
                      >
                        {past ? "pasado" : "próximo"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-300">
                    {r.cantidad.toLocaleString("es-CL")}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-zinc-100">
                    {fmClp(r.venta_con_cargo)}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span
                      className={`text-xs font-medium ${
                        r.pct_cantidad >= 50
                          ? "text-emerald-400"
                          : r.pct_cantidad >= 20
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {r.pct_cantidad}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`text-xs font-medium ${
                        r.pct_precio_final >= 50
                          ? "text-emerald-400"
                          : r.pct_precio_final >= 20
                          ? "text-amber-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {r.pct_precio_final}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
