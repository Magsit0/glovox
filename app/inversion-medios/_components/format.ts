/** USD compacto para la grilla: `$1,234` (0 dec), `$1,234.50` (2 dec), `-$50`. */
export function fmtUsd(value: number, digits: 0 | 2 = 2): string {
  const num = Number(value || 0);
  return (
    (num < 0 ? "-" : "") +
    "$" +
    Math.abs(num).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

/** '2026-07-14' → '14 jul'. */
export function fmtDiaCorto(iso: string): string {
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]}`;
}

// ---------- Métricas de rendimiento (Fase 1) ----------
// Los formateadores de conteos, ratios y costos unitarios NO se redefinen acá:
// son los mismos de `/paid-media` y viven en `lib/format/paid.ts`. Se re-exportan
// para que los componentes de esta ruta tengan un solo lugar de importación.
export {
  compactInt,
  div,
  formatInt,
  formatRatio,
  formatRoas,
  formatUnitCost,
} from "@/lib/format/paid";

import { formatInt } from "@/lib/format/paid";

/** Porcentaje YA en 0..100 → "52%". Tolera >100% (el plan puede pasarse del
 *  techo, y la venta puede pasarse de la meta). `null` → "—", nunca 0. */
export function fmtPct(v: number | null | undefined, dec = 0): string {
  return v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(dec)}%`;
}

/**
 * Conversiones: entero si es entero, un decimal si no.
 *
 * Google declara FRACCIONES (73 de 171 filas con conversiones en 2026; Meta 0 de
 * 1.622). El guard es `!(v > 0)` y no `=== 0` a propósito: con `=== 0` un valor
 * de 0,4 pasaría el filtro y se imprimiría como "0", afirmando que no hubo
 * conversiones cuando hubo una fracción de una.
 */
export function fmtConv(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || !(v > 0)) return "—";
  return v % 1 === 0 ? formatInt(v) : v.toFixed(1);
}
