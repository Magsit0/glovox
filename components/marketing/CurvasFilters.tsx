"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import MultiSelectFilter from "@/components/cierre-mensual/filters/MultiSelectFilter";
import type { CurvaEventOption, CurvaComunidad } from "@/lib/queries/curvas";
import type {
  CurvaGroupBy,
  CurvaMetric,
  CurvaVista,
} from "@/lib/marketing/curvas";
import type { Country } from "@/lib/queries/comunidad";

interface Props {
  events: CurvaEventOption[];
  tipoTicketOptions: { tipoTicket: string; tickets: number }[];
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

/** Marca "ninguno seleccionado" (distinto de "sin filtro" = param ausente). */
const NONE = "__none__";

// Campos de glovox.categoriaEvento expuestos como facetas encadenadas. El
// evento es el nivel más granular: value = eventoId, label = NombreGlovox.
type FacetField =
  | "categoriaEvento"
  | "categoriaEvento2"
  | "categoriaEvento3"
  | "temporada"
  | "eventoId";

const FACETS: { param: string; field: FacetField; label: string }[] = [
  { param: "categorias", field: "categoriaEvento", label: "Categoría de evento" },
  { param: "categorias2", field: "categoriaEvento2", label: "Categoría 2 (familia)" },
  { param: "categorias3", field: "categoriaEvento3", label: "Categoría 3 (edición)" },
  { param: "temporadas", field: "temporada", label: "Temporada" },
  { param: "eventos", field: "eventoId", label: "Evento" },
];

const TIPO_PARAM = "tipos";

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
  tipoTicketOptions,
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

  // Valores de la URL por faceta.
  const urlByParam = useMemo(() => {
    const sp = new URLSearchParams(search);
    const m: Record<string, string[]> = {};
    for (const f of FACETS) m[f.param] = sp.getAll(f.param);
    m[TIPO_PARAM] = sp.getAll(TIPO_PARAM);
    return m;
  }, [search]);

  // Opciones por faceta. Las categorías/temporada usan el texto como value y
  // label; el evento usa eventoId como value y NombreGlovox como label.
  const optionsByField = useMemo(() => {
    const m = {} as Record<FacetField, { value: string; label: string }[]>;
    for (const f of FACETS) {
      if (f.field === "eventoId") {
        m[f.field] = events
          .filter((e) => e.eventoId)
          .map((e) => ({
            value: e.eventoId,
            label: e.nombre ? `${e.eventoId} — ${e.nombre}` : e.eventoId,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "es"));
      } else {
        m[f.field] = [...new Set(events.map((e) => e[f.field]).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "es"))
          .map((v) => ({ value: v, label: v }));
      }
    }
    return m;
  }, [events]);

  const valuesByField = useMemo(() => {
    const m = {} as Record<FacetField, string[]>;
    for (const f of FACETS) m[f.field] = optionsByField[f.field].map((o) => o.value);
    return m;
  }, [optionsByField]);

  // Selección efectiva por campo: null = sin restricción (todos seleccionados).
  const effByField = useMemo(() => {
    const m = {} as Record<FacetField, Set<string> | null>;
    for (const f of FACETS) {
      const url = urlByParam[f.param];
      if (url.length === 0) m[f.field] = null;
      else if (url.length === 1 && url[0] === NONE) m[f.field] = new Set<string>();
      else m[f.field] = new Set(url);
    }
    return m;
  }, [urlByParam]);

  const selectedByField = useMemo(() => {
    const m = {} as Record<FacetField, Set<string>>;
    for (const f of FACETS) {
      const eff = effByField[f.field];
      m[f.field] = eff === null ? new Set(valuesByField[f.field]) : eff;
    }
    return m;
  }, [effByField, valuesByField]);

  // Disponibilidad encadenada: por faceta, los valores compatibles con la
  // selección de las OTRAS facetas. Las incompatibles se atenúan (no se
  // esconden) para que se vea qué combinaciones existen.
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

  // Categoría 3 solo tiene contenido real en las familias que numeran sus
  // ediciones (Piknic, After Piknic, …). En el resto vale 'Otro', así que la
  // faceta se muestra solo si hay al menos una edición distinta de 'Otro'
  // compatible con la selección actual.
  const cat3Util = useMemo(
    () =>
      [...availableByField.categoriaEvento3].some(
        (v) => v && v.toLowerCase() !== "otro",
      ),
    [availableByField],
  );

  const tipoOptions = useMemo(
    () =>
      tipoTicketOptions.map((t) => ({
        value: t.tipoTicket,
        label: `${t.tipoTicket} · ${t.tickets.toLocaleString("es-CL")}`,
      })),
    [tipoTicketOptions],
  );
  const tipoValues = useMemo(() => tipoOptions.map((o) => o.value), [tipoOptions]);
  const tipoSelected = useMemo(() => {
    const url = urlByParam[TIPO_PARAM];
    if (url.length === 0) return new Set(tipoValues);
    if (url.length === 1 && url[0] === NONE) return new Set<string>();
    return new Set(url);
  }, [urlByParam, tipoValues]);
  const tipoAvailable = useMemo(() => new Set(tipoValues), [tipoValues]);

  function commit(patch: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(search);
    for (const [key, value] of Object.entries(patch)) {
      params.delete(key);
      if (value !== null) {
        if (Array.isArray(value)) for (const v of value) params.append(key, v);
        else params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `/marketing/curvas?${qs}` : "/marketing/curvas", {
      scroll: false,
    });
  }

  /** Multi-select → param repetible. Todos = param ausente; ninguno = NONE. */
  function onMultiChange(param: string, all: string[]) {
    return (_name: string, next: Set<string>) => {
      const value =
        next.size === all.length ? null : next.size === 0 ? [NONE] : [...next];
      commit({ [param]: value });
    };
  }

  const anyFacetActive =
    FACETS.some((f) => urlByParam[f.param].length > 0) ||
    urlByParam[TIPO_PARAM].length > 0;
  const hasActiveFilters =
    anyFacetActive ||
    country !== "all" ||
    comunidad !== "todos" ||
    incluirDevueltos ||
    incluirCortesias ||
    groupBy !== "evento" ||
    metric !== "tickets" ||
    vista !== "acumulado" ||
    normalizar ||
    !promedio;

  return (
    <section className="flex flex-col gap-4">
      {/* Fila 1: universo de eventos (facetas encadenadas) + tipo de ticket */}
      <div className="flex flex-wrap items-end gap-3">
        {FACETS.map((f) => {
          if (f.field === "categoriaEvento3" && !cat3Util) return null;
          if (optionsByField[f.field].length === 0) return null;
          return (
            <MultiSelectFilter
              key={f.param}
              name={f.param}
              label={f.label}
              options={optionsByField[f.field]}
              available={availableByField[f.field]}
              selected={selectedByField[f.field]}
              onChange={onMultiChange(f.param, valuesByField[f.field])}
            />
          );
        })}
        {tipoOptions.length > 0 && (
          <MultiSelectFilter
            name={TIPO_PARAM}
            label="Tipo de ticket"
            options={tipoOptions}
            available={tipoAvailable}
            selected={tipoSelected}
            onChange={onMultiChange(TIPO_PARAM, tipoValues)}
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
          onSelect={(id) => commit({ metrica: id === "tickets" ? null : id })}
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
