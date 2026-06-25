"use client";

import { useMemo } from "react";
import { useFilters, useExpenseUI } from "@/components/cierre-mensual/context/DashboardContext";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import { buildMatrix, heatStyle, truncateText } from "@/lib/unabase/heatmap";

export default function ExpenseSubcategoryMatrix() {
  const { filteredExpenseRows } = useFilters();
  const { expenseViewMode: mode, selectedExpenseCategory } = useExpenseUI();

  const relevantRows = useMemo(
    () =>
      selectedExpenseCategory
        ? filteredExpenseRows.filter((r) => r.categoriaGasto === selectedExpenseCategory)
        : [],
    [filteredExpenseRows, selectedExpenseCategory],
  );

  const model = useMemo(
    () => buildMatrix(relevantRows, (r) => r.subCategoria, mode),
    [relevantRows, mode],
  );

  const totals = useMemo(() => {
    let gasto = 0;
    let presupuesto = 0;
    let asistentes = 0;
    relevantRows.forEach((r) => {
      gasto += r.gasto;
      presupuesto += r.presupuesto;
    });
    model.eventStats.forEach((s) => {
      asistentes += s.asistentes || 0;
    });
    return { gasto, presupuesto, asistentes };
  }, [relevantRows, model]);

  if (!filteredExpenseRows.length || !selectedExpenseCategory) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-4 text-center font-sans text-sm text-[#999999]">
        {!filteredExpenseRows.length
          ? "No hay líneas de gasto visibles."
          : "Haz clic en una categoría para ver su desglose."}
      </div>
    );
  }

  if (!relevantRows.length) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] font-sans text-sm text-[#999999]">
        La categoría abierta no tiene subcategorías visibles.
      </div>
    );
  }

  const { groupMap, eventStats, events, groups: subcategories, maxValue } = model;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Chip accent>
          <strong className="font-medium">{selectedExpenseCategory}</strong>
        </Chip>
        <Chip>
          <strong className="font-medium">{formatNumber(subcategories.length)}</strong>&nbsp;subcategorías
        </Chip>
        <Chip>
          <strong className="font-medium">{formatNumber(events.length)}</strong>&nbsp;eventos
        </Chip>
        <Chip>
          <strong className="font-medium">{formatNumber(totals.asistentes)}</strong>&nbsp;asistentes
        </Chip>
        <Chip>
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
                  Subcategoría
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
              {subcategories.map((sub, rowIdx) => {
                const eventMap = groupMap.get(sub) ?? new Map();
                const isLast = rowIdx === subcategories.length - 1;
                const borderCls = isLast ? "" : "border-b border-[#E5E5E5]";
                return (
                  <tr key={sub} className={borderCls}>
                    <th className="sticky left-0 z-10 border-r border-[#E5E5E5] bg-white px-4 py-3 text-left font-sans text-sm text-[#333333]">
                      {sub}
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
                          title={`${selectedExpenseCategory} · ${sub} · ${info?.eventName ?? ev}`}
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
