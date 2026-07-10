"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import { compactMoney, formatMoney, formatMonthLabel as mesLabel } from "@/lib/money";
import type { CloudSpend } from "@/lib/queries/cloud";

function MonthTooltip({
  active,
  payload,
  moneda,
}: {
  active?: boolean;
  payload?: { payload: { mes: string; costo: number; enCurso: boolean } }[];
  moneda: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">
        {mesLabel(p.mes)}
        {p.enCurso && <span className="ml-1.5 text-xs text-[#999999]">(en curso)</span>}
      </p>
      <p className="mt-1 text-xs text-[#666666]">{formatMoney(p.costo, moneda)}</p>
    </div>
  );
}

function ServiceTooltip({
  active,
  payload,
  moneda,
}: {
  active?: boolean;
  payload?: { payload: { servicio: string; costo: number } }[];
  moneda: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.servicio}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatMoney(p.costo, moneda)}</p>
    </div>
  );
}

export default function CloudSpendCharts({ spend }: { spend: CloudSpend }) {
  const { moneda, monthly, currentMonth, currentByService } = spend;

  const monthData = monthly.map((m) => ({
    ...m,
    label: mesLabel(m.mes),
    enCurso: m.mes === currentMonth,
  }));

  const serviceData = [...currentByService]
    .reverse()
    .map((s) => ({
      ...s,
      shortLabel: s.servicio.length > 30 ? `${s.servicio.slice(0, 29)}…` : s.servicio,
    }));
  const serviceHeight = Math.max(240, serviceData.length * 34 + 40);

  return (
    <div className="flex flex-col gap-6">
      {/* Gasto por mes */}
      <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Gasto por mes
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Total mensual en Google Cloud ({moneda}). El mes en curso (amarillo) es parcial.
          </p>
        </header>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthData}
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
              barCategoryGap="30%"
            >
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#E5E5E5" }} tick={axisTick} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                width={64}
                tickFormatter={(v) => compactMoney(v)}
              />
              <Tooltip
                content={<MonthTooltip moneda={moneda} />}
                cursor={{ fill: "#F0F0F0" }}
              />
              <Bar dataKey="costo" radius={[4, 4, 0, 0]}>
                {monthData.map((d) => (
                  <Cell key={d.mes} fill={d.enCurso ? "#F6C544" : seriesColor(0)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      {/* Desglose por servicio (mes en curso) */}
      <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            En qué se va este mes
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            {currentMonth ? `Gasto por servicio · ${mesLabel(currentMonth)}` : "Gasto por servicio"}
          </p>
        </header>
        {serviceData.length === 0 ? (
          <p className="font-sans text-sm text-[#999999]">Sin datos del mes en curso.</p>
        ) : (
          <div style={{ height: serviceHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={serviceData}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
              >
                <CartesianGrid {...gridProps} horizontal={false} vertical={true} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={axisTick}
                  tickFormatter={(v) => compactMoney(v)}
                />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={{ stroke: "#E5E5E5" }}
                  tick={axisTick}
                  width={190}
                />
                <Tooltip content={<ServiceTooltip moneda={moneda} />} cursor={{ fill: "#F0F0F0" }} />
                <Bar dataKey="costo" fill={seriesColor(0)} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </div>
  );
}
