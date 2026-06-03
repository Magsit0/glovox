/**
 * Formatters específicos del dashboard de paid media. Las cuentas conviven
 * en CLP, USD y BRL — sumar entre monedas no tiene sentido — por eso todos
 * los formatters reciben la moneda activa y se respeta el locale acordado:
 *
 *  - CLP → "$12.345"      (es-CL, sin decimales)
 *  - USD → "$12,345.67"   (en-US, dos decimales)
 *  - BRL → "R$ 12.345,67" (pt-BR, dos decimales)
 */

const FMT_CACHE = new Map<string, Intl.NumberFormat>();

function formatter(key: string, build: () => Intl.NumberFormat): Intl.NumberFormat {
  const cached = FMT_CACHE.get(key);
  if (cached) return cached;
  const fmt = build();
  FMT_CACHE.set(key, fmt);
  return fmt;
}

function localeForCurrency(currency: string): { locale: string; decimals: number } {
  switch (currency) {
    case "CLP": return { locale: "es-CL", decimals: 0 };
    case "USD": return { locale: "en-US", decimals: 2 };
    case "BRL": return { locale: "pt-BR", decimals: 2 };
    default:    return { locale: "en-US", decimals: 2 };
  }
}

export function formatMoney(value: number, currency: string): string {
  const { locale, decimals } = localeForCurrency(currency);
  const fmt = formatter(`m-${currency}-${decimals}`, () =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );
  return fmt.format(value || 0);
}

/**
 * Versión compacta del monto: "$12K", "$1.2M". Conserva el símbolo de la
 * moneda activa en lugar de un signo genérico para no confundir al lector
 * cuando hay mezcla de cuentas USD y CLP en otros dashboards.
 */
export function compactMoney(value: number, currency: string): string {
  const num = value || 0;
  const abs = Math.abs(num);
  const sym = currency === "BRL" ? "R$" : "$";
  if (abs >= 1_000_000_000) return `${sym}${(num / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${sym}${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${sym}${(num / 1_000).toFixed(0)}K`;
  if (currency === "CLP")   return `${sym}${Math.round(num)}`;
  return `${sym}${num.toFixed(2)}`;
}

export function formatInt(value: number): string {
  const fmt = formatter("int", () =>
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }),
  );
  return fmt.format(value || 0);
}

export function compactInt(value: number): string {
  const num = value || 0;
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(num / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${(num / 1_000).toFixed(0)}K`;
  return `${Math.round(num)}`;
}

/** CTR viene del backend ya como ratio 0..1. */
export function formatRatio(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${((value || 0) * 100).toFixed(decimals)}%`;
}

export function formatRoas(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  return `${value.toFixed(2)}x`;
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
};

export function plataformaLabel(p: string): string {
  return PLATAFORMA_LABEL[p] ?? p;
}
