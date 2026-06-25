"use client";

import { useMemo } from "react";
import { useFilters } from "@/components/cierre-mensual/context/DashboardContext";
import { compactCurrency } from "@/lib/unabase/formatting";
import { sortRowsByFechaAsc } from "@/lib/unabase/dates";
import type { BusinessRow } from "@/lib/unabase/types";

type Health = "ok" | "risk" | "bad";

function getHealth(row: BusinessRow): Health {
  const margenPct = row.margenPct;
  const gastoPptoPct = row.presupuesto > 0 ? row.gasto / row.presupuesto : 0;
  const facturacionPct = row.ingreso > 0 ? row.facturado / row.ingreso : 1;
  if (margenPct < 0 || (row.presupuesto > 0 && row.gasto > row.presupuesto)) return "bad";
  if (gastoPptoPct > 0.9 || facturacionPct < 0.4) return "risk";
  return "ok";
}

function healthPill(h: Health) {
  if (h === "bad") return { dot: "bg-[#ED75A0]", label: "Crítico" };
  if (h === "risk") return { dot: "bg-[#F6C544]", label: "Riesgo" };
  return { dot: "bg-[#B1D750]", label: "OK" };
}

const HEADERS = [
  { key: "negocio", label: "Negocio", align: "left" as const },
  { key: "estado", label: "Estado", align: "left" as const },
  { key: "fecha", label: "Fecha", align: "left" as const },
  { key: "ingreso", label: "Ingreso", align: "right" as const },
  { key: "facturado", label: "Facturado", align: "right" as const },
  { key: "gasto", label: "Gasto", align: "right" as const },
  { key: "ppto", label: "Ppto", align: "right" as const },
  { key: "vsPpto", label: "vs ppto", align: "right" as const },
  { key: "margen", label: "Margen", align: "right" as const },
  { key: "margenPct", label: "Ut. %", align: "right" as const },
  { key: "salud", label: "Salud", align: "center" as const },
];

export default function SummaryBusinessTable() {
  const { filteredRows } = useFilters();
  const ordered = useMemo(() => sortRowsByFechaAsc(filteredRows), [filteredRows]);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
          Resumen por negocio
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
              {ordered.length === 0 && (
                <tr>
                  <td
                    colSpan={HEADERS.length}
                    className="px-4 py-8 text-center font-sans text-sm text-[#999999]"
                  >
                    Sin negocios con los filtros actuales.
                  </td>
                </tr>
              )}
              {ordered.map((row, i) => {
                const vsPpto = row.presupuesto > 0 ? row.gasto - row.presupuesto : null;
                const vsPptoPct =
                  row.presupuesto > 0 ? ((row.gasto / row.presupuesto) * 100).toFixed(1) : null;
                let vsText = "—";
                let vsCls = "text-[#333333]";
                if (vsPpto !== null) {
                  if (vsPpto > 0) {
                    vsText = `+${compactCurrency(vsPpto)} (${vsPptoPct}%)`;
                    vsCls = "text-[#ED75A0] font-medium";
                  } else if (row.gasto > row.presupuesto * 0.9) {
                    vsText = `${vsPptoPct}%`;
                    vsCls = "text-[#EF8C34] font-medium";
                  } else {
                    vsText = `${vsPptoPct}%`;
                  }
                }
                const marginCls =
                  row.margen >= 0 ? "text-[#333333] font-medium" : "text-[#ED75A0] font-medium";
                const health = getHealth(row);
                const pill = healthPill(health);
                const isLast = i === ordered.length - 1;
                const borderCls = isLast ? "" : "border-b border-[#E5E5E5]";

                return (
                  <tr
                    key={row.key}
                    className={`${borderCls} transition-colors duration-150 hover:bg-[#FAFAFA]`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#333333]">{row.nombre}</div>
                      <div className="font-sans text-xs text-[#999999]">{row.EventoID}</div>
                    </td>
                    <td className="px-4 py-3 text-[#333333]">{row.estado}</td>
                    <td className="px-4 py-3 text-[#666666]">{row.fechaAsignacion}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {compactCurrency(row.ingresoProrrateado)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {compactCurrency(row.facturado)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {compactCurrency(row.gasto)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#333333]">
                      {compactCurrency(row.presupuesto)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${vsCls}`}>{vsText}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${marginCls}`}>
                      {compactCurrency(row.margen)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${marginCls}`}>
                      {(row.margenPct * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
                        <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
                        {pill.label}
                      </span>
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
