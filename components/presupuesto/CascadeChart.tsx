"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "@/lib/chart-colors";

export type CascadeSlice = { key: string; label: string; monto: number };

interface Props {
  rows: CascadeSlice[];
  ceiling: number;
  /** Formateador de moneda del país del presupuesto. */
  money: (v: number) => string;
}

interface TooltipEntry {
  payload: CascadeSlice & { _pct: number };
}

function ChartTooltip(
  { active, payload, money }: { active?: boolean; payload?: TooltipEntry[]; money: (v: number) => string },
) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="mt-1 text-xs text-[#666666]">{money(p.monto)}</p>
      <p className="text-xs text-[#666666]">{(p._pct * 100).toFixed(1)}% del techo</p>
    </div>
  );
}

export default function CascadeChart({ rows, ceiling, money }: Props) {
  const positivos = rows.filter((r) => r.monto > 0);
  const asignado = positivos.reduce((a, r) => a + r.monto, 0);
  const data = positivos.map((r) => ({ ...r, _pct: ceiling > 0 ? r.monto / ceiling : 0 }));

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Distribución del techo
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Cómo se reparte el techo presupuestario entre las categorías de costo.
        </p>
      </header>

      {ceiling <= 0 || data.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">
          Cargá asistentes, per-cápitas y margen para ver la distribución.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative h-56 w-56 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="monto"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="100%"
                  stroke="none"
                  animationDuration={400}
                >
                  {data.map((r, i) => (
                    <Cell key={r.key} fill={seriesColor(i)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip money={money} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-xl font-bold leading-none text-[#333333]">
                {money(ceiling)}
              </span>
              <span className="mt-1 font-sans text-xs text-[#999999]">techo</span>
            </div>
          </div>

          <div className="flex-1 self-stretch">
            <ul className="flex flex-col gap-2">
              {data.map((r, i) => (
                <li key={r.key} className="flex items-center justify-between gap-4 font-sans text-sm">
                  <span className="inline-flex items-center gap-2 text-[#333333]">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: seriesColor(i) }}
                    />
                    {r.label}
                  </span>
                  <span className="tabular-nums text-[#666666]">
                    {money(r.monto)} · {(r._pct * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
            {asignado !== ceiling && (
              <p className="mt-3 border-t border-[#E5E5E5] pt-3 font-sans text-xs text-[#999999]">
                Asignado {money(asignado)} de {money(ceiling)}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
