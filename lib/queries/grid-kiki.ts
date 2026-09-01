import { query } from "@/lib/bigquery";

const P          = process.env.BIGQUERY_PROJECT_ID;
const TICKETS    = `\`${P}.glovox.tickets\``;
const SOLD_ITEMS = `\`${P}.onfire.soldItems\``;

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

// ---------- Config del experimento ----------

/**
 * Reporte one-off: los EventoID y las fechas de la noche quedan fijos acá.
 * La "noche" de un evento va desde las 12:00 del día del evento hasta las
 * 12:00 del día siguiente (HoraPedido/HoraQuemado se almacenan en hora local).
 */
export const GRID_KIKI = {
  eventoId: "GLO198",
  nombre: "The Grid System Chile · KI/KI",
  fecha: "2026-05-09",
} as const;

export const EVENTOS_COMPARACION = [
  { eventoId: "GLO198", label: "The Grid · KI/KI",             fecha: "2026-05-09" },
  { eventoId: "GLO174", label: "The Grid · Klangkuenstler",    fecha: "2025-08-30" },
  { eventoId: "GLO179", label: "The Grid · Charlotte de Witte", fecha: "2025-10-30" },
] as const;

/** Categorías de barra del evento KI/KI usadas en la comparación intra-evento. */
export const CATEGORIAS_BARRA = ["JW", "MISTRAL", "GIN", "VODKA"] as const;

function nocheDe(fecha: string): { desde: string; hasta: string; base: string } {
  const base = `${fecha} 12:00:00`;
  const next = new Date(`${fecha}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const hasta = `${next.toISOString().slice(0, 10)} 12:00:00`;
  return { desde: base, hasta, base };
}

// ---------- Types ----------

export type GridKikiAudiencia = {
  asistentes: number;
  /** Personas con ticket quemado antes de las 21:00 (audiencia del WhatsApp). */
  audiencia21: number;
};

export type EvolucionCategoriaRow = {
  /** Minutos desde las 00:00 del día del evento (1440 = medianoche siguiente). */
  slotMin: number;
  slotLabel: string;
  categoria: string;
  venta: number;
  qtty: number;
};

export type PerCapitaSerie = {
  eventoId: string;
  label: string;
  fecha: string;
  asistentes: number;
  rows: { slotMin: number; slotLabel: string; venta: number; qtty: number }[];
};

// ---------- Queries ----------

/** Asistentes totales y personas dentro del recinto antes de las 21:00. */
export async function getGridKikiAudiencia(): Promise<GridKikiAudiencia> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      -- Asistentes = PERSONAS, no filas: la columna PersonasPorTicket pesa los
      -- packs multi-persona que la ticketera no partió en una fila por asistente.
      -- Hoy los tres eventos comparados dan delta 0; esto es blindaje para cuando
      -- entre uno con packs (en GLO181 la diferencia sería +30%).
      SUM(PersonasPorTicket)                      AS asistentes,
      SUM(IF(HoraQuemado < DATETIME(@corte), PersonasPorTicket, 0)) AS audiencia21
    FROM ${TICKETS}
    WHERE EventoID = @eventoId AND EsQuemado = TRUE
    `,
    { eventoId: GRID_KIKI.eventoId, corte: `${GRID_KIKI.fecha} 21:00:00` }
  );
  return {
    asistentes:  n(rows[0]?.asistentes),
    audiencia21: n(rows[0]?.audiencia21),
  };
}

/**
 * Venta y cantidad por bloque de 30 min y categoría de barra (JW, MISTRAL,
 * GIN, VODKA) durante la noche del evento KI/KI.
 */
export async function getGridKikiEvolucionCategorias(): Promise<EvolucionCategoriaRow[]> {
  const noche = nocheDe(GRID_KIKI.fecha);
  const rows = await query<Record<string, unknown>>(
    `
    WITH bucketed AS (
      SELECT
        TIMESTAMP_SUB(
          TIMESTAMP_TRUNC(HoraPedido, MINUTE),
          INTERVAL MOD(EXTRACT(MINUTE FROM HoraPedido), 30) MINUTE
        )                                AS slot,
        UPPER(IFNULL(Categoria, ''))     AS categoria,
        IFNULL(SubTotal, 0)              AS venta,
        IFNULL(Cantidad, 0)              AS qtty
      FROM ${SOLD_ITEMS}
      WHERE EventoID = @eventoId
        AND HoraPedido >= TIMESTAMP(@desde)
        AND HoraPedido <  TIMESTAMP(@hasta)
        AND UPPER(IFNULL(Categoria, '')) IN UNNEST(@categorias)
    )
    SELECT
      TIMESTAMP_DIFF(slot, TIMESTAMP(@desde), MINUTE) + 720 AS slot_min,
      FORMAT_TIMESTAMP('%H:%M', slot)                       AS slot_label,
      categoria,
      SUM(venta) AS venta,
      SUM(qtty)  AS qtty
    FROM bucketed
    GROUP BY slot, slot_label, categoria
    ORDER BY slot
    `,
    {
      eventoId:   GRID_KIKI.eventoId,
      desde:      noche.desde,
      hasta:      noche.hasta,
      categorias: [...CATEGORIAS_BARRA],
    }
  );
  return rows.map((r) => ({
    slotMin:   n(r.slot_min),
    slotLabel: s(r.slot_label),
    categoria: s(r.categoria),
    venta:     n(r.venta),
    qtty:      n(r.qtty),
  }));
}

/**
 * Consumo Johnnie Walker por bloque de 30 min para un evento, identificado
 * por producto (los eventos históricos no tienen la categoría "JW": sus SKUs
 * JW viven en TRAGOS / PROMOS / BOTELLAS).
 */
async function getJwEvolucionPorProducto(
  eventoId: string,
  fecha: string
): Promise<{ slotMin: number; slotLabel: string; venta: number; qtty: number }[]> {
  const noche = nocheDe(fecha);
  const rows = await query<Record<string, unknown>>(
    `
    WITH bucketed AS (
      SELECT
        TIMESTAMP_SUB(
          TIMESTAMP_TRUNC(HoraPedido, MINUTE),
          INTERVAL MOD(EXTRACT(MINUTE FROM HoraPedido), 30) MINUTE
        )                    AS slot,
        IFNULL(SubTotal, 0)  AS venta,
        IFNULL(Cantidad, 0)  AS qtty
      FROM ${SOLD_ITEMS}
      WHERE EventoID = @eventoId
        AND HoraPedido >= TIMESTAMP(@desde)
        AND HoraPedido <  TIMESTAMP(@hasta)
        AND (
          UPPER(IFNULL(Producto, '')) LIKE '%JOHNNIE%'
          OR UPPER(IFNULL(Producto, '')) LIKE '%JOHNNY%'
        )
    )
    SELECT
      TIMESTAMP_DIFF(slot, TIMESTAMP(@desde), MINUTE) + 720 AS slot_min,
      FORMAT_TIMESTAMP('%H:%M', slot)                       AS slot_label,
      SUM(venta) AS venta,
      SUM(qtty)  AS qtty
    FROM bucketed
    GROUP BY slot, slot_label
    ORDER BY slot
    `,
    { eventoId, desde: noche.desde, hasta: noche.hasta }
  );
  return rows.map((r) => ({
    slotMin:   n(r.slot_min),
    slotLabel: s(r.slot_label),
    venta:     n(r.venta),
    qtty:      n(r.qtty),
  }));
}

/** Asistentes (tickets quemados) por evento. */
async function getAsistentesPorEvento(
  eventoIds: string[]
): Promise<Record<string, number>> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT EventoID AS evento_id, SUM(PersonasPorTicket) AS asistentes
    FROM ${TICKETS}
    WHERE EventoID IN UNNEST(@eventoIds) AND EsQuemado = TRUE
    GROUP BY EventoID
    `,
    { eventoIds }
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[s(r.evento_id)] = n(r.asistentes);
  return out;
}

/** Series de consumo JW por evento para la comparación per cápita. */
export async function getJwPerCapitaComparativo(): Promise<PerCapitaSerie[]> {
  const [asistentes, ...series] = await Promise.all([
    getAsistentesPorEvento(EVENTOS_COMPARACION.map((e) => e.eventoId)),
    ...EVENTOS_COMPARACION.map((e) =>
      getJwEvolucionPorProducto(e.eventoId, e.fecha)
    ),
  ]);
  return EVENTOS_COMPARACION.map((e, i) => ({
    eventoId:   e.eventoId,
    label:      e.label,
    fecha:      e.fecha,
    asistentes: asistentes[e.eventoId] ?? 0,
    rows:       series[i],
  }));
}
