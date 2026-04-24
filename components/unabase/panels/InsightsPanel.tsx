"use client";

import { useMemo, type ReactNode } from "react";
import { useFilters } from "@/components/unabase/context/DashboardContext";
import { formatCurrency } from "@/lib/unabase/formatting";
import type { BusinessRow } from "@/lib/unabase/types";

interface Insight {
  label: string;
  text: ReactNode;
}

function generateInsights(rows: BusinessRow[]): Insight[] {
  if (!rows.length) return [];
  const insights: Insight[] = [];

  const totalIngreso = rows.reduce((s, r) => s + r.ingreso, 0);
  const totalGasto = rows.reduce((s, r) => s + r.gasto, 0);
  const totalPpto = rows.reduce((s, r) => s + r.presupuesto, 0);
  const totalMargen = totalIngreso - totalGasto;
  const margenPct = totalIngreso ? (totalMargen / totalIngreso) * 100 : 0;

  const topNeg = [...rows].sort((a, b) => b.ingreso - a.ingreso)[0];
  if (topNeg && totalIngreso > 0) {
    const part = ((topNeg.ingreso / totalIngreso) * 100).toFixed(1);
    insights.push({
      label: "Top negocio",
      text: (
        <>
          <strong className="font-medium">{topNeg.nombre}</strong> es el negocio de mayor ingreso con{" "}
          {formatCurrency(topNeg.ingreso)}, el <strong className="font-medium">{part}%</strong> del total.
        </>
      ),
    });
  }

  insights.push({
    label: "Margen",
    text: (
      <>
        Margen consolidado: <strong className="font-medium">{formatCurrency(totalMargen)}</strong> (
        <strong className="font-medium">{margenPct.toFixed(1)}%</strong>).
      </>
    ),
  });

  const catGasto: Record<string, number> = {};
  rows.forEach((r) => {
    Object.entries(r.categoriasGasto || {}).forEach(([cat, g]) => {
      catGasto[cat] = (catGasto[cat] || 0) + g;
    });
  });
  const cats = Object.entries(catGasto).sort((a, b) => b[1] - a[1]);
  if (cats.length > 0) {
    const [topCat, topG] = cats[0];
    const pct = totalGasto > 0 ? ((topG / totalGasto) * 100).toFixed(1) : "0";
    insights.push({
      label: "Categoría dominante",
      text: (
        <>
          <strong className="font-medium">{topCat}</strong> concentra el{" "}
          <strong className="font-medium">{pct}%</strong> del gasto ({formatCurrency(topG)}).
        </>
      ),
    });
  }

  if (totalPpto > 0) {
    const ejPct = ((totalGasto / totalPpto) * 100).toFixed(1);
    const restante = totalPpto - totalGasto;
    if (restante >= 0) {
      insights.push({
        label: "Ejecución",
        text: (
          <>
            Ejecutado <strong className="font-medium">{ejPct}%</strong> del presupuesto. Disponible{" "}
            <strong className="font-medium">{formatCurrency(restante)}</strong>.
          </>
        ),
      });
    } else {
      insights.push({
        label: "Presupuesto comprometido",
        text: (
          <>
            Gasto supera el presupuesto del período en{" "}
            <strong className="font-medium">{formatCurrency(Math.abs(restante))}</strong>.
          </>
        ),
      });
    }
  }

  const areaMap: Record<string, { ingreso: number; margen: number }> = {};
  rows.forEach((r) => {
    if (!areaMap[r.area_negocio]) areaMap[r.area_negocio] = { ingreso: 0, margen: 0 };
    areaMap[r.area_negocio].ingreso += r.ingreso;
    areaMap[r.area_negocio].margen += r.margen;
  });
  const areas = Object.entries(areaMap).filter(([, v]) => v.ingreso > 0);
  if (areas.length > 1) {
    areas.sort((a, b) => b[1].margen / b[1].ingreso - a[1].margen / a[1].ingreso);
    const [best, data] = areas[0];
    const pct = ((data.margen / data.ingreso) * 100).toFixed(1);
    insights.push({
      label: "Área más rentable",
      text: (
        <>
          <strong className="font-medium">{best}</strong> tiene mayor rentabilidad con margen de{" "}
          <strong className="font-medium">{pct}%</strong>.
        </>
      ),
    });
  }

  return insights;
}

export default function InsightsPanel() {
  const { filteredRows } = useFilters();
  const insights = useMemo(() => generateInsights(filteredRows), [filteredRows]);

  if (!insights.length) return null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center gap-3">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
          Insights
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
          {insights.length}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {insights.map((ins, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-lg border border-[#E5E5E5] bg-white p-4"
          >
            <div className="font-sans text-xs font-medium text-[#9F99F8]">{ins.label}</div>
            <div className="font-sans text-sm text-[#333333]">{ins.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
