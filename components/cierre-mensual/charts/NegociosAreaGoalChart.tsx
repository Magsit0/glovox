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
import { BrutalTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import { axisTick, BRAND, gridProps, legendProps, SURFACE } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { NegocioRow } from "@/lib/unabase/types";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface Props {
  rows: NegocioRow[];
  area: string;
  meta: number;
}

function parseFechaToYearMonth(dateStr: string): { year: number; month: number } | null {
  if (!dateStr || dateStr === "00-00-00") return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [, m, y] = dateStr.split("-");
    return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split("-");
    return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
  }
  return null;
}

export default function NegociosAreaGoalChart({ rows, area, meta }: Props) {
  const { chartData, totalFacturado, cumulativeActual, currentMonth } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyIncome = new Array(12).fill(0);
    const monthlyFacturado = new Array(12).fill(0);
    let totalFacturado = 0;

    rows.forEach((row) => {
      if (row.area_negocio.toLowerCase() !== area.toLowerCase()) return;
      const parsed = parseFechaToYearMonth(row.fecha_asignacion);
      if (!parsed || parsed.year !== currentYear) return;
      if (parsed.month < 0 || parsed.month > 11) return;
      monthlyIncome[parsed.month] += parseFloat(row.total_neto) || 0;
      monthlyFacturado[parsed.month] += parseFloat(row.total_facturado) || 0;
      totalFacturado += parseFloat(row.total_facturado) || 0;
    });

    const cumulativeActual = monthlyIncome
      .slice(0, currentMonth + 1)
      .reduce((sum, v) => sum + v, 0);

    const metaPerMonth = meta / 12;
    const cumIncome = monthlyIncome.reduce<number[]>((acc, v, i) => {
      acc.push((acc[i - 1] ?? 0) + v);
      return acc;
    }, []);
    const cumFact = monthlyFacturado.reduce<number[]>((acc, v, i) => {
      acc.push((acc[i - 1] ?? 0) + v);
      return acc;
    }, []);

    const chartData = MONTH_NAMES.map((name, i) => ({
      label: `${name} ${String(currentYear).slice(2)}`,
      acumulado: i <= currentMonth ? cumIncome[i] : null,
      facturado: i <= currentMonth ? cumFact[i] : null,
      meta: metaPerMonth * (i + 1),
    }));

    return { chartData, totalFacturado, cumulativeActual, currentMonth };
  }, [rows, area, meta]);

  const pct = meta > 0 ? (cumulativeActual / meta) * 100 : 0;
  const pacingPct = ((currentMonth + 1) / 12) * 100;
  const pill =
    pct >= 100
      ? { dot: "bg-[#B1D750]", label: "En meta" }
      : pct >= pacingPct
        ? { dot: "bg-[#F6C544]", label: "En ritmo" }
        : { dot: "bg-[#ED75A0]", label: "Atrasado" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-sans text-xs text-[#666666]">Acumulado vs meta anual</span>
          <span className="font-display text-3xl font-extrabold leading-none tracking-tight text-[#333333]">
            {pct.toFixed(1)}%
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
      </div>

      <div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
              domain={[0, meta]}
            />
            <Tooltip
              cursor={{ stroke: SURFACE.divider }}
              content={({ active, label, payload }) => (
                <BrutalTooltip
                  active={active}
                  label={label}
                  items={(payload ?? [])
                    .filter((p) => p.value !== null)
                    .map((p) => ({
                      name: String(p.name),
                      color: String(p.color),
                      formatted: formatCurrency(Number(p.value)),
                    }))}
                />
              )}
            />
            <Legend {...legendProps} />
            <Line
              type="monotone"
              dataKey="acumulado"
              name="Ingreso acumulado"
              stroke={BRAND.purple}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="facturado"
              name="Facturado acumulado"
              stroke={BRAND.green}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="meta"
              name="Pacing meta"
              stroke={BRAND.pink}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-[#E5E5E5] pt-4">
        <span className="font-sans text-xs text-[#666666]">Total facturado año</span>
        <span className="font-display text-xl font-extrabold tracking-tight text-[#333333] tabular-nums">
          {formatCurrency(totalFacturado)}
        </span>
      </div>
    </div>
  );
}
