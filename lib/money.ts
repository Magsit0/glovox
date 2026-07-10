/**
 * Formateo de moneda currency-aware (client-safe: solo Intl, sin deps de server).
 *
 * A diferencia de `lib/unabase/formatting.ts` (fijo a CLP), acá la moneda es un
 * parámetro: el gasto de Google Cloud puede facturarse en USD o CLP según la
 * cuenta, y el dato trae su propio código ISO.
 */

const FRACTION_DIGITS: Record<string, number> = { CLP: 0, USD: 2 };

function fractionDigits(currency: string): number {
  return FRACTION_DIGITS[currency] ?? 2;
}

/** `$12.345` (CLP) · `US$1,234.56` (USD). Locale es-CL. */
export function formatMoney(value: unknown, currency = "CLP"): string {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

/** Compacto para ejes/labels: `$1,2M`, `$340K`. Sin decimales de moneda. */
export function compactMoney(value: unknown): string {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${Math.round(num)}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** 'YYYY-MM' → 'jul 25'. Sin construir Date (evita corrimientos de zona horaria). */
export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1] ?? m} ${y.slice(2)}`;
}
