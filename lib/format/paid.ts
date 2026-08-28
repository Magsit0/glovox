/**
 * Formateadores numéricos compartidos entre los paneles de paid media
 * (`/paid-media` y `/inversion-medios`).
 *
 * Vivían en `components/paid-media/format.ts`; se subieron acá cuando
 * `/inversion-medios` necesitó los MISMOS (conteos, ratios, costos unitarios)
 * para sus métricas de rendimiento. Esa ruta los re-exporta, así que sus
 * consumidores no cambiaron.
 *
 * Locale: `es-CL` para conteos y `en-US` para USD, que es lo que ya está en
 * pantalla en `/paid-media` y lo que pide docs/STYLE_DASHBOARD.md (USD
 * `$12,345.00`, conteos con el locale del panel).
 */

/** Monedas que estos formateadores saben expresar. `DisplayCurrency`
 *  (`lib/queries/paidMedia.ts`) es asignable a este tipo; se declara acá para no
 *  acoplar un módulo client-safe a uno de queries. */
export type MoneyCurrency = "USD" | "CLP" | "BRL";

const FMT_CACHE = new Map<string, Intl.NumberFormat>();

export function formatter(key: string, build: () => Intl.NumberFormat): Intl.NumberFormat {
  const cached = FMT_CACHE.get(key);
  if (cached) return cached;
  const fmt = build();
  FMT_CACHE.set(key, fmt);
  return fmt;
}

export function localeForCurrency(currency: string): { locale: string; decimals: number } {
  switch (currency) {
    case "CLP": return { locale: "es-CL", decimals: 0 };
    case "USD": return { locale: "en-US", decimals: 2 };
    case "BRL": return { locale: "pt-BR", decimals: 2 };
    default:    return { locale: "en-US", decimals: 2 };
  }
}

/**
 * Costos unitarios (CPC, CPM, CPA). Precisión ADAPTATIVA porque las magnitudes
 * viven en órdenes muy distintos: el CPC consolidado ronda 0,064 USD —con dos
 * decimales todas las cuentas se verían "$0.06" y el KPI dejaría de discriminar—
 * pero el mismo CPC en pesos son ~59 CLP, donde los decimales son ruido. La
 * regla es mostrar tres cifras significativas.
 *
 * ⚠️ Un CERO no es "no medible". El guard `value === 0` que tenía esta función
 * pintaba el mismo glifo para las dos cosas: en GLO207 la campaña google/P.Max
 * gastó $101,18 con valor de conversión declarado 0, y la celda decía "—" cuando
 * la lectura correcta es "0.00x". `conversiones` y `valor_conversion_usd` no son
 * NULL en ninguna de las 17.586 filas del mart, así que un 0 que llega acá es un
 * 0 MEDIDO. Quien dice "no hay denominador" es `div()`, devolviendo `null`.
 */
export function formatUnitCost(
  value: number | null | undefined,
  moneda: MoneyCurrency = "USD",
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 0 : abs >= 1 ? 2 : 3;
  const { locale } = localeForCurrency(moneda);
  const fmt = formatter(`unit-${moneda}-${decimals}`, () =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );
  return fmt.format(value);
}

/** Conteos exactos: "1.475.944". Exacto y no compacto donde su función es hacer
 *  auditable el ratio de al lado — con "802K" nadie puede verificar que
 *  14.245 ÷ 801.628 = 1,78%. */
export function formatInt(value: number | null | undefined): string {
  const fmt = formatter("int", () =>
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }),
  );
  return fmt.format(value || 0);
}

export function compactInt(value: number | null | undefined): string {
  const num = value || 0;
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${(num / 1_000).toFixed(0)}K`;
  return `${Math.round(num)}`;
}

/** Ratio 0..1 → porcentaje. CTR llega ya como fracción desde el cálculo. */
export function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${((value || 0) * 100).toFixed(decimals)}%`;
}

/** ROAS. Sin el guard de cero, por el mismo motivo que `formatUnitCost`. */
export function formatRoas(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

/**
 * Cociente seguro. Es el ÚNICO autorizado a decir "no hay denominador": devuelve
 * `null`, que los formateadores pintan como guion. Nunca 0 — un 0 afirmaría que
 * el costo es cero, que es lo contrario de "no se puede calcular".
 */
export function div(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return b > 0 ? a / b : null;
}
