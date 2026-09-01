"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import MultiSelectFilter from "@/components/cierre-mensual/filters/MultiSelectFilter";
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
  NONE,
  TIPO_PARAM,
  buildTiposIndex,
  compatibles as compatiblesDe,
  purgarSelecciones,
  type FacetEstado as Estado,
  type FacetField,
  type Sel,
} from "@/lib/marketing/curvasFacetas";
import type { Country } from "@/lib/queries/comunidad";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  // Qué tipos de ticket vende cada evento: es lo que permite encadenar ese
  // filtro en las dos direcciones sin volver al servidor.
  const tiposIdx = useMemo(() => buildTiposIndex(tipoTicketMap), [tipoTicketMap]);

  const labelEvento = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) {
      m.set(e.eventoId, e.nombre ? `${e.eventoId} — ${e.nombre}` : e.eventoId);
    }
    return m;
  }, [events]);

  /** Universo completo por faceta: sirve para colapsar "todos" a param ausente. */
  const universo = useMemo(() => {
    const byField = {} as Record<FacetField, Set<string>>;
    for (const f of FACETS) {
      byField[f.field] = new Set(events.map((e) => e[f.field]).filter(Boolean));
    }
    return { byField, tipos: tiposIdx.universo };
  }, [events, tiposIdx]);

  /** Selección vigente, leída de la URL. */
  const sel = useMemo<Estado>(() => {
    const sp = new URLSearchParams(search);
    const parse = (param: string): Sel => {
      const v = sp.getAll(param);
      if (v.length === 0) return null;
      if (v.length === 1 && v[0] === NONE) return new Set<string>();
      return new Set(v);
    };
    const byField = {} as Record<FacetField, Sel>;
    for (const f of FACETS) byField[f.field] = parse(f.param);
    return { byField, tipos: parse(TIPO_PARAM) };
  }, [search]);

  /** Valores compatibles por faceta, dado el resto de la selección. */
  const compatibles = useMemo(
    () => compatiblesDe(events, sel, tiposIdx),
    [events, sel, tiposIdx],
  );

  /**
   * Opciones que se muestran: solo las compatibles. Se suman las que estén
   * seleccionadas pero ya no sean compatibles (puede pasar al abrir una URL
   * compartida): quedan visibles y atenuadas para poder destildarlas.
   */
  const optionsByField = useMemo(() => {
    const m = {} as Record<FacetField, { value: string; label: string }[]>;
    for (const f of FACETS) {
      const values = new Set(compatibles.byField[f.field]);
      const s = sel.byField[f.field];
      if (s) for (const v of s) values.add(v);
      m[f.field] = [...values]
        .filter(Boolean)
        .map((v) => ({
          value: v,
          label: f.field === "eventoId" ? (labelEvento.get(v) ?? v) : v,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
    }
    return m;
  }, [compatibles, sel, labelEvento]);

  const tipoOptions = useMemo(() => {
    const counts = new Map(compatibles.tipos);
    if (sel.tipos) for (const t of sel.tipos) if (!counts.has(t)) counts.set(t, 0);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
      .map(([t, n]) => ({
        value: t,
        label: n > 0 ? `${t} · ${n.toLocaleString("es-CL")}` : t,
      }));
  }, [compatibles, sel]);

  /** Set que recibe el componente: sin restricción = todas las visibles. */
  const selectedFor = (visibles: string[], s: Sel): Set<string> =>
    s === null ? new Set(visibles) : s;

  // Categoría 3 solo tiene contenido real en las familias que numeran sus
  // ediciones (Piknic, After Piknic, Maxi). En el resto vale 'Otro', así que la
  // faceta se muestra solo si hay al menos una edición distinta de 'Otro'.
  const cat3Util = useMemo(
    () =>
      [...compatibles.byField.categoriaEvento3].some(
        (v) => v && v.toLowerCase() !== "otro",
      ),
    [compatibles],
  );

  function push(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `/marketing/curvas?${qs}` : "/marketing/curvas", {
      scroll: false,
    });
  }

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
    push(params);
  }

  function onFacetChange(param: string, field: FacetField | "tipos") {
    return (_name: string, next: Set<string>) => {
      const visibles =
        field === "tipos"
          ? tipoOptions.map((o) => o.value)
          : optionsByField[field].map((o) => o.value);
      // "Todas las visibles" = sin restricción, para no arrastrar en la URL una
      // lista que quedaría congelada al mover las otras facetas.
      const cubreTodo =
        next.size === visibles.length && visibles.every((v) => next.has(v));
      const value: Sel = next.size === 0 ? new Set<string>() : cubreTodo ? null : next;

      const base: Estado = { byField: { ...sel.byField }, tipos: sel.tipos };
      if (field === "tipos") base.tipos = value;
      else base.byField[field] = value;

      const purgado = purgarSelecciones(events, base, param, tiposIdx);

      const params = new URLSearchParams(search);
      const write = (p: string, s: Sel, todo: Set<string>) => {
        params.delete(p);
        if (s === null) return;
        if (s.size === 0) {
          params.append(p, NONE);
          return;
        }
        if (s.size === todo.size) return; // cubre el universo entero
        for (const v of s) params.append(p, v);
      };
      for (const f of FACETS) {
        write(f.param, purgado.byField[f.field], universo.byField[f.field]);
      }
      write(TIPO_PARAM, purgado.tipos, universo.tipos);
      push(params);
    };
  }

  const anyFacetActive =
    FACETS.some((f) => sel.byField[f.field] !== null) || sel.tipos !== null;
  const hasActiveFilters =
    anyFacetActive ||
    country !== "all" ||
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
          if (f.field === "categoriaEvento3" && !cat3Util) return null;
          const options = optionsByField[f.field];
          if (options.length === 0) return null;
          return (
            <MultiSelectFilter
              key={f.param}
              name={f.param}
              label={f.label}
              options={options}
              available={compatibles.byField[f.field]}
              selected={selectedFor(
                options.map((o) => o.value),
                sel.byField[f.field],
              )}
              onChange={onFacetChange(f.param, f.field)}
            />
          );
        })}
        {tipoOptions.length > 0 && (
          <MultiSelectFilter
            name={TIPO_PARAM}
            label="Tipo de ticket"
            options={tipoOptions}
            available={new Set(compatibles.tipos.keys())}
            selected={selectedFor(
              tipoOptions.map((o) => o.value),
              sel.tipos,
            )}
            onChange={onFacetChange(TIPO_PARAM, "tipos")}
          />
        )}
      </div>

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
            onClick={() => router.push("/marketing/curvas", { scroll: false })}
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
