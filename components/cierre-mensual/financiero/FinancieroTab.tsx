"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { montoModeFrom } from "@/components/montoMode";
import { useDashboard } from "@/components/cierre-mensual/context/DashboardContext";
import { useEstructuraData } from "@/components/cierre-mensual/hooks/useEstructuraData";
import EstadoResultadosSection from "@/components/cierre-mensual/financiero/EstadoResultadosSection";
import AnalisisVerticalSection from "@/components/cierre-mensual/financiero/AnalisisVerticalSection";
import DevengoCajaSection from "@/components/cierre-mensual/financiero/DevengoCajaSection";
import { resolveFechaFinanciera, type PeriodGrain } from "@/lib/unabase/dates";
import { formatNumber } from "@/lib/unabase/formatting";
import type { BusinessRow } from "@/lib/unabase/types";

/**
 * Pestaña "Análisis financiero" — aplica el método de análisis de estados
 * financieros (análisis vertical, estado de resultados y devengo vs caja) a la
 * data de cierres. Los negocios se imputan al período de su FECHA DE
 * REALIZACIÓN (devengo: cuándo ocurrió el evento); si no existe, se usa la
 * fecha de asignación y se advierte cuántos negocios caen en ese fallback.
 * Los filtros superiores aplican igual que en el resto del dashboard (el rango
 * de fechas sigue filtrando por fecha de asignación).
 */

export interface FinBusiness {
  b: BusinessRow;
  /** Timestamp de la fecha financiera (realización → fallback asignación). */
  ts: number;
  usaFallback: boolean;
}

const GRAINS: { key: PeriodGrain; label: string }[] = [
  { key: "month", label: "Mes" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Año" },
];

export default function FinancieroTab() {
  const {
    filteredRows,
    filteredExpenseRows,
    negociosRows,
    negociosLoading,
    negociosError,
  } = useDashboard();
  const estructura = useEstructuraData();
  const [grain, setGrain] = useState<PeriodGrain>("quarter");
  const montoMode = montoModeFrom(useSearchParams().get("monto"));

  const { finRows, fallbackCount, sinFechaCount } = useMemo(() => {
    const rows: FinBusiness[] = [];
    let fallback = 0;
    let sinFecha = 0;
    filteredRows.forEach((b) => {
      const ff = resolveFechaFinanciera(b.fechaNegocio, b.fechaAsignacion);
      if (!Number.isFinite(ff.ts)) {
        sinFecha += 1;
        return;
      }
      if (ff.usaFallback) fallback += 1;
      rows.push({ b, ts: ff.ts, usaFallback: ff.usaFallback });
    });
    return { finRows: rows, fallbackCount: fallback, sinFechaCount: sinFecha };
  }, [filteredRows]);

  return (
    <motion.section
      key="financiero"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-sans text-xs text-[#666666]">Período</span>
          <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5">
            {GRAINS.map((g) => {
              const active = grain === g.key;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGrain(g.key)}
                  aria-pressed={active}
                  className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#F0EFFE] text-[#9F99F8]"
                      : "text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fallbackCount > 0 && (
            <Chip
              dot="#F6C544"
              text={`${formatNumber(fallbackCount)} negocios sin fecha de realización (imputados por asignación)`}
            />
          )}
          {sinFechaCount > 0 && (
            <Chip
              dot="#ED75A0"
              text={`${formatNumber(sinFechaCount)} negocios sin fecha válida (excluidos)`}
            />
          )}
          {montoMode === "bruto" && (
            <Chip
              dot="#EF8C34"
              text="Modo bruto activo: para análisis financiero se recomienda neto (el gasto siempre es neto)"
            />
          )}
        </div>
      </div>

      <p className="font-sans text-xs text-[#999999]">
        Cada negocio se imputa al período de su fecha de realización (devengo);
        si falta, se usa la fecha de asignación. El rango de fechas del filtro
        superior sigue filtrando por fecha de asignación, como en el resto del
        dashboard.
      </p>

      <EstadoResultadosSection
        finRows={finRows}
        estructura={estructura}
        grain={grain}
      />
      <AnalisisVerticalSection
        finRows={finRows}
        expenseRows={filteredExpenseRows}
        estructura={estructura}
        grain={grain}
      />
      <DevengoCajaSection
        finRows={finRows}
        negociosRows={negociosRows}
        negociosLoading={negociosLoading}
        negociosError={negociosError}
        grain={grain}
      />
    </motion.section>
  );
}

function Chip({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: dot }}
      />
      {text}
    </span>
  );
}
