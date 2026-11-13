/**
 * Facetas de `/marketing/curvas`.
 *
 * Las 5 facetas de `glovox.categoriaEvento` (categoría, categoría 2, categoría
 * 3, temporada, evento) más el tipo de ticket siguen la regla única de filtros
 * del proyecto (`lib/filters/facetas.ts`, la de Power BI / Looker / Metabase):
 *
 *   1. Selección vacía = "Todos". No existe "ninguno".
 *   2. Un filtro nunca modifica a otro: cambiar o limpiar una faceta escribe
 *      SOLO su propio param de la URL. Nada de purgas ni resets en cascada.
 *   3. El encadenamiento acota las OPCIONES de cada dropdown, no las
 *      selecciones: cada uno ofrece lo compatible con los otros cinco más lo ya
 *      elegido (lo elegido que quedó incompatible se ve atenuado). Si la
 *      combinación no deja ningún evento, `enConflicto` dice qué filtros chocan
 *      y la UI ofrece limpiarlos uno por uno.
 *
 * El encadenamiento es bidireccional: elegir una familia acota los tipos de
 * ticket, y elegir un tipo de ticket acota los eventos y sus categorías. El
 * tipo es una faceta multivaluada (los tipos que vende cada evento): un evento
 * calza si vende al menos uno de los elegidos.
 *
 * Acá solo se declaran las facetas sobre `CurvaEventOption`; la mecánica vive
 * en `lib/filters/`. Puro y sin React, para poder verificarlo sin montar
 * `components/marketing/CurvasFilters.tsx`, que es solo la UI.
 */
import { calza, type Faceta, type Selecciones } from "@/lib/filters/facetas";
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
 * Eventos con al menos un ticket bajo los filtros de fila vigentes (comunidad,
 * devoluciones, cortesías): los que tienen tipos en el mapa, que es la misma
 * query que el gráfico sin la condición de tipo. Son los únicos que pueden dar
 * filas, así que las facetas se calculan sobre ellos: un evento sin venta con
 * esos filtros no se ofrece y, si viene seleccionado, se ve atenuado y salta el
 * aviso de conflicto en vez de un gráfico vacío sin explicación.
 */
export function eventosConTickets(
  events: readonly CurvaEventOption[],
  idx: TiposIndex,
): CurvaEventOption[] {
  return events.filter((e) => idx.tiposByEvento.has(e.eventoId));
}

/**
 * Las seis facetas de la fila 1. La `key` de cada una es su param de la URL,
 * así limpiar una faceta (desde su dropdown o desde el aviso de conflicto) es
 * borrar ese param y nada más.
 */
export function facetasCurvas(idx: TiposIndex): Faceta<CurvaEventOption>[] {
  return [
    ...CURVA_FACETS.map(
      (f): Faceta<CurvaEventOption> => ({ key: f.param, valores: (e) => e[f.field] }),
    ),
    {
      key: TIPO_PARAM,
      valores: (e) => {
        const own = idx.tiposByEvento.get(e.eventoId);
        return own ? [...own] : null;
      },
    },
  ];
}

/**
 * Volumen (tickets) de cada tipo de ticket sumado sobre los eventos compatibles
 * con las OTRAS facetas: la selección propia de tipos no cuenta, igual que en
 * `disponibles`. Sirve para ordenar el dropdown por relevancia real.
 */
export function volumenTipos(
  events: readonly CurvaEventOption[],
  facetas: readonly Faceta<CurvaEventOption>[],
  sel: Selecciones,
  idx: TiposIndex,
): Map<string, number> {
  const omitir = new Set([TIPO_PARAM]);
  const out = new Map<string, number>();
  for (const e of events) {
    if (!calza(e, facetas, sel, omitir)) continue;
    const own = idx.tiposByEvento.get(e.eventoId);
    if (!own) continue;
    for (const t of own) {
      const vol = idx.ticketsPorPar.get(`${e.eventoId}|${t}`) ?? 0;
      out.set(t, (out.get(t) ?? 0) + vol);
    }
  }
  return out;
}
