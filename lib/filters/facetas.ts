/**
 * Filtros encadenados (facetas) — regla única para todo el proyecto.
 *
 * Tres reglas, las mismas que usan Power BI, Looker, Metabase y Superset:
 *
 *   1. Selección vacía = "Todos". No existe el estado "ninguno": un filtro sin
 *      nada marcado no restringe.
 *   2. Un filtro nunca modifica a otro. Cambiar o limpiar una faceta solo toca
 *      su propia selección; las demás quedan exactamente como estaban.
 *   3. El encadenamiento acota las OPCIONES, no las selecciones. Un valor que
 *      deja de ser compatible sigue seleccionado (la UI lo muestra atenuado) y
 *      vuelve a servir si el otro filtro se revierte. Si la combinación no
 *      deja ningún resultado, `enConflicto` dice qué filtros chocan para
 *      ofrecer limpiarlos.
 *
 * Puro y sin React, para poder verificarlo sin montar componentes
 * (`npm run test:filtros`).
 */

/** Selección de un filtro. Vacía = "Todos" (sin restricción). */
export type Seleccion = ReadonlySet<string>;

/** Selección de todas las facetas, por `key`. Una key ausente = "Todos". */
export type Selecciones = Readonly<Record<string, Seleccion | undefined>>;

export interface Faceta<T> {
  key: string;
  /**
   * Valores del ítem en esta faceta: uno, o varios si es multivaluada (un
   * evento vende varios tipos de ticket). Los vacíos se ignoran.
   */
  valores: (item: T) => string | readonly string[] | null | undefined;
  /**
   * Facetas cuya selección NO acota las opciones de esta. Sirve para
   * jerarquías de un solo sentido (padre → hijo): el padre declara a sus hijos
   * acá y así elegir un hijo no le esconde opciones al padre.
   */
  ignora?: readonly string[];
}

function valoresDe<T>(f: Faceta<T>, item: T): readonly string[] {
  const v = f.valores(item);
  if (v == null || v === "") return [];
  if (typeof v === "string") return [v];
  return v.filter(Boolean);
}

/** ¿El ítem pasa la selección de esta faceta? Vacía = pasa siempre. */
function pasa<T>(f: Faceta<T>, item: T, sel: Seleccion | undefined): boolean {
  if (!sel || sel.size === 0) return true;
  for (const v of valoresDe(f, item)) if (sel.has(v)) return true;
  return false;
}

/**
 * ¿El ítem pasa todas las facetas? `omitir` deja fuera las facetas indicadas:
 * al calcular las opciones de una faceta, su propia selección no puede
 * acotarse a sí misma (o el dropdown solo mostraría lo ya elegido).
 */
export function calza<T>(
  item: T,
  facetas: readonly Faceta<T>[],
  sel: Selecciones,
  omitir?: ReadonlySet<string>,
): boolean {
  for (const f of facetas) {
    if (omitir?.has(f.key)) continue;
    if (!pasa(f, item, sel[f.key])) return false;
  }
  return true;
}

/** Ítems que pasan todas las facetas. */
export function filtrar<T>(
  items: readonly T[],
  facetas: readonly Faceta<T>[],
  sel: Selecciones,
): T[] {
  return items.filter((item) => calza(item, facetas, sel));
}

/**
 * Valores que cada faceta puede ofrecer dado lo elegido en las otras.
 * La selección propia (y la de las facetas que declara en `ignora`) no cuenta.
 */
export function disponibles<T>(
  items: readonly T[],
  facetas: readonly Faceta<T>[],
  sel: Selecciones,
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const f of facetas) {
    const omitir = new Set<string>([f.key, ...(f.ignora ?? [])]);
    const set = new Set<string>();
    for (const item of items) {
      if (!calza(item, facetas, sel, omitir)) continue;
      for (const v of valoresDe(f, item)) set.add(v);
    }
    out[f.key] = set;
  }
  return out;
}

/**
 * Opciones que muestra el dropdown de una faceta: las compatibles con los
 * otros filtros (`disponibles`) más las ya seleccionadas, aunque hayan quedado
 * incompatibles, para que se vean (el componente las atenúa con `available`) y
 * se puedan desmarcar. Respeta el orden de `todas`; un valor seleccionado que
 * no está en `todas` (link viejo, cambio de país) va al final.
 */
export function opcionesVisibles(
  todas: Iterable<string>,
  disponibles: ReadonlySet<string>,
  seleccion: Seleccion | undefined,
): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const v of todas) {
    if (vistos.has(v)) continue;
    vistos.add(v);
    if (disponibles.has(v) || seleccion?.has(v)) out.push(v);
  }
  if (seleccion) for (const v of seleccion) if (!vistos.has(v)) out.push(v);
  return out;
}

/**
 * Facetas que chocan entre sí cuando la combinación no deja ningún ítem.
 *
 * Devuelve `[]` si algo calza, o si no hay nada seleccionado. Si nada calza,
 * devuelve las facetas cuya selección no tiene ningún valor compatible con el
 * resto; si el choque es de tres o más y ninguna queda aislada, devuelve todas
 * las que tienen selección (limpiar cualquiera puede destrabar).
 */
export function enConflicto<T>(
  items: readonly T[],
  facetas: readonly Faceta<T>[],
  sel: Selecciones,
): string[] {
  const activas = facetas.filter((f) => (sel[f.key]?.size ?? 0) > 0);
  if (activas.length === 0) return [];
  if (items.some((item) => calza(item, facetas, sel))) return [];

  const disp = disponibles(items, facetas, sel);
  const aisladas = activas.filter((f) => {
    for (const v of sel[f.key]!) if (disp[f.key].has(v)) return false;
    return true;
  });
  return (aisladas.length ? aisladas : activas).map((f) => f.key);
}
