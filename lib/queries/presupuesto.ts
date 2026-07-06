/**
 * Queries del constructor de presupuesto de evento.
 *
 *  - BigQuery (defaults históricos): per-cápitas de ingreso desde
 *    ticketsAndAABB.cierreEventos y % de costo por categoría desde
 *    marts.finanzas_gastos (vista curada). Son SUGERENCIAS: se siembran en el
 *    doc al crear y quedan editables.
 *  - Postgres (presupuestos): lista y carga los presupuestos editables.
 *
 * Migrado 3-jul-2026: antes sumaba `item_costo_real` del raw — campo CORRUPTO
 * en 2.436 documentos (la API de Unabase replica el mismo valor en todas las
 * líneas del doc, error "# 53"; infla sumas hasta 8x por negocio). La vista
 * expone solo `gasto_neto` (= item_costo_empresa, reconcilia con el maestro),
 * y el mapeo categoría→bucket ya no es regex en TS: viene resuelto en
 * `bucket_presupuesto` desde el seed finanzas.unabase_categoria_map.
 * ⚠ Los % sembrados CAMBIAN respecto al cálculo anterior (fix intencional).
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  presupuestosEvento,
  type PresupuestoEvento,
  type Country as PgCountry,
} from "@/db/schema";
import { query } from "@/lib/bigquery";
import { withNeonRetry } from "@/lib/neon-retry";
import { getComparableEvents } from "@/lib/queries/pricing";
import { CATEGORIA_KEYS, type CategoriaKey } from "@/lib/budget-forecast/config";

const P = process.env.BIGQUERY_PROJECT_ID;

const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;
const GASTOS = `\`${P}.marts.finanzas_gastos\``;

const AREA_PRODUCCION = "produccion de eventos propios";

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

function numOrNull(v: unknown): number | null {
  const x = n(v);
  return Number.isFinite(x) ? x : null;
}

// ---------- BigQuery: per-cápitas de ingreso ----------

export type PerCapitaSource = "own" | "comparables" | "none";

export type PerCapitaDefaults = {
  /** Fuente dominante de las sugerencias. */
  source: PerCapitaSource;
  /** # eventos detrás de las sugerencias (1 si es histórico propio). */
  n: number;
  asistentes: number | null;
  /** Venta de tickets por asistente (PerCapitaTicketsQuemados, incluye rebate). */
  ticketPerCapita: number | null;
  /** Ticket promedio: venta por ticket VENDIDO (PerCapitaTicketsVenta). Solo referencia. */
  ticketPromedio: number | null;
  /** F&B por asistente (PerCapitaFFyBB). */
  fbPerCapita: number | null;
  /** Rangos min–max entre comparables (para mostrar incertidumbre). */
  ranges: {
    ticketPerCapita: { min: number; max: number } | null;
    ticketPromedio: { min: number; max: number } | null;
    fbPerCapita: { min: number; max: number } | null;
  };
  /** Eventos comparables considerados (para mostrar la procedencia). */
  eventosRef: { eventoId: string; nombre: string }[];
};

type CierreRow = {
  asistentes: number | null;
  pcTicket: number | null;
  pcVenta: number | null;
  pcFb: number | null;
};

async function getCierreOwn(eventoId: string): Promise<CierreRow | null> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      SAFE_CAST(TotalAsistentes AS FLOAT64)          AS asistentes,
      SAFE_CAST(PerCapitaTicketsQuemados AS FLOAT64) AS pc_ticket,
      SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64)    AS pc_venta,
      SAFE_CAST(PerCapitaFFyBB AS FLOAT64)           AS pc_fb
    FROM ${CIERRE_EVENTOS}
    WHERE CAST(EventoID AS STRING) = @id
    LIMIT 1
    `,
    { id: eventoId },
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    asistentes: numOrNull(r.asistentes),
    pcTicket: numOrNull(r.pc_ticket),
    pcVenta: numOrNull(r.pc_venta),
    pcFb: numOrNull(r.pc_fb),
  };
}

type CierreAgg = {
  n: number;
  asistentes: number | null;
  pcTicket: number | null;
  pcVenta: number | null;
  pcFb: number | null;
  pcTicketMin: number | null;
  pcTicketMax: number | null;
  pcVentaMin: number | null;
  pcVentaMax: number | null;
  pcFbMin: number | null;
  pcFbMax: number | null;
};

async function getCierreComparablesAgg(refEventoIds: string[]): Promise<CierreAgg | null> {
  if (!refEventoIds.length) return null;
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      COUNT(*)                                        AS n,
      AVG(SAFE_CAST(TotalAsistentes AS FLOAT64))      AS asistentes,
      AVG(SAFE_CAST(PerCapitaTicketsQuemados AS FLOAT64)) AS pc_ticket,
      MIN(SAFE_CAST(PerCapitaTicketsQuemados AS FLOAT64)) AS pc_ticket_min,
      MAX(SAFE_CAST(PerCapitaTicketsQuemados AS FLOAT64)) AS pc_ticket_max,
      -- Ticket promedio (venta por ticket vendido): solo referencia, no impulsa el cálculo.
      AVG(IF(SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64) > 0, SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64), NULL)) AS pc_venta,
      MIN(IF(SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64) > 0, SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64), NULL)) AS pc_venta_min,
      MAX(IF(SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64) > 0, SAFE_CAST(PerCapitaTicketsVenta AS FLOAT64), NULL)) AS pc_venta_max,
      -- F&B: excluir eventos con venta F&B = 0 (F&B no capturado sesga a la baja)
      AVG(IF(SAFE_CAST(TotalVentaFFBB AS FLOAT64) > 0, SAFE_CAST(PerCapitaFFyBB AS FLOAT64), NULL)) AS pc_fb,
      MIN(IF(SAFE_CAST(TotalVentaFFBB AS FLOAT64) > 0, SAFE_CAST(PerCapitaFFyBB AS FLOAT64), NULL)) AS pc_fb_min,
      MAX(IF(SAFE_CAST(TotalVentaFFBB AS FLOAT64) > 0, SAFE_CAST(PerCapitaFFyBB AS FLOAT64), NULL)) AS pc_fb_max
    FROM ${CIERRE_EVENTOS}
    WHERE CAST(EventoID AS STRING) IN UNNEST(@ids)
      AND SAFE_CAST(TotalAsistentes AS FLOAT64) > 0
    `,
    { ids: refEventoIds },
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const cnt = n(r.n);
  if (cnt <= 0) return null;
  return {
    n: cnt,
    asistentes: numOrNull(r.asistentes),
    pcTicket: numOrNull(r.pc_ticket),
    pcVenta: numOrNull(r.pc_venta),
    pcFb: numOrNull(r.pc_fb),
    pcTicketMin: numOrNull(r.pc_ticket_min),
    pcTicketMax: numOrNull(r.pc_ticket_max),
    pcVentaMin: numOrNull(r.pc_venta_min),
    pcVentaMax: numOrNull(r.pc_venta_max),
    pcFbMin: numOrNull(r.pc_fb_min),
    pcFbMax: numOrNull(r.pc_fb_max),
  };
}

/**
 * Sugerencias de per-cápita para un evento. Cadena: histórico propio del evento
 * (cierreEventos) → promedio de comparables → nada (entrada manual). Field-by-field:
 * si el propio tiene un valor lo usa, si no cae al promedio de comparables.
 */
export async function getPerCapitaDefaults(
  eventoId: string,
  opts?: { refEventoIds?: string[] },
): Promise<PerCapitaDefaults> {
  const empty: PerCapitaDefaults = {
    source: "none",
    n: 0,
    asistentes: null,
    ticketPerCapita: null,
    ticketPromedio: null,
    fbPerCapita: null,
    ranges: { ticketPerCapita: null, ticketPromedio: null, fbPerCapita: null },
    eventosRef: [],
  };
  if (!eventoId) return empty;

  const comparables = opts?.refEventoIds?.length
    ? null
    : await getComparableEvents(eventoId);
  const refIds = opts?.refEventoIds?.length
    ? opts.refEventoIds
    : (comparables ?? []).map((c) => c.eventoId);

  const [own, agg] = await Promise.all([
    getCierreOwn(eventoId),
    getCierreComparablesAgg(refIds),
  ]);

  const ownHas = own != null && own.asistentes != null && own.asistentes > 0;

  const asistentes = own?.asistentes ?? agg?.asistentes ?? null;
  const ticketPerCapita = own?.pcTicket ?? agg?.pcTicket ?? null;
  const ticketPromedio = own?.pcVenta ?? agg?.pcVenta ?? null;
  const fbPerCapita = own?.pcFb ?? agg?.pcFb ?? null;

  const source: PerCapitaSource = ownHas ? "own" : agg ? "comparables" : "none";
  const eventosRef = (comparables ?? [])
    .filter((c) => refIds.includes(c.eventoId))
    .map((c) => ({ eventoId: c.eventoId, nombre: c.nombre }));

  return {
    source,
    n: source === "own" ? 1 : (agg?.n ?? 0),
    asistentes,
    ticketPerCapita,
    ticketPromedio,
    fbPerCapita,
    ranges: {
      ticketPerCapita:
        agg?.pcTicketMin != null && agg?.pcTicketMax != null
          ? { min: agg.pcTicketMin, max: agg.pcTicketMax }
          : null,
      ticketPromedio:
        agg?.pcVentaMin != null && agg?.pcVentaMax != null
          ? { min: agg.pcVentaMin, max: agg.pcVentaMax }
          : null,
      fbPerCapita:
        agg?.pcFbMin != null && agg?.pcFbMax != null
          ? { min: agg.pcFbMin, max: agg.pcFbMax }
          : null,
    },
    eventosRef,
  };
}

// ---------- BigQuery: % de costo por categoría ----------

export type CostShareDefaults = {
  source: "comparables" | "none";
  nEventos: number;
  /** Fracción del techo por bucket (normalizada a sumar ~1). Incluye las 7 keys. */
  buckets: { key: CategoriaKey; pct: number }[];
  /** Categorías crudas de Unabase NO mapeadas (caen en "otras"), con su gasto. */
  sinMapear: { categoria: string; monto: number }[];
};

/**
 * % histórico de costo por bucket, promediado sobre eventos comparables.
 * Toma `gasto_neto` de marts.finanzas_gastos (= item_costo_empresa, la métrica
 * canónica; el viejo `item_costo_real` está corrupto en el origen), filtra con
 * `incluir_en_totales`, normaliza el share DENTRO de cada evento y promedia
 * esos shares entre eventos (así un festival grande no domina la mezcla).
 * El bucket viene resuelto por la vista (`bucket_presupuesto`, seed
 * finanzas.unabase_categoria_map); lo no mapeado cae en "otras" con
 * `flag_categoria_sin_mapear` y se reporta en `sinMapear`.
 */
export async function getCostShareDefaults(opts?: {
  refEventoIds?: string[];
  eventoId?: string;
}): Promise<CostShareDefaults> {
  const emptyBuckets = CATEGORIA_KEYS.map((key) => ({ key, pct: 0 }));
  const empty: CostShareDefaults = { source: "none", nEventos: 0, buckets: emptyBuckets, sinMapear: [] };

  let refIds = opts?.refEventoIds ?? [];
  if (!refIds.length && opts?.eventoId) {
    const comparables = await getComparableEvents(opts.eventoId);
    refIds = comparables.map((c) => c.eventoId);
  }
  if (!refIds.length) return empty;

  const rows = await query<Record<string, unknown>>(
    `
    WITH gasto AS (
      SELECT
        evento_id,
        UPPER(TRIM(IFNULL(categoria_raw, ''))) AS item_categoria,
        ANY_VALUE(bucket_presupuesto)          AS bucket,
        LOGICAL_OR(flag_categoria_sin_mapear)  AS sin_mapear,
        SUM(IFNULL(gasto_neto, 0))             AS monto
      FROM ${GASTOS}
      WHERE incluir_en_totales
        AND LOWER(IFNULL(area_negocio, '')) = @area
        AND LOWER(IFNULL(negocio_estadonv, '')) <> 'nulo'
        AND LOWER(IFNULL(negocio_estado, '')) <> 'cotizacion'
        AND evento_id IN UNNEST(@ids)
      GROUP BY evento_id, item_categoria
    ),
    por_evento AS (
      SELECT
        evento_id,
        item_categoria,
        bucket,
        sin_mapear,
        monto,
        SAFE_DIVIDE(monto, SUM(monto) OVER (PARTITION BY evento_id)) AS pct_evento
      FROM gasto
      WHERE monto > 0
    )
    SELECT
      item_categoria,
      ANY_VALUE(bucket)         AS bucket,
      LOGICAL_OR(sin_mapear)    AS sin_mapear,
      AVG(pct_evento)           AS pct_promedio,
      SUM(monto)                AS monto_total,
      COUNT(DISTINCT evento_id) AS n_eventos
    FROM por_evento
    GROUP BY item_categoria
    `,
    { area: AREA_PRODUCCION, ids: refIds },
  );

  if (!rows.length) return empty;

  // Agregar los shares por bucket + recolectar categorías sin mapear.
  const bucketSet = new Set<string>(CATEGORIA_KEYS);
  const pctByBucket = new Map<CategoriaKey, number>();
  const sinMapear: { categoria: string; monto: number }[] = [];
  let maxN = 0;
  for (const r of rows) {
    const categoria = s(r.item_categoria);
    const pct = n(r.pct_promedio);
    const monto = n(r.monto_total);
    maxN = Math.max(maxN, n(r.n_eventos));
    const rawBucket = s(r.bucket);
    const bucket = (bucketSet.has(rawBucket) ? rawBucket : "otras") as CategoriaKey;
    pctByBucket.set(bucket, (pctByBucket.get(bucket) ?? 0) + pct);
    // "sin mapear" = el seed no tiene fila para este texto (revisar y agregar al CSV).
    if (Boolean(r.sin_mapear) && categoria) {
      sinMapear.push({ categoria, monto });
    }
  }

  // Normalizar a sumar 1 (los promedios de shares no suman exacto).
  const total = [...pctByBucket.values()].reduce((a, b) => a + b, 0);
  const buckets = CATEGORIA_KEYS.map((key) => ({
    key,
    pct: total > 0 ? (pctByBucket.get(key) ?? 0) / total : 0,
  }));

  sinMapear.sort((a, b) => b.monto - a.monto);
  return { source: "comparables", nEventos: maxN, buckets, sinMapear };
}

// ---------- Postgres: presupuestos (modelo documento) ----------

/** Presupuestos del working store, filtrados por país si se indica. */
export async function listPresupuestos(country?: PgCountry): Promise<PresupuestoEvento[]> {
  return withNeonRetry(() => {
    const q = db.select().from(presupuestosEvento);
    return country
      ? q.where(eq(presupuestosEvento.country, country)).orderBy(desc(presupuestosEvento.updatedAt))
      : q.orderBy(desc(presupuestosEvento.updatedAt));
  });
}

/** Un presupuesto (cabecera + doc jsonb), o null si no existe. */
export async function getPresupuesto(id: string): Promise<PresupuestoEvento | null> {
  return withNeonRetry(async () => {
    const [row] = await db
      .select()
      .from(presupuestosEvento)
      .where(eq(presupuestosEvento.id, id))
      .limit(1);
    return row ?? null;
  });
}
