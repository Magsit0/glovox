"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronDown, Inbox } from "lucide-react";
import { useDataset } from "@/components/cierre-mensual/context/DashboardContext";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import { seriesColor } from "@/lib/chart-colors";
import type { NegocioRow } from "@/lib/unabase/types";
import CierreNegocioLink from "@/components/cierre-mensual/CierreNegocioLink";

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Parsea fecha_asignacion (DD-MM-YYYY o YYYY-MM-DD) a {year, month(0-11), day}. */
function parseFecha(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || dateStr === "00-00-00" || dateStr === "Sin dato") return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("-");
    return { year: parseInt(y, 10), month: parseInt(m, 10) - 1, day: parseInt(d, 10) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return { year: parseInt(y, 10), month: parseInt(m, 10) - 1, day: parseInt(d, 10) };
  }
  const dt = new Date(dateStr);
  if (!isNaN(dt.getTime()))
    return { year: dt.getFullYear(), month: dt.getMonth(), day: dt.getDate() };
  return null;
}

const num = (v: string): number => parseFloat(v) || 0;

type Delta = { pct: number | null; tone: "up" | "down" | "flat" };

function computeDelta(curr: number, prev: number): Delta {
  if (prev <= 0) return { pct: null, tone: curr > 0 ? "up" : "flat" };
  const pct = ((curr - prev) / prev) * 100;
  return { pct, tone: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat" };
}

function DeltaBadge({ delta, prevLabel }: { delta: Delta; prevLabel: string }) {
  const dot =
    delta.tone === "up" ? "bg-[#B1D750]" : delta.tone === "down" ? "bg-[#ED75A0]" : "bg-[#999999]";
  const text =
    delta.pct === null
      ? "Sin base mes previo"
      : `${delta.pct >= 0 ? "+" : "−"}${Math.abs(delta.pct).toFixed(0)}% vs ${prevLabel}`;
  return (
    <span className="mt-3 inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#333333]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  prevLabel,
}: {
  label: string;
  value: string;
  delta: Delta;
  prevLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-4">
      <span className="font-sans text-xs text-[#666666]">{label}</span>
      <span className="mt-2 font-display text-3xl font-bold leading-none tracking-tight text-[#333333] tabular-nums">
        {value}
      </span>
      <DeltaBadge delta={delta} prevLabel={prevLabel} />
    </div>
  );
}

export default function MonthlyResultsPanel() {
  const { negociosRows, negociosLoading, negociosError } = useDataset();
  const [showList, setShowList] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const prev = new Date(year, month - 1, 1);
    const prevYear = prev.getFullYear();
    const prevMonth = prev.getMonth();

    let count = 0;
    let monto = 0;
    let prevCount = 0;
    let prevMonto = 0;
    const areaMap = new Map<string, { count: number; monto: number }>();
    const negocios: {
      id: string;
      referencia: string;
      cliente: string;
      area: string;
      fechaLabel: string;
      day: number;
      monto: number;
    }[] = [];

    for (const r of negociosRows as NegocioRow[]) {
      const f = parseFecha(r.fecha_asignacion);
      if (!f) continue;
      if (f.year === year && f.month === month) {
        const m = num(r.total_neto);
        count += 1;
        monto += m;
        const area = r.area_negocio || "Sin área";
        const a = areaMap.get(area) ?? { count: 0, monto: 0 };
        a.count += 1;
        a.monto += m;
        areaMap.set(area, a);
        negocios.push({
          id: r.id,
          referencia: r.referencia || "—",
          cliente: r.razon_cliente || "—",
          area,
          fechaLabel: `${f.day} ${MONTHS_ES[month].slice(0, 3)}`,
          day: f.day,
          monto: m,
        });
      } else if (f.year === prevYear && f.month === prevMonth) {
        prevCount += 1;
        prevMonto += num(r.total_neto);
      }
    }

    // Más recientes primero; a igual día, mayor monto primero.
    negocios.sort((a, b) => b.day - a.day || b.monto - a.monto);

    const areas = Array.from(areaMap, ([area, v]) => ({ area, ...v })).sort(
      (a, b) => b.monto - a.monto,
    );
    const ticket = count > 0 ? monto / count : 0;
    const prevTicket = prevCount > 0 ? prevMonto / prevCount : 0;

    return {
      monthLabel: `${MONTHS_ES[month]} ${year}`,
      prevLabel: MONTHS_ES[prevMonth],
      count,
      monto,
      ticket,
      areas,
      negocios,
      maxAreaMonto: areas.length ? Math.max(...areas.map((a) => a.monto)) : 0,
      countDelta: computeDelta(count, prevCount),
      montoDelta: computeDelta(monto, prevMonto),
      ticketDelta: computeDelta(ticket, prevTicket),
    };
  }, [negociosRows]);

  const title = `Resultados de Glovox · ${stats.monthLabel.charAt(0).toUpperCase()}${stats.monthLabel.slice(1)}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-5 rounded-lg border border-[#E5E5E5] bg-white p-6"
    >
      <header className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0EFFE] text-[#9F99F8]">
          <CalendarDays className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-lg font-bold leading-tight tracking-tight text-[#333333]">
            {title}
          </h2>
          <span className="font-sans text-xs text-[#666666]">
            Negocios creados este mes (según fecha de asignación)
          </span>
        </div>
      </header>

      {negociosError ? (
        <p className="font-sans text-sm text-[#ED75A0]">{negociosError}</p>
      ) : negociosLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-[#F0F0F0]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi
              label="Negocios creados"
              value={formatNumber(stats.count)}
              delta={stats.countDelta}
              prevLabel={stats.prevLabel}
            />
            <Kpi
              label="Monto recaudado (neto)"
              value={compactCurrency(stats.monto)}
              delta={stats.montoDelta}
              prevLabel={stats.prevLabel}
            />
            <Kpi
              label="Ticket promedio"
              value={compactCurrency(stats.ticket)}
              delta={stats.ticketDelta}
              prevLabel={stats.prevLabel}
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-[#E5E5E5] pt-5">
            <span className="font-sans text-sm font-medium text-[#666666]">
              Desglose por área
            </span>
            {stats.areas.length === 0 ? (
              <div className="flex items-center gap-2 py-2 font-sans text-sm text-[#999999]">
                <Inbox className="h-4 w-4" />
                Sin negocios creados en {stats.monthLabel}.
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {stats.areas.map((a, i) => {
                  // Clamp a [0,100]: un total_neto negativo (nota de crédito)
                  // daría un ancho negativo, CSS inválido que rompe la barra.
                  const pct =
                    stats.maxAreaMonto > 0
                      ? Math.max(0, Math.min(100, (a.monto / stats.maxAreaMonto) * 100))
                      : 0;
                  const color = seriesColor(i);
                  return (
                    <li key={a.area} className="flex items-center gap-3">
                      <span className="w-48 shrink-0 truncate font-sans text-sm text-[#333333]">
                        {a.area}
                      </span>
                      <span className="w-24 shrink-0 font-sans text-xs text-[#666666] tabular-nums">
                        {formatNumber(a.count)} negocio{a.count === 1 ? "" : "s"}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F0F0]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span
                        className="w-20 shrink-0 text-right font-sans text-sm font-medium text-[#333333] tabular-nums"
                        title={formatCurrency(a.monto)}
                      >
                        {compactCurrency(a.monto)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {stats.negocios.length > 0 && (
            <div className="border-t border-[#E5E5E5] pt-4">
              <button
                type="button"
                onClick={() => setShowList((v) => !v)}
                aria-expanded={showList}
                className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-[#9F99F8] transition-colors hover:text-[#8780F0]"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showList ? "rotate-180" : ""}`}
                  strokeWidth={2.5}
                />
                {showList
                  ? "Ocultar negocios"
                  : `Ver negocios creados (${formatNumber(stats.negocios.length)})`}
              </button>

              <AnimatePresence initial={false}>
                {showList && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 overflow-auto rounded-lg border border-[#E5E5E5]">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                            <th className="whitespace-nowrap px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                              Negocio
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                              Cliente
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                              Área
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                              Fecha
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">
                              Monto (neto)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.negocios.map((n) => (
                            <tr
                              key={n.id}
                              className="border-b border-[#E5E5E5] transition-colors last:border-0 hover:bg-[#FAFAFA]"
                            >
                              <td className="px-4 py-3 font-sans text-sm text-[#333333]">
                                <CierreNegocioLink negocioIds={[n.id]}>
                                  {n.referencia}
                                </CierreNegocioLink>
                              </td>
                              <td className="px-4 py-3 font-sans text-sm text-[#333333]">
                                {n.cliente}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-sans text-sm text-[#666666]">
                                {n.area}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 font-sans text-sm text-[#666666]">
                                {n.fechaLabel}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right font-sans text-sm font-medium text-[#333333] tabular-nums">
                                {formatCurrency(n.monto)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
}
