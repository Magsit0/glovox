/**
 * Formatos de número y fecha de Venta Diaria (`/marketing/weekly`).
 * Módulo CLIENT-SAFE: lo usan la página (server) y los componentes cliente.
 */

import type { Moneda } from "./atribucion";

/** USD con 1 decimal, sin separador de miles (formato histórico del panel Paid Media). */
export const fmtUsd = (v: number) => "US$" + v.toFixed(1);

/** Monto USD o "—" cuando no aplica (CPA sin gasto o sin compras). */
export const fmtUsdOGuion = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : fmtUsd(v));

/**
 * Porcentaje en PUNTOS PORCENTUALES (85.63 → "85,6%"), no una fracción.
 * Es la unidad de todos los `pct`/`conv` de lib/marketing/atribucion.ts
 * (usa `pct(parte, total)` para calcularlo). null o no finito → "—".
 */
export function fmtPct(v: number | null, dec = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + "%";
}

const FECHA_CORTA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-09-17" → "17 sept". Fecha de calendario (sin zona): se arma en UTC. */
export function fmtFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return FECHA_CORTA.format(Date.UTC(y, m - 1, d));
}

// Formato compacto de la tira de KPIs ("$12,7 M"), compartido con la sección de atribución.
const COMPACTO = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

/** CLP compacto con "$" ("$12,7 M"), el de la tira de KPIs; "—" si no es finito. */
export const fmtClpCompact = (v: number) => (Number.isFinite(v) ? "$" + COMPACTO.format(Math.round(v)) : "—");

/** Símbolo de la moneda de venta: "$" (CLP) o "S/" (PEN, Fever Lima). */
export const simboloMoneda = (m: Moneda) => (m === "PEN" ? "S/ " : "$");

/** Venta compacta en la moneda del evento: "$12,7 M" (CLP) o "S/ 154,5 mil" (PEN). */
export const fmtVentaCompact = (v: number, m: Moneda) =>
  Number.isFinite(v) ? simboloMoneda(m) + COMPACTO.format(Math.round(v)) : "—";
