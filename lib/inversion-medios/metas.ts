/**
 * Helpers CLIENT-SAFE de las metas del evento (goalTickets / budgetPm) que
 * define el editor único desde el drill. Los usan el input del cliente y la
 * server action, así que los dos validan con la misma regla.
 */

export const CAMPOS_META = ["goalTickets", "budgetPm"] as const;
export type CampoMeta = (typeof CAMPOS_META)[number];

export function esCampoMeta(v: unknown): v is CampoMeta {
  return typeof v === "string" && (CAMPOS_META as readonly string[]).includes(v);
}

/**
 * Valor ACTUAL de la celda en la hoja, base de la edición y de la verificación
 * de conflicto: número, null (vacía) o el texto tal cual si alguien escribió
 * algo que no es número ("TBD"), para poder reemplazarlo.
 */
export type BaseMeta = number | string | null;

/** Tope de cordura por campo: un dedo de más no debe llegar a la hoja. */
export const MAX_META: Record<CampoMeta, number> = {
  goalTickets: 1_000_000,
  budgetPm: 5_000_000,
};

/**
 * Texto del input → entero. Acepta "12000" y "12.000" (punto de miles, como se
 * escribe en Chile); "" borra la meta (null). Cualquier otra cosa — decimales,
 * comas, negativos, letras — es `undefined` (inválido): las dos columnas son
 * INT64 y "1,5" no debe convertirse en 15.
 */
export function parseMeta(texto: string): number | null | undefined {
  const s = texto.trim();
  if (s === "") return null;
  if (!/^\d+$/.test(s) && !/^\d{1,3}(\.\d{3})+$/.test(s)) return undefined;
  const n = Number(s.replace(/\./g, ""));
  return Number.isSafeInteger(n) ? n : undefined;
}
