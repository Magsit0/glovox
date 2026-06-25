"use client";

import { useMemo } from "react";
import { useExpenseUI, useFilters } from "@/components/cierre-mensual/context/DashboardContext";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";

const HEADERS = [
  { key: "sub", label: "Subcategoría", align: "left" as const },
  { key: "gasto", label: "Gasto", align: "right" as const },
  { key: "ppto", label: "Presupuesto", align: "right" as const },
  { key: "desv", label: "Desviación", align: "right" as const },
  { key: "eventos", label: "Eventos", align: "right" as const },
];

export default function ExpenseSubcategoryTable() {
  const { filteredExpenseRows } = useFilters();
  const { selectedExpenseCategory } = useExpenseUI();

  const items = useMemo(() => {
    if (!filteredExpenseRows.length || !selectedExpenseCategory) return null;
    const relevant = filteredExpenseRows.filter(
      (r) => r.categoriaGasto === selectedExpenseCategory,
    );
    if (!relevant.length) return [];

    const grouped = new Map<
      string,
      { subCategoria: string; gasto: number; presupuesto: number; eventos: Set<string> }
    >();
    relevant.forEach((row) => {
      const curr = grouped.get(row.subCategoria) ?? {
        subCategoria: row.subCategoria,
        gasto: 0,
        presupuesto: 0,
        eventos: new Set<string>(),
      };
      curr.gasto += row.gasto;
      curr.presupuesto += row.presupuesto;
      curr.eventos.add(row.nombre);
      grouped.set(row.subCategoria, curr);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        desviacion: item.gasto - item.presupuesto,
        eventosCount: item.eventos.size,
      }))
      .sort((a, b) => b.gasto - a.gasto);
  }, [filteredExpenseRows, selectedExpenseCategory]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
          Subcategorías
        </h2>
        {selectedExpenseCategory && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
            {selectedExpenseCategory}
          </span>
        )}
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
              {items === null && (
                <tr>
                  <td
                    colSpan={HEADERS.length}
                    className="px-4 py-8 text-center font-sans text-sm text-[#999999]"
                  >
                    Elige una categoría para ver subcategorías.
                  </td>
                </tr>
              )}
              {items && items.length === 0 && (
                <tr>
                  <td
                    colSpan={HEADERS.length}
                    className="px-4 py-8 text-center font-sans text-sm text-[#999999]"
                  >
                    La categoría abierta no tiene subcategorías visibles.
                  </td>
                </tr>
              )}
              {items?.map((item, i) => {
                const desvCls =
                  item.desviacion > 0
                    ? "text-[#ED75A0] font-medium"
                    : item.desviacion < 0
                      ? "text-[#333333] font-medium"
                      : "text-[#333333]";
                const isLast = i === items.length - 1;
                const borderCls = isLast ? "" : "border-b border-[#E5E5E5]";
                return (
                  <tr
                    key={item.subCategoria}
                    className={`${borderCls} transition-colors duration-150 hover:bg-[#FAFAFA]`}
                  >
                    <td className="px-4 py-3 text-[#333333]">{item.subCategoria}</td>
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
