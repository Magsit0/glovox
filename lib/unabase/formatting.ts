export const formatCurrency = (value: unknown): string =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const formatNumber = (value: unknown): string =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Number(value || 0));

export const parseNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(String(value).replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(num) ? num : 0;
};

export const safeText = (value: unknown): string =>
  value === null || value === undefined || value === "" || value === "None"
    ? "Sin dato"
    : String(value);

export const compactCurrency = (value: unknown): string => {
  const num = Number(value || 0);
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${Math.round(num)}`;
};

export const formatPercent = (value: unknown): string => {
  const num = Number(value || 0);
  return `${(num * 100).toFixed(1)}%`;
};
