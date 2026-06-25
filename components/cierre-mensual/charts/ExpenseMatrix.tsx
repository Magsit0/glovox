"use client";

import { useMemo } from "react";
import { useFilters, useExpenseUI } from "@/components/cierre-mensual/context/DashboardContext";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import { buildMatrix, heatStyle, truncateText } from "@/lib/unabase/heatmap";

export default function ExpenseMatrix() {
  const { filteredExpenseRows } = useFilters();
  const { expenseViewMode: mode, selectedExpenseCategory, setSelectedExpenseCategory } = useExpenseUI();

  const model = useMemo(
    () => buildMatrix(filteredExpenseRows, (r) => r.categoriaGasto, mode),
    [filteredExpenseRows, mode],
  );

  const totals = useMemo(() => {
    let gasto = 0;
    let presupuesto = 0;
    let asistentes = 0;
    filteredExpenseRows.forEach((r) => {
      gasto += r.gasto;
      presupuesto += r.presupuesto;
    });
    model.eventStats.forEach((s) => {
      asistentes += s.asistentes || 0;
    });
    return { gasto, presupuesto, asistentes };
  }, [filteredExpenseRows, model]);

  if (!filteredExpenseRows.length) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] font-sans text-sm text-[#999999]">
        No hay líneas de gasto para construir la matriz.
      </div>
    );
  }

  const { groupMap, eventStats, events, groups: categories, maxValue } = model;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Chip>
          <strong className="font-medium">{formatNumber(categories.length)}</strong>&nbsp;categorías
        </Chip>
        <Chip>
          <strong className="font-medium">{formatNumber(events.length)}</strong>&nbsp;eventos
        </Chip>
        <Chip>
          <strong className="font-medium">{formatNumber(totals.asistentes)}</strong>&nbsp;asistentes
        </Chip>
        <Chip accent>
          <strong className="font-medium">{mode === "percapita" ? "Per cápita" : "Total"}</strong>
        </Chip>
        <Chip>
          <strong className="font-medium">{formatCurrency(totals.gasto)}</strong>&nbsp;gasto
        </Chip>
        <Chip>
          <strong className="font-medium">{formatCurrency(totals.presupuesto)}</strong>&nbsp;presupuesto
        </Chip>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
        <div className="overflow-auto">
          <table className="min-w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="sticky left-0 z-10 border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                  Categoría
                </th>
                {events.map((ev) => {
                  const info = eventStats.get(ev);
                  return (
                    <th
                      key={ev}
                      className="min-w-[160px] border-r border-[#E5E5E5] px-4 py-3 text-left font-sans text-xs font-medium text-[#666666] last:border-r-0"
                      title={info?.eventName}
                    >
                      <div className="text-[#333333]">{truncateText(info?.eventName ?? ev, 24)}</div>
                      <div className="mt-0.5 font-sans text-[11px] font-normal text-[#999999]">
                        {info?.fechaAsignacion} · {formatNumber(info?.asistentes ?? 0)} as.
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, rowIdx) => {
                const eventMap = groupMap.get(category) ?? new Map();
                const isSelected = selectedExpenseCategory === category;
                const isLast = rowIdx === categories.length - 1;
                const borderCls = isLast ? "" : "border-b border-[#E5E5E5]";
                return (
                  <tr key={category} className={borderCls}>
                    <th
                      className={`sticky left-0 z-10 border-r border-[#E5E5E5] bg-white px-4 py-3 text-left ${
                        isLast ? "" : "border-b border-[#E5E5E5]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedExpenseCategory(isSelected ? null : category)
                        }
                        className={`text-left font-sans text-sm transition-colors ${
                          isSelected
                            ? "font-medium text-[#9F99F8]"
                            : "text-[#333333] hover:text-[#9F99F8]"
                        }`}
                      >
                        {category}
                      </button>
                    </th>
                    {events.map((ev) => {
                      const info = eventStats.get(ev);
                      const cell = eventMap.get(ev) ?? {
                        gasto: 0,
                        presupuesto: 0,
                        asistentes: info?.asistentes ?? 0,
                      };
                      const metric =
                        mode === "percapita"
                          ? cell.asistentes > 0
                            ? cell.gasto / cell.asistentes
                            : null
                          : cell.gasto;
                      const cellStyle = heatStyle(metric ?? 0, maxValue);
                      const valueLabel =
                        mode === "percapita"
                          ? metric !== null && metric > 0
                            ? formatCurrency(metric)
                            : cell.gasto > 0
                              ? "N/D"
                              : "—"
                          : cell.gasto > 0
                            ? compactCurrency(cell.gasto)
                            : "—";
                      const meta =
                        mode === "percapita"
                          ? cell.asistentes > 0
                            ? `Ppto ${compactCurrency(cell.presupuesto)}`
                            : "Sin asistentes"
                          : cell.presupuesto > 0
                            ? `Ppto ${compactCurrency(cell.presupuesto)}`
                            : "—";
                      return (
                        <td
                          key={ev}
                          className="border-r border-[#E5E5E5] px-4 py-3 align-top font-sans text-sm tabular-nums last:border-r-0"
                          style={cellStyle}
                          title={`${category} · ${info?.eventName ?? ev} · Gasto ${formatCurrency(cell.gasto)}`}
                        >
                          <div className="font-medium">{valueLabel}</div>
                          <div className="mt-0.5 text-[11px] opacity-80">{meta}</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs font-medium ${
        accent
          ? "border border-[#9F99F8] bg-[#F0EFFE] text-[#9F99F8]"
          : "border border-[#E5E5E5] bg-white text-[#333333]"
      }`}
    >
      {children}
    </span>
  );
}
