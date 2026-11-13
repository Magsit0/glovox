"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2, X } from "lucide-react";
import StandardMultiFilter, {
  type StandardFilterOption,
} from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import { useQueryFiltros } from "@/components/filters/useQueryFiltros";
import {
  disponibles,
  enConflicto,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { escribirSeleccion, normalizarSeleccion } from "@/lib/filters/url";
import {
  DEFAULT_FILTERS,
  EVENT_ALL,
  parseCompradoresParams,
  type CompradoresContacto,
  type CompradoresDatos,
  type CompradoresDevueltos,
  type CompradoresEventOption,
  type CompradoresFilters as Filters,
  type CompradoresModo,
  type CompradoresTipo,
} from "@/lib/compradores/filtros";

const RUTA = "/marketing/compradores";

// Facetas encadenadas sobre el catálogo de eventos (lib/filters/facetas.ts).
// Categoría es el padre: acota las opciones de Eventos, pero elegir un evento
// no le esconde categorías (`ignora`). Ningún filtro modifica al otro: cada uno
// escribe solo su param. Un evento sin categoría no calza con ninguna categoría
// elegida, igual que en el SQL (`ev.categoria IN UNNEST(@categorias)`).
const FACETAS: Faceta<CompradoresEventOption>[] = [
  { key: "categorias", valores: (e) => e.categoria, ignora: ["eventos"] },
  { key: "eventos", valores: (e) => e.eventoId },
];

const FACETA_LABEL: Record<string, string> = {
  categorias: "Categoría de evento",
  eventos: "Eventos",
};

type Toggles = typeof DEFAULT_FILTERS;
const TOGGLE_KEYS = Object.keys(DEFAULT_FILTERS) as (keyof Toggles)[];

/** Query string → params crudos, con la misma forma que recibe la página. */
function paramsCrudos(search: string): Record<string, string[]> {
  const raw: Record<string, string[]> = {};
  for (const [k, v] of new URLSearchParams(search)) (raw[k] ??= []).push(v);
  return raw;
}

/** Eventos vacío = "Todos", que en esta URL se escribe `event=all`. */
function escribirEventos(params: URLSearchParams, ids: readonly string[]) {
  escribirSeleccion(params, "event", ids.length > 0 ? ids : [EVENT_ALL]);
}

// La query vigente vive en un contexto de la ruta y no dentro de la barra: el
// botón del CSV (DescargarCsv) también tiene que saber cuándo la barra muestra
// una selección que el servidor todavía no confirma.
const QueryContext = createContext<ReturnType<typeof useQueryFiltros> | null>(null);

/**
 * Envuelve la barra y el botón del CSV (page.tsx). Guarda la query vigente: el
 * último cambio pedido aunque la navegación (que espera a BigQuery) no haya
 * terminado, para que dos cambios seguidos se sumen.
 */
export function CompradoresQueryProvider({ children }: { children: ReactNode }) {
  const query = useQueryFiltros(RUTA);
  return <QueryContext.Provider value={query}>{children}</QueryContext.Provider>;
}

/** Query vigente y si hay una navegación en curso (vigente ≠ URL confirmada). */
function useQueryCompradores() {
  const query = useContext(QueryContext);
  // URL confirmada: solo para comparar (los cambios se arman siempre sobre `search`).
  const confirmada = useSearchParams().toString();
  if (!query) {
    throw new Error("CompradoresFilters y DescargarCsv van dentro de <CompradoresQueryProvider>.");
  }
  return { ...query, pending: query.search !== confirmada };
}

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

const DEVUELTOS_OPTIONS: { id: CompradoresDevueltos; label: string }[] = [
  { id: "excluir", label: "Excluir" },
  { id: "incluir", label: "Incluir" },
];

const MODO_OPTIONS: { id: CompradoresModo; label: string }[] = [
  { id: "persona", label: "Por persona" },
  { id: "ticket", label: "Por ticket" },
];

/**
 * Barra de filtros de /marketing/compradores. El estado vive en la URL y la
 * página (server) vuelve a consultar con cada cambio; el CSV usa los mismos
 * params. Regla única de filtros (lib/filters/facetas.ts): Categoría acota las
 * OPCIONES de Eventos, nunca su selección. Un evento elegido fuera de las
 * categorías sigue elegido (atenuado) y, si la combinación no deja eventos, se
 * avisa con un "Limpiar" por filtro en conflicto.
 */
export default function CompradoresFilters({
  events,
  eventoPorDefecto,
  sinFilas,
}: {
  events: CompradoresEventOption[];
  /** Evento que la página elige cuando la URL no trae `event` ni `cat`. */
  eventoPorDefecto: string | null;
  /** El servidor no devolvió filas para la URL confirmada (CSV vacío). */
  sinFilas: boolean;
}) {
  // Query vigente (contexto de la ruta) y si la navegación sigue en curso.
  const { search, navegar, pending } = useQueryCompradores();

  // Filtros vigentes, leídos igual que en page.tsx: sin `event` ni `cat` en la
  // URL, Eventos es el evento por defecto.
  const actual = useMemo<Filters>(() => {
    const { filters, eventosExplicitos } = parseCompradoresParams(paramsCrudos(search));
    if (eventosExplicitos) return filters;
    return { ...filters, eventos: eventoPorDefecto ? [eventoPorDefecto] : [] };
  }, [search, eventoPorDefecto]);

  const sel = useMemo(
    () => ({ categorias: new Set(actual.categorias), eventos: new Set(actual.eventos) }),
    [actual],
  );
  const disp = useMemo(() => disponibles(events, FACETAS, sel), [events, sel]);
  const conflictos = useMemo(
    () =>
      enConflicto(events, FACETAS, sel).map((key) => ({
        key,
        label: FACETA_LABEL[key] ?? key,
      })),
    [events, sel],
  );
  // El catálogo da el aviso al instante mientras el servidor responde, pero deja
  // fuera eventos que el SQL sí cuenta (cancelados, o con todos sus tickets
  // devueltos). Con la URL confirmada manda el servidor: solo se avisa si esa
  // selección de verdad dejó el CSV en 0 filas.
  const conflictosVisibles = pending || sinFilas ? conflictos : [];

  // Categorías ordenadas por la fecha de su evento más reciente (lo vigente arriba).
  const todasCategorias = useMemo(() => {
    const maxFecha = new Map<string, string>();
    for (const e of events) {
      if (!e.categoria) continue;
      const prev = maxFecha.get(e.categoria) ?? "";
      if (e.fecha > prev) maxFecha.set(e.categoria, e.fecha);
    }
    return Array.from(maxFecha.entries())
      .sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0], "es"))
      .map(([c]) => c);
  }, [events]);
  const categoriaOptions = useMemo<StandardFilterOption[]>(
    () =>
      opcionesVisibles(todasCategorias, disp.categorias, sel.categorias).map((c) => ({
        value: c,
        label: c,
      })),
    [todasCategorias, disp, sel.categorias],
  );

  // Eventos en el orden del catálogo (fecha desc). Un ID elegido que no está en
  // el catálogo (link viejo, otro país) se muestra con su ID para poder sacarlo.
  const todosEventos = useMemo(() => events.map((e) => e.eventoId), [events]);
  const eventoPorId = useMemo(() => new Map(events.map((e) => [e.eventoId, e])), [events]);
  const eventOptions = useMemo<StandardFilterOption[]>(
    () =>
      opcionesVisibles(todosEventos, disp.eventos, sel.eventos).map((id) => {
        const e = eventoPorId.get(id);
        return e
          ? { value: id, label: `${id} — ${e.nombre}`, meta: fmtFecha(e.fecha) }
          : { value: id, label: id };
      }),
    [todosEventos, eventoPorId, disp, sel.eventos],
  );

  /**
   * Aplica un cambio sobre la query vigente sin tocar los demás params. Un
   * `event` ausente no es "Todos": sin `cat` la página elige el evento por
   * defecto y con `cat` toma todos los eventos. Por eso, antes de cambiar otra
   * cosa, se deja escrito el Eventos que se ve: así elegir o limpiar Categoría
   * (o mover un toggle) no le cambia la selección a Eventos de rebote.
   */
  function navegarCon(cambio: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(search);
    if (!params.getAll("event").some((v) => v.trim())) escribirEventos(params, actual.eventos);
    cambio(params);
    navegar(params.toString());
  }

  // Cada filtro escribe solo su param. Marcar el universo entero se guarda como
  // "Todos" (normalizarSeleccion); "todos los eventos de FDS" sigue siendo lista.
  function onCategorias(next: Set<string>) {
    navegarCon((p) => escribirSeleccion(p, "cat", normalizarSeleccion(next, todasCategorias)));
  }

  function onEventos(next: Set<string>) {
    navegarCon((p) => escribirEventos(p, normalizarSeleccion(next, todosEventos)));
  }

  function onToggle<K extends keyof Toggles>(key: K, value: Toggles[K]) {
    navegarCon((p) => {
      if (value === DEFAULT_FILTERS[key]) p.delete(key);
      else p.set(key, value);
    });
  }

  // "Limpiar filtros" (único control que toca varios filtros) vuelve al estado
  // por defecto: la página sin params, con el evento por defecto.
  const eventosDefecto = eventoPorDefecto ? [eventoPorDefecto] : [];
  const enDefecto =
    actual.categorias.length === 0 &&
    actual.eventos.length === eventosDefecto.length &&
    actual.eventos.every((id) => eventosDefecto.includes(id)) &&
    TOGGLE_KEYS.every((k) => actual[k] === DEFAULT_FILTERS[k]);

  return (
    <section
      aria-busy={pending}
      className={`flex flex-col gap-4 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 transition-opacity ${
        pending ? "opacity-70" : ""
      }`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <StandardMultiFilter
          label={FACETA_LABEL.categorias}
          options={categoriaOptions}
          available={disp.categorias}
          selected={sel.categorias}
          onChange={onCategorias}
          allLabel="Todas las categorías"
          searchPlaceholder="Buscar categoría…"
        />
        <StandardMultiFilter
          label={FACETA_LABEL.eventos}
          options={eventOptions}
          available={disp.eventos}
          selected={sel.eventos}
          onChange={onEventos}
          allLabel="Todos los eventos"
          searchPlaceholder="Buscar evento…"
          className="min-w-[300px]"
        />
        <Toggle
          label="Datos de"
          value={actual.datos}
          options={DATOS_OPTIONS}
          onSelect={(datos) => onToggle("datos", datos)}
        />
        <Toggle
          label="Tipo"
          value={actual.tipo}
          options={TIPO_OPTIONS}
          onSelect={(tipo) => onToggle("tipo", tipo)}
        />
        <Toggle
          label="Contacto"
          value={actual.contacto}
          options={CONTACTO_OPTIONS}
          onSelect={(contacto) => onToggle("contacto", contacto)}
        />
        <Toggle
          label="Devueltos"
          value={actual.devueltos}
          options={DEVUELTOS_OPTIONS}
          onSelect={(devueltos) => onToggle("devueltos", devueltos)}
        />
        <Toggle
          label="Filas del CSV"
          value={actual.modo}
          options={MODO_OPTIONS}
          onSelect={(modo) => onToggle("modo", modo)}
        />

        <div className="ml-auto flex items-center gap-2 self-end">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-subtle)]" aria-label="Cargando" />
          )}
          {!enDefecto && (
            <button
              type="button"
              onClick={() => navegar("")}
              className="flex items-center gap-1 rounded-lg px-2 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <FilterConflictNotice
        conflicts={conflictosVisibles}
        onClear={(key) => (key === "categorias" ? onCategorias(new Set()) : onEventos(new Set()))}
      />

      <p className="font-sans text-xs text-[var(--ink-subtle)]">
        Ventas = venta + pase de temporada · Cortesías = cortesía + mesa VIP (ambas entran con
        medio de pago &quot;Otro&quot;). Los tickets devueltos quedan fuera salvo con &quot;Devueltos: Incluir&quot;, que además agrega al CSV una columna que los marca. &quot;Por
        persona&quot; junta los tickets de un mismo email (o teléfono, si no hay email) en una
        sola fila y deja fuera los tickets sin ningún dato de contacto. &quot;Nominados&quot; =
        la persona del ticket (asistente); &quot;Compradores&quot; = quien pagó la orden, útil
        para audiencias de Meta.
      </p>
    </section>
  );
}

const INT = new Intl.NumberFormat("es-CL");

/**
 * Botón "Descargar CSV" de la cabecera. `href` y `filas` vienen del servidor,
 * armados con la URL confirmada. Mientras la barra muestra una selección que el
 * servidor todavía no confirma, ese link baja la selección anterior: queda
 * deshabilitado hasta que llegue la nueva, así nunca se descarga una lista
 * distinta de la que muestran los filtros.
 */
export function DescargarCsv({
  href,
  filas,
  modo,
}: {
  href: string;
  filas: number;
  modo: CompradoresModo;
}) {
  const { pending } = useQueryCompradores();
  const caption = pending
    ? "Actualizando…"
    : filas > 0
      ? `${INT.format(filas)} ${filas === 1 ? "fila" : "filas"} · ${
          modo === "ticket" ? "una por ticket" : "una por persona"
        }`
      : "Sin filas con los filtros actuales";
  const base =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 font-sans text-sm font-medium transition-colors";
  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
      {!pending && filas > 0 ? (
        <a href={href} download className={`${base} bg-[#9F99F8] text-white hover:bg-[#8780F0]`}>
          <Download className="h-4 w-4" />
          Descargar CSV
        </a>
      ) : (
        <span
          aria-disabled="true"
          className={`${base} cursor-not-allowed bg-[#9F99F8] text-white opacity-60`}
        >
          <Download className="h-4 w-4" />
          Descargar CSV
        </span>
      )}
      <span className="font-sans text-xs text-[var(--ink-muted)]">{caption}</span>
    </div>
  );
}
