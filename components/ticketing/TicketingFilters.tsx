"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { ClaseVenta, TicketingEventOption } from "@/lib/queries/ticketing";
import type { Country } from "@/lib/queries/comunidad";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";

interface Props {
  events: TicketingEventOption[];
  /** Evento seleccionado: un id, o "all" para la vista histórica. */
  eventoId: string;
  /** Id del evento por default (último ocurrido); no cuenta como filtro activo. */
  defaultEventId: string;
  categoriaEventos: string[];
  country: Country;
  countryLocked: boolean;
  from: string;
  to: string;
  clases: ClaseVenta[];
  incluirDevueltos: boolean;
}

const SelectCaret = () => (
  <svg
    viewBox="0 0 12 12"
    className="pointer-events-none absolute right-3 h-3 w-3 text-[#999999]"
    aria-hidden="true"
  >
    <path
      d="M2 4l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SELECT_CLS =
  "appearance-none rounded-lg border border-[#E5E5E5] bg-white py-2 pl-3 pr-9 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

const INPUT_CLS =
  "rounded-lg border border-[#E5E5E5] bg-white py-2 px-3 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

export default function TicketingFilters({
  events,
  eventoId,
  defaultEventId,
  categoriaEventos,
  country,
  countryLocked,
  from,
  to,
  clases,
  incluirDevueltos,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categorias = useMemo(
    () =>
      [...new Set(events.map((e) => e.categoriaEvento).filter(Boolean))].sort(),
    [events],
  );

  const filteredEvents = useMemo(
    () =>
      categoriaEventos.length > 0
        ? events.filter((e) => categoriaEventos.includes(e.categoriaEvento))
        : events,
    [events, categoriaEventos],
  );

  function update(patch: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.delete(key);
        for (const item of value) params.append(key, item);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(`/ticketing${qs ? `?${qs}` : ""}`);
  }

  const hasActiveFilters =
    (eventoId !== "" && eventoId !== defaultEventId) ||
    categoriaEventos.length > 0 ||
    country !== "all" ||
    Boolean(from) ||
    Boolean(to) ||
    clases.length > 0 ||
    incluirDevueltos;

  const countryButtons: { id: Country; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "chile", label: "Chile" },
    { id: "peru", label: "Perú" },
  ];
  const claseOptions: { value: ClaseVenta; label: string }[] = [
    { value: "VENTA", label: "Venta" },
    { value: "CORTESIA", label: "Cortesía" },
    { value: "OTRO", label: "Otro" },
  ];

  return (
    <section className="flex flex-wrap items-end gap-3">
      {/* Categoría de evento */}
      <StandardMultiFilter
        label="Categoría de evento"
        options={categorias.map((c) => ({ value: c, label: c }))}
        selected={new Set(categoriaEventos)}
        onChange={(next) => update({ categoria: Array.from(next), event: null })}
        allLabel="Todas"
        searchPlaceholder="Buscar categoría..."
      />

      {/* Evento */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Evento</span>
        <div className="relative inline-flex items-center">
          <select
            className={`${SELECT_CLS} max-w-[280px]`}
            value={eventoId}
            onChange={(e) => update({ event: e.target.value })}
            aria-label="Evento"
          >
            <option value="all">Todos los eventos (histórico)</option>
            {filteredEvents.map((ev) => (
              <option key={ev.eventoId} value={ev.eventoId}>
                {ev.eventoId} — {ev.nombre}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

      {/* Clase de venta */}
      <StandardMultiFilter
        label="Clase"
        options={claseOptions}
        selected={new Set(clases)}
        onChange={(next) => update({ clase: Array.from(next) })}
        allLabel="Todas"
        searchPlaceholder="Buscar clase..."
      />

      {/* Rango de fechas */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Desde</span>
        <input
          type="date"
          className={INPUT_CLS}
          value={from}
          onChange={(e) => update({ from: e.target.value || null })}
          aria-label="Fecha desde"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Hasta</span>
        <input
          type="date"
          className={INPUT_CLS}
          value={to}
          onChange={(e) => update({ to: e.target.value || null })}
          aria-label="Fecha hasta"
        />
      </label>

      {/* País */}
      <div className="flex flex-col gap-1">
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
                onClick={() =>
                  update({ country: b.id === "all" ? null : b.id })
                }
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

      {/* Incluir devueltos */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2">
        <input
          type="checkbox"
          checked={incluirDevueltos}
          onChange={(e) =>
            update({ devueltos: e.target.checked ? "1" : null })
          }
          className="h-4 w-4 rounded border-[#E5E5E5] accent-[#9F99F8]"
        />
        <span className="font-sans text-sm text-[#333333]">Incluir devueltos</span>
      </label>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => router.push("/ticketing")}
          className="flex items-center gap-1 px-2 py-2 font-sans text-sm text-[#666666] transition-colors hover:text-[#333333]"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Limpiar
        </button>
      )}
    </section>
  );
}
