"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import {
  filtersToSearchParams,
  type CompradoresContacto,
  type CompradoresDatos,
  type CompradoresEventOption,
  type CompradoresFilters as Filters,
  type CompradoresModo,
  type CompradoresTipo,
} from "@/lib/compradores/filtros";

const RUTA = "/marketing/compradores";

// Misma estética de toggles que /marketing/curvas (CurvasFilters.tsx).
const TOGGLE_GROUP = "flex gap-1 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-1";
const toggleBtn = (active: boolean) =>
  `rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
    active ? "bg-[var(--purple-tint)] text-[#9F99F8]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
  }`;

/** Grupo de botones exclusivos (un valor activo) con la estética de los filtros. */
function Toggle<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-xs text-[var(--ink-muted)]">{label}</span>
      <div className={TOGGLE_GROUP} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(o.id)}
              className={toggleBtn(active)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-15" → "15 nov 2026". Fecha de calendario (sin zona): se arma en UTC. */
function fmtFecha(iso: string): string {
  if (!iso) return "Sin fecha";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return FECHA.format(Date.UTC(y, m - 1, d));
}

const TIPO_OPTIONS: { id: CompradoresTipo; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ventas", label: "Ventas" },
  { id: "cortesias", label: "Cortesías" },
];

const CONTACTO_OPTIONS: { id: CompradoresContacto; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "email", label: "Con email" },
  { id: "telefono", label: "Con teléfono" },
];

const DATOS_OPTIONS: { id: CompradoresDatos; label: string }[] = [
  { id: "compradores", label: "Compradores" },
  { id: "nominados", label: "Nominados" },
];

const MODO_OPTIONS: { id: CompradoresModo; label: string }[] = [
  { id: "persona", label: "Por persona" },
  { id: "ticket", label: "Por ticket" },
];

/**
 * Barra de filtros de /marketing/compradores. El estado vive en la URL: cada
 * cambio hace `router.push` y la página (server) vuelve a consultar. Las
 * categorías acotan las opciones de evento; al cambiar de categoría se
 * sueltan los eventos que quedan fuera.
 */
export default function CompradoresFilters({
  events,
  filters,
  hasParams,
}: {
  events: CompradoresEventOption[];
  filters: Filters;
  /** La URL trae algún parámetro → se muestra "Limpiar filtros". */
  hasParams: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Categorías ordenadas por la fecha de su evento más reciente (lo vigente arriba).
  const categoriaOptions = useMemo(() => {
    const maxFecha = new Map<string, string>();
    for (const e of events) {
      if (!e.categoria) continue;
      const prev = maxFecha.get(e.categoria) ?? "";
      if (e.fecha > prev) maxFecha.set(e.categoria, e.fecha);
    }
    return Array.from(maxFecha.entries())
      .sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0], "es"))
      .map(([c]) => ({ value: c, label: c }));
  }, [events]);

  const catSet = useMemo(() => new Set(filters.categorias), [filters.categorias]);
  const eventSet = useMemo(() => new Set(filters.eventos), [filters.eventos]);

  const eventOptions = useMemo(
    () =>
      events
        .filter((e) => catSet.size === 0 || catSet.has(e.categoria))
        .map((e) => ({
          value: e.eventoId,
          label: `${e.eventoId} — ${e.nombre}`,
          meta: fmtFecha(e.fecha),
        })),
    [events, catSet],
  );

  function commit(next: Filters) {
    const qs = filtersToSearchParams(next).toString();
    startTransition(() => {
      router.push(qs ? `${RUTA}?${qs}` : RUTA, { scroll: false });
    });
  }

  function onCategorias(next: Set<string>) {
    const categorias = Array.from(next);
    const permitidos = new Set(
      events
        .filter((e) => categorias.length === 0 || next.has(e.categoria))
        .map((e) => e.eventoId),
    );
    commit({
      ...filters,
      categorias,
      eventos: filters.eventos.filter((id) => permitidos.has(id)),
    });
  }

  function onEventos(next: Set<string>) {
    commit({ ...filters, eventos: Array.from(next) });
  }

  function reset() {
    startTransition(() => {
      router.push(RUTA, { scroll: false });
    });
  }

  return (
    <section
      aria-busy={pending}
      className={`flex flex-col gap-4 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 transition-opacity ${
        pending ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <StandardMultiFilter
          label="Categoría de evento"
          options={categoriaOptions}
          selected={catSet}
          onChange={onCategorias}
          allLabel="Todas las categorías"
          searchPlaceholder="Buscar categoría…"
        />
        <StandardMultiFilter
          label="Eventos"
          options={eventOptions}
          selected={eventSet}
          onChange={onEventos}
          allLabel="Todos los eventos"
          searchPlaceholder="Buscar evento…"
          className="min-w-[300px]"
        />
        <Toggle
          label="Datos de"
          value={filters.datos}
          options={DATOS_OPTIONS}
          onSelect={(datos) => commit({ ...filters, datos })}
        />
        <Toggle
          label="Tipo"
          value={filters.tipo}
          options={TIPO_OPTIONS}
          onSelect={(tipo) => commit({ ...filters, tipo })}
        />
        <Toggle
          label="Contacto"
          value={filters.contacto}
          options={CONTACTO_OPTIONS}
          onSelect={(contacto) => commit({ ...filters, contacto })}
        />
        <Toggle
          label="Filas del CSV"
          value={filters.modo}
          options={MODO_OPTIONS}
          onSelect={(modo) => commit({ ...filters, modo })}
        />

        <div className="ml-auto flex items-center gap-2 self-end">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-subtle)]" aria-label="Cargando" />
          )}
          {hasParams && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 rounded-lg px-2 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <p className="font-sans text-xs text-[var(--ink-subtle)]">
        Ventas = venta + pase de temporada · Cortesías = cortesía + mesa VIP (ambas entran con
        medio de pago &quot;Otro&quot;). Los tickets devueltos quedan fuera. &quot;Por
        persona&quot; junta los tickets de un mismo email (o teléfono, si no hay email) en una
        sola fila y deja fuera los tickets sin ningún dato de contacto. &quot;Nominados&quot; =
        la persona del ticket (asistente); &quot;Compradores&quot; = quien pagó la orden, útil
        para audiencias de Meta.
      </p>
    </section>
  );
}
