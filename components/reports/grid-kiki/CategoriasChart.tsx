"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  axisTick,
  fmtCLP,
  fmtCLPCompact,
  fmtNum,
  gridProps,
  GlovoxTooltip,
  MetricToggle,
  promoMarks,
  rangoDe,
  SeriePill,
} from "./chart-utils";

export type CategoriaPoint = {
  slotLabel: string;
  categoria: string;
  venta: number;
  qtty: number;
};

const SERIES = [
  { key: "JW",      label: "Johnnie Walker", color: "#9F99F8", defaultOn: true },
  { key: "MISTRAL", label: "Pisco Mistral",  color: "#B1D750", defaultOn: true },
  { key: "GIN",     label: "Gin",            color: "#ED75A0", defaultOn: false },
  { key: "VODKA",   label: "Vodka",          color: "#F6C544", defaultOn: false },
];

export default function CategoriasChart({
  data,
  slots,
}: {
  data: CategoriaPoint[];
  slots: string[];
}) {
  const [metric, setMetric] = useState<"venta" | "qtty">("qtty");
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SERIES.map((s) => [s.key, s.defaultOn]))
  );

  const chartData = useMemo(() => {
    const bySlot = new Map<string, Record<string, number | string>>(
      slots.map((slot) => [
        slot,
        {
          slotLabel: slot,
          ...Object.fromEntries(SERIES.map((s) => [s.key, 0])),
        },
      ])
    );
    for (const row of data) {
      const entry = bySlot.get(row.slotLabel);
      if (entry) entry[row.categoria] = row[metric];
    }
    return slots.map((slot) => bySlot.get(slot)!);
  }, [data, slots, metric]);

  const active = SERIES.filter((s) => visible[s.key]);

  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#333333]">
            Johnnie Walker vs. otras categorías de barra
          </h3>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Consumo por bloque de 30 minutos en la misma noche. Activa gin y
            vodka para ampliar la comparación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SERIES.map((s) => (
            <SeriePill
              key={s.key}
              label={s.label}
              color={s.color}
              on={visible[s.key]}
              onToggle={() =>
                setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))
              }
            />
          ))}
          <MetricToggle metric={metric} onChange={setMetric} />
        </div>
      </div>
      <div className="mt-6 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 40, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="slotLabel"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              interval={1}
            />
            <YAxis
              tick={axisTick}
              tickFormatter={(v: number) =>
                metric === "venta" ? fmtCLPCompact(v) : fmtNum(v)
              }
              tickLine={false}
              axisLine={false}
              width={56}
            />
            {promoMarks()}
            <Tooltip
              cursor={{ stroke: "#E5E5E5" }}
              content={
                <GlovoxTooltip
                  labelFormatter={rangoDe}
                  formatter={(v) => (metric === "venta" ? fmtCLP(v) : fmtNum(v))}
                />
              }
            />
            {active.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
