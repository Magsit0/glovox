"use client";

import { useMemo } from "react";
import type { ClaseVenta, TicketingEventOption } from "@/lib/queries/ticketing";
import type { Country } from "@/lib/queries/comunidad";
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

interface Props {
  events: TicketingEventOption[];
  /**
   * Evento que usó el servidor: un id, "all" para la vista histórica, o "" si
   * la categoría no tiene eventos (sin default).
   */
  eventoId: string;
  country: Country;
  countryLocked: boolean;
  from: string;
  to: string;
  incluirDevueltos: boolean;
}

// Facetas encadenadas sobre el catálogo de eventos del país (lib/filters/facetas.ts).
// Las keys son los params de la URL. Categoría es el padre: acota las opciones
// de Evento, pero el evento elegido no le esconde categorías (`ignora`); si no,
// como Evento siempre tiene valor, Categoría quedaría reducida a una sola.
const FACETAS: Faceta<TicketingEventOption>[] = [
  { key: "categoria", valores: (e) => e.categoriaEvento, ignora: ["event"] },
  { key: "event", valores: (e) => e.eventoId },
];

const LABEL: Record<string, string> = {
  categoria: "Categoría de evento",
  event: "Evento",
  from: "Desde",
  country: "País",
};

// Prefijo de EventoID por país: el mismo literal que filtra baseCte en
// lib/queries/ticketing.ts (`a.EventoID LIKE 'GLO%'`).
const PREFIJO_PAIS: Record<Exclude<Country, "all">, string> = {
  chile: "GLO",
  peru: "GLP",
};

const CLASES: readonly ClaseVenta[] = ["VENTA", "CORTESIA", "OTRO"];
const CLASE_LABEL: Record<ClaseVenta, string> = {
  VENTA: "Venta",
  CORTESIA: "Cortesía",
  OTRO: "Otro",
};

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

/**
 * Filtros de la pestaña Análisis por evento. Regla única de filtros (README ›
 * "Estándar de filtros"): cada control escribe solo su param. Categoría acota
 * las opciones de Evento pero no lo cambia: el evento elegido (o "Todos los
 * eventos (histórico)") se conserva aunque no sea de la categoría; se marca en
 * el selector y, como la combinación no deja tickets, se avisa con
 * FilterConflictNotice. Sin `event` en la URL, el servidor usa el último
 * evento ocurrido de la categoría y del rango Desde/Hasta (default derivado,
 * no es una escritura).
 */
export default function TicketingFilters({
  events,
  eventoId,
  country,
  countryLocked,
  from,
  to,
  incluirDevueltos,
}: Props) {
  // Query vigente (el último cambio pedido aunque la navegación no haya
  // terminado), para que dos cambios seguidos se sumen.
  const { search, navegar } = useQueryFiltros("/ticketing");

  const url = useMemo(() => {
    const sp = new URLSearchParams(search);
    const eventoParam = sp.get("event") ?? "";
    return {
      categorias: leerSeleccion(sp, "categoria"),
      clases: new Set(
        [...leerSeleccion(sp, "clase")].filter((c) => (CLASES as readonly string[]).includes(c)),
      ),
      eventoParam,
    };
  }, [search]);

  // Evento elegido a mano (no "all" ni el default derivado). Es el único que
  // puede chocar con la categoría o el país.
  const eventoExplicito =
    url.eventoParam && url.eventoParam !== "all" ? url.eventoParam : null;
  // Valor del selector: el pedido en la URL o, sin `event`, el que resolvió el
  // servidor (el default de la categoría).
  const eventoActual = url.eventoParam || eventoId;

  const eventoPorId = useMemo(() => new Map(events.map((e) => [e.eventoId, e])), [events]);
  const todasCategorias = useMemo(
    () => [...new Set(events.map((e) => e.categoriaEvento).filter(Boolean))].sort(),
    [events],
  );
  const todosEventos = useMemo(() => events.map((e) => e.eventoId).filter(Boolean), [events]);

  const sel = useMemo(
    () => ({
      categoria: url.categorias,
      event: eventoExplicito ? new Set([eventoExplicito]) : undefined,
    }),
    [url.categorias, eventoExplicito],
  );
  const disp = useMemo(() => disponibles(events, FACETAS, sel), [events, sel]);

  // El catálogo viene acotado al país, así que un evento de otro país no está
  // en `events`. Ese choque es seguro (baseCte filtra por prefijo).
  const fueraDelPais =
    eventoExplicito !== null &&
    country !== "all" &&
    !eventoExplicito.startsWith(PREFIJO_PAIS[country]);

  // Desde filtra por FechaEvento (baseCte) y el catálogo trae su máximo, así
  // que un evento cuya fecha es anterior a Desde no puede tener tickets. Vale
  // para el evento elegido y para el default (el servidor lo busca dentro del
  // rango y, si no hay ninguno, cae en el de la categoría). Hasta no se puede
  // afirmar: el catálogo no trae la primera FechaEvento del evento.
  const fechaMostrado =
    eventoActual && eventoActual !== "all" ? eventoPorId.get(eventoActual)?.fechaEvento : undefined;
  const antesDeDesde = Boolean(from && fechaMostrado && fechaMostrado < from);

  const conflictos = useMemo(() => {
    // Un evento fuera del catálogo (otro país, cancelado, sin fecha) no tiene
    // categoría conocida: solo se afirma el choque de país.
    const keys: string[] =
      !eventoExplicito || eventoPorId.has(eventoExplicito)
        ? enConflicto(events, FACETAS, sel)
        : fueraDelPais
          ? ["event"]
          : [];
    if (antesDeDesde) {
      if (eventoExplicito && !keys.includes("event")) keys.push("event");
      keys.push("from");
    }
    if (fueraDelPais && !countryLocked) keys.push("country");
    return keys.map((key) => ({ key, label: LABEL[key] ?? key }));
  }, [events, sel, eventoExplicito, eventoPorId, fueraDelPais, countryLocked, antesDeDesde]);

  const categoriaOptions = useMemo(
    () =>
      opcionesVisibles(todasCategorias, disp.categoria, url.categorias).map((c) => ({
        value: c,
        label: c,
      })),
    [todasCategorias, disp, url.categorias],
  );

  // Evento: los de la categoría (fecha desc) más el que está elegido aunque no
  // sea de ella, marcado. El marcador va antes del nombre para que se lea
  // aunque el select corte el texto.
  const eventoOptions = useMemo(() => {
    const actual = eventoActual && eventoActual !== "all" ? new Set([eventoActual]) : undefined;
    return opcionesVisibles(todosEventos, disp.event, actual).map((id) => {
      const ev = eventoPorId.get(id);
      let marca = "";
      if (id === eventoExplicito && !disp.event.has(id)) {
        marca = !ev
          ? fueraDelPais
            ? " (fuera del país)"
            : " (fuera del listado)"
          : " (fuera de la categoría)";
      } else if (id === eventoActual && antesDeDesde) {
        marca = " (fuera del rango de fechas)";
      }
      return { value: id, label: `${id}${marca}${ev?.nombre ? ` — ${ev.nombre}` : ""}` };
    });
  }, [todosEventos, disp, eventoActual, eventoExplicito, eventoPorId, fueraDelPais, antesDeDesde]);

  const etiquetaEvento =
    eventoActual === "all"
      ? "Todos los eventos (histórico)"
      : (eventoOptions.find((o) => o.value === eventoActual)?.label ?? "");

  // Cada control reescribe solo su propio param y conserva el resto de la URL.
  function setParam(param: string, value: string | null) {
    const params = new URLSearchParams(search);
    if (value) params.set(param, value);
    else params.delete(param);
    navegar(params.toString());
  }

  // Marcar el universo entero se guarda como "Todos" (param ausente).
  function setSeleccion(param: string, next: Set<string>, universo: readonly string[]) {
    const params = new URLSearchParams(search);
    escribirSeleccion(params, param, normalizarSeleccion(next, universo));
    navegar(params.toString());
  }

  // Cualquier `event` en la URL cuenta, aunque coincida con el default: un
  // evento elegido a mano queda fijo cuando cambian los otros filtros y el
  // default no, así que ya no es el estado por defecto.
  const hasActiveFilters =
    url.eventoParam !== "" ||
    url.categorias.size > 0 ||
    (!countryLocked && country !== "all") ||
    Boolean(from) ||
    Boolean(to) ||
    url.clases.size > 0 ||
    incluirDevueltos;

  const countryButtons: { id: Country; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "chile", label: "Chile" },
    { id: "peru", label: "Perú" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Categoría de evento */}
        <StandardMultiFilter
          label={LABEL.categoria}
          options={categoriaOptions}
          available={disp.categoria}
          selected={url.categorias}
          onChange={(next) => setSeleccion("categoria", next, todasCategorias)}
          allLabel="Todas"
          searchPlaceholder="Buscar categoría..."
        />

        {/* Evento: un solo valor, siempre definido ("all", un id o el default). */}
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs text-[#666666]">{LABEL.event}</span>
          <div className="relative inline-flex items-center">
            <select
              className={`${SELECT_CLS} max-w-[280px]`}
              value={eventoActual}
              onChange={(e) => setParam("event", e.target.value)}
              aria-label={LABEL.event}
              title={etiquetaEvento || undefined}
            >
              {eventoActual === "" && (
                <option value="" disabled>
                  Sin eventos con estos filtros
                </option>
              )}
              <option value="all">Todos los eventos (histórico)</option>
              {eventoOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <SelectCaret />
          </div>
        </label>

        {/* Clase de venta */}
        <StandardMultiFilter
          label="Clase"
          options={CLASES.map((c) => ({ value: c, label: CLASE_LABEL[c] }))}
          selected={url.clases}
          onChange={(next) => setSeleccion("clase", next, CLASES)}
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
            onChange={(e) => setParam("from", e.target.value || null)}
            aria-label="Fecha desde"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-xs text-[#666666]">Hasta</span>
          <input
            type="date"
            className={INPUT_CLS}
            value={to}
            onChange={(e) => setParam("to", e.target.value || null)}
            aria-label="Fecha hasta"
          />
        </label>

        {/* País */}
        <div className="flex flex-col gap-1">
          <span className="font-sans text-xs text-[#666666]">{LABEL.country}</span>
          <div className="flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1">
            {countryButtons.map((b) => {
              const isActive = country === b.id;
              const disabled = countryLocked && !isActive;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setParam("country", b.id === "all" ? null : b.id)}
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
            onChange={(e) => setParam("devueltos", e.target.checked ? "1" : null)}
            className="h-4 w-4 rounded border-[#E5E5E5] accent-[#9F99F8]"
          />
          <span className="font-sans text-sm text-[#333333]">Incluir devueltos</span>
        </label>

        {/* Único control que toca varios filtros: vuelve al estado por defecto. */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => navegar("")}
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
            Limpiar filtros
          </button>
        )}
      </div>

      <FilterConflictNotice conflicts={conflictos} onClear={(key) => setParam(key, null)} />
    </section>
  );
}
