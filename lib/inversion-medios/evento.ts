/**
 * Helpers CLIENT-SAFE del CALENDARIO PROPIO del evento (sus días).
 *
 * `categoriaEvento` guarda la fecha del evento (`Fecha`) y **cuántos días dura**
 * (`dias`, INT64). Un evento de 2 días corre en `Fecha` y `Fecha + 1`; uno de 4
 * (PPR025) en `Fecha`..`Fecha + 3`. Hasta el 2026-08-28 todo el panel asumía UN
 * día y eso rompía dos cosas en los eventos multi-día:
 *
 *  1. **El resaltado ámbar** marcaba solo el primer día, así que el resto de los
 *     días del evento se veían como días cualquiera — con gasto y venta reales.
 *     Medido: GLO197 (Bocas Moradas 8, `dias`=2) gastó $295,08 y vendió 326
 *     tickets el 2026-03-29, su SEGUNDO día, sin ninguna marca.
 *  2. **La ventana del drill** terminaba en el primer día, así que en un evento
 *     futuro los días 2..n NO TENÍAN COLUMNA y no se podía ni planificar.
 *     GLO207 (Bocas Moradas 10, 2026-09-05, `dias`=2) no tenía el 06-09.
 *
 * Hay 10 eventos con `dias > 1`: 7 de 2 días (Bocas Moradas 6-10, La Cava Jumbo
 * 2025, DGTL 2023), 2 de 3 (FDS 25, La Cava Jumbo 2026) y 1 de 4 (Yein Fonda).
 *
 * Aritmética en UTC a propósito: estas fechas son etiquetas `YYYY-MM-DD` del
 * calendario, no instantes, y sumar días en hora local metería saltos en los
 * cambios de horario. Es el mismo criterio de `listDays`.
 */

/** Suma días a una fecha ISO `YYYY-MM-DD`. */
export function addDiasIso(iso: string, dias: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Normaliza `dias` del catálogo: cualquier cosa rara cae a 1 día. */
export function normDias(dias: number | null | undefined): number {
  const n = Number(dias);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * Último día del evento. Con `dias`=1 es la fecha misma; con `dias`=2, la fecha
 * +1. Devuelve "" si no hay fecha declarada.
 */
export function ultimoDiaEvento(fechaEvento: string, dias: number | null | undefined): string {
  if (!fechaEvento) return "";
  return addDiasIso(fechaEvento, normDias(dias) - 1);
}

/**
 * ¿Esta fecha es UNO de los días del evento? Es el predicado del resaltado
 * ámbar: con `dias`=2 son dos columnas, no una.
 */
export function esDiaEvento(
  fecha: string,
  fechaEvento: string,
  dias: number | null | undefined,
): boolean {
  if (!fechaEvento || !fecha) return false;
  return fecha >= fechaEvento && fecha <= ultimoDiaEvento(fechaEvento, dias);
}

/**
 * Texto del tooltip de una columna que cae en el evento. En multi-día dice qué
 * día es, porque "Día del evento" repetido en dos columnas no informa cuál.
 */
export function tituloDiaEvento(
  fecha: string,
  fechaEvento: string,
  dias: number | null | undefined,
): string {
  const total = normDias(dias);
  if (total <= 1) return "Día del evento";
  const idx =
    Math.round(
      (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${fechaEvento}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  return `Día ${idx} de ${total} del evento`;
}
