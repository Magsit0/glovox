"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import StandardMultiFilter, {
  type StandardFilterOption,
} from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import { useQueryFiltros } from "@/components/filters/useQueryFiltros";
import { disponibles, enConflicto, opcionesVisibles } from "@/lib/filters/facetas";
import {
  leerSeleccion,
  normalizarSeleccion,
  reemplazarSeleccion,
} from "@/lib/filters/url";
import type {
  CurvaEventOption,
  CurvaComunidad,
  CurvaTipoTicketPar,
} from "@/lib/queries/curvas";
import type {
  CurvaGroupBy,
  CurvaMetric,
  CurvaVista,
} from "@/lib/marketing/curvas";
import {
  CURVA_FACETS as FACETS,
  TIPO_PARAM,
  buildTiposIndex,
  eventosConTickets,
  facetasCurvas,
  volumenTipos,
} from "@/lib/marketing/curvasFacetas";
import type { Country } from "@/lib/queries/comunidad";

const TIPO_LABEL = "Tipo de ticket";

const LABEL_POR_PARAM: Record<string, string> = Object.fromEntries([
  ...FACETS.map((f) => [f.param, f.label]),
  [TIPO_PARAM, TIPO_LABEL],
]);

interface Props {
  events: CurvaEventOption[];
  /** Pares (evento, TipoTicket) de todo el universo del país. */
  tipoTicketMap: CurvaTipoTicketPar[];
  country: Country;
  countryLocked: boolean;
  comunidad: CurvaComunidad;
  incluirDevueltos: boolean;
  incluirCortesias: boolean;
  groupBy: CurvaGroupBy;
  metric: CurvaMetric;
  vista: CurvaVista;
  normalizar: boolean;
  promedio: boolean;
}

const TOGGLE_GROUP = "flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1";

const toggleBtn = (active: boolean) =>
  `rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
    active ? "bg-[#F0EFFE] text-[#9F99F8]" : "text-[#666666] hover:text-[#333333]"
  }`;

/** Grupo de botones exclusivos (un valor activo) con la estética de los filtros. */
function Toggle<T extends string>({
  label,
  value,
  options,
  onSelect,
  locked,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onSelect: (id: T) => void;
  /** Deshabilita las opciones no activas (ej. país fijado por la sesión). */
  locked?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-sans text-xs text-[#666666]">{label}</span>
      <div className={TOGGLE_GROUP}>
        {options.map((o) => {
          const active = value === o.id;
          const disabled = locked === true && !active;
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(o.id)}
              className={
                disabled
                  ? "cursor-not-allowed rounded-md px-3 py-1.5 font-sans text-sm font-medium text-[#E5E5E5]"
                  : toggleBtn(active)
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CurvasFilters({
  events,
  tipoTicketMap,
  country,
  countryLocked,
  comunidad,
  incluirDevueltos,
  incluirCortesias,
  groupBy,
  metric,
  vista,
  normalizar,
  promedio,
}: Props) {
  // Query vigente: el último cambio pedido aunque la navegación (que espera a
  // BigQuery) no haya terminado, para que dos cambios seguidos se sumen.
  const { search, navegar: push } = useQueryFiltros("/marketing/curvas");

  // Qué tipos de ticket vende cada evento: es lo que permite encadenar ese
  // filtro en las dos direcciones sin volver al servidor.
  const tiposIdx = useMemo(() => buildTiposIndex(tipoTicketMap), [tipoTicketMap]);
  const facetas = useMemo(() => facetasCurvas(tiposIdx), [tiposIdx]);
  // Ítems de las facetas: solo eventos con tickets bajo los filtros de fila
  // (ver eventosConTickets). Etiquetas y orden salen de todos los eventos.
  const items = useMemo(() => eventosConTickets(events, tiposIdx), [events, tiposIdx]);

  const labelEvento = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) {
      m.set(e.eventoId, e.nombre ? `${e.eventoId} — ${e.nombre}` : e.eventoId);
    }
    return m;
  }, [events]);

  /** Universo de cada faceta de evento, en orden alfabético de su etiqueta. */
  const universo = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of FACETS) {
      const label = (v: string) =>
        f.field === "eventoId" ? (labelEvento.get(v) ?? v) : v;
      const values = new Set<string>();
      for (const e of events) if (e[f.field]) values.add(e[f.field]);
      out[f.param] = [...values].sort((a, b) => label(a).localeCompare(label(b), "es-CL"));
    }
    return out;
  }, [events, labelEvento]);

  /** Selección vigente por param, leída de la URL. Vacía = "Todos". */
  const sel = useMemo(() => {
    const sp = new URLSearchParams(search);
    const out: Record<string, Set<string>> = {};
    for (const f of FACETS) out[f.param] = leerSeleccion(sp, f.param);
    out[TIPO_PARAM] = leerSeleccion(sp, TIPO_PARAM);
    return out;
  }, [search]);

  /** Valores compatibles de cada faceta con lo elegido en las otras. */
  const disp = useMemo(() => disponibles(items, facetas, sel), [items, facetas, sel]);

  /** Tickets de cada tipo sobre los eventos compatibles con las otras facetas. */
  const volTipos = useMemo(
    () => volumenTipos(items, facetas, sel, tiposIdx),
    [items, facetas, sel, tiposIdx],
  );

  /**
   * Opciones de cada dropdown: las compatibles con los otros filtros más las
   * ya seleccionadas, aunque hayan quedado incompatibles (se ven atenuadas vía
   * `available` y se pueden desmarcar).
   */
  const optionsByParam = useMemo(() => {
    const m: Record<string, StandardFilterOption[]> = {};
    for (const f of FACETS) {
      m[f.param] = opcionesVisibles(universo[f.param], disp[f.param], sel[f.param]).map(
        (v) => ({
          value: v,
          label: f.field === "eventoId" ? (labelEvento.get(v) ?? v) : v,
        }),
      );
    }
    return m;
  }, [universo, disp, sel, labelEvento]);

  // Tipo de ticket va por volumen desc (desempate alfabético). Lo seleccionado
  // sin volumen con las otras facetas queda al final y sin número.
  const tipoOptions = useMemo<StandardFilterOption[]>(() => {
    const vol = (t: string) => volTipos.get(t) ?? 0;
    const todos = [...tiposIdx.universo].sort(
      (a, b) => vol(b) - vol(a) || a.localeCompare(b, "es-CL"),
    );
    return opcionesVisibles(todos, disp[TIPO_PARAM], sel[TIPO_PARAM]).map((t) => {
      const n = vol(t);
      return { value: t, label: t, meta: n > 0 ? n.toLocaleString("es-CL") : undefined };
    });
  }, [tiposIdx, volTipos, disp, sel]);

  /** Facetas que chocan cuando la combinación no deja ningún evento. */
  const conflictos = useMemo(
    () =>
      enConflicto(items, facetas, sel).map((key) => ({
        key,
        label: LABEL_POR_PARAM[key] ?? key,
      })),
    [items, facetas, sel],
  );

  /** Escribe params que NO son facetas (los toggles). */
  function commit(patch: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(search);
    for (const [key, value] of Object.entries(patch)) {
      params.delete(key);
      if (value !== null) {
        if (Array.isArray(value)) for (const v of value) params.append(key, v);
        else params.set(key, value);
      }
    }
    push(params.toString());
  }

  /**
   * Escribe SOLO la selección de esta faceta (vacía = borra el param). Las
   * otras facetas no se tocan aunque queden incompatibles: el encadenamiento
   * acota opciones, no selecciones. Marcar el universo entero de la faceta se
   * guarda como "Todos" (normalizarSeleccion).
   */
  function setFaceta(param: string, next: Iterable<string>) {
    const todo = param === TIPO_PARAM ? tiposIdx.universo : universo[param];
    push(reemplazarSeleccion(search, param, normalizarSeleccion(next, todo)));
  }

  const anyFacetActive = Object.values(sel).some((s) => s.size > 0);
  const hasActiveFilters =
    anyFacetActive ||
    (!countryLocked && country !== "all") ||
    comunidad !== "todos" ||
    incluirDevueltos ||
    incluirCortesias ||
    groupBy !== "evento" ||
    metric !== "personas" ||
    vista !== "acumulado" ||
    normalizar ||
    !promedio;

  return (
    <section className="flex flex-col gap-4">
      {/* Fila 1: universo de eventos (facetas encadenadas) + tipo de ticket */}
      <div className="flex flex-wrap items-end gap-3">
        {FACETS.map((f) => {
          const options = optionsByParam[f.param];
          const selected = sel[f.param];
          // Una faceta con selección nunca se oculta: hay que poder limpiarla.
          if (selected.size === 0) {
            if (options.length === 0) return null;
            // Categoría 3 solo tiene contenido real en las familias que numeran
            // sus ediciones (Piknic, After Piknic, Maxi); en el resto vale
            // 'Otro'. Se muestra si alguna edición compatible no es 'Otro'.
            if (
              f.field === "categoriaEvento3" &&
              ![...disp[f.param]].some((v) => v.toLowerCase() !== "otro")
            ) {
              return null;
            }
          }
          return (
            <StandardMultiFilter
              key={f.param}
              label={f.label}
              options={options}
              available={disp[f.param]}
              selected={selected}
              onChange={(next) => setFaceta(f.param, next)}
              allLabel={f.field === "eventoId" ? "Todos" : "Todas"}
            />
          );
        })}
        {(tipoOptions.length > 0 || sel[TIPO_PARAM].size > 0) && (
          <StandardMultiFilter
            label={TIPO_LABEL}
            options={tipoOptions}
            available={disp[TIPO_PARAM]}
            selected={sel[TIPO_PARAM]}
            onChange={(next) => setFaceta(TIPO_PARAM, next)}
          />
        )}
      </div>

      <FilterConflictNotice
        conflicts={conflictos}
        onClear={(key) => setFaceta(key, [])}
      />

      {/* Fila 2: qué se cuenta */}
      <div className="flex flex-wrap items-end gap-3">
        <Toggle<CurvaComunidad>
          label="Comunidad"
          value={comunidad}
          options={[
            { id: "todos", label: "Todas" },
            { id: "solo", label: "Solo comunidad" },
            { id: "sin", label: "Sin comunidad" },
          ]}
          onSelect={(id) => commit({ comunidad: id === "todos" ? null : id })}
        />
        <Toggle<"no" | "si">
          label="Devoluciones"
          value={incluirDevueltos ? "si" : "no"}
          options={[
            { id: "no", label: "Excluir" },
            { id: "si", label: "Incluir" },
          ]}
          onSelect={(id) => commit({ devueltos: id === "si" ? "1" : null })}
        />
        <Toggle<"no" | "si">
          label="Cortesías"
          value={incluirCortesias ? "si" : "no"}
          options={[
            { id: "no", label: "Excluir" },
            { id: "si", label: "Incluir" },
          ]}
          onSelect={(id) => commit({ cortesias: id === "si" ? "1" : null })}
        />
        <Toggle<Country>
          label="País"
          value={country}
          options={[
            { id: "all", label: "Todos" },
            { id: "chile", label: "Chile" },
            { id: "peru", label: "Perú" },
          ]}
          onSelect={(id) => commit({ country: id === "all" ? null : id })}
          locked={countryLocked}
        />
      </div>

      {/* Fila 3: cómo se dibuja */}
      <div className="flex flex-wrap items-end gap-3">
        <Toggle<CurvaMetric>
          label="Métrica"
          value={metric}
          options={[
            { id: "tickets", label: "Tickets" },
            { id: "personas", label: "Personas" },
            { id: "venta", label: "Recaudación" },
          ]}
          onSelect={(id) => commit({ metrica: id === "personas" ? null : id })}
        />
        <Toggle<CurvaGroupBy>
          label="Una curva por"
          value={groupBy}
          options={[
            { id: "evento", label: "Evento" },
            { id: "categoria3", label: "Edición" },
            { id: "categoria2", label: "Familia" },
            { id: "temporada", label: "Temporada" },
          ]}
          onSelect={(id) => commit({ agrupar: id === "evento" ? null : id })}
        />
        <Toggle<CurvaVista>
          label="Vista"
          value={vista}
          options={[
            { id: "acumulado", label: "Acumulado" },
            { id: "diario", label: "Por día" },
          ]}
          onSelect={(id) => commit({ vista: id === "acumulado" ? null : id })}
        />
        <Toggle<"abs" | "pct">
          label="Escala"
          value={normalizar ? "pct" : "abs"}
          options={[
            { id: "abs", label: "Absoluta" },
            { id: "pct", label: "% del total" },
          ]}
          onSelect={(id) => commit({ escala: id === "pct" ? "pct" : null })}
        />
        <Toggle<"si" | "no">
          label="Curva promedio"
          value={promedio ? "si" : "no"}
          options={[
            { id: "si", label: "Mostrar" },
            { id: "no", label: "Ocultar" },
          ]}
          onSelect={(id) => commit({ promedio: id === "no" ? "0" : null })}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => push("")}
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
