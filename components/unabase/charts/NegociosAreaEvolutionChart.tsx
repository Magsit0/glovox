"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox } from "lucide-react";
import { BrutalTooltip } from "@/components/unabase/charts/ChartTooltip";
import { axisTick, gridProps, legendProps, seriesColor, SURFACE } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { NegocioRow } from "@/lib/unabase/types";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function parseDateToYM(dateStr: string): string | null {
  if (!dateStr || dateStr === "00-00-00") return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [, m, y] = dateStr.split("-");
    return `${y}-${m}`;
  }
  if (/^\d{4}-\d{2}/.test(dateStr)) return dateStr.slice(0, 7);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  rows: NegocioRow[];
}

export default function NegociosAreaEvolutionChart({ rows }: Props) {
  const { data, areas } = useMemo(() => {
    const areaMonth: Record<string, Record<string, number>> = {};
    const monthSet = new Set<string>();

    rows.forEach((row) => {
      const month = parseDateToYM(row.fecha_asignacion);
      if (!month) return;
      const area = row.area_negocio || "Sin área";
      if (!areaMonth[area]) areaMonth[area] = {};
      areaMonth[area][month] = (areaMonth[area][month] || 0) + (parseFloat(row.total_neto) || 0);
      monthSet.add(month);
    });

    const months = Array.from(monthSet).sort();
    const areasList = Object.keys(areaMonth).sort((a, b) => {
      const sa = Object.values(areaMonth[a]).reduce((s, v) => s + v, 0);
      const sb = Object.values(areaMonth[b]).reduce((s, v) => s + v, 0);
      return sb - sa;
    });

    const chartRows = months.map((m) => {
      const [y, mo] = m.split("-");
      const label = `${MONTH_NAMES[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
      const entry: Record<string, string | number> = { label };
      areasList.forEach((area) => {
        entry[area] = areaMonth[area]?.[m] ?? 0;
      });
      return entry;
    });

    return { data: chartRows, areas: areasList };
  }, [rows]);

  if (!data.length || !areas.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => compactCurrency(v)}
        />
        <Tooltip
          cursor={{ stroke: SURFACE.divider }}
          content={({ active, label, payload }) => (
            <BrutalTooltip
              active={active}
              label={label}
              items={(payload ?? []).map((p) => ({
                name: String(p.name),
                color: String(p.color),
                formatted: formatCurrency(Number(p.value)),
              }))}
            />
          )}
        />
        <Legend {...legendProps} />
        {areas.map((area, i) => (
          <Line
            key={area}
            type="monotone"
            dataKey={area}
            name={area}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
