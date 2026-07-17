"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { OnepagerIngresoRow } from "@/lib/queries/onepager";
import { BRAND, INK } from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";

// Cada fuente de ingreso mapeada a un acento de marca distinto (manual Glovox).
const COLORS: Record<string, string> = {
  TICKETS: BRAND.purple,
  FFBB: BRAND.green,
  MARCAS: BRAND.pink,
  "MESAS VIP": BRAND.teal,
  MEDIOS: BRAND.orange,
  PRODUCTO: BRAND.yellow,
};

function getColor(ingreso: string) {
  return COLORS[ingreso] ?? INK.subtle;
}

function displayLabel(ingreso: string) {
  if (ingreso === "FFBB") return "FF&BB";
  if (ingreso === "MARCAS") return "Marcas";
  if (ingreso === "MESAS VIP") return "Mesas VIP";
  if (ingreso === "MEDIOS") return "Medios";
  if (ingreso === "PRODUCTO") return "Producto";
  if (ingreso === "TICKETS") return "Tickets";
  return ingreso;
}

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

type Props = { data: OnepagerIngresoRow[] };

export default function IngresoChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.venta, 0);

  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width={132} height={132}>
        <PieChart>
          <Pie
            data={data}
            dataKey="venta"
            nameKey="ingreso"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={62}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((row) => (
              <Cell key={row.ingreso} fill={getColor(row.ingreso)} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                items={(payload ?? []).map((p) => {
                  const ingreso = String(p.name ?? "");
                  const num = Number(p.value);
                  return {
                    name: displayLabel(ingreso),
                    color: getColor(ingreso),
                    formatted: Number.isFinite(num) ? fmtClp(num) : String(p.value),
                  };
                })}
              />
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Leyenda manual */}
      <div className="flex flex-col gap-1.5 w-full">
        {data.map((row) => {
          const pct = total > 0 ? ((row.venta / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={row.ingreso} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: getColor(row.ingreso) }}
                />
                <span className="font-sans text-xs text-[#666666] truncate">
                  {displayLabel(row.ingreso)}
                </span>
              </div>
              <span className="font-sans text-xs font-medium text-[#333333] tabular-nums">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
