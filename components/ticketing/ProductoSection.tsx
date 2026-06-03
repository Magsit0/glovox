"use client";

import { useMemo, useState } from "react";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import type { TicketingProductoRow } from "@/lib/queries/ticketing";
import SnakeBar from "@/components/ticketing/SnakeBar";

interface Props {
  title: string;
  subtitle: string;
  rows: TicketingProductoRow[];
  /** Encabezado de la primera columna (p. ej. "Tipo de ticket"). */
  columnLabel: string;
}

type Metric = "venta" | "cantidad" | "promedio";

const MAX_ROWS = 3; // debe coincidir con SnakeBar.MAX_ROWS

const METRICS: { id: Metric; label: string }[] = [
  { id: "venta", label: "Venta" },
  { id: "cantidad", label: "Cantidad" },
  { id: "promedio", label: "Promedio" },
];

function metricValue(r: TicketingProductoRow, m: Metric): number {
  if (m === "venta") return r.venta;
  if (m === "cantidad") return r.qtty;
  return r.qtty > 0 ? r.venta / r.qtty : 0;
}

/** Etiqueta compacta (sobre la barra). */
function fmtShort(v: number, m: Metric): string {
  return m === "cantidad" ? formatNumber(v) : compactCurrency(v);
}

/** Etiqueta completa (fila de total). */
function fmtFull(v: number, m: Metric): string {
  return m === "cantidad" ? formatNumber(v) : formatCurrency(v);
}

export default function ProductoSection({
  title,
  subtitle,
  rows,
  columnLabel,
}: Props) {
  const [metric, setMetric] = useState<Metric>("venta");

  const view = useMemo(() => {
    const totalVenta = rows.reduce((a, r) => a + r.venta, 0);
    const totalQtty = rows.reduce((a, r) => a + r.qtty, 0);

    // Ranking por la métrica activa.
    const sorted = [...rows].sort(
      (a, b) => metricValue(b, metric) - metricValue(a, metric),
    );
    const ranked = sorted.slice(0, 15);
    const maxMetric = ranked.reduce(
      (m, r) => Math.max(m, metricValue(r, metric)),
      0,
    );

    // % secundario según la métrica (las aditivas usan share del total).
    const pctHeader =
      metric === "venta"
        ? "% Venta"
        : metric === "cantidad"
          ? "% Tickets"
          : "vs máx";
    const pctOf = (r: TicketingProductoRow): number => {
      if (metric === "venta") return totalVenta > 0 ? (r.venta / totalVenta) * 100 : 0;
      if (metric === "cantidad") return totalQtty > 0 ? (r.qtty / totalQtty) * 100 : 0;
      return maxMetric > 0 ? (metricValue(r, metric) / maxMetric) * 100 : 0;
    };

    // Total: aditivo para venta/cantidad; promedio ponderado para promedio.
    const totalMain =
      metric === "venta"
        ? totalVenta
        : metric === "cantidad"
          ? totalQtty
          : totalQtty > 0
            ? totalVenta / totalQtty
            : 0;
    const totalPct = metric === "promedio" ? "—" : "100%";

    return {
      ranked,
      unitMax: maxMetric / MAX_ROWS,
      pctHeader,
      pctOf,
      totalMain,
      totalPct,
    };
  }, [rows, metric]);

  const subtitleByMetric =
    metric === "venta"
      ? subtitle
      : metric === "cantidad"
        ? "Cantidad de tickets por producto, ordenado de mayor a menor."
        : "Precio neto promedio por ticket (venta / cantidad), ordenado de mayor a menor.";

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            {title}
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">{subtitleByMetric}</p>
        </div>

        <div className="flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1">
          {METRICS.map((m) => {
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
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">
          Sin tickets para los filtros seleccionados.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Encabezado del ranking */}
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_minmax(0,2fr)] items-center gap-3 border-b border-[#E5E5E5] pb-2 font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
            <span>#</span>
            <span>{columnLabel}</span>
            <span className="text-right">{view.pctHeader}</span>
            <span>{METRICS.find((m) => m.id === metric)?.label}</span>
          </div>

          {/* Filas ranking */}
          <ul className="flex flex-col gap-4">
            {view.ranked.map((r, i) => {
              const v = metricValue(r, metric);
              return (
                <li
                  key={r.label}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_minmax(0,2fr)] items-start gap-3"
                >
                  <span className="font-sans text-sm tabular-nums leading-[14px] text-[#999999]">
                    {i + 1}.
                  </span>
                  <span
                    className="truncate font-sans text-sm leading-[14px] text-[#333333]"
                    title={`${r.label} · ${formatNumber(r.qtty)} tickets · ${formatCurrency(r.venta)}`}
                  >
                    {r.label}
                  </span>
                  <span className="text-right font-sans text-sm leading-[14px] tabular-nums text-[#666666]">
                    {view.pctOf(r).toFixed(1)}%
                  </span>
                  <SnakeBar
                    value={v}
                    unitMax={view.unitMax}
                    label={fmtShort(v, metric)}
                  />
                </li>
              );
            })}
          </ul>

          {rows.length > view.ranked.length && (
            <p className="font-sans text-xs text-[#999999]">
              Mostrando top {view.ranked.length} de {formatNumber(rows.length)}.
            </p>
          )}

          {/* Total */}
          <div className="mt-2 grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_minmax(0,2fr)] items-center gap-3 border-t-2 border-[#333333] pt-3 font-sans text-sm font-medium text-[#333333]">
            <span />
            <span>
              {metric === "promedio" ? "Promedio global" : `Total (${formatNumber(rows.length)})`}
            </span>
            <span className="text-right tabular-nums">{view.totalPct}</span>
            <span className="tabular-nums">{fmtFull(view.totalMain, metric)}</span>
          </div>
        </div>
      )}
    </article>
  );
}
