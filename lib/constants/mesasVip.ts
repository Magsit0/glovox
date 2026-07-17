/**
 * Reglas de negocio de Mesas VIP.
 *
 * El usuario imputa el PRECIO (lo que paga el cliente). Si la venta es exenta
 * no hay IVA (neto = precio); si es afecta, el precio es bruto y el neto se
 * deriva ÷1,19 (ver lib/constants/tax.ts). El CONSUMO (25%) es informativo.
 */

import { brutoToNeto } from "./tax";

/**
 * El consumo (crédito de barra) asociado a una mesa es el 25% de su precio.
 * Es un valor derivado — no se inputa ni se persiste.
 */
export const CONSUMO_RATE = 0.25;

export function consumoFromPrecio(precio: number): number {
  if (!Number.isFinite(precio)) return 0;
  return Math.round(precio * CONSUMO_RATE);
}

// ------------------------------------------------------------------ IVA
// `precio` = lo que paga el cliente. Si la venta es EXENTA no hay IVA
// (neto = precio); si es AFECTA, el precio es bruto (IVA incluido) → el neto se
// deriva ÷1,19 (ver lib/constants/tax.ts). Centralizado para que input, queries
// y cierre usen exactamente la misma fórmula.

export function netoFromPrecio(precio: number, exento: boolean): number {
  if (!Number.isFinite(precio)) return 0;
  return exento ? Math.round(precio) : brutoToNeto(precio);
}

export function ivaFromPrecio(precio: number, exento: boolean): number {
  if (!Number.isFinite(precio)) return 0;
  return exento ? 0 : Math.round(precio) - brutoToNeto(precio);
}

/**
 * Estado de pago de una venta de mesa. Control operativo (canal informal):
 * como el pago entra por transferencia y finanzas lo atribuye a GLOVOX SPA,
 * no se puede derivar automáticamente si el cliente está al día — se marca
 * a mano.
 *  - pendiente: sin pago recibido
 *  - abono: pagó una parte (seña)
 *  - pagado: al día
 */
export const ESTADOS_PAGO = ["pendiente", "abono", "pagado"] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const ESTADO_PAGO_DEFAULT: EstadoPago = "pendiente";

export function normalizeEstadoPago(v: unknown): EstadoPago {
  return v === "abono" || v === "pagado" ? v : "pendiente";
}

/** Metadatos de UI por estado (label + colores brutalistas). */
export const ESTADO_PAGO_META: Record<
  EstadoPago,
  { label: string; short: string; bg: string; fg: string }
> = {
  pendiente: { label: "Pendiente", short: "P", bg: "#FFFFFF", fg: "#000000" },
  abono: { label: "Abono", short: "A", bg: "#FFA500", fg: "#000000" },
  pagado: { label: "Pagado", short: "✓", bg: "#00A000", fg: "#FFFFFF" },
};

/** Devuelve el siguiente estado en el ciclo pendiente → abono → pagado → …. */
export function nextEstadoPago(e: EstadoPago): EstadoPago {
  const i = ESTADOS_PAGO.indexOf(e);
  return ESTADOS_PAGO[(i + 1) % ESTADOS_PAGO.length];
}
