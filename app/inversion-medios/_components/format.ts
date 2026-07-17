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
