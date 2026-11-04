/**
 * Las dos llaves de un evento — módulo CLIENT-SAFE (sin imports de servidor).
 *
 * - `ID` (columna A de la hoja CategoriaEvento, ej. `1248-CL-TKM`): la IDENTIDAD
 *   del evento. Nace con el alta y nunca cambia: correlativo global de 4 dígitos
 *   + país + código de marca (lista fija, pestaña «Marcas» de la hoja). Es la
 *   llave del plan de /inversion-medios desde 2026-11-04, porque se planifica
 *   antes de que la ticketera entregue el EventoID.
 * - `EventoID` (columna B, ej. `GLO213` o `660905` en Fever): lo entrega la
 *   ticketera cuando el evento empieza a vender. Es la llave de CRUCE: va al
 *   inicio del nombre de cada campaña y en cada ticket. Puede faltar (evento aún
 *   sin venta) y un evento tiene uno solo.
 */

/** `1248-CL-TKM`: correlativo, país (ISO-2) y código de marca. */
export const ID_HOJA_RE = /^\d{4}-[A-Z]{2}-[A-Z]{3}$/;

/** EventoID de la ticketera: alfanumérico (GLO213, GLP007, GLB001) o Fever (660905). */
export const EVENTO_ID_TICKETERA_RE = /^([A-Z]{2,4}\d{2,4}|\d{5,6})$/;

/** Código de marca del ID (tres letras mayúsculas). */
export const CODIGO_MARCA_RE = /^[A-Z]{3}$/;

export function esIdHoja(v: string): boolean {
  return ID_HOJA_RE.test(v);
}

/** Correlativo de un ID (`1248-CL-TKM` → 1248); NaN si no tiene el formato. */
export function correlativoIdHoja(id: string): number {
  return ID_HOJA_RE.test(id) ? Number(id.slice(0, 4)) : NaN;
}

/**
 * Siguiente ID libre: el correlativo es GLOBAL (no por país ni por marca), así
 * que es el mayor + 1 sobre TODOS los IDs de la hoja, incluidos los cancelados.
 */
export function siguienteIdHoja(idsExistentes: string[], pais: string, marca: string): string {
  const max = idsExistentes.reduce((m, id) => {
    const c = correlativoIdHoja(id);
    return Number.isFinite(c) ? Math.max(m, c) : m;
  }, 0);
  return `${String(max + 1).padStart(4, "0")}-${pais.toUpperCase()}-${marca.toUpperCase()}`;
}
