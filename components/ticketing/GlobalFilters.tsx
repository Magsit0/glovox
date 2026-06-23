"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { X } from "lucide-react";
import MultiSelectFilter from "@/components/unabase/filters/MultiSelectFilter";
import type { TicketingEventOption } from "@/lib/queries/ticketing";
import type { Country } from "@/lib/queries/comunidad";
import { PRODUCTOS, PRODUCTO_LABEL } from "@/lib/ticketing-pricing/formulas";

interface Props {
  events: TicketingEventOption[];
  country: Country;
  countryLocked: boolean;
}

// Centinela para el estado "ninguno seleccionado" en la URL: hay que poder
// distinguir "sin filtro = todos" (param ausente) de "desmarqué todo = nada"
// (param presente con este valor). Ningún EventoID/categoría real lo usa, así
// que `IN UNNEST(['__none__'])` no matchea nada → resultado vacío.
const NONE = "__none__";

export default function GlobalFilters({ events, country, countryLocked }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estado multi-selección desde la URL (params repetidos). Vacío = sin filtro.
  const urlCategorias = useMemo(() => searchParams.getAll("categorias"), [searchParams]);
  const urlEventos = useMemo(() => searchParams.getAll("eventos"), [searchParams]);
  const urlProductos = useMemo(() => searchParams.getAll("productos"), [searchParams]);

  // Opciones de categoría = categorías presentes en los eventos del país.
  const categoriaOptions = useMemo(
    () =>
      [...new Set(events.map((e) => e.categoriaEvento).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((c) => ({ value: c, label: c })),
    [events],
  );
  const allCategoriaValues = useMemo(
    () => categoriaOptions.map((o) => o.value),
    [categoriaOptions],
  );
  const categoriaSelected = useMemo(() => {
    if (urlCategorias.length === 0) return new Set(allCategoriaValues); // sin filtro = todos
    if (urlCategorias.length === 1 && urlCategorias[0] === NONE) return new Set<string>(); // ninguno
    return new Set(urlCategorias);
  }, [urlCategorias, allCategoriaValues]);

  // Eventos acotados a las categorías elegidas (ya vienen ordenados por fecha desc).
  const scopedEvents = useMemo(
    () =>
      urlCategorias.length
        ? events.filter((e) => categoriaSelected.has(e.categoriaEvento))
        : events,
    [events, urlCategorias, categoriaSelected],
  );
  const eventoOptions = useMemo(
    () => scopedEvents.map((e) => ({ value: e.eventoId, label: `${e.eventoId} — ${e.nombre}` })),
    [scopedEvents],
  );
  const eventoAvailable = useMemo(
    () => new Set(eventoOptions.map((o) => o.value)),
    [eventoOptions],
  );
  const eventoSelected = useMemo(() => {
    if (urlEventos.length === 0) return new Set(eventoAvailable); // sin filtro = todos
    if (urlEventos.length === 1 && urlEventos[0] === NONE) return new Set<string>(); // ninguno
    return new Set(urlEventos);
  }, [urlEventos, eventoAvailable]);

  // Producto: enum fijo (familias de producto), independiente de categoría/evento.
  const productoOptions = useMemo(
    () => PRODUCTOS.map((p) => ({ value: p, label: PRODUCTO_LABEL[p] })),
    [],
  );
  const allProductoValues = useMemo(() => [...PRODUCTOS] as string[], []);
  const productoSelected = useMemo(() => {
    if (urlProductos.length === 0) return new Set(allProductoValues); // sin filtro = todos
    if (urlProductos.length === 1 && urlProductos[0] === NONE) return new Set<string>(); // ninguno
    return new Set(urlProductos);
  }, [urlProductos, allProductoValues]);

  // Reescribe la URL conservando el resto de params. Un valor `null` borra el
  // param; un array lo reemplaza por completo (params repetidos).
  function commit(patch: Record<string, string[] | null>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "global");
    for (const [key, values] of Object.entries(patch)) {
      params.delete(key);
      if (values) for (const v of values) params.append(key, v);
    }
    router.push(`/ticketing?${params.toString()}`, { scroll: false });
  }

  // Tres estados → URL: todos (param ausente), ninguno (centinela), subconjunto.
  // Cambiar categoría resetea el filtro de eventos (su alcance cambia).
  function onCategoriaChange(_name: string, next: Set<string>) {
    const categorias =
      next.size === allCategoriaValues.length ? null : next.size === 0 ? [NONE] : [...next];
    commit({ categorias, eventos: null });
  }

  function onEventoChange(_name: string, next: Set<string>) {
    const eventos =
      next.size === eventoAvailable.size ? null : next.size === 0 ? [NONE] : [...next];
    commit({ eventos });
  }

  function onProductoChange(_name: string, next: Set<string>) {
    const productos =
      next.size === allProductoValues.length ? null : next.size === 0 ? [NONE] : [...next];
    commit({ productos });
  }

  function updateCountry(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "global");
    if (value === null) params.delete("country");
    else params.set("country", value);
    router.push(`/ticketing?${params.toString()}`, { scroll: false });
  }

  const hasActiveFilters =
    urlCategorias.length > 0 ||
    urlEventos.length > 0 ||
    urlProductos.length > 0 ||
    country !== "all";

  const countryButtons: { id: Country; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "chile", label: "Chile" },
    { id: "peru", label: "Perú" },
  ];

  return (
    <section className="flex flex-wrap items-end gap-3">
      <MultiSelectFilter
        name="categorias"
        label="Categoría de evento"
        options={categoriaOptions}
        available={new Set(allCategoriaValues)}
        selected={categoriaSelected}
        onChange={onCategoriaChange}
      />

      <MultiSelectFilter
        name="eventos"
        label="Evento"
        options={eventoOptions}
        available={eventoAvailable}
        selected={eventoSelected}
        onChange={onEventoChange}
      />

      <MultiSelectFilter
        name="productos"
        label="Producto"
        options={productoOptions}
        available={new Set(allProductoValues)}
        selected={productoSelected}
        onChange={onProductoChange}
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
          onClick={() => router.push("/ticketing?tab=global", { scroll: false })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar filtros
        </button>
      )}
    </section>
  );
}
