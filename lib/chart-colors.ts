import chroma from "chroma-js";

export const BRAND = {
  purple: "#9F99F8",
  green: "#B1D750",
  pink: "#ED75A0",
  yellow: "#F6C544",
  teal: "#87DACD",
  orange: "#EF8C34",
} as const;

/**
 * Neutros como VARIABLES CSS, no como hex.
 *
 * SVG resuelve `var(--x)` en `fill` y `stroke` igual que cualquier propiedad de
 * color, asi que estos valores sirven tal cual en las props de recharts y siguen
 * al tema sin que ningun chart se entere. En las rutas sin `data-theme` resuelven
 * a los mismos hex de siempre, asi que los ~23 dashboards restantes no cambian.
 *
 * ⚠️ NO usar estos valores en operaciones de chroma-js (`chroma(...)`, escalas):
 * chroma necesita un color concreto y `var(--x)` lo hace explotar. Para eso estan
 * los `*_HEX` de abajo.
 */
export const INK = {
  primary: "var(--ink)",
  muted: "var(--ink-muted)",
  subtle: "var(--ink-subtle)",
} as const;

export const SURFACE = {
  canvas: "var(--surface-alt)",
  card: "var(--surface)",
  divider: "var(--divider)",
  grid: "var(--grid)",
  purpleTint: "var(--purple-tint)",
} as const;

/** Valores concretos del tema CLARO, para lo que necesite color real (chroma). */
export const LIGHT_HEX = {
  ink: "#333333",
  canvas: "#FAFAFA",
  card: "#FFFFFF",
  divider: "#E5E5E5",
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

// chroma necesita colores concretos: va con el hex claro, no con el token.
export const heatmapScale = chroma.scale([LIGHT_HEX.canvas, BRAND.purple]).mode("lab");
