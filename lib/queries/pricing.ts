/**
 * Queries del constructor de planes de pricing.
 *
 *  - BigQuery (referencia histórica): lee marts.ticketing_demand_by_stage para
 *    mostrar qué precio y volumen tuvo cada tipo×etapa en eventos pasados.
 *  - Postgres (planes): lista y carga los planes editables (working store).
 *
 * El país en BQ se deriva del prefijo de EventoID (GLO=Chile, GLP=Perú), igual
 * que en lib/queries/ticketing.ts. En Postgres el país es el enum CL/PE.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  ticketingPlanes,
  ticketingSponsors,
  type TicketingPlan,
  type TicketingSponsor,
  type Country as PgCountry,
} from "@/db/schema";
import { query } from "@/lib/bigquery";
import { withNeonRetry } from "@/lib/neon-retry";
import type { Country } from "@/lib/queries/comunidad";
import { bucketTipo } from "@/lib/ticketing-pricing/optimizer";

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

function countryCond(country: Country, col = "evento_id"): string {
  if (country === "chile") return `AND ${col} LIKE 'GLO%'`;
  if (country === "peru") return `AND ${col} LIKE 'GLP%'`;
  return "";
}

// ---------- Tipos ----------

export type HistoricalEventOption = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  marca: string;
  temporada: string;
  fechaEvento: string;
  tickets: number;
};

export type DemandByStageRow = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  marca: string;
  temporada: string;
  tipoTicket: string;
  etapaNorm: string;
  etapaOrden: number;
  tickets: number;
  ingreso: number;
  precioEfectivo: number;
  precioMediana: number;
  precioModal: number;
  shareEtapaEvento: number;
};

export type ComparableEvent = {
  eventoId: string;
  nombre: string;
  marca: string;
  temporada: string;
  tickets: number;
  score: number;
};


// ---------- BigQuery: referencia histórica ----------

/**
 * Eventos pasados con ventas, para elegir como referencia/plantilla. Trae
 * marca y temporada (de categoriaEvento) + total de tickets. Dedup defensivo
 * de categoriaEvento (GLO042 está duplicada).
 */
export async function getHistoricalEventOptions(
  country: Country = "all",
): Promise<HistoricalEventOption[]> {
  const rows = await query<Record<string, unknown>>(`
    WITH c AS (
      SELECT * FROM \`root-emissary-313321.glovox.categoriaEvento\`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    )
    SELECT
      c.EventoID                                       AS evento_id,
      ANY_VALUE(c.NombreGlovox)                        AS nombre,
      ANY_VALUE(c.CategoriaEvento)                     AS categoria_evento,
      REGEXP_REPLACE(ANY_VALUE(c.CategoriaEvento), r'\\s*\\d+-\\d+$', '') AS marca,
      ANY_VALUE(c.Temporada)                           AS temporada,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento)) AS fecha_evento,
      COUNTIF(t.EsDevuelto IS NOT TRUE)                AS tickets
    FROM c
    JOIN \`root-emissary-313321.glovox.tickets\` t ON c.EventoID = t.EventoID
    WHERE c.isCanceled IS NOT TRUE ${countryCond(country, "c.EventoID")}
    GROUP BY c.EventoID
    HAVING fecha_evento IS NOT NULL AND tickets > 0
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    marca: s(r.marca),
    temporada: s(r.temporada),
    fechaEvento: s(r.fecha_evento),
    tickets: n(r.tickets),
  }));
}

/**
 * Desglose tipo×etapa (precio efectivo/modal/mediana + volumen + share) para
 * uno o más eventos de referencia. Lee la vista marts.ticketing_demand_by_stage.
 * Vacío si no se pasan eventos.
 */
export async function getDemandByStageForEvents(
  eventoIds: string[],
): Promise<DemandByStageRow[]> {
  if (!eventoIds.length) return [];
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      evento_id, nombre, categoria_evento, marca, temporada,
      tipo_ticket, etapa_norm, etapa_orden,
      tickets, ingreso, precio_efectivo, precio_mediana, precio_modal,
      share_etapa_evento
    FROM \`root-emissary-313321.marts.ticketing_demand_by_stage\`
    WHERE evento_id IN UNNEST(@ids)
    ORDER BY evento_id, etapa_orden, ingreso DESC
    `,
    { ids: eventoIds },
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    marca: s(r.marca),
    temporada: s(r.temporada),
    tipoTicket: s(r.tipo_ticket),
    etapaNorm: s(r.etapa_norm),
    etapaOrden: n(r.etapa_orden),
    tickets: n(r.tickets),
    ingreso: n(r.ingreso),
    precioEfectivo: n(r.precio_efectivo),
    precioMediana: n(r.precio_mediana),
    precioModal: n(r.precio_modal),
    shareEtapaEvento: n(r.share_etapa_evento),
  }));
}

/**
 * Eventos comparables a uno dado, por marca (CategoriaEvento sin temporada) +
 * país + tamaño similar (±40% del goalTickets si existe). Devuelve un score
 * descendente. Si el evento target no está en categoriaEvento (evento nuevo),
 * devuelve vacío — usar getHistoricalEventOptions para elegir a mano.
 */
export async function getComparableEvents(
  targetEventoId: string,
  limit = 6,
): Promise<ComparableEvent[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH cat AS (
      SELECT * FROM \`root-emissary-313321.glovox.categoriaEvento\`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    ),
    target AS (
      SELECT
        EventoID,
        REGEXP_REPLACE(CategoriaEvento, r'\\s*\\d+-\\d+$', '') AS marca,
        Temporada, goalTickets, LEFT(EventoID, 3) AS pais
      FROM cat WHERE EventoID = @eventoId
    ),
    hist AS (
      SELECT
        c.EventoID,
        ANY_VALUE(c.NombreGlovox) AS nombre,
        REGEXP_REPLACE(ANY_VALUE(c.CategoriaEvento), r'\\s*\\d+-\\d+$', '') AS marca,
        ANY_VALUE(c.Temporada) AS temporada,
        LEFT(c.EventoID, 3) AS pais,
        COUNTIF(t.EsDevuelto IS NOT TRUE) AS tickets_tot
      FROM cat c
      JOIN \`root-emissary-313321.glovox.tickets\` t ON t.EventoID = c.EventoID
      WHERE c.isCanceled IS NOT TRUE
      GROUP BY c.EventoID
    )
    SELECT
      h.EventoID AS evento_id, h.nombre, h.marca, h.temporada, h.tickets_tot AS tickets,
      (CASE WHEN h.marca = t.marca THEN 3 ELSE 0 END
       + CASE WHEN h.pais = t.pais THEN 1 ELSE 0 END
       + CASE WHEN t.goalTickets IS NULL
                OR ABS(h.tickets_tot - t.goalTickets) <= 0.4 * t.goalTickets
              THEN 1 ELSE 0 END) AS score
    FROM hist h CROSS JOIN target t
    WHERE h.EventoID <> t.EventoID
    ORDER BY score DESC, h.temporada DESC
    LIMIT @lim
    `,
    { eventoId: targetEventoId, lim: limit },
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    marca: s(r.marca),
    temporada: s(r.temporada),
    tickets: n(r.tickets),
    score: n(r.score),
  }));
}

/** Un evento candidato a referencia (para el selector del optimizador). */
export type ComparableCandidate = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  temporada: string;
  tickets: number;
};

/**
 * TODOS los eventos de la misma marca + país con ventas (sin límite ni score),
 * para que la UI los agrupe por temporada/categoría y el usuario elija cuáles
 * usar como referencia. Devuelve también la marca del target.
 */
export async function getComparableCandidates(
  targetEventoId: string,
): Promise<{ marca: string; candidates: ComparableCandidate[] }> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH cat AS (
      SELECT * FROM \`root-emissary-313321.glovox.categoriaEvento\`
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    ),
    target AS (
      SELECT REGEXP_REPLACE(CategoriaEvento, r'\\s*\\d+-\\d+$', '') AS marca, LEFT(EventoID, 3) AS pais
      FROM cat WHERE EventoID = @eventoId
    )
    SELECT
      c.EventoID AS evento_id,
      ANY_VALUE(c.NombreGlovox) AS nombre,
      ANY_VALUE(c.CategoriaEvento) AS categoria_evento,
      ANY_VALUE(c.Temporada) AS temporada,
      COUNTIF(t.EsDevuelto IS NOT TRUE) AS tickets
    FROM cat c
    JOIN \`root-emissary-313321.glovox.tickets\` t ON t.EventoID = c.EventoID
    CROSS JOIN target tg
    WHERE c.isCanceled IS NOT TRUE
      AND REGEXP_REPLACE(c.CategoriaEvento, r'\\s*\\d+-\\d+$', '') = tg.marca
      AND LEFT(c.EventoID, 3) = tg.pais
      AND c.EventoID <> @eventoId
    GROUP BY c.EventoID
    HAVING tickets > 0
    ORDER BY categoria_evento DESC, tickets DESC
    `,
    { eventoId: targetEventoId },
  );
  const candidates = rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    temporada: s(r.temporada),
    tickets: n(r.tickets),
  }));
  const marca = candidates[0] ? candidates[0].categoriaEvento.replace(/\s*\d+-\d+$/, "") : "";
  return { marca, candidates };
}

// ---------- Anclas de demanda por etapa (para el optimizador) ----------

/** Ancla histórica de una celda (bucket × etapa) = PROMEDIO de los eventos elegidos. */
export type DemandAnchorPoint = {
  bucket: "VIP" | "GENERAL";
  etapaNorm: string;
  etapaOrden: number;
  /** D0 = promedio de cantidades vendidas en la celda entre los eventos elegidos. */
  d0: number;
  /** p0 = promedio de precios efectivos en la celda entre los eventos elegidos. */
  p0: number;
  nEventos: number;
  /** Lo que aportó cada evento al promedio (cantidad y precio). */
  porEvento: { eventoId: string; nombre: string; tickets: number; precio: number }[];
};

export type DemandAnchorsResult = {
  /** Suma de D0 = tamaño promedio de los eventos elegidos. */
  magnitudTotal: number;
  magnitudFuente: "comparables" | "capacidad";
  anchors: DemandAnchorPoint[];
  /** Eventos efectivamente usados como referencia (con datos). */
  eventosRef: { eventoId: string; nombre: string }[];
  comparables: ComparableEvent[];
  marca: string;
};

/**
 * Anclas de demanda por (bucket × etapa) desde el histórico de marca:
 * `p0` = PROMEDIO de los precios efectivos y `D0` = PROMEDIO de las cantidades
 * vendidas, entre los eventos elegidos como referencia. El sponsor viene
 * embebido en `tipo_ticket` ("GENERAL ENTEL") y se agrega al bucket del
 * producto. Excluye CORTESIA/OTRO; el precio ignora los tickets gratis. Devuelve
 * además el detalle por evento (lo que cada uno aportó al promedio).
 */
export async function getDemandAnchorsByStage(
  eventoId: string,
  opts?: { refEventoIds?: string[]; capacidadFallback?: number | null },
): Promise<DemandAnchorsResult> {
  const comparables = await getComparableEvents(eventoId);
  const refs = opts?.refEventoIds?.length ? opts.refEventoIds : comparables.map((c) => c.eventoId);
  const marca = comparables[0]?.marca ?? "";

  if (!refs.length) {
    return {
      magnitudTotal: opts?.capacidadFallback ?? 0,
      magnitudFuente: "capacidad",
      anchors: [],
      eventosRef: [],
      comparables,
      marca,
    };
  }

  const rows = await getDemandByStageForEvents(refs);

  // Agregar por (evento, bucket, etapa): tickets + ingreso pagado.
  type EvCell = { paidTickets: number; paidIngreso: number };
  const byEventCell = new Map<string, EvCell>();
  const nombreDe = new Map<string, string>();
  const etapaOrdenDe = new Map<string, number>();
  for (const r of rows) {
    if (r.etapaNorm === "CORTESIA" || r.etapaNorm === "OTRO") continue;
    nombreDe.set(r.eventoId, r.nombre);
    const cellKey = `${bucketTipo(r.tipoTicket)}|${r.etapaNorm}`;
    etapaOrdenDe.set(cellKey, r.etapaOrden);
    const k = `${r.eventoId}|${cellKey}`;
    let e = byEventCell.get(k);
    if (!e) {
      e = { paidTickets: 0, paidIngreso: 0 };
      byEventCell.set(k, e);
    }
    // Sólo tickets PAGADOS (precio > 0): las cortesías/invitaciones a $0 no son
    // ventas, así que no cuentan en la referencia (ni en cantidad ni en precio).
    if (r.precioEfectivo > 0) {
      e.paidTickets += r.tickets;
      e.paidIngreso += r.ingreso;
    }
  }

  // Juntar, por celda, lo que VENDIÓ cada evento (descartando celdas sin ventas pagas).
  const porCelda = new Map<string, { eventoId: string; nombre: string; tickets: number; precio: number }[]>();
  for (const [k, e] of byEventCell) {
    if (e.paidTickets <= 0) continue;
    const i = k.indexOf("|");
    const eventoId = k.slice(0, i);
    const cellKey = k.slice(i + 1);
    const arr = porCelda.get(cellKey) ?? [];
    arr.push({
      eventoId,
      nombre: nombreDe.get(eventoId) ?? eventoId,
      tickets: e.paidTickets,
      precio: Math.round(e.paidIngreso / e.paidTickets),
    });
    porCelda.set(cellKey, arr);
  }

  const anchors: DemandAnchorPoint[] = [...porCelda.entries()]
    .map(([cellKey, porEvento]) => {
      const [bucket, etapaNorm] = cellKey.split("|");
      const conPrecio = porEvento.filter((p) => p.precio > 0);
      const p0 = conPrecio.length
        ? Math.round(conPrecio.reduce((s, p) => s + p.precio, 0) / conPrecio.length)
        : 0;
      const d0 = porEvento.length
        ? Math.round(porEvento.reduce((s, p) => s + p.tickets, 0) / porEvento.length)
        : 0;
      return {
        bucket: bucket as "VIP" | "GENERAL",
        etapaNorm,
        etapaOrden: etapaOrdenDe.get(cellKey) ?? 9,
        d0,
        p0,
        nEventos: porEvento.length,
        porEvento: porEvento.sort((a, b) => b.tickets - a.tickets),
      };
    })
    .filter((a) => a.p0 > 0)
    .sort((x, y) => x.etapaOrden - y.etapaOrden || x.bucket.localeCompare(y.bucket));

  const magnitudTotal = anchors.reduce((s, a) => s + a.d0, 0);
  const eventosRef = refs
    .filter((id) => nombreDe.has(id))
    .map((id) => ({ eventoId: id, nombre: nombreDe.get(id) ?? id }));

  return { magnitudTotal, magnitudFuente: "comparables", anchors, eventosRef, comparables, marca };
}

// ---------- Postgres: planes (modelo documento) ----------

/** Planes del working store, filtrados por país si se indica. */
export async function listPlanes(country?: PgCountry): Promise<TicketingPlan[]> {
  return withNeonRetry(() => {
    const q = db.select().from(ticketingPlanes);
    return country
      ? q.where(eq(ticketingPlanes.country, country)).orderBy(desc(ticketingPlanes.updatedAt))
      : q.orderBy(desc(ticketingPlanes.updatedAt));
  });
}

/** Un plan (cabecera + doc jsonb), o null si no existe. */
export async function getPlan(planId: string): Promise<TicketingPlan | null> {
  return withNeonRetry(async () => {
    const [plan] = await db
      .select()
      .from(ticketingPlanes)
      .where(eq(ticketingPlanes.id, planId))
      .limit(1);
    return plan ?? null;
  });
}

/**
 * Catálogo de sponsors. Por defecto solo activos; `includeInactive` los trae
 * todos (para la gestión). Sin filtro de país devuelve ambos.
 */
export async function listSponsors(opts?: {
  country?: PgCountry;
  includeInactive?: boolean;
}): Promise<TicketingSponsor[]> {
  return withNeonRetry(() => {
    const conds = [];
    if (opts?.country) conds.push(eq(ticketingSponsors.country, opts.country));
    if (!opts?.includeInactive) conds.push(eq(ticketingSponsors.activo, true));
    const q = db.select().from(ticketingSponsors);
    return (conds.length ? q.where(and(...conds)) : q).orderBy(
      asc(ticketingSponsors.nombre),
    );
  });
}
