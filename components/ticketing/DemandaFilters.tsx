"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { X } from "lucide-react";
import MultiSelectFilter from "@/components/unabase/filters/MultiSelectFilter";
import type { TicketingEventOption, DemandaGranularidad, DemandaMetrica } from "@/lib/queries/ticketing";
import type { ProyeccionMetodo } from "@/lib/ticketing/demanda-forecast";
import type { Country } from "@/lib/queries/comunidad";

interface Props {
  events: TicketingEventOption[];
  country: Country;
  countryLocked: boolean;
  granularidad: DemandaGranularidad;
  metrica: DemandaMetrica;
  proyeccion: ProyeccionMetodo;
}

const NONE = "__none__";

// Campos de glovox.categoriaEvento expuestos como filtros encadenados. El evento
// es el nivel más granular: value = eventoId, label = NombreGlovox.
type FacetField =
  | "categoriaEvento"
  | "categoriaEvento2"
  | "categoriaEvento3"
  | "temporada"
  | "eventoId";

const FACETS: { param: string; field: FacetField; label: string }[] = [
  { param: "categorias",  field: "categoriaEvento",  label: "Categoría de evento" },
  { param: "categorias2", field: "categoriaEvento2", label: "Categoría de evento 2" },
  { param: "categorias3", field: "categoriaEvento3", label: "Categoría de evento 3" },
  { param: "temporadas",  field: "temporada",        label: "Temporada" },
  { param: "eventos",     field: "eventoId",         label: "Evento" },
];

export default function DemandaFilters({
  events,
  country,
  countryLocked,
  granularidad,
  metrica,
  proyeccion,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  // Valores de la URL por faceta.
  const urlByFacet = useMemo(() => {
    const sp = new URLSearchParams(search);
    const m: Record<string, string[]> = {};
    for (const f of FACETS) m[f.param] = sp.getAll(f.param);
    return m;
  }, [search]);

  // Opciones por faceta. Las categorías/temporada usan el texto como value y label;
  // el evento usa eventoId como value y NombreGlovox como label.
  const optionsByField = useMemo(() => {
    const m = {} as Record<FacetField, { value: string; label: string }[]>;
    for (const f of FACETS) {
      if (f.field === "eventoId") {
        m[f.field] = events
          .filter((e) => e.eventoId)
          .map((e) => ({ value: e.eventoId, label: e.nombre || e.eventoId }))
          .sort((a, b) => a.label.localeCompare(b.label, "es"));
      } else {
        m[f.field] = [...new Set(events.map((e) => e[f.field]).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "es"))
          .map((v) => ({ value: v, label: v }));
      }
    }
    return m;
  }, [events]);

  // Universo de values por faceta (para detectar "todos" y construir la selección).
  const valuesByField = useMemo(() => {
    const m = {} as Record<FacetField, string[]>;
    for (const f of FACETS) m[f.field] = optionsByField[f.field].map((o) => o.value);
    return m;
  }, [optionsByField]);

  // Selección efectiva por campo: null = sin restricción (todos seleccionados).
  const effByField = useMemo(() => {
    const m = {} as Record<FacetField, Set<string> | null>;
    for (const f of FACETS) {
      const url = urlByFacet[f.param];
      if (url.length === 0) m[f.field] = null;
      else if (url.length === 1 && url[0] === NONE) m[f.field] = new Set<string>();
      else m[f.field] = new Set(url);
    }
    return m;
  }, [urlByFacet]);

  // Set que recibe el componente (vacío = ninguno; todos = todo el universo).
  const selectedByField = useMemo(() => {
    const m = {} as Record<FacetField, Set<string>>;
    for (const f of FACETS) {
      const eff = effByField[f.field];
      m[f.field] = eff === null ? new Set(valuesByField[f.field]) : eff;
    }
    return m;
  }, [effByField, valuesByField]);

  // Disponibilidad encadenada: para cada faceta, valores compatibles con la
  // selección de las OTRAS facetas (facets cruzados). Las incompatibles se atenúan.
  const availableByField = useMemo(() => {
    const m = {} as Record<FacetField, Set<string>>;
    for (const target of FACETS) {
      const out = new Set<string>();
      for (const e of events) {
        let ok = true;
        for (const other of FACETS) {
          if (other.field === target.field) continue;
          const sel = effByField[other.field];
          if (sel === null) continue;
          if (!sel.has(e[other.field])) {
            ok = false;
            break;
          }
        }
        if (ok && e[target.field]) out.add(e[target.field]);
      }
      m[target.field] = out;
    }
    return m;
  }, [events, effByField]);

  function commit(patch: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(search);
    params.set("tab", "demanda");
    for (const [key, value] of Object.entries(patch)) {
      params.delete(key);
      if (value !== null) {
        if (Array.isArray(value)) {
          for (const v of value) params.append(key, v);
        } else {
          params.set(key, value);
        }
      }
    }
    router.push(`/ticketing?${params.toString()}`, { scroll: false });
  }

  function onFacetChange(param: string, field: FacetField) {
    return (_name: string, next: Set<string>) => {
      const all = valuesByField[field];
      const value = next.size === all.length ? null : next.size === 0 ? [NONE] : [...next];
      commit({ [param]: value });
    };
  }

  function onGranularidadChange(g: DemandaGranularidad) {
    commit({ granularidad: g });
  }

  function onMetricaChange(m: DemandaMetrica) {
    commit({ metrica: m });
  }

  function onProyeccionChange(p: ProyeccionMetodo) {
    commit({ proyeccion: p === "ninguna" ? null : p });
  }

  function updateCountry(value: string | null) {
    const params = new URLSearchParams(search);
    params.set("tab", "demanda");
    if (value === null) params.delete("country");
    else params.set("country", value);
    router.push(`/ticketing?${params.toString()}`, { scroll: false });
  }

  const anyFacetActive = FACETS.some((f) => urlByFacet[f.param].length > 0);
  const hasActiveFilters =
    anyFacetActive ||
    country !== "all" ||
    granularidad !== "ISOWEEK" ||
    metrica !== "tickets" ||
    proyeccion !== "ninguna";

  const countryButtons: { id: Country; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "chile", label: "Chile" },
    { id: "peru", label: "Perú" },
  ];

  const granButtons: { id: DemandaGranularidad; label: string }[] = [
    { id: "ISOWEEK",   label: "Semana" },
    { id: "MONTH",     label: "Mes" },
    { id: "EVENTO",    label: "Evento" },
    { id: "CATEGORIA", label: "Categoría" },
  ];

  const metricaButtons: { id: DemandaMetrica; label: string }[] = [
    { id: "tickets", label: "Tickets" },
    { id: "venta", label: "Recaudación" },
  ];

  const proyeccionButtons: { id: ProyeccionMetodo; label: string }[] = [
    { id: "ninguna", label: "No" },
    { id: "lineal", label: "Lineal" },
    { id: "holt", label: "Holt" },
  ];

  const toggleGroup = "flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1";
  const toggleBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
      active ? "bg-[#F0EFFE] text-[#9F99F8]" : "text-[#666666] hover:text-[#333333]"
    }`;

  return (
    <section className="flex flex-col gap-4">
      {/* Fila 1: filtros de eventos (encadenados) */}
      <div className="flex flex-wrap items-end gap-3">
        {FACETS.map((f) =>
          optionsByField[f.field].length > 0 ? (
            <MultiSelectFilter
              key={f.param}
              name={f.param}
              label={f.label}
              options={optionsByField[f.field]}
              available={availableByField[f.field]}
              selected={selectedByField[f.field]}
              onChange={onFacetChange(f.param, f.field)}
            />
          ) : null,
        )}
      </div>

      {/* Fila 2: métrica, granularidad, proyección, país */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Métrica */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">Métrica</span>
          <div className={toggleGroup}>
            {metricaButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onMetricaChange(b.id)}
                className={toggleBtn(metrica === b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Granularidad */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">Granularidad</span>
          <div className={toggleGroup}>
            {granButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onGranularidadChange(b.id)}
                className={toggleBtn(granularidad === b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Proyección */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">Proyección</span>
          <div className={toggleGroup}>
            {proyeccionButtons.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onProyeccionChange(b.id)}
                className={toggleBtn(proyeccion === b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* País */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">País</span>
          <div className={toggleGroup}>
            {countryButtons.map((b) => {
              const isActive = country === b.id;
              const disabled = countryLocked && !isActive;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => updateCountry(b.id === "all" ? null : b.id)}
                  className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#F0EFFE] text-[#9F99F8]"
                      : disabled
                        ? "cursor-not-allowed text-[#E5E5E5]"
                        : "text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => router.push("/ticketing?tab=demanda", { scroll: false })}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>
    </section>
  );
}
