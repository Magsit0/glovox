import {
  EVENTOS_COMPARACION,
  getGridKikiAudiencia,
  getGridKikiEvolucionCategorias,
  getJwPerCapitaComparativo,
  type EvolucionCategoriaRow,
  type GridKikiAudiencia,
  type PerCapitaSerie,
} from "@/lib/queries/grid-kiki";

/**
 * Ensamblado de datos del reporte GRID KI/KI · Johnnie Walker.
 * Única fuente de los números: lo consumen la page y la exportación a
 * Google Docs, así ambas siempre muestran lo mismo.
 */

const MIN_INICIO = 21 * 60 + 30; // 21:30 — inicio de la ventana anunciada
const MIN_CIERRE = 23 * 60;      // 23:00 — cierre real (extendido)

export type JwSlotPoint = { slotLabel: string; venta: number; qtty: number };

export type PerCapitaTotal = PerCapitaSerie & {
  qttyPor1000: number;
  clpPorAsistente: number;
};

export type GridKikiReporte = {
  audiencia: GridKikiAudiencia;
  evolucion: EvolucionCategoriaRow[];
  perCapita: PerCapitaSerie[];
  perCapitaTotales: PerCapitaTotal[];
  slotLabels: string[];
  jwTimeline: JwSlotPoint[];
  stats: {
    ventanaVenta: number;
    ventanaQtty: number;
    totalNocheVenta: number;
    totalNocheQtty: number;
    peakLabel: string;
    peakVenta: number;
    peakQtty: number;
    multiplicadorPeak: number;
    shareVentana: number;
    conversionVentana: number;
    horasBarra: number;
  };
};

export function slotLabelDe(min: number): string {
  const m = min % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export async function getGridKikiReporte(): Promise<GridKikiReporte> {
  const [audiencia, evolucion, perCapita] = await Promise.all([
    getGridKikiAudiencia(),
    getGridKikiEvolucionCategorias(),
    getJwPerCapitaComparativo(),
  ]);

  // Eje canónico de bloques de 30 min para la noche KI/KI. Los labels usan la
  // hora de FIN del bloque (el punto "23:00" es lo vendido entre 22:30 y
  // 23:00), para que el eje coincida con el tooltip y con las líneas de hito.
  const slotMins = evolucion.map((r) => r.slotMin);
  const minSlot = Math.min(...slotMins);
  const maxSlot = Math.max(...slotMins);
  const slots: number[] = [];
  for (let m = minSlot; m <= maxSlot; m += 30) slots.push(m);
  const slotLabels = slots.map((m) => slotLabelDe(m + 30));

  // Serie JW con ceros en los bloques sin venta
  const jwRows = evolucion.filter((r) => r.categoria === "JW");
  const jwBySlot = new Map(jwRows.map((r) => [r.slotMin, r]));
  const jwTimeline = slots.map((m) => ({
    slotLabel: slotLabelDe(m + 30),
    venta: jwBySlot.get(m)?.venta ?? 0,
    qtty: jwBySlot.get(m)?.qtty ?? 0,
  }));

  // KPIs de la noche (sobre la serie JW, desde su primer bloque con venta)
  const jwMinSlot = jwRows.length > 0 ? Math.min(...jwRows.map((r) => r.slotMin)) : minSlot;
  const pre = jwRows.filter((r) => r.slotMin < MIN_INICIO);
  const ventana = jwRows.filter((r) => r.slotMin >= MIN_INICIO && r.slotMin < MIN_CIERRE);
  const preSlots = (MIN_INICIO - jwMinSlot) / 30;
  const sum = (rows: { venta: number; qtty: number }[]) => ({
    venta: rows.reduce((a, r) => a + r.venta, 0),
    qtty: rows.reduce((a, r) => a + r.qtty, 0),
  });
  const preTot = sum(pre);
  const ventanaTot = sum(ventana);
  const totalNoche = sum(jwRows);
  const peak = jwRows.reduce((a, r) => (r.qtty > a.qtty ? r : a), jwRows[0]);
  const preQttyPorBloque = preTot.qtty / Math.max(preSlots, 1);

  const perCapitaTotales = perCapita.map((serie) => {
    const t = sum(serie.rows);
    return {
      ...serie,
      qttyPor1000: serie.asistentes > 0 ? (t.qtty / serie.asistentes) * 1000 : 0,
      clpPorAsistente: serie.asistentes > 0 ? t.venta / serie.asistentes : 0,
    };
  });

  return {
    audiencia,
    // Labels re-mapeados a hora de fin del bloque (ver slotLabels arriba)
    evolucion: evolucion.map((r) => ({ ...r, slotLabel: slotLabelDe(r.slotMin + 30) })),
    perCapita,
    perCapitaTotales,
    slotLabels,
    jwTimeline,
    stats: {
      ventanaVenta: ventanaTot.venta,
      ventanaQtty: ventanaTot.qtty,
      totalNocheVenta: totalNoche.venta,
      totalNocheQtty: totalNoche.qtty,
      peakLabel: peak?.slotLabel ?? "—",
      peakVenta: peak?.venta ?? 0,
      peakQtty: peak?.qtty ?? 0,
      multiplicadorPeak: preQttyPorBloque > 0 ? (peak?.qtty ?? 0) / preQttyPorBloque : 0,
      shareVentana: totalNoche.venta > 0 ? ventanaTot.venta / totalNoche.venta : 0,
      conversionVentana:
        audiencia.audiencia21 > 0 ? ventanaTot.qtty / audiencia.audiencia21 : 0,
      horasBarra: (maxSlot + 30 - minSlot) / 60,
    },
  };
}

export const EVENTO_KIKI_ID = EVENTOS_COMPARACION[0].eventoId;
