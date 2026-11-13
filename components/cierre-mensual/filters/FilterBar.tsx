"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, X } from "lucide-react";
import StandardMultiFilter, {
  type StandardFilterOption,
} from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import MontoModeToggle from "@/components/MontoModeToggle";
import { montoModeFrom } from "@/components/montoMode";
import {
  disponibles,
  enConflicto,
  filtrar,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { normalizarSeleccion } from "@/lib/filters/url";
import { FILTER_DEFINITIONS } from "@/lib/unabase/constants";
import { safeText } from "@/lib/unabase/formatting";
import { parseDateFlexible } from "@/lib/unabase/dates";
import { useDateFilter } from "@/components/cierre-mensual/context/DashboardContext";
import type { BusinessRow } from "@/lib/unabase/types";

interface Props {
  rows: BusinessRow[];
  onFilter: (filtered: BusinessRow[]) => void;
}

/**
 * Selección de cada filtro por `name` de FILTER_DEFINITIONS. Una key ausente o
 * un Set vacío = "Todos" (regla de lib/filters/facetas.ts).
 */
type Selections = Record<string, Set<string>>;

/**
 * Jerarquía de un solo sentido: Categoría Evento 2 → Categoría Evento → Evento.
 * Elegir un hijo no le esconde opciones al padre; el resto de los filtros se
 * acotan entre sí en las dos direcciones.
 */
const IGNORA: Record<string, readonly string[]> = {
  categoria: ["categoriaEvento1", "evento"],
  categoriaEvento1: ["evento"],
};

const FACETAS: Faceta<BusinessRow>[] = FILTER_DEFINITIONS.map((def) => ({
  key: def.name,
  valores: (row) => safeText(def.getValue(row)),
  ignora: IGNORA[def.name],
}));

const LABELS: Record<string, string> = Object.fromEntries(
  FILTER_DEFINITIONS.map((def) => [def.name, def.label]),
);

/** Temporada con la que abre el dashboard (si existe en los datos). */
const CATEGORIA_EVENTO_DEFAULT = "Piknic 25-26";

/** Selección vacía compartida (= "Todos"); nadie la muta. */
const EMPTY: Set<string> = new Set();

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

/**
 * Estado por defecto del dashboard: Categoría Evento = "Piknic 25-26" si esa
 * opción existe; si no, nada seleccionado (= todo).
 */
function buildDefaultSelections(baseOptions: Record<string, BaseOption[]>): Selections {
  const hasDefault = (baseOptions.categoriaEvento1 ?? []).some(
    (o) => o.value === CATEGORIA_EVENTO_DEFAULT,
  );
  return hasDefault ? { categoriaEvento1: new Set([CATEGORIA_EVENTO_DEFAULT]) } : {};
}

/** Igualdad de selecciones tratando ausente y vacío como lo mismo ("Todos"). */
function sameSelections(a: Selections, b: Selections): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const x = a[key];
    const y = b[key];
    const size = x?.size ?? 0;
    if (size !== (y?.size ?? 0)) return false;
    if (size === 0) continue;
    for (const v of x!) if (!y!.has(v)) return false;
  }
  return true;
}

export default function FilterBar({ rows, onFilter }: Props) {
  const searchParams = useSearchParams();
  const baseOptions = useMemo(() => buildBaseOptions(rows), [rows]);
  const defaultSelections = useMemo(() => buildDefaultSelections(baseOptions), [baseOptions]);
  const [selections, setSelections] = useState<Selections>(() =>
    buildDefaultSelections(baseOptions),
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

  // Valores compatibles de cada filtro con lo elegido en los otros (respeta la
  // jerarquía de IGNORA). Las fechas no acotan las opciones, como antes.
  const available = useMemo(() => disponibles(rows, FACETAS, selections), [rows, selections]);

  // Opciones de cada dropdown: las compatibles + las ya seleccionadas (aunque
  // hayan quedado incompatibles: se ven atenuadas para poder desmarcarlas), en
  // el orden de buildBaseOptions (evento por fecha) y con su label.
  const options = useMemo(() => {
    const result: Record<string, StandardFilterOption[]> = {};
    FILTER_DEFINITIONS.forEach((def) => {
      const base = baseOptions[def.name] ?? [];
      const labels = new Map(base.map((o) => [o.value, o.label]));
      result[def.name] = opcionesVisibles(
        base.map((o) => o.value),
        available[def.name] ?? new Set<string>(),
        selections[def.name],
      ).map((value) => ({ value, label: labels.get(value) ?? value }));
    });
    return result;
  }, [baseOptions, available, selections]);

  const filteredRows = useMemo(() => {
    const byFacets = filtrar(rows, FACETAS, selections);
    if (!dateStart && !dateEnd) return byFacets;
    return byFacets.filter((row) => {
      const ymd = normalizeToYMD(row.fechaAsignacion);
      if (!ymd) return true;
      if (dateStart && ymd < dateStart) return false;
      if (dateEnd && ymd > dateEnd) return false;
      return true;
    });
  }, [rows, selections, dateStart, dateEnd]);

  useEffect(() => {
    onFilter(filteredRows);
  }, [filteredRows, onFilter]);

  // Filtros que chocan entre sí cuando la combinación no deja ningún negocio.
  const conflicts = useMemo(
    () =>
      enConflicto(rows, FACETAS, selections).map((key) => ({
        key,
        label: LABELS[key] ?? key,
      })),
    [rows, selections],
  );

  // Cada filtro escribe solo su propia selección: nunca toca a los demás.
  // Marcar todos sus valores se guarda como "Todos" (normalizarSeleccion).
  const handleChange = (name: string, next: Set<string>) => {
    const lista = normalizarSeleccion(
      next,
      (baseOptions[name] ?? []).map((o) => o.value),
    );
    setSelections((prev) => {
      const out: Selections = { ...prev };
      if (lista.length === 0) delete out[name];
      else out[name] = new Set(lista);
      return out;
    });
  };

  const handleReset = () => {
    setSelections(defaultSelections);
    setDateStart("");
    setDateEnd("");
  };

  if (!rows.length) return null;

  const hasDateFilter = Boolean(dateStart || dateEnd);
  const canReset = hasDateFilter || !sameSelections(selections, defaultSelections);
  const montoMode = montoModeFrom(searchParams.get("monto"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {FILTER_DEFINITIONS.map((def) => (
          <StandardMultiFilter
            key={def.name}
            label={def.label}
            options={options[def.name] ?? []}
            available={available[def.name]}
            selected={selections[def.name] ?? EMPTY}
            onChange={(next) => handleChange(def.name, next)}
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

        {/* Vuelve al estado por defecto (Categoría Evento = Piknic 25-26, sin
            fechas). Solo se ve si hay algo distinto de ese estado. */}
        {canReset && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>
      <FilterConflictNotice
        conflicts={conflicts}
        onClear={(key) => handleChange(key, new Set())}
      />
    </div>
  );
}
