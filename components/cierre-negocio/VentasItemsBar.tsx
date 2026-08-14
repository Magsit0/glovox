"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { ItemDescripcionBreakdown } from "@/lib/unabase/cierreNegocio";

interface Props {
  rows: ItemDescripcionBreakdown[];
}

interface TooltipPayload {
  value: number;
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
        {formatNumber(p.nDocs)} {p.nDocs === 1 ? "documento" : "documentos"}
      </p>
    </div>
  );
}

// Barras horizontales (mismo patrón que TopProveedoresChart): las descripciones
// de ítem son texto largo y esta card vive en una columna angosta, así las
// etiquetas se leen sin rotar ni truncar de más.
export default function VentasItemsBar({ rows }: Props) {
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

  // `rows` viene ordenado desc por monto; recharts dibuja de abajo hacia arriba,
  // así que se invierte para que el mayor quede arriba.
  const data = [...rows].reverse().map((r) => ({
    ...r,
    label: r.descripcion.length > 18 ? `${r.descripcion.slice(0, 17)}…` : r.descripcion,
  }));

  // ~40px por barra + padding.
  const chartHeight = Math.max(220, data.length * 40 + 40);

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
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
          >
            <CartesianGrid {...gridProps} horizontal={false} vertical={true} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              tickFormatter={(v) => compactCurrency(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#E5E5E5" }}
              tick={axisTick}
              width={120}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
            <Bar dataKey="total" fill={seriesColor(0)} radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
