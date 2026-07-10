"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/unabase/formatting";

export interface DonutSlice {
  label: string;
  value: number;
}

interface Props {
  slices: DonutSlice[];
}

// Tintes de blanco en opacidad decreciente: se leen bien sobre el fondo morado
// sólido de la card spotlight. seriesColor() no sirve acá — su primer color
// ES ese mismo morado y quedaría invisible contra el fondo.
const WHITE_TIERS = [
  "rgba(255,255,255,0.95)",
  "rgba(255,255,255,0.75)",
  "rgba(255,255,255,0.58)",
  "rgba(255,255,255,0.42)",
  "rgba(255,255,255,0.28)",
  "rgba(255,255,255,0.16)",
];

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload: DonutSlice }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const pct = total > 0 ? (p.value / total) * 100 : 0;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="mt-1 text-xs text-[#666666]">
        {formatCurrency(p.value)} · {pct.toFixed(1)}%
      </p>
    </div>
  );
}

export default function TotalIngresosDonut({ slices }: Props) {
  const data = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-28 w-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              stroke="none"
              animationDuration={400}
            >
              {data.map((s, i) => (
                <Cell key={s.label} fill={WHITE_TIERS[i % WHITE_TIERS.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-col gap-1.5">
        {data.map((s, i) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-white/40"
                style={{ backgroundColor: WHITE_TIERS[i % WHITE_TIERS.length] }}
              />
              <span className="truncate font-sans text-xs text-white/90">{s.label}</span>
              <span className="ml-auto shrink-0 font-sans text-xs font-medium tabular-nums text-white">
                {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
