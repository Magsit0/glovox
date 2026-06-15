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
