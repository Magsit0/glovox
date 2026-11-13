"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import { useQueryFiltros } from "@/components/filters/useQueryFiltros";
import {
  disponibles,
  enConflicto,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { escribirSeleccion, leerSeleccion, normalizarSeleccion } from "@/lib/filters/url";
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

// Encadenadas en las dos direcciones (lib/filters/facetas.ts): lo elegido en
// cualquier faceta acota las opciones de todas las demás. Ninguna modifica la
// selección de otra: cada una escribe solo su param.
const FACETAS: Faceta<TicketingEventOption>[] = FACETS.map((f) => ({
  key: f.param,
  valores: (e) => e[f.field],
}));

const LABEL_POR_PARAM: Record<string, string> = Object.fromEntries(
  FACETS.map((f) => [f.param, f.label]),
);

export default function DemandaFilters({
  events,
  country,
  countryLocked,
  granularidad,
  metrica,
  proyeccion,
}: Props) {
  // Query vigente (el último cambio pedido aunque la navegación no haya
  // terminado), para que dos cambios seguidos se sumen.
  const { search, navegar } = useQueryFiltros("/ticketing");

  // Selección por faceta desde la URL (params repetidos). Vacía = "Todos".
  const sel = useMemo(() => {
    const sp = new URLSearchParams(search);
    const m: Record<string, Set<string>> = {};
    for (const f of FACETS) m[f.param] = leerSeleccion(sp, f.param);
    return m;
  }, [search]);

  // Universo de valores por faceta, en el orden del dropdown. Las categorías y
  // la temporada van en orden alfabético; el evento, por nombre.
  const todasPorParam = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const f of FACETS) {
      m[f.param] =
        f.field === "eventoId"
          ? events
              .filter((e) => e.eventoId)
              .sort((a, b) =>
                (a.nombre || a.eventoId).localeCompare(b.nombre || b.eventoId, "es"),
              )
              .map((e) => e.eventoId)
          : [...new Set(events.map((e) => e[f.field]).filter(Boolean))].sort((a, b) =>
              a.localeCompare(b, "es"),
            );
    }
    return m;
  }, [events]);

  // Label del evento = NombreGlovox; un ID fuera del catálogo (link viejo,
  // cambio de país) se muestra con su ID.
  const nombrePorEvento = useMemo(
    () => new Map(events.map((e) => [e.eventoId, e.nombre || e.eventoId])),
    [events],
  );

  // Encadenamiento: valores compatibles con lo elegido en las otras facetas.
  const disp = useMemo(() => disponibles(events, FACETAS, sel), [events, sel]);

  // Opciones visibles = compatibles + ya seleccionadas (estas últimas atenuadas
  // si quedaron incompatibles, para poder desmarcarlas).
  const opcionesPorParam = useMemo(() => {
    const m: Record<string, { value: string; label: string }[]> = {};
    for (const f of FACETS) {
      m[f.param] = opcionesVisibles(todasPorParam[f.param], disp[f.param], sel[f.param]).map(
        (v) => ({
          value: v,
          label: f.field === "eventoId" ? (nombrePorEvento.get(v) ?? v) : v,
        }),
      );
    }
    return m;
  }, [todasPorParam, disp, sel, nombrePorEvento]);

  const conflictos = useMemo(
    () =>
      enConflicto(events, FACETAS, sel).map((key) => ({
        key,
        label: LABEL_POR_PARAM[key] ?? key,
      })),
    [events, sel],
  );

  // Reescribe params escalares (granularidad, métrica, proyección) conservando
  // el resto de la URL. `null` borra el param.
  function commit(patch: Record<string, string | null>) {
    const params = new URLSearchParams(search);
    params.set("tab", "demanda");
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    navegar(params.toString());
  }

  // Cada faceta reescribe solo su propio param; las demás quedan como estaban.
  // Marcar el universo entero de la faceta en el país ("Seleccionar todos" sin
  // otro filtro acotando) se guarda como "Todos" (param ausente), no como
  // lista: en el servidor la lista sería `IN UNNEST` y dejaría fuera los tickets
  // con ese campo vacío (p. ej. sin Temporada) o de eventos fuera del catálogo,
  // que "Todos" sí cuenta. Se compara con el universo y no con lo visible: con
  // otra faceta acotando (p. ej. Temporada 2025), marcar todo lo visible sigue
  // siendo una lista salvo que cubra el universo entero.
  function onFacetChange(param: string, next: Set<string>) {
    const universo = todasPorParam[param] ?? [];
    const params = new URLSearchParams(search);
    params.set("tab", "demanda");
    escribirSeleccion(params, param, normalizarSeleccion(next, universo));
    navegar(params.toString());
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
    navegar(params.toString());
  }

  const anyFacetActive = FACETS.some((f) => sel[f.param].size > 0);
  const hasActiveFilters =
    anyFacetActive ||
    (!countryLocked && country !== "all") ||
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
      {/* Fila 1: filtros de eventos (encadenados). Una faceta sin valores en el
          país se oculta, salvo que tenga selección: hay que poder limpiarla. */}
      <div className="flex flex-wrap items-end gap-3">
        {FACETS.map((f) =>
          todasPorParam[f.param].length > 0 || sel[f.param].size > 0 ? (
            <StandardMultiFilter
              key={f.param}
              label={f.label}
              allLabel={f.field === "eventoId" ? "Todos" : "Todas"}
              options={opcionesPorParam[f.param]}
              available={disp[f.param]}
              selected={sel[f.param]}
              onChange={(next) => onFacetChange(f.param, next)}
              searchPlaceholder={f.field === "eventoId" ? "Buscar evento…" : "Buscar…"}
            />
          ) : null,
        )}
      </div>

      <FilterConflictNotice
        conflicts={conflictos}
        onClear={(key) => onFacetChange(key, new Set())}
      />

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
            onClick={() => navegar("tab=demanda")}
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
