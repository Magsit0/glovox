/**
 * Tax helpers for Chilean operations.
 *
 * IVA (Impuesto al Valor Agregado) chileno: 19% sobre el monto neto.
 * Centralizado acá para que tanto el preview en el form como el server-side
 * que persiste el bruto compartan exactamente la misma fórmula.
 */

export const IVA_RATE = 0.19;

/**
 * Convierte un monto neto en bruto agregando IVA. Redondea al peso entero
 * (CLP no usa decimales).
 */
export function netoToBruto(neto: number): number {
  if (!Number.isFinite(neto)) return 0;
  return Math.round(neto * (1 + IVA_RATE));
}
