/**
 * Cargos extra (CARDDA) — módulo CLIENT-SAFE (sin imports de servidor). Tipos y
 * normalización de la frecuencia de pago a costo MENSUAL y SEMANAL, para el
 * resumen que dice cuánto presupuestar. Lo comparten actions (server), la query
 * y el componente (cliente).
 */

export const METODOS_CARGO = ["anual", "mensual", "semanal", "diario"] as const;
export type MetodoCargo = (typeof METODOS_CARGO)[number];

export const METODO_LABEL: Record<MetodoCargo, string> = {
  anual: "Anual",
  mensual: "Mensual",
  semanal: "Semanal",
  diario: "Diario",
};

// Cuántos "pagos" caen en un mes / una semana promedio, por método.
const FACTOR_MENSUAL: Record<MetodoCargo, number> = {
  anual: 1 / 12,
  mensual: 1,
  semanal: 52 / 12,
  diario: 365 / 12,
};
const FACTOR_SEMANAL: Record<MetodoCargo, number> = {
  anual: 1 / 52,
  mensual: 12 / 52,
  semanal: 1,
  diario: 7,
};

type CargoLike = { montoUsd: number; metodo: string };

/** Costo normalizado a un mes promedio (USD). */
export function costoMensual(c: CargoLike): number {
  return c.montoUsd * (FACTOR_MENSUAL[c.metodo as MetodoCargo] ?? 0);
}
/** Costo normalizado a una semana promedio (USD). */
export function costoSemanal(c: CargoLike): number {
  return c.montoUsd * (FACTOR_SEMANAL[c.metodo as MetodoCargo] ?? 0);
}

/** Totales normalizados del set de cargos. */
export function resumenCargos(cargos: CargoLike[]): { mensual: number; semanal: number } {
  return {
    mensual: cargos.reduce((a, c) => a + costoMensual(c), 0),
    semanal: cargos.reduce((a, c) => a + costoSemanal(c), 0),
  };
}
