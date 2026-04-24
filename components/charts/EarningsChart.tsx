"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState, useMemo } from "react";
import type { CountryMonthlyRow } from "@/lib/queries/comunidad";
import type { MpMonthlyRow } from "@/lib/mercadopago";


function fmClp(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

type PivotRow = {
  month: string;
  chile_revenue: number;
  peru_revenue_clp: number;
  peru_revenue_raw: number;
  chile_tickets: number;
  peru_tickets: number;
  mp_revenue: number;
  mp_count: number;
};

function pivot(
  rows: CountryMonthlyRow[],
  mpRows: MpMonthlyRow[],
  rate: number
): PivotRow[] {
  const map = new Map<string, PivotRow>();

  const ensure = (month: string) => {
    if (!map.has(month)) {
      map.set(month, {
        month,
        chile_revenue: 0,
        peru_revenue_clp: 0,
        peru_revenue_raw: 0,
        chile_tickets: 0,
        peru_tickets: 0,
        mp_revenue: 0,
        mp_count: 0,
      });
    }
    return map.get(month)!;
  };

  for (const r of rows) {
    const entry = ensure(r.month);
    if (r.country === "chile") {
      entry.chile_revenue = r.revenue;
      entry.chile_tickets = r.tickets;
    } else {
      entry.peru_revenue_raw = r.revenue;
      entry.peru_revenue_clp = r.revenue * rate;
      entry.peru_tickets = r.tickets;
    }
  }

  for (const m of mpRows) {
    const entry = ensure(m.month);
    entry.mp_revenue = m.amount;
    entry.mp_count = m.count;
  }

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function downloadCsv(rows: PivotRow[], rate: number) {
  const header = [
    "Mes",
    "Chile Revenue (CLP)",
    "Perú Revenue (PEN)",
    `Perú Revenue CLP (tasa ${rate})`,
    "MercadoPago (CLP)",
    "MercadoPago Pagos",
    "Total CLP",
    "Chile Tickets",
    "Perú Tickets",
    "Total Tickets",
  ].join(",");

  const body = rows.map((r) => {
    const total = r.chile_revenue + r.peru_revenue_clp + r.mp_revenue;
    return [
      r.month,
      Math.round(r.chile_revenue),
      Math.round(r.peru_revenue_raw),
      Math.round(r.peru_revenue_clp),
      Math.round(r.mp_revenue),
      r.mp_count,
      Math.round(total),
      r.chile_tickets,
      r.peru_tickets,
      r.chile_tickets + r.peru_tickets,
    ].join(",");
  });

  const csv = [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comunidad_earnings_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EarningsChart({
  data,
  mpData,
  initialRate,
}: {
  data: CountryMonthlyRow[];
  mpData: MpMonthlyRow[];
  initialRate: number;
}) {
  const [rate, setRate] = useState(initialRate);
  const [rateInput, setRateInput] = useState(initialRate.toFixed(2));

  const rows = useMemo(() => pivot(data, mpData, rate), [data, mpData, rate]);

  function handleRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRateInput(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed) && parsed > 0) setRate(parsed);
  }

  const totalChile = rows.reduce((s, r) => s + r.chile_revenue, 0);
  const totalPeruRaw = rows.reduce((s, r) => s + r.peru_revenue_raw, 0);
  const totalPeruClp = rows.reduce((s, r) => s + r.peru_revenue_clp, 0);
  const totalMp = rows.reduce((s, r) => s + r.mp_revenue, 0);
  const totalClp = totalChile + totalPeruClp + totalMp;

  const tooltipLabels: Record<string, string> = {
    chile_revenue: "Chile (CLP)",
    peru_revenue_clp: `Perú (CLP)`,
    mp_revenue: "MercadoPago (CLP)",
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Tasa PEN → CLP
          </label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={rateInput}
            onChange={handleRateChange}
            className="w-24 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
          <span className="text-xs text-zinc-500">1 PEN = {rate} CLP</span>
        </div>
        <button
          onClick={() => downloadCsv(rows, rate)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
            <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
          </svg>
          Descargar CSV
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Chile</p>
          <p className="mt-1 text-xl font-semibold text-zinc-50">{fmClp(totalChile)}</p>
          <p className="text-xs text-zinc-500">CLP</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Perú</p>
          <p className="mt-1 text-xl font-semibold text-zinc-50">{fmClp(totalPeruRaw)}</p>
          <p className="text-xs text-zinc-500">PEN originales</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Perú (en CLP)</p>
          <p className="mt-1 text-xl font-semibold text-emerald-400">{fmClp(totalPeruClp)}</p>
          <p className="text-xs text-zinc-500">tasa {rate}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">MercadoPago</p>
          <p className="mt-1 text-xl font-semibold text-amber-400">{fmClp(totalMp)}</p>
          <p className="text-xs text-zinc-500">PRIME + PRIME_YEARLY</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total CLP</p>
          <p className="mt-1 text-xl font-semibold text-indigo-400">{fmClp(totalClp)}</p>
          <p className="text-xs text-zinc-500">desde 2025</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={rows} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmClp}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#e4e4e7", fontWeight: 600 }}
            itemStyle={{ color: "#a1a1aa" }}
            formatter={(value, name) => [fmClp(Number(value)), tooltipLabels[String(name)] ?? name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }}
            formatter={(value) => tooltipLabels[value] ?? value}
          />
          <Bar dataKey="chile_revenue" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
          <Bar dataKey="peru_revenue_clp" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="mp_revenue" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="pb-3 pr-4">Mes</th>
              <th className="pb-3 pr-4 text-right">Chile (CLP)</th>
              <th className="pb-3 pr-4 text-right">Perú (PEN)</th>
              <th className="pb-3 pr-4 text-right">Perú (CLP)</th>
              <th className="pb-3 pr-4 text-right">MP (CLP)</th>
              <th className="pb-3 pr-4 text-right">Total CLP</th>
              <th className="pb-3 pr-4 text-right">Tickets CL</th>
              <th className="pb-3 text-right">Tickets PE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.map((r) => {
              const total = r.chile_revenue + r.peru_revenue_clp + r.mp_revenue;
              return (
                <tr key={r.month} className="transition-colors hover:bg-zinc-800/40">
                  <td className="py-2.5 pr-4 font-mono text-xs text-zinc-400">{r.month}</td>
                  <td className="py-2.5 pr-4 text-right text-zinc-200">
                    {r.chile_revenue > 0 ? fmClp(r.chile_revenue) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-400">
                    {r.peru_revenue_raw > 0
                      ? r.peru_revenue_raw.toLocaleString("es-CL", { maximumFractionDigits: 0 })
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">
                    {r.peru_revenue_clp > 0 ? fmClp(r.peru_revenue_clp) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-amber-400">
                    {r.mp_revenue > 0 ? fmClp(r.mp_revenue) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-zinc-100">
                    {fmClp(total)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-zinc-400">
                    {r.chile_tickets > 0 ? r.chile_tickets.toLocaleString("es-CL") : "—"}
                  </td>
                  <td className="py-2.5 text-right text-zinc-400">
                    {r.peru_tickets > 0 ? r.peru_tickets.toLocaleString("es-CL") : "—"}
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
