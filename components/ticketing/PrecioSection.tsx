"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { TicketingPrecioMatrizRow } from "@/lib/queries/ticketing";

interface Props {
  rows: TicketingPrecioMatrizRow[];
}

type Acc = { qtty: number; venta: number };
type Metric = "promedio" | "cantidad" | "venta";

const METRIC_OPTIONS: { id: Metric; label: string }[] = [
  { id: "promedio", label: "Precio promedio" },
  { id: "cantidad", label: "Cantidad" },
  { id: "venta", label: "Venta" },
];

function valueOf(a: Acc | undefined, metric: Metric): number | null {
  if (!a || a.qtty === 0) return null;
  if (metric === "promedio") return a.venta / a.qtty;
  if (metric === "cantidad") return a.qtty;
  return a.venta;
}

function formatValue(v: number | null, metric: Metric): string {
  if (v === null) return "—";
  if (metric === "cantidad") return formatNumber(v);
  return formatCurrency(v);
}

/**
 * Heat suave en rojo, escala lineal sobre el máximo de las celdas (sin
 * incluir totales, que distorsionarían la escala). Alpha máx 0.38 para
 * que el texto siga siendo legible.
 */
function heatBg(v: number | null, max: number): string {
  if (v === null || max <= 0) return "transparent";
  const ratio = Math.max(0, Math.min(1, v / max));
  const alpha = ratio * 0.38;
  return `rgba(237, 75, 75, ${alpha})`;
}

export default function PrecioSection({ rows }: Props) {
  const [metric, setMetric] = useState<Metric>("promedio");
  const [showTotals, setShowTotals] = useState(true);
  const [showPct, setShowPct] = useState(false);

  const { categorias, tipos, cell, tipoTotal, catTotal, grand } = useMemo(() => {
    const cell = new Map<string, Acc>();
    const tipoTotal = new Map<string, Acc>();
    const catTotal = new Map<string, Acc>();
    const grand: Acc = { qtty: 0, venta: 0 };

    for (const r of rows) {
      cell.set(`${r.tipoTicket}|||${r.categoriaTicket}`, {
        qtty: r.qtty,
        venta: r.venta,
      });
      const tt = tipoTotal.get(r.tipoTicket) ?? { qtty: 0, venta: 0 };
      tt.qtty += r.qtty;
      tt.venta += r.venta;
      tipoTotal.set(r.tipoTicket, tt);

      const ct = catTotal.get(r.categoriaTicket) ?? { qtty: 0, venta: 0 };
      ct.qtty += r.qtty;
      ct.venta += r.venta;
      catTotal.set(r.categoriaTicket, ct);

      grand.qtty += r.qtty;
      grand.venta += r.venta;
    }

    const categorias = [...new Set(rows.map((r) => r.categoriaTicket))].sort();
    const tipos = [...tipoTotal.keys()].sort(
      (a, b) => (tipoTotal.get(b)?.qtty ?? 0) - (tipoTotal.get(a)?.qtty ?? 0),
    );
    return { categorias, tipos, cell, tipoTotal, catTotal, grand };
  }, [rows]);

  // Máximo sobre celdas (no totales) para escalar el heat.
  const maxCell = useMemo(() => {
    let max = 0;
    for (const a of cell.values()) {
      const v = valueOf(a, metric);
      if (v !== null && v > max) max = v;
    }
    return max;
  }, [cell, metric]);

  // El % sobre el total sólo aplica a métricas aditivas (no a un promedio).
  const pctEnabled = metric !== "promedio";
  const showPctEffective = showPct && pctEnabled;
  const grandValue =
    metric === "venta" ? grand.venta : metric === "cantidad" ? grand.qtty : 0;

  function pct(v: number | null): string | null {
    if (v === null || grandValue <= 0) return null;
    return `${((v / grandValue) * 100).toFixed(1)}%`;
  }

  function cellContent(v: number | null) {
    return (
      <div className="flex flex-col items-end leading-tight">
        <span>{formatValue(v, metric)}</span>
        {showPctEffective && v !== null && (
          <span className="mt-0.5 text-[11px] font-normal text-[#999999]">
            {pct(v)}
          </span>
        )}
      </div>
    );
  }

  const subtitle =
    metric === "promedio"
      ? "Precio neto promedio (venta / cantidad) en cada cruce de tipo de ticket (filas) y categoría de ticket (columnas)."
      : metric === "cantidad"
        ? "Cantidad de tickets en cada cruce de tipo (filas) y categoría (columnas)."
        : "Venta neta total en cada cruce de tipo (filas) y categoría (columnas).";

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Matriz de tipo × categoría
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1">
            {METRIC_OPTIONS.map((m) => {
              const isActive = metric === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#F0EFFE] text-[#9F99F8]"
                      : "text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={showTotals}
              onChange={(e) => setShowTotals(e.target.checked)}
              className="h-4 w-4 rounded border-[#E5E5E5] accent-[#9F99F8]"
            />
            <span className="font-sans text-sm text-[#333333]">
              Mostrar totales
            </span>
          </label>

          <label
            className={`flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 ${
              pctEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
            title={
              pctEnabled
                ? "Muestra qué fracción del total representa cada celda"
                : "No aplica sobre un promedio"
            }
          >
            <input
              type="checkbox"
              checked={showPctEffective}
              disabled={!pctEnabled}
              onChange={(e) => setShowPct(e.target.checked)}
              className="h-4 w-4 rounded border-[#E5E5E5] accent-[#9F99F8]"
            />
            <span className="font-sans text-sm text-[#333333]">% sobre total</span>
          </label>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">
          Sin tickets para los filtros seleccionados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-[#666666]">
                <th className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide">
                  Tipo \ Categoría
                </th>
                {categorias.map((c) => (
                  <th
                    key={c}
                    className="py-2 px-4 text-right text-xs font-medium uppercase tracking-wide"
                  >
                    {c}
                  </th>
                ))}
                {showTotals && (
                  <th className="py-2 pl-4 text-right text-xs font-medium uppercase tracking-wide">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <tr
                  key={tipo}
                  className="border-b border-[#F0F0F0] last:border-b-0"
                >
                  <td className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-[#333333]">
                    {tipo}
                  </td>
                  {categorias.map((c) => {
                    const a = cell.get(`${tipo}|||${c}`);
                    const v = valueOf(a, metric);
                    return (
                      <td
                        key={c}
                        style={{ backgroundColor: heatBg(v, maxCell) }}
                        className={`py-2 px-4 text-right tabular-nums transition-colors ${
                          v !== null ? "text-[#333333]" : "text-[#999999]"
                        }`}
                      >
                        {cellContent(v)}
                      </td>
                    );
                  })}
                  {showTotals && (
                    <td className="py-2 pl-4 text-right font-medium tabular-nums text-[#333333]">
                      {cellContent(valueOf(tipoTotal.get(tipo), metric))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {showTotals && (
              <tfoot>
                <tr className="border-t-2 border-[#333333] font-medium">
                  <td className="sticky left-0 z-10 bg-white py-2 pr-4 text-left text-[#333333]">
                    Total
                  </td>
                  {categorias.map((c) => (
                    <td
                      key={c}
                      className="py-2 px-4 text-right tabular-nums text-[#333333]"
                    >
                      {cellContent(valueOf(catTotal.get(c), metric))}
                    </td>
                  ))}
                  <td className="py-2 pl-4 text-right tabular-nums text-[#333333]">
                    {cellContent(valueOf(grand, metric))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </article>
  );
}
