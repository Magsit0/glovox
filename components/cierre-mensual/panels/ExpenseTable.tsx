"use client";

import { useMemo } from "react";
import { useExpenseUI, useFilters } from "@/components/unabase/context/DashboardContext";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";

const HEADERS = [
  { key: "categoria", label: "Categoría", align: "left" as const },
  { key: "gasto", label: "Gasto", align: "right" as const },
  { key: "ppto", label: "Presupuesto", align: "right" as const },
  { key: "desv", label: "Desviación", align: "right" as const },
  { key: "eventos", label: "Eventos", align: "right" as const },
];

export default function ExpenseTable() {
  const { filteredExpenseRows } = useFilters();
  const { selectedExpenseCategory, setSelectedExpenseCategory } = useExpenseUI();

  const items = useMemo(() => {
    if (!filteredExpenseRows.length) return [];
    const grouped = new Map<
      string,
      { categoria: string; gasto: number; presupuesto: number; eventos: Set<string> }
    >();
    filteredExpenseRows.forEach((row) => {
      const curr = grouped.get(row.categoriaGasto) ?? {
        categoria: row.categoriaGasto,
        gasto: 0,
        presupuesto: 0,
        eventos: new Set<string>(),
      };
      curr.gasto += row.gasto;
      curr.presupuesto += row.presupuesto;
      curr.eventos.add(row.nombre);
      grouped.set(row.categoriaGasto, curr);
    });
    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        desviacion: item.gasto - item.presupuesto,
        eventosCount: item.eventos.size,
      }))
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, 20);
  }, [filteredExpenseRows]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
          Top categorías de gasto
        </h2>
      </header>
      <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {HEADERS.map((h) => (
                  <th
                    key={h.key}
                    className={`px-4 py-3 text-${h.align} font-sans text-xs font-medium text-[#666666]`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={HEADERS.length}
                    className="px-4 py-8 text-center font-sans text-sm text-[#999999]"
                  >
                    Sin gastos con los filtros actuales.
                  </td>
                </tr>
              )}
              {items.map((item, i) => {
                const desvCls =
                  item.desviacion > 0
                    ? "text-[#ED75A0] font-medium"
                    : item.desviacion < 0
                      ? "text-[#333333] font-medium"
                      : "text-[#333333]";
                const isSelected = selectedExpenseCategory === item.categoria;
                const isLast = i === items.length - 1;
                const borderCls = isLast ? "" : "border-b border-[#E5E5E5]";
                return (
                  <tr
                    key={item.categoria}
                    className={`${borderCls} transition-colors duration-150 hover:bg-[#FAFAFA]`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedExpenseCategory(isSelected ? null : item.categoria)
                        }
                        className={`text-left font-sans text-sm transition-colors ${
                          isSelected
                            ? "font-medium text-[#9F99F8]"
                            : "text-[#333333] hover:text-[#9F99F8]"
                        }`}
                      >
                        {item.categoria}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {formatCurrency(item.gasto)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {formatCurrency(item.presupuesto)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${desvCls}`}>
                      {formatCurrency(item.desviacion)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {formatNumber(item.eventosCount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
