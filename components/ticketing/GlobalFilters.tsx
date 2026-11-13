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
import type { TicketingEventOption } from "@/lib/queries/ticketing";
import type { Country } from "@/lib/queries/comunidad";
import { PRODUCTOS, PRODUCTO_LABEL, type Producto } from "@/lib/ticketing-pricing/formulas";

interface Props {
  events: TicketingEventOption[];
  country: Country;
  countryLocked: boolean;
}

// Facetas encadenadas sobre el catálogo de eventos del país (lib/filters/facetas.ts).
// Categoría es el padre: acota las opciones de Evento, pero elegir un evento no
// le esconde categorías (`ignora`), igual que antes de la regla única. Ningún
// filtro modifica a otro: cada uno escribe solo su param.
const FACETAS: Faceta<TicketingEventOption>[] = [
  { key: "categorias", valores: (e) => e.categoriaEvento, ignora: ["eventos"] },
  { key: "eventos", valores: (e) => e.eventoId },
];

const FACETA_LABEL: Record<string, string> = {
  categorias: "Categoría de evento",
  eventos: "Evento",
};

const TODOS_PRODUCTOS: ReadonlySet<string> = new Set(PRODUCTOS);

export default function GlobalFilters({ events, country, countryLocked }: Props) {
  // Query vigente (el último cambio pedido aunque la navegación no haya
  // terminado), para que dos cambios seguidos se sumen.
  const { search, navegar } = useQueryFiltros("/ticketing");

  // Selección por filtro desde la URL (params repetidos). Vacía = "Todos".
  const sel = useMemo(() => {
    const sp = new URLSearchParams(search);
    return {
      categorias: leerSeleccion(sp, "categorias"),
      eventos: leerSeleccion(sp, "eventos"),
      productos: leerSeleccion(sp, "productos"),
    };
  }, [search]);

  const selFacetas = useMemo(
    () => ({ categorias: sel.categorias, eventos: sel.eventos }),
    [sel],
  );
  const disp = useMemo(() => disponibles(events, FACETAS, selFacetas), [events, selFacetas]);
  const conflictos = useMemo(
    () =>
      enConflicto(events, FACETAS, selFacetas).map((key) => ({
        key,
        label: FACETA_LABEL[key] ?? key,
      })),
    [events, selFacetas],
  );

  // Categoría: las presentes en los eventos del país, en orden alfabético.
  const todasCategorias = useMemo(
    () =>
      [...new Set(events.map((e) => e.categoriaEvento).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [events],
  );
  const categoriaOptions = useMemo(
    () =>
      opcionesVisibles(todasCategorias, disp.categorias, sel.categorias).map((c) => ({
        value: c,
        label: c,
      })),
    [todasCategorias, disp, sel.categorias],
  );

  // Evento: en el orden en que vienen (fecha desc). Un ID seleccionado que no
  // está en el catálogo (link viejo, cambio de país) se muestra con su ID.
  const todosEventos = useMemo(() => events.map((e) => e.eventoId).filter(Boolean), [events]);
  const eventoPorId = useMemo(() => new Map(events.map((e) => [e.eventoId, e])), [events]);
  const eventoOptions = useMemo(
    () =>
      opcionesVisibles(todosEventos, disp.eventos, sel.eventos).map((id) => {
        const nombre = eventoPorId.get(id)?.nombre;
        return { value: id, label: nombre ? `${id} — ${nombre}` : id };
      }),
    [todosEventos, eventoPorId, disp, sel.eventos],
  );

  // Producto: enum fijo (familias de producto), independiente de categoría/evento.
  const productoOptions = useMemo(
    () =>
      opcionesVisibles(PRODUCTOS, TODOS_PRODUCTOS, sel.productos).map((p) => ({
        value: p,
        label: PRODUCTO_LABEL[p as Producto] ?? p,
      })),
    [sel.productos],
  );

  // Universo completo de cada filtro en el país (no solo lo visible).
  const universoPorParam: Record<string, readonly string[]> = {
    categorias: todasCategorias,
    eventos: todosEventos,
    productos: PRODUCTOS,
  };

  // Cada filtro reescribe solo su propio param y conserva el resto de la URL.
  // Marcar el universo entero ("Seleccionar todos" sin otro filtro acotando) se
  // guarda como "Todos" (param ausente), no como lista: en el servidor la lista
  // sería `IN UNNEST` y dejaría fuera los tickets de eventos sin categoría o
  // fuera del catálogo, que "Todos" sí cuenta. Se compara con el universo y no
  // con lo visible: "todos los eventos de FDS" sigue siendo una lista.
  function onFilterChange(param: string, next: Set<string>) {
    const universo = universoPorParam[param] ?? [];
    const params = new URLSearchParams(search);
    params.set("tab", "global");
    escribirSeleccion(params, param, normalizarSeleccion(next, universo));
    navegar(params.toString());
  }

  function updateCountry(value: string | null) {
    const params = new URLSearchParams(search);
    params.set("tab", "global");
    if (value === null) params.delete("country");
    else params.set("country", value);
    navegar(params.toString());
  }

  const hasActiveFilters =
    sel.categorias.size > 0 ||
    sel.eventos.size > 0 ||
    sel.productos.size > 0 ||
    (!countryLocked && country !== "all");

  const countryButtons: { id: Country; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "chile", label: "Chile" },
    { id: "peru", label: "Perú" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <StandardMultiFilter
          label={FACETA_LABEL.categorias}
          allLabel="Todas"
          options={categoriaOptions}
          available={disp.categorias}
          selected={sel.categorias}
          onChange={(next) => onFilterChange("categorias", next)}
          searchPlaceholder="Buscar categoría…"
        />

        <StandardMultiFilter
          label={FACETA_LABEL.eventos}
          options={eventoOptions}
          available={disp.eventos}
          selected={sel.eventos}
          onChange={(next) => onFilterChange("eventos", next)}
          searchPlaceholder="Buscar evento…"
        />

        <StandardMultiFilter
          label="Producto"
          options={productoOptions}
          selected={sel.productos}
          onChange={(next) => onFilterChange("productos", next)}
          searchPlaceholder="Buscar producto…"
        />

        {/* País */}
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">País</span>
          <div className="flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1">
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
            onClick={() => navegar("tab=global")}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
      </div>

      <FilterConflictNotice
        conflicts={conflictos}
        onClear={(key) => onFilterChange(key, new Set())}
      />
    </section>
  );
}
