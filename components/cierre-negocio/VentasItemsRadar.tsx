"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { BRAND, seriesFillSoft } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { ItemDescripcionBreakdown } from "@/lib/unabase/cierreNegocio";

interface Props {
  rows: ItemDescripcionBreakdown[];
}

interface TooltipPayload {
  payload: ItemDescripcionBreakdown;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.descripcion}</p>
      <p className="mt-1 text-xs text-[#666666]">{formatCurrency(p.total)}</p>
      <p className="text-xs text-[#666666]">
        {p.nDocs} {p.nDocs === 1 ? "documento" : "documentos"}
      </p>
    </div>
  );
}

export default function VentasItemsRadar({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Ventas por tipo de ítem
        </h3>
        <p className="mt-2 font-sans text-sm text-[#999999]">
          Los documentos de este negocio no tienen descripciones de ítem.
        </p>
      </article>
    );
  }

  const total = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Ventas por tipo de ítem
        </h3>
        <p className="mt-1 font-sans text-xs text-[#666666]">
          Venta neta atribuida por descripción de ítem.
        </p>
      </header>

      {rows.length < 3 ? (
        // El radar necesita ≥3 ejes para leerse; con menos mostramos barras.
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const pct = total > 0 ? r.total / total : 0;
            return (
              <li key={r.descripcion} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-sans text-sm text-[#333333]">{r.descripcion}</span>
                  <span className="font-sans text-sm tabular-nums text-[#333333]">
                    {formatCurrency(r.total)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0F0F0]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: BRAND.purple }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={rows} outerRadius="70%">
              <PolarGrid stroke="#F0F0F0" />
              <PolarAngleAxis
                dataKey="descripcion"
                tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "#666666" }}
              />
              <PolarRadiusAxis
                tick={{ fontFamily: "var(--font-sans)", fontSize: 10, fill: "#999999" }}
                tickFormatter={(value) => compactCurrency(value)}
                axisLine={false}
              />
              <Radar
                dataKey="total"
                stroke={BRAND.purple}
                strokeWidth={2}
                fill={seriesFillSoft(BRAND.purple)}
              />
              <Tooltip content={<ChartTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
