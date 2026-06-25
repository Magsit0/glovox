"use client";

import { useMemo, type ReactNode } from "react";
import { useFilters } from "@/components/cierre-mensual/context/DashboardContext";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { BusinessRow } from "@/lib/unabase/types";

type Severity = "critical" | "warning";

interface Alert {
  severity: Severity;
  label: string;
  text: ReactNode;
  meta: string;
}

function generateAlerts(rows: BusinessRow[]): Alert[] {
  const alerts: Alert[] = [];

  rows
    .filter((r) => r.margen < 0)
    .forEach((r) => {
      alerts.push({
        severity: "critical",
        label: "Pérdida neta",
        text: (
          <>
            <strong className="font-medium">{r.nombre}</strong> opera con margen negativo de{" "}
            <strong className="font-medium">{formatCurrency(r.margen)}</strong>.
          </>
        ),
        meta: `${r.area_negocio} · ${r.cat2 || ""} · ${r.estado}`,
      });
    });

  rows
    .filter((r) => r.presupuesto > 0 && r.gasto > r.presupuesto)
    .forEach((r) => {
      const pct = ((r.gasto / r.presupuesto - 1) * 100).toFixed(1);
      alerts.push({
        severity: "critical",
        label: "Sobrepresupuesto",
        text: (
          <>
            <strong className="font-medium">{r.nombre}</strong> supera el presupuesto en{" "}
            <strong className="font-medium">{formatCurrency(r.desviacion)}</strong> (+{pct}%).
          </>
        ),
        meta: `Gasto ${compactCurrency(r.gasto)} · Ppto ${compactCurrency(r.presupuesto)}`,
      });
    });

  rows
    .filter((r) => r.presupuesto > 0 && r.gasto > r.presupuesto * 0.9 && r.gasto <= r.presupuesto)
    .forEach((r) => {
      const pct = ((r.gasto / r.presupuesto) * 100).toFixed(1);
      alerts.push({
        severity: "warning",
        label: "Riesgo sobregiro",
        text: (
          <>
            <strong className="font-medium">{r.nombre}</strong> consumió el{" "}
            <strong className="font-medium">{pct}%</strong> del presupuesto.
          </>
        ),
        meta: `Disponible ${formatCurrency(r.presupuesto - r.gasto)}`,
      });
    });

  const sinFacturar = rows.filter((r) => r.ingreso > 0 && r.facturado / r.ingreso < 0.4);
  if (sinFacturar.length > 0) {
    const totalExpuesto = sinFacturar.reduce((s, r) => s + (r.ingreso - r.facturado), 0);
    alerts.push({
      severity: "warning",
      label: "Facturación pendiente",
      text: (
        <>
          <strong className="font-medium">
            {sinFacturar.length} negocio{sinFacturar.length > 1 ? "s" : ""}
          </strong>{" "}
          con menos del 40% facturado — exposición{" "}
          <strong className="font-medium">{formatCurrency(totalExpuesto)}</strong>.
        </>
      ),
      meta:
        sinFacturar.slice(0, 3).map((r) => r.nombre).join(" · ") +
        (sinFacturar.length > 3 ? ` +${sinFacturar.length - 3} más` : ""),
    });
  }

  const totalGasto = rows.reduce((s, r) => s + r.gasto, 0);
  const totalPpto = rows.reduce((s, r) => s + r.presupuesto, 0);
  if (totalPpto > 0 && totalGasto > totalPpto) {
    const pctGlobal = ((totalGasto / totalPpto - 1) * 100).toFixed(1);
    alerts.unshift({
      severity: "critical",
      label: "Sobregiro global",
      text: (
        <>
          El gasto total supera el presupuesto consolidado en{" "}
          <strong className="font-medium">{pctGlobal}%</strong> (+
          {formatCurrency(totalGasto - totalPpto)}).
        </>
      ),
      meta: `Gasto ${compactCurrency(totalGasto)} · Ppto ${compactCurrency(totalPpto)}`,
    });
  }

  return alerts.slice(0, 10);
}

export default function AlertsPanel() {
  const { filteredRows } = useFilters();
  const alerts = useMemo(() => generateAlerts(filteredRows), [filteredRows]);

  if (!alerts.length) return null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center gap-3">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
          Alertas
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ED75A0]" />
          {alerts.length}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {alerts.map((a, i) => {
          const borderColor = a.severity === "critical" ? "border-[#ED75A0]" : "border-[#F6C544]";
          const dotColor = a.severity === "critical" ? "bg-[#ED75A0]" : "bg-[#F6C544]";
          const statusText = a.severity === "critical" ? "Crítico" : "Atención";
          return (
            <div
              key={i}
              className={`flex flex-col gap-2 rounded-lg border-l-4 ${borderColor} border border-[#E5E5E5] bg-white p-4`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-sans text-xs font-medium text-[#666666]">{a.label}</div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-[10px] font-medium text-[#333333]">
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                  {statusText}
                </span>
              </div>
              <div className="font-sans text-sm text-[#333333]">{a.text}</div>
              <div className="font-sans text-xs text-[#999999]">{a.meta}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
