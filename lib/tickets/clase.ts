/**
 * Clase de ticket: VENTA, PASE TEMPORADA, CORTESIA o MESA VIP.
 *
 * La declara `glovox.tickets.ventaNoventa` (desde 2026-10-28, para TODAS las
 * ticketeras). Cada ticketera decide su clase en su propio bloque de la vista
 * (data-governance/schemas/bigquery/views/glovox_tickets.sql):
 *  - PuntoTicket / TeleTicket: MedioPago = 'Otro' → CORTESIA, MESA VIP o
 *    PASE TEMPORADA (según TipoTicket); el resto → VENTA.
 *  - FeverUp: payment_method 'Free' o precio unitario <= 0,01 → CORTESIA; el
 *    resto → VENTA. Fever nunca usa MedioPago = 'Otro'.
 *
 * Las queries LEEN esa columna; nunca recalculan la clase con MedioPago ni con
 * el precio. La regla de 'Otro' solo existe en PuntoTicket/TeleTicket: aplicada
 * a Fever dejaba sus cortesías (38% de sus filas) contadas como venta.
 *
 * Módulo CLIENT-SAFE (solo constantes): lo usan queries, scripts y componentes.
 */

export type Clase = "VENTA" | "PASE TEMPORADA" | "CORTESIA" | "MESA VIP";

/** Clases que cuentan como venta. ÚNICO lugar donde se define la lista. */
export const CLASES_VENTA: readonly Clase[] = ["VENTA", "PASE TEMPORADA"];

/** Clases que no son venta: entradas liberadas. */
export const CLASES_CORTESIA: readonly Clase[] = ["CORTESIA", "MESA VIP"];

/** Lista SQL literal, p. ej. `('VENTA', 'PASE TEMPORADA')`. Solo constantes de código. */
export function sqlClases(clases: readonly Clase[]): string {
  return `(${clases.map((c) => `'${c}'`).join(", ")})`;
}

/**
 * Predicado SQL "el ticket cuenta como venta": `<col> IN ('VENTA', 'PASE TEMPORADA')`.
 * `col` es la columna `ventaNoventa` con el alias que use la query (p. ej.
 * `t.ventaNoventa`). No incluye el filtro de devoluciones: cada query decide.
 */
export function esVentaSql(col = "ventaNoventa"): string {
  return `${col} IN ${sqlClases(CLASES_VENTA)}`;
}
