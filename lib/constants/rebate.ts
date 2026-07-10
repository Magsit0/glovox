/**
 * Reglas de negocio del REBATE (cierre de negocio · producción de eventos propios).
 *
 * El "cargo por servicio" que recauda Punto Ticket NO es ingreso Glovox
 * completo: solo un porcentaje — el rebate — es nuestro. Por defecto es 55%,
 * editable por evento (tabla `rebate_config` en Neon, keyed por EventoID).
 * El porcentaje se maneja en puntos porcentuales (55 = 55%).
 */

export const REBATE_PCT_DEFAULT = 55;

/**
 * Normaliza un porcentaje imputado: número finito acotado a [0, 100].
 * Devuelve null si el valor no es interpretable como número.
 */
export function normalizeRebatePct(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

/** Monto de rebate a partir de un monto base y un % en puntos (55 → 55%). */
export function rebateFrom(monto: number, pct: number): number {
  if (!Number.isFinite(monto) || !Number.isFinite(pct)) return 0;
  return monto * (pct / 100);
}
