"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { FfbbBarraRow } from "@/lib/ffbb/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  rows: FfbbBarraRow[];
}

type SortKey = "nombreBarra" | "ventas" | "unidades" | "transacciones" | "ticketPromedio";
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "nombreBarra", label: "Barra", align: "left" },
  { key: "ventas", label: "Ventas", align: "right" },
  { key: "unidades", label: "Unidades", align: "right" },
  { key: "transacciones", label: "Transacciones", align: "right" },
  { key: "ticketPromedio", label: "Ticket promedio", align: "right" },
];

export default function VentasPorBarraTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("ventas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "es-CL");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "nombreBarra" ? "asc" : "desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 text-[#999999]" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[#333333]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#333333]" />
    );
  }

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Ventas por barra
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Desglose por punto de venta. Click en la columna para ordenar.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 font-medium text-[#666666] ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onHeaderClick(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-[#333333] ${
                      col.align === "right" ? "ml-auto" : ""
                    }`}
                  >
                    {col.label}
                    {sortIcon(col.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-[#666666]">
                  Sin ventas por barra.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.nombreBarra}
                  className="border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[#333333]">
                    {row.nombreBarra}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]"
                    title={formatCurrency(row.ventas)}
                  >
                    {compactCurrency(row.ventas)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                    {formatNumber(row.unidades)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                    {formatNumber(row.transacciones)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                    {formatCurrency(row.ticketPromedio)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
