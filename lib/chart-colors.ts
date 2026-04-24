import chroma from "chroma-js";

export const BRAND = {
  purple: "#9F99F8",
  green: "#B1D750",
  pink: "#ED75A0",
  yellow: "#F6C544",
  teal: "#87DACD",
  orange: "#EF8C34",
} as const;

export const INK = {
  primary: "#333333",
  muted: "#666666",
  subtle: "#999999",
} as const;

export const SURFACE = {
  canvas: "#FAFAFA",
  card: "#FFFFFF",
  divider: "#E5E5E5",
  grid: "#F0F0F0",
  purpleTint: "#F0EFFE",
} as const;

export const STATUS = {
  success: BRAND.green,
  warning: BRAND.orange,
  error: BRAND.pink,
  pending: BRAND.yellow,
  info: BRAND.purple,
  neutral: INK.subtle,
} as const;

export const CHART_SERIES = [
  BRAND.purple,
  BRAND.green,
  BRAND.pink,
  BRAND.yellow,
  BRAND.teal,
  BRAND.orange,
] as const;

export function seriesColor(i: number): string {
  const ring = Math.floor(i / CHART_SERIES.length);
  const hue = CHART_SERIES[i % CHART_SERIES.length];
  switch (ring) {
    case 0:
      return hue;
    case 1:
      return chroma(hue).brighten(1).hex();
    case 2:
      return chroma(hue).darken(1).hex();
    default:
      return chroma(hue).set("hsl.h", "+180").hex();
  }
}

export function seriesFillSoft(color: string, alpha = 0.15): string {
  return chroma(color).alpha(alpha).css();
}

export const axisTick = {
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fill: INK.subtle,
} as const;

export const gridProps = {
  vertical: false,
  stroke: SURFACE.grid,
  strokeDasharray: "0",
} as const;

export const legendProps = {
  iconType: "circle" as const,
  iconSize: 8,
  wrapperStyle: {
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    color: INK.muted,
  },
};

export const heatmapScale = chroma.scale([SURFACE.canvas, BRAND.purple]).mode("lab");
