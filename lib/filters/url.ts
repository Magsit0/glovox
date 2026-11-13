/**
 * Lectura y escritura de filtros multi-selección en la URL.
 *
 * Regla única: param ausente = "Todos". Un filtro se guarda como param repetido
 * (`?eventos=GLO181&eventos=GLO213`) y se borra entero cuando queda vacío.
 */

/**
 * Centinela que usaban los filtros viejos para "ninguno seleccionado". Ese
 * estado ya no existe; los links guardados que lo traen se leen como "Todos".
 */
export const NINGUNO_LEGADO = "__none__";

function limpiar(values: readonly string[]): string[] {
  return values.filter((v) => Boolean(v) && v !== NINGUNO_LEGADO);
}

/** Cliente: selección de un param repetible. Vacía = "Todos". */
export function leerSeleccion(
  sp: { getAll(name: string): string[] },
  param: string,
): Set<string> {
  return new Set(limpiar(sp.getAll(param)));
}

/** Cliente: reemplaza un param repetible. Selección vacía = borra el param. */
export function escribirSeleccion(
  params: URLSearchParams,
  param: string,
  sel: Iterable<string>,
): void {
  params.delete(param);
  for (const v of limpiar([...sel])) params.append(param, v);
}

/**
 * Selección lista para guardar. Si cubre el universo ENTERO de la faceta (no lo
 * visible: es "Seleccionar todos" sin otro filtro acotando) se guarda como
 * "Todos" (`[]`): filtra lo mismo, no arrastra a la URL listas de cientos de
 * valores (Vercel corta en 14 KB) y sigue incluyendo los valores que aparezcan
 * después o que no estén en el catálogo. Cualquier otra selección va tal cual,
 * así "todos los eventos de FDS menos uno" sigue siendo una lista.
 */
export function normalizarSeleccion(
  sel: Iterable<string>,
  universo: Iterable<string>,
): string[] {
  const lista = limpiar([...sel]);
  const elegidos = new Set(lista);
  let n = 0;
  for (const v of universo) {
    if (!v) continue;
    if (!elegidos.has(v)) return lista;
    n++;
  }
  return n > 0 ? [] : lista;
}

/**
 * Query string con la selección de UN filtro reemplazada. Los demás params
 * (otros filtros, toggles, tab) quedan exactamente como estaban.
 */
export function reemplazarSeleccion(
  search: string,
  param: string,
  sel: Iterable<string>,
): string {
  const params = new URLSearchParams(search);
  escribirSeleccion(params, param, sel);
  return params.toString();
}

/** Servidor: normaliza un searchParam repetible de la page. `[]` = "Todos". */
export function valoresDeParam(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return limpiar(Array.isArray(v) ? v : [v]);
}
