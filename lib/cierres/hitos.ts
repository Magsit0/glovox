/** Formato de fechas de hitos en las presentaciones de cierre. */

import type { Tone } from "@/components/cierres/deck/primitives";

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

/** Suma `dias` corridos a una fecha ISO. */
export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** «32 días antes», «4 días después», «el mismo día del evento». */
export function textoDias(dias: number): string {
  if (dias === 0) return "el mismo día del evento";
  const n = Math.abs(dias);
  return `${n} ${n === 1 ? "día" : "días"} ${dias > 0 ? "antes" : "después"}`;
}

/** Cómo se lee en la lámina una fecha clave de la carta Gantt. */
export interface ConfigFechaClave {
  /** «Se confirmó», «Se entregó». */
  verbo: string;
  /** Antepuesto al plazo, p. ej. «ideal ». */
  prefijoPlazo?: string;
  /** Día contra el que se cuentan los días (ISO): el del evento o, si el
   *  hito es posterior, el último día del evento. */
  base: string;
}

/**
 * Fila de un punto de control que sale de una fecha clave de la carta Gantt:
 * plazo (si la categoría lo tiene), qué pasó y estado. `fc.plazoDias` y los
 * días van con signo: positivo = antes de `base`, negativo = después. Sin
 * tarea marcada, se deja el texto de la fila y solo se pone el plazo.
 */
export function aplicarFechaClave<T extends { plazo: string; quePaso: string; estado: string; tone: Tone }>(
  fila: T,
  fc: { fecha: string | null; plazoDias: number | null } | null,
  cfg: ConfigFechaClave,
): T {
  const anio = Number(cfg.base.slice(0, 4));
  const plazo = fc?.plazoDias ?? null;
  const conPlazo =
    plazo != null
      ? { plazo: `${cfg.prefijoPlazo ?? ""}${textoDias(plazo)} · ${fechaCorta(sumarDias(cfg.base, -plazo), anio)}` }
      : {};
  if (!fc?.fecha) return { ...fila, ...conPlazo };
  const dias = diasAntes(fc.fecha, cfg.base);
  const quePaso = `${cfg.verbo} el ${fechaCorta(fc.fecha, anio)}, ${textoDias(dias)}, según la carta Gantt.`;
  if (plazo == null) return { ...fila, quePaso, estado: "plazo por definir", tone: "neutral" as Tone };
  return dias >= plazo
    ? { ...fila, ...conPlazo, quePaso, estado: "a tiempo", tone: "success" as Tone }
    : { ...fila, ...conPlazo, quePaso, estado: `${plazo - dias} días tarde`, tone: "error" as Tone };
}
