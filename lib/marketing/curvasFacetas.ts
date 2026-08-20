/**
 * Encadenamiento de las facetas de `/marketing/curvas`.
 *
 * Las 5 facetas de `glovox.categoriaEvento` (categoría, categoría 2, categoría
 * 3, temporada, evento) más el tipo de ticket se cruzan entre sí: cada dropdown
 * muestra SOLO los valores que existen dado lo elegido en los otros. El
 * encadenamiento es bidireccional — elegir una familia acota los tipos de
 * ticket, y elegir un tipo de ticket acota los eventos y sus categorías.
 *
 * Vive acá, puro y sin React, por lo mismo que `lib/marketing/curvas.ts`: la
 * purga a punto fijo es la parte delicada y así se puede verificar sin montar
 * el componente. `components/marketing/CurvasFilters.tsx` es solo la UI.
 */
import type { CurvaEventOption, CurvaTipoTicketPar } from "@/lib/queries/curvas";

export type FacetField =
  | "categoriaEvento"
  | "categoriaEvento2"
  | "categoriaEvento3"
  | "temporada"
  | "eventoId";

export const CURVA_FACETS: { param: string; field: FacetField; label: string }[] = [
  { param: "categorias", field: "categoriaEvento", label: "Categoría de evento" },
  { param: "categorias2", field: "categoriaEvento2", label: "Categoría 2 (familia)" },
  { param: "categorias3", field: "categoriaEvento3", label: "Categoría 3 (edición)" },
  { param: "temporadas", field: "temporada", label: "Temporada" },
  { param: "eventos", field: "eventoId", label: "Evento" },
];

/** Param del filtro de tipo de ticket (no es una faceta de categoriaEvento). */
export const TIPO_PARAM = "tipos";

/** Marca "ninguno seleccionado" (distinto de "sin filtro" = param ausente). */
export const NONE = "__none__";

/** Selección de una faceta: `null` = sin restricción; Set vacío = ninguno. */
export type Sel = Set<string> | null;

export type FacetEstado = {
  byField: Record<FacetField, Sel>;
  tipos: Sel;
};

/** Índice de qué tipos de ticket vende cada evento, y con qué volumen. */
export type TiposIndex = {
  tiposByEvento: Map<string, Set<string>>;
  /** clave `eventoId|tipoTicket` → tickets */
  ticketsPorPar: Map<string, number>;
  universo: Set<string>;
};

export function buildTiposIndex(pares: CurvaTipoTicketPar[]): TiposIndex {
  const tiposByEvento = new Map<string, Set<string>>();
  const ticketsPorPar = new Map<string, number>();
  const universo = new Set<string>();
  for (const p of pares) {
    let own = tiposByEvento.get(p.eventoId);
    if (!own) {
      own = new Set<string>();
      tiposByEvento.set(p.eventoId, own);
    }
    own.add(p.tipoTicket);
    universo.add(p.tipoTicket);
    ticketsPorPar.set(`${p.eventoId}|${p.tipoTicket}`, p.tickets);
  }
  return { tiposByEvento, ticketsPorPar, universo };
}

/**
 * ¿El evento sobrevive a la selección?
 *
 * `skip` es la faceta que se está evaluando: su propia selección no puede
 * acotarse a sí misma, o el dropdown solo mostraría lo ya elegido.
 */
export function eventoMatches(
  e: CurvaEventOption,
  estado: FacetEstado,
  skip: FacetField | "tipos" | null,
  idx: TiposIndex,
): boolean {
  for (const f of CURVA_FACETS) {
    if (skip === f.field) continue;
    const s = estado.byField[f.field];
    if (s === null) continue;
    if (!s.has(e[f.field])) return false;
  }
  if (skip !== "tipos" && estado.tipos !== null) {
    const own = idx.tiposByEvento.get(e.eventoId);
    if (!own) return false;
    for (const t of estado.tipos) if (own.has(t)) return true;
    return false;
  }
  return true;
}

/**
 * Valores que se pueden ofrecer en cada faceta dado el resto de la selección.
 * Para los tipos de ticket devuelve además el volumen sumado sobre los eventos
 * compatibles, para ordenar el dropdown por relevancia real.
 */
export function compatibles(
  events: CurvaEventOption[],
  estado: FacetEstado,
  idx: TiposIndex,
): { byField: Record<FacetField, Set<string>>; tipos: Map<string, number> } {
  const byField = {} as Record<FacetField, Set<string>>;
  for (const f of CURVA_FACETS) {
    const out = new Set<string>();
    for (const e of events) {
      if (eventoMatches(e, estado, f.field, idx) && e[f.field]) out.add(e[f.field]);
    }
    byField[f.field] = out;
  }

  const tipos = new Map<string, number>();
  for (const e of events) {
    if (!eventoMatches(e, estado, "tipos", idx)) continue;
    const own = idx.tiposByEvento.get(e.eventoId);
    if (!own) continue;
    for (const t of own) {
      const vol = idx.ticketsPorPar.get(`${e.eventoId}|${t}`) ?? 0;
      tipos.set(t, (tipos.get(t) ?? 0) + vol);
    }
  }
  return { byField, tipos };
}

/**
 * Purga las selecciones que quedaron huérfanas.
 *
 * Al cambiar una faceta, las otras pueden conservar valores que ya no existen
 * en el universo resultante — y como esos valores ahora se OCULTAN, la
 * selección quedaría atrapada dando cero resultados sin forma de deshacerla.
 * La faceta que el usuario acaba de tocar (`exceptParam`) nunca se purga: su
 * acción manda y las demás se adaptan.
 *
 * Se itera a punto fijo porque purgar una faceta puede volver incompatible un
 * valor de otra. Una faceta que queda sin valores válidos se libera (`null`,
 * sin restricción) en vez de quedar en "ninguno". El `guard` acota el bucle:
 * cada pasada sin cambios lo corta, y como cada cambio solo puede QUITAR
 * valores, converge siempre.
 */
export function purgarSelecciones(
  events: CurvaEventOption[],
  estado: FacetEstado,
  exceptParam: string,
  idx: TiposIndex,
): FacetEstado {
  const byField = { ...estado.byField };
  let tipos = estado.tipos;

  let changed = true;
  for (let guard = 0; changed && guard < 8; guard++) {
    changed = false;

    for (const f of CURVA_FACETS) {
      if (f.param === exceptParam) continue;
      const s = byField[f.field];
      // null = sin restricción; Set vacío = "ninguno" elegido a propósito.
      if (s === null || s.size === 0) continue;
      const avail = new Set<string>();
      for (const e of events) {
        if (eventoMatches(e, { byField, tipos }, f.field, idx) && e[f.field]) {
          avail.add(e[f.field]);
        }
      }
      const kept = [...s].filter((v) => avail.has(v));
      if (kept.length !== s.size) {
        byField[f.field] = kept.length ? new Set(kept) : null;
        changed = true;
      }
    }

    if (exceptParam !== TIPO_PARAM && tipos !== null && tipos.size > 0) {
      const avail = new Set<string>();
      for (const e of events) {
        if (!eventoMatches(e, { byField, tipos }, "tipos", idx)) continue;
        const own = idx.tiposByEvento.get(e.eventoId);
        if (own) for (const t of own) avail.add(t);
      }
      const kept = [...tipos].filter((v) => avail.has(v));
      if (kept.length !== tipos.size) {
        tipos = kept.length ? new Set(kept) : null;
        changed = true;
      }
    }
  }

  return { byField, tipos };
}
