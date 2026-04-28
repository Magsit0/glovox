const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function fmtPen(value: number, decimals = 0): string {
  return (
    "S/ " +
    value.toLocaleString("es-PE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

export function fmtPenShort(value: number): string {
  if (value >= 1_000_000)
    return "S/ " + (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (value >= 1_000)
    return "S/ " + (value / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return "S/ " + Math.round(value).toLocaleString("es-PE");
}

export function fmtNumber(value: number): string {
  return value.toLocaleString("es-PE");
}

export function fmtMonthYear(ym: string): string {
  // "2026-04" → "abr 2026"
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${MONTHS_ES[idx]} ${y}`;
}

export function fmtDate(iso: string): string {
  // "2026-04-17" → "17 abr 2026"
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return iso;
  return `${Number(d)} ${MONTHS_ES[idx]} ${y}`;
}

export function fmtPct(value: number, decimals = 1): string {
  return value.toFixed(decimals) + "%";
}
