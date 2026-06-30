/**
 * Temporada GLOVOX: corre de julio a junio. La etiqueta es "NN-NN" (dos
 * dígitos del año de inicio y del siguiente), p. ej. julio 2025 → "25-26".
 * Las categorías llegan formateadas como "<marca> NN-NN" (sufijo de temporada).
 */

const SEASON_TIME_ZONE = "America/Santiago";

export function twoDigitYear(year: number): string {
  return String(year % 100).padStart(2, "0");
}

/** Etiqueta "NN-NN" de la temporada vigente en la fecha dada (default: hoy). */
export function currentSeasonLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEASON_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const startYear = month >= 7 ? year : year - 1;
  return `${twoDigitYear(startYear)}-${twoDigitYear(startYear + 1)}`;
}

/**
 * ¿La categoría pertenece a la temporada vigente? El sufijo de temporada va
 * anclado al final ("<marca> NN-NN"), así que comparamos contra el final para
 * no marcar falsos positivos dentro de tiradas numéricas (p. ej. "X 125-263").
 */
export function isCurrentSeasonCategory(
  category: string,
  seasonLabel: string,
): boolean {
  return category.endsWith(` ${seasonLabel}`) || category === seasonLabel;
}
