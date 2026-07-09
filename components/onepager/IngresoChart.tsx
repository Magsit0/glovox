"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { OnepagerIngresoRow } from "@/lib/queries/onepager";

const COLORS: Record<string, string> = {
  TICKETS: "#0000FF",
  FFBB: "#000000",
  MARCAS: "#FFFF00",
  "MESAS VIP": "#00A0A0",
  MEDIOS: "#C800C8",
};

function getColor(ingreso: string) {
  return COLORS[ingreso] ?? "#555555";
}

function displayLabel(ingreso: string) {
  if (ingreso === "FFBB") return "FF&BB";
  if (ingreso === "MARCAS") return "Marcas";
  if (ingreso === "MESAS VIP") return "Mesas VIP";
  if (ingreso === "MEDIOS") return "Medios";
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
            innerRadius={36}
            outerRadius={60}
            paddingAngle={3}
            isAnimationActive={false}
          >
            {data.map((row) => (
              <Cell key={row.ingreso} fill={getColor(row.ingreso)} stroke="#000" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "4px solid #000",
              borderRadius: 0,
              fontFamily: "monospace",
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const num = Number(value);
              return [
                Number.isFinite(num) ? fmtClp(num) : String(value),
                displayLabel(String(name)),
              ];
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Leyenda manual */}
      <div className="flex flex-col gap-1 w-full">
        {data.map((row) => {
          const pct = total > 0 ? ((row.venta / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={row.ingreso} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 border border-black flex-shrink-0"
                  style={{ background: getColor(row.ingreso) }}
                />
                <span className="font-mono-data text-xs uppercase">{displayLabel(row.ingreso)}</span>
              </div>
              <span className="font-mono-data text-xs font-bold">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
