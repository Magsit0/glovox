/**
 * Paleta del dashboard La Cava (`/lacava`).
 *
 * Excepción deliberada a la paleta Glovox de docs/STYLE_DASHBOARD.md: esta
 * pestaña usa la identidad de La Cava de Jumbo (verde botella, burdeos, crema
 * y el verde Jumbo), tomada de la gráfica del evento en puntoticket.com y
 * jumbo.cl/oferta/la-cava. La estructura (cards, hairlines, chrome de charts)
 * sigue la guía; solo cambian los colores y la tipografía display (serif).
 */

export const LACAVA = {
  /** Verde botella — fondo del hero y color primario. */
  verde: "#0F3D2A",
  /** Verde medio — series de gráficos, hover del primario. */
  verdeMedio: "#1F5B3F",
  /** Burdeos vino — acento secundario. */
  burdeos: "#6E1B3A",
  /** Dorado — resaltes, cortesías. */
  dorado: "#C8A24B",
  /** Verde Jumbo — pill del logo, estados positivos. */
  jumbo: "#43B02A",
  /** Crema — canvas de la página. */
  crema: "#F7F2E7",
  /** Crema clara — fondo de tooltips y superficies elevadas. */
  cremaClara: "#FFFDF7",
  /** Marfil — texto sobre verde botella. */
  marfil: "#F5EEDC",
  /** Hairlines cálidas (bordes de cards y tablas). */
  borde: "#E3DCC8",
  /** Grilla de gráficos. */
  grid: "#EFE9DA",
  /** Texto principal. */
  tinta: "#22301F",
  /** Labels y subtítulos. */
  tintaSuave: "#6E6857",
  /** Ejes, captions. */
  tintaSutil: "#9A917C",
} as const;

/** Series de gráficos, en orden. Índice 0 = primaria. */
export const LACAVA_SERIES = [
  LACAVA.verdeMedio,
  LACAVA.burdeos,
  LACAVA.dorado,
  LACAVA.jumbo,
  "#557F6B", // salvia
  "#B0592F", // terracota
] as const;

export function lacavaSeriesColor(i: number): string {
  return LACAVA_SERIES[i % LACAVA_SERIES.length];
}

/** Color por clase de ticket (donut de tipos). */
export const CLASE_COLORS: Record<string, string> = {
  VENTA: LACAVA.verdeMedio,
  CORTESIA: LACAVA.dorado,
  "PASE TEMPORADA": LACAVA.burdeos,
  "MESA VIP": "#557F6B",
};

export const CLASE_LABELS: Record<string, string> = {
  VENTA: "Venta",
  CORTESIA: "Cortesía",
  "PASE TEMPORADA": "Pase temporada",
  "MESA VIP": "Mesa VIP",
};

/** Chrome compartido de recharts, en clave La Cava. */
export const lacavaAxisTick = {
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fill: LACAVA.tintaSutil,
} as const;

export const lacavaGridProps = {
  vertical: false,
  stroke: LACAVA.grid,
  strokeDasharray: "0",
} as const;
