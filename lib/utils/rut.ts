/**
 * Chilean RUT utilities — canonical form, validation (módulo-11 check digit),
 * and pretty formatting.
 *
 * Storage canonical: `<body>-<dv>` with no dots, dash before the verification
 * digit, and "K" uppercase. Example: "97004000-5".
 *
 * Display canonical: same body grouped in thousands with dots, e.g.
 * "97.004.000-5". Use `formatRut` only for display — persist `normalizeRut`.
 */

/**
 * Returns the canonical storage form, or null if the input is structurally
 * invalid (doesn't parse as digits + optional K terminator). Doesn't verify
 * the check digit — use `isValidRut` for that.
 */
export function normalizeRut(input: string | null | undefined): string | null {
  if (!input) return null;
  const stripped = String(input).replace(/[.\s-]/g, "").toUpperCase().trim();
  if (stripped.length < 2) return null;
  if (!/^\d+[\dK]$/.test(stripped)) return null;
  const body = stripped.slice(0, -1);
  const dv = stripped.slice(-1);
  // Cuerpo razonable: 5–9 dígitos (cubre personas y empresas chilenas).
  if (body.length < 5 || body.length > 9) return null;
  return `${body}-${dv}`;
}

/**
 * Calcula el dígito verificador esperado para un cuerpo numérico.
 */
function computeDv(body: string): string {
  let sum = 0;
  let mult = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const rem = 11 - (sum % 11);
  if (rem === 11) return "0";
  if (rem === 10) return "K";
  return String(rem);
}

/**
 * Valida estructura + dígito verificador. Acepta cualquier formato de entrada
 * (con o sin puntos, con o sin guión, K mayúscula o minúscula).
 */
export function isValidRut(input: string | null | undefined): boolean {
  const norm = normalizeRut(input);
  if (!norm) return false;
  const [body, dv] = norm.split("-");
  return computeDv(body) === dv;
}

/**
 * Devuelve el RUT pretty-printed con puntos. Si la entrada no es parseable,
 * devuelve la entrada tal cual (graceful fallback para display de legacy).
 */
export function formatRut(input: string | null | undefined): string {
  const norm = normalizeRut(input);
  if (!norm) return input ?? "";
  const [body, dv] = norm.split("-");
  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
