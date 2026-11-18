/** Formato de fechas de hitos en las presentaciones de cierre. */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-02" → "2-oct"; agrega el año si no es el del evento. */
export function fechaCorta(iso: string, anioEvento?: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = `${d}-${MESES[m - 1]}`;
  return anioEvento && y !== anioEvento ? `${base}-${String(y).slice(2)}` : base;
}

/** Días corridos entre `iso` y el día del evento (positivo = antes). */
export function diasAntes(iso: string, eventoIso: string): number {
  const a = Date.UTC(...(iso.split("-").map(Number) as [number, number, number]));
  const b = Date.UTC(...(eventoIso.split("-").map(Number) as [number, number, number]));
  return Math.round((b - a) / 86_400_000);
}

/** Fecha ISO "yyyy-mm-dd" válida (sin hora). */
export const FECHA_ISO_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
