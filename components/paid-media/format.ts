/**
 * Formatters del dashboard de paid media.
 *
 * El panel está CONSOLIDADO: las cuentas facturan en CLP, USD y BRL, y el mart
 * `marts.paidmedia_ads_performance` las convierte con el tipo de cambio del día
 * de cada fila. La `DisplayCurrency` decide en qué unidad se EXPRESA ese
 * consolidado (USD o CLP); no cambia el scope de datos, solo la unidad.
 *
 * `formatLocalMoney` es la excepción: recibe la moneda de ORIGEN de cada cuenta
 * —que puede ser BRL, jamás una moneda de despliegue— para la lista que permite
 * cuadrar contra la factura de cada plataforma.
 *
 * Formato acordado (docs/STYLE_DASHBOARD.md → Column conventions):
 *  - USD → "$12,345.00"   (en-US, dos decimales)
 *  - CLP → "$12.345"      (es-CL, sin decimales)
 *  - BRL → "R$ 12.345,67" (pt-BR, dos decimales)
 *
 * ⚠️ Los formateadores NUMÉRICOS (conteos, ratios, costos unitarios) viven ahora
 * en `lib/format/paid.ts`, porque `/inversion-medios` usa los mismos para sus
 * métricas de rendimiento. Acá se re-exportan: ningún consumidor de esta ruta
 * cambió de import. Lo que queda propio de este archivo es lo que depende de la
 * MONEDA DE DESPLIEGUE, que es un concepto exclusivo de `/paid-media`.
 */
import type { DisplayCurrency } from "@/lib/queries/paidMedia";
import { formatter, localeForCurrency } from "@/lib/format/paid";

export {
  compactInt,
  div,
  formatInt,
  formatRatio,
  formatRoas,
  formatUnitCost,
} from "@/lib/format/paid";

/**
 * Monto en la moneda de despliegue, exacto. `null` significa "no convertido"
 * —el mart todavía no tiene tipo de cambio para esa fecha— y se pinta como
 * guion, nunca como cero: un cero afirma que no se gastó, que es lo contrario
 * de lo que pasó.
 */
export function formatMoney(
  value: number | null | undefined,
  moneda: DisplayCurrency,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const { locale, decimals } = localeForCurrency(moneda);
  const fmt = formatter(`disp-${moneda}`, () =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );
  return fmt.format(value);
}

/**
 * Versión compacta: "$12.3K", "$1.2M".
 *
 * Un decimal en la banda K/M. La versión anterior redondeaba los miles sin
 * decimales, lo cual estaba calibrado para magnitudes CLP; en un eje cuyo
 * dominio típico en dólares es 0–2.500 producía ticks repetidos y un "$3K" para
 * el valor 2.500. Por debajo de mil se usa el entero, para no mezclar "$1K" con
 * "$313.88" en la misma columna.
 *
 * No recibe la moneda a propósito: USD y CLP comparten el glifo "$"
 * (docs/STYLE_DASHBOARD.md) y ninguna de las bandas depende de la unidad. Quién
 * declara la unidad es el switch y el encabezado de cada columna, no el símbolo.
 * El monto exacto que acompaña a cada compacto sí va por `formatMoney`.
 */
export function compactMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

/** Monto en la moneda de ORIGEN de la cuenta (puede ser BRL, que nunca es
 *  moneda de despliegue). Solo para la lista que permite reconciliar contra la
 *  factura de la plataforma — nunca para sumar entre monedas. */
export function formatLocalMoney(value: number, currency: string): string {
  const { locale, decimals } = localeForCurrency(currency);
  const fmt = formatter(`local-${currency}-${decimals}`, () =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );
  return fmt.format(value || 0);
}

/** Tasa efectiva: unidades de la moneda nativa por unidad de la de despliegue. */
export function formatFxRate(value: number, currency: string): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const decimals = currency === "CLP" ? 1 : 2;
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const PLATAFORMA_LABEL: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

export function plataformaLabel(p: string): string {
  return PLATAFORMA_LABEL[p] ?? p;
}
