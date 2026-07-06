"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, X } from "lucide-react";
import MultiSelectFilter from "@/components/cierre-mensual/filters/MultiSelectFilter";
import MontoModeToggle from "@/components/MontoModeToggle";
import { montoModeFrom } from "@/components/montoMode";
import { FILTER_DEFINITIONS } from "@/lib/unabase/constants";
import { safeText } from "@/lib/unabase/formatting";
import { parseDateFlexible } from "@/lib/unabase/dates";
import { useDateFilter } from "@/components/cierre-mensual/context/DashboardContext";
import type { BusinessRow } from "@/lib/unabase/types";

interface Props {
  rows: BusinessRow[];
  onFilter: (filtered: BusinessRow[]) => void;
}

const DESCENDANTS: Record<string, string[]> = {
  categoria: ["categoria", "categoriaEvento1", "evento"],
  categoriaEvento1: ["categoriaEvento1", "evento"],
  evento: ["evento"],
  area: ["area"],
  estado: ["estado"],
};

function normalizeToYMD(dateStr: string): string | null {
  if (!dateStr || dateStr === "Sin dato") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("-");
    return `${y}-${m}-${d}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

type BaseOption = { value: string; label: string; date: string };

function buildBaseOptions(rows: BusinessRow[]): Record<string, BaseOption[]> {
  const result: Record<string, BaseOption[]> = {};
  FILTER_DEFINITIONS.forEach((def) => {
    const byValue = new Map<string, BaseOption>();
    rows.forEach((row) => {
      const value = safeText(def.getValue(row));
      const label = safeText(def.getLabel(row));
      if (!byValue.has(value)) byValue.set(value, { value, label, date: row.fechaAsignacion });
    });
    const opts = Array.from(byValue.values()).sort((a, b) => {
      if (def.name === "evento") {
        const diff = parseDateFlexible(a.date) - parseDateFlexible(b.date);
        if (diff !== 0) return diff;
      }
      return a.label.localeCompare(b.label, "es");
    });
    result[def.name] = opts;
  });
  return result;
}

function buildInitialSelections(
  rows: BusinessRow[],
  baseOptions: Record<string, BaseOption[]>,
): Record<string, Set<string>> {
  const initial: Record<string, Set<string>> = {};
  if (!rows.length) return initial;
  FILTER_DEFINITIONS.forEach((def) => {
    if (def.name === "evento") return;
    const opts = baseOptions[def.name] || [];
    if (def.name === "categoriaEvento1") {
      const defaultOpt = opts.find((o) => o.value === "Piknic 25-26");
      initial[def.name] = new Set(defaultOpt ? [defaultOpt.value] : opts.map((o) => o.value));
    } else {
      initial[def.name] = new Set(opts.map((o) => o.value));
    }
  });
  const matching = rows.filter((row) =>
    FILTER_DEFINITIONS.every((def) => {
      if (def.name === "evento") return true;
      const sel = initial[def.name];
      if (!sel) return true;
      if (sel.size === 0) return false;
      return sel.has(safeText(def.getValue(row)));
    }),
  );
  const eventoOpts = baseOptions["evento"] || [];
  const availableEventKeys = new Set(matching.map((row) => safeText(row.key)));
  initial["evento"] = new Set(
    eventoOpts.filter((o) => availableEventKeys.has(o.value)).map((o) => o.value),
  );
  return initial;
}

export default function FilterBar({ rows, onFilter }: Props) {
  const searchParams = useSearchParams();
  const baseOptions = useMemo(() => buildBaseOptions(rows), [rows]);
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() =>
    buildInitialSelections(rows, baseOptions),
  );
  const { dateStart, dateEnd, setDateStart, setDateEnd } = useDateFilter();

  // Años presentes en los datos (por fecha de asignación), descendente.
  const years = useMemo(() => {
    const set = new Set<number>();
    rows.forEach((row) => {
      const ymd = normalizeToYMD(row.fechaAsignacion);
      if (ymd) {
        const y = parseInt(ymd.slice(0, 4), 10);
        if (y >= 2000 && y <= 2100) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  // Un año está "seleccionado" si el rango de fecha es exactamente ese año.
  const selectedYear = useMemo(() => {
    for (const y of years) {
      if (dateStart === `${y}-01-01` && dateEnd === `${y}-12-31`) return y;
    }
    return null;
  }, [years, dateStart, dateEnd]);

  const toggleYear = (y: number) => {
    if (selectedYear === y) {
      setDateStart("");
      setDateEnd("");
    } else {
      setDateStart(`${y}-01-01`);
      setDateEnd(`${y}-12-31`);
    }
  };

  const availableOptions = useMemo(() => {
    const result: Record<string, Set<string>> = {};
    FILTER_DEFINITIONS.forEach((def) => {
      const ignore = new Set(DESCENDANTS[def.name] || [def.name]);
      const filtered = rows.filter((row) =>
        FILTER_DEFINITIONS.every((other) => {
          if (ignore.has(other.name)) return true;
          const sel = selections[other.name];
          if (!sel) return true;
          if (sel.size === 0) return false;
          return sel.has(safeText(other.getValue(row)));
        }),
      );
      result[def.name] = new Set(filtered.map((row) => safeText(def.getValue(row))));
    });
    return result;
  }, [rows, selections]);

  useEffect(() => {
    if (!rows.length || !Object.keys(selections).length) return;
    const filtered = rows.filter((row) => {
      const matches = FILTER_DEFINITIONS.every((def) => {
        const sel = selections[def.name];
        if (!sel) return true;
        if (sel.size === 0) return false;
        return sel.has(safeText(def.getValue(row)));
      });
      if (!matches) return false;
      if (dateStart || dateEnd) {
        const ymd = normalizeToYMD(row.fechaAsignacion);
        if (!ymd) return true;
        if (dateStart && ymd < dateStart) return false;
        if (dateEnd && ymd > dateEnd) return false;
      }
      return true;
    });
    onFilter(filtered);
  }, [selections, dateStart, dateEnd, rows, onFilter]);

  const handleChange = (name: string, newSet: Set<string>) => {
    setSelections((prev) => {
      const next: Record<string, Set<string>> = { ...prev, [name]: newSet };

      if (name === "categoria") {
        const cat1Def = FILTER_DEFINITIONS.find((d) => d.name === "categoriaEvento1")!;
        const rowsAfterCategoria = rows.filter((row) =>
          FILTER_DEFINITIONS.every((def) => {
            if (def.name === "categoriaEvento1" || def.name === "evento") return true;
            const sel = def.name === "categoria" ? newSet : next[def.name];
            if (!sel) return true;
            if (sel.size === 0) return false;
            return sel.has(safeText(def.getValue(row)));
          }),
        );
        const availCat1 = new Set(
          rowsAfterCategoria.map((row) => safeText(cat1Def.getValue(row))).filter((v) => v && v !== "Sin dato"),
        );
        const prevCat1 = prev["categoriaEvento1"] || new Set<string>();
        const intersected = new Set([...prevCat1].filter((v) => availCat1.has(v)));
        next["categoriaEvento1"] = intersected.size > 0 ? intersected : new Set(availCat1);

        const rowsAfterCat1 = rowsAfterCategoria.filter((row) =>
          next["categoriaEvento1"].has(safeText(cat1Def.getValue(row))),
        );
        const availEventKeys = new Set(rowsAfterCat1.map((row) => safeText(row.key)));
        const eventoOpts = baseOptions["evento"] || [];
        next["evento"] = new Set(
          eventoOpts.filter((o) => availEventKeys.has(o.value)).map((o) => o.value),
        );
      }

      if (name === "categoriaEvento1") {
        const matching = rows.filter((row) =>
          FILTER_DEFINITIONS.every((def) => {
            if (def.name === "evento") return true;
            const sel = def.name === "categoriaEvento1" ? newSet : next[def.name];
            if (!sel) return true;
            if (sel.size === 0) return false;
            return sel.has(safeText(def.getValue(row)));
          }),
        );
        const availEventKeys = new Set(matching.map((row) => safeText(row.key)));
        const eventoOpts = baseOptions["evento"] || [];
        next["evento"] = new Set(
          eventoOpts.filter((o) => availEventKeys.has(o.value)).map((o) => o.value),
        );
      }

      return next;
    });
  };

  const handleReset = () => {
    const reset: Record<string, Set<string>> = {};
    FILTER_DEFINITIONS.forEach((def) => {
      if (def.name === "evento") return;
      const opts = baseOptions[def.name] || [];
      if (def.name === "categoriaEvento1") {
        const defaultOpt = opts.find((o) => o.value === "Piknic 25-26");
        reset[def.name] = new Set(defaultOpt ? [defaultOpt.value] : opts.map((o) => o.value));
      } else {
        reset[def.name] = new Set(opts.map((o) => o.value));
      }
    });
    const matching = rows.filter((row) =>
      FILTER_DEFINITIONS.every((def) => {
        if (def.name === "evento") return true;
        const sel = reset[def.name];
        if (!sel) return true;
        if (sel.size === 0) return false;
        return sel.has(safeText(def.getValue(row)));
      }),
    );
    const eventoOpts = baseOptions["evento"] || [];
    const availableEventKeys = new Set(matching.map((row) => safeText(row.key)));
    reset["evento"] = new Set(
      eventoOpts.filter((o) => availableEventKeys.has(o.value)).map((o) => o.value),
    );
    setSelections(reset);
    setDateStart("");
    setDateEnd("");
  };

  if (!rows.length) return null;

  const hasDateFilter = Boolean(dateStart || dateEnd);
  const montoMode = montoModeFrom(searchParams.get("monto"));

  return (
    <div className="flex flex-wrap items-end gap-3">
      {FILTER_DEFINITIONS.map((def) => (
        <MultiSelectFilter
          key={def.name}
          name={def.name}
          label={def.label}
          options={baseOptions[def.name] || []}
          available={availableOptions[def.name] || new Set()}
          selected={selections[def.name] || new Set()}
          onChange={handleChange}
        />
      ))}

      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-xs text-[#666666]">Fecha de asignación</span>
        <div className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 transition-colors hover:border-[#333333] focus-within:border-[#9F99F8] focus-within:ring-1 focus-within:ring-[#9F99F8]">
          <Calendar className="h-4 w-4 shrink-0 text-[#666666]" />
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="border-0 bg-transparent font-sans text-sm text-[#333333] focus:outline-none"
          />
          <span className="font-sans text-xs text-[#999999]">→</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="border-0 bg-transparent font-sans text-sm text-[#333333] focus:outline-none"
          />
          {hasDateFilter && (
            <button
              type="button"
              onClick={() => {
                setDateStart("");
                setDateEnd("");
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#999999] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
              aria-label="Limpiar fechas"
              title="Limpiar fechas"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {years.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">Año</span>
          <div className="flex max-w-[12.5rem] items-center gap-1.5 overflow-x-auto overflow-y-hidden">
            {years.map((y) => {
              const active = selectedYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => toggleYear(y)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-lg px-3 py-1.5 font-sans text-sm font-medium tabular-nums transition-colors ${
                    active
                      ? "border border-[#9F99F8] bg-[#9F99F8] text-white"
                      : "border border-[#E5E5E5] bg-white text-[#666666] hover:border-[#333333] hover:text-[#333333]"
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Switch neto/bruto: afecta el ingreso (venta_neta / venta_bruta de la
          vista); el gasto del presupuesto es neto por diseño. */}
      <MontoModeToggle value={montoMode} />

      <button
        type="button"
        onClick={handleReset}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
      >
        <X className="h-3.5 w-3.5" />
        Limpiar filtros
      </button>
    </div>
  );
}
