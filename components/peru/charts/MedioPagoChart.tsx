"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { seriesColor } from "@/lib/chart-colors";
import { GlovoxTooltip } from "@/components/peru/ChartTooltip";
import { fmtNumber, fmtPct } from "@/lib/peru-format";

export type MedioPoint = {
  medio: string;
  ventas: number;
};

export default function MedioPagoChart({ data }: { data: MedioPoint[] }) {
  const total = data.reduce((s, d) => s + d.ventas, 0);
  const top = data.slice(0, 6);
  const rest = data.slice(6);
  const finalData =
    rest.length > 0
      ? [
          ...top,
          { medio: "Otros", ventas: rest.reduce((s, d) => s + d.ventas, 0) },
        ]
      : top;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={finalData}
            dataKey="ventas"
            nameKey="medio"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          >
            {finalData.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip
            content={
              <GlovoxTooltip
                formatter={(value) => {
                  const v = Number(value ?? 0);
                  return `${fmtNumber(v)} (${fmtPct((v / total) * 100)})`;
                }}
              />
            }
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              color: "#666666",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
