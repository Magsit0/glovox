import { cache } from "react";
import { query } from "@/lib/bigquery";
import {
  countryTicketeraFilter,
  hasCountryScope,
  type DataScope,
} from "@/lib/scopes";
import {
  CANALES_GA4_DEBILES,
  CANAL_GOOGLE,
  CANAL_META,
  CANAL_SIN_ORIGEN,
  HASTA_ABIERTO,
  estadoMedicion,
  mergeUtmOrdenes,
  monedaDePais,
  type AtribucionCompras,
  type ConjuntoMetaRow,
  type ContenidosQueVenden,
  type FuenteCanal,
  type FunnelCompra,
  type RendimientoConjuntos,
  type VentanaMedida,
} from "@/lib/marketing/atribucion";
import { tipoDeObjetivo } from "@/lib/inversion-medios/tipos";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
// Paid-media source: the GOVERNED view, which carries the raw `ads_performance`
// columns plus `gasto_usd` — converted with the exchange rate of each row's own
// date, from `referencia.tipo_cambio`. It used to read the raw table and divide
// by the flat `paidMedia.fx_rates` (CLP=900 for every date since 2023), which
// drifted up to 11% against /paid-media on the same event. Rows still carry
// multiple currencies and combined Meta + Google spend, with no EventoID — see
// `attributedAds()` for how each row is tied back to an event.
const ADS = `\`${P}.marts.paidmedia_ads_performance\``;
// Maps a Google `campaign_id` to the EventoID(s) it funds (1 campaign -> many
// events for season-long campaigns). Meta needs no map (EventoID is derived from
// the campaign name). Populated manually in BigQuery.
const CAMP_MAP = `\`${P}.paidMedia.campaign_event_map\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;
// Multi-network followers table (replaces the legacy `rrssFollowers`). Columns:
// blog_id INT64, label STRING, network STRING, date DATE, delta_followers INT64,
// total_followers INT64, loaded_at TIMESTAMP. We filter by network='instagram'
// at every call site because the dashboard reports Instagram followers.
const FOLLOWERS = `\`${P}.marketing.rrss_fllws\``;
// Funnel mart: vista sobre google_analytics.funnel con landing_page normalizada.
// La tabla cruda tiene miles de landing pages únicas (códigos personales
// /codigo/EVENTO/50/XXXX, retornos de pago /Compra/Exito/<orden>, páginas QA);
// la vista las colapsa en `landing_normalizada` y las clasifica en `familia`.
// Definición: data-governance/schemas/bigquery/views/marts_ga4_funnel.sql
const FUNNEL = `\`${P}.marts.ga4_funnel\``;
// Asignación landing↔evento. Una propiedad GA4 es de la MARCA (GRID, Piknic),
// no del evento: sin este mapa, el funnel de un evento mezcla el tráfico de
// todos los eventos de la marca. Auto-poblada desde las URLs de prueba del
// equipo; se re-siembra con data-governance/scripts/ga4_seed_landing_event_map.sql
// y admite filas manuales (fuente='manual').
const LANDING_MAP = `\`${P}.glovox_inputs.ga4_landing_event_map\``;
// Tráfico UTM mart: vista con `canal` (clasifica el source/medium informal del
// equipo — meta/venta_*, mt/pm, ff/ref… — en canales de negocio) y landing
// normalizada para acotar por evento. Definición:
// data-governance/schemas/bigquery/views/marts_ga4_utm.sql
const UTM = `\`${P}.marts.ga4_utm\``;
const USERS = `\`${P}.comunidadGlovox.users\``;
// Compras que GA4 vio (evento purchase), UNA fila por transaction_id, amarrada a
// la orden real (orden_id = OrdenID, ticketera, evento_id) y con el canal de la
// SESIÓN (session_source/medium: ve (direct) y el auto-tag de Google Ads). Trae
// también las dims MANUALES (source/medium/content/term) para cruzar con UTM.
// El inicio de la medición de cada propiedad es MIN(fecha_ga4) de esta vista.
// Definición: data-governance/schemas/bigquery/views/marts_ga4_purchases.sql
const PURCHASES = `\`${P}.marts.ga4_purchases\``;

// Override FechaOrden for GLO198 / GENERAL DGTL tickets to 2026-03-18 for chart display
const FECHA_ORDEN_ADJ = `CASE WHEN EventoID = 'GLO198' AND TipoTicket = 'GENERAL DGTL' THEN TIMESTAMP('2026-03-18') ELSE FechaOrden END`;

// Ticket filter from reference SQL: exclude cortesias and refunds
const TICKET_TYPE_FILTER = `
  CASE
    WHEN MedioPago = 'Otro' AND (LOWER(TipoTicket) LIKE '%pase%' OR LOWER(TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
    WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
    WHEN MedioPago = 'Otro' THEN 'CORTESIA'
    ELSE 'VENTA'
  END IN ('VENTA', 'PASE TEMPORADA')
  AND EsDevuelto IS FALSE
`;

// Ticket row that went through the web checkout (spec D7): sold online and paid
// with a checkout method. Box office, invitations, free tickets and season
// passes (MedioPago 'Otro') can never fire a GA4 `purchase`, so they stay out of
// every GA4 coverage denominator. Aggregated per order with LOGICAL_AND.
const ES_WEB = `COALESCE(LOWER(SucursalVenta) IN ('internet', 'marketplace') AND MedioPago NOT IN ('Otro', 'Free', 'Cash'), FALSE)`;

// Referido (already UPPER(TRIM())) → the SAME channel labels as marts.ga4_purchases,
// so an order whose channel comes from GA4 and one whose channel comes from the
// link code land in the same row. `c` is a SQL expression, never user input.
// FF codes are "Vendedores (ref)" (GA4 taxonomy); "Origen de Venta" calls them Club Glovox.
function referidoCanalSql(c: string): string {
  return `CASE
      WHEN ${c} = '' THEN NULL
      WHEN REGEXP_CONTAINS(${c}, r'^PM_MT') THEN '${CANAL_META}'
      WHEN REGEXP_CONTAINS(${c}, r'^PM_GG') THEN '${CANAL_GOOGLE}'
      WHEN REGEXP_CONTAINS(${c}, r'^PM_') OR ${c} IN ('CONV', 'MIX', 'ALC', 'TRF', 'SEA')
        OR REGEXP_CONTAINS(${c}, r'^[0-9]{15,20}$') THEN 'Paid media (otro código)'
      WHEN REGEXP_CONTAINS(${c}, r'^ORG_LT') THEN 'Linktree'
      WHEN REGEXP_CONTAINS(${c}, r'^ORG_(STO|IG)') THEN 'Social orgánico'
      WHEN REGEXP_CONTAINS(${c}, r'^EMAIL') THEN 'Email'
      WHEN REGEXP_CONTAINS(${c}, r'^FF') THEN 'Vendedores (ref)'
      ELSE 'Otro (código)'
    END`;
}

// GA4 channels that say nothing about the origin (code constants, not user input).
const GA4_DEBIL_SQL = CANALES_GA4_DEBILES.map((c) => `'${c}'`).join(", ");

// Referido of one ticket row, normalized: UPPER(TRIM()), and the placeholders
// that mean "no code" read as '' (Fever writes the literal GA4 sentinels
// "(not set)" / "(not provided)" into Referido). Without this they fell through
// to 'Otro (código)' and overrode GA4's Directo: 82 of 617 measured orders in 708092.
const REFERIDO_VACIOS = ["(NOT SET)", "(NOT PROVIDED)", "(NONE)", "(DIRECT)", "(DATA NOT AVAILABLE)", "_"];
const REFERIDO_NORM = `IF(UPPER(TRIM(COALESCE(Referido, ''))) IN (${REFERIDO_VACIOS.map((v) => `'${v}'`).join(", ")}), '', UPPER(TRIM(COALESCE(Referido, ''))))`;

// Measured web orders of @eventoId: one row per (order, ticketera), web checkout
// only (ES_WEB), day in [@medDesde, @medHasta] (ticket date, like the rest of the
// page). Shared by the queries that run over the GA4 measured window.
function ordenesWebMedidasCte(tSql: string): string {
  return `ordenes_web AS (
      SELECT
        OrdenID AS orden_id,
        Ticketera AS ticketera,
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS dia,
        SUM(Precio - COALESCE(Descuento, 0)) AS venta
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${tSql}
      GROUP BY orden_id, ticketera
      HAVING LOGICAL_AND(${ES_WEB})
        AND MIN(DATE(${FECHA_ORDEN_ADJ})) BETWEEN DATE(@medDesde) AND DATE(@medHasta)
    )`;
}

// ---------- Paid-media attribution (ads_performance) ----------
//
// `ads_performance` has no EventoID. Each row is tied to an event two ways:
//   - Meta:   EventoID = SUBSTR(campaign_name, 1, 6) — each campaign is event-specific.
//   - Google: campaign_id is mapped to its event(s) via `campaign_event_map`. A single
//             season campaign funds many events, so its daily spend is attributed to an
//             event only on days inside that event's sale window. A campaign mapped to
//             overlapping events double-counts by design (agreed product decision).
//
// Spend is multi-currency (USD / CLP / BRL …); the governed view already carries
// `gasto_usd`, converted with each row's own date rate. Callers sum that column.

// People counting: `glovox.tickets.PersonasPorTicket` (INT64) says how many
// PEOPLE a ticket row represents — 1 for the vast majority, N for multi-person
// packs the ticketera did not split into one row per attendee.
//
//   SUM(PersonasPorTicket) = people / attendees
//   COUNT(*)               = transactions / tickets issued
//
// It replaces the old local `personasExpr()` heuristic (CategoriaEvento='FBM' +
// TipoTicket LIKE '%PACK%' + an isolated 2), which double-counted the events
// where PuntoTicket had ALREADY split the pack into one row per person
// (GLO136, GLO146, GLO155, GLO165, GLO185). CPA and every other per-purchase
// metric keep using COUNT(*).

// Sale window for @eventoId: first ticket-order date → last order date (or today if
// the event is still upcoming). Mirrors the window used elsewhere in the dashboard.
// `tSql` is the scoped ticketera filter fragment from `ticketeraFilter(scope)`.
function ticketPeriodCte(tSql: string): string {
  return `ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${tSql}
    )`;
}

// Rows from `ads_performance` attributed to @eventoId (param required by callers).
// Requires a `ticket_period` CTE in the same query. `windowMeta=true` also clips Meta
// to the sale window (used by the time-series breakdown); false sums all Meta spend.
function attributedAds(windowMeta: boolean): string {
  // `gasto` stays for the per-currency native breakdown; `gasto_usd` is what
  // every total and ratio sums. It is NULL when `referencia.tipo_cambio` has no
  // rate for that date yet — SUM skips it rather than pretending it is zero.
  // `objective` and `adset_id` feed the GA4 attribution section (sales spend for
  // the CPA, spend per Meta adset). Every caller selects named columns.
  const cols = `a.plataforma, a.fecha, a.campaign_id, a.campaign_name, a.objective, a.adset_id, a.currency, a.gasto, a.gasto_usd, a.conversiones`;
  return `
    SELECT ${cols}
    FROM ${ADS} a
    ${windowMeta ? `CROSS JOIN ticket_period pm` : ``}
    WHERE a.plataforma = 'meta' AND a.gasto > 0
      AND SUBSTR(a.campaign_name, 1, 6) = @eventoId
      ${windowMeta ? `AND a.fecha BETWEEN pm.start_date AND pm.end_date` : ``}
    UNION ALL
    SELECT ${cols}
    FROM ${ADS} a
    JOIN ${CAMP_MAP} m ON a.campaign_id = m.campaign_id
    CROSS JOIN ticket_period pg
    WHERE a.plataforma = 'google' AND a.gasto > 0
      AND m.EventoID = @eventoId
      AND a.fecha BETWEEN pg.start_date AND pg.end_date`;
}

// ---------- Data scope ----------
//
// `scope` carries the user's country attribute (from session.user.country).
// `ticketeraFilter` derives the actual `Ticketera IN UNNEST(...)` clause from
// COUNTRY_TICKETERAS in lib/scopes.ts — never via SQL interpolation.

export type Scope = DataScope;

const ticketeraFilter = countryTicketeraFilter;
const hasScope = hasCountryScope;

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

// ---------- Types ----------

export type EventOption = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  fechaEvento: string;
  ticketCount: number;
};

export type EventKpiRow = {
  totalTickets: number;
  // COUNT(*) of the same rows: tickets issued by the ticketera. A "PACK PARA 2"
  // is ONE ticket worth 2 personas, so this is always <= totalTickets. Shown
  // under "Personas" so the gap between tickets and people is visible.
  totalTransactions: number;
  // Rows worth more than one person: COUNTIF(PersonasPorTicket > 1).
  packs: number;
  // Net ticket revenue = SUM(Precio - Descuento). Excludes CargoServicio (the
  // platform's service fee), which is reported separately so this number lines
  // up with what the ticketera reports for "venta de tickets".
  totalRevenue: number;
  cargoServicio: number; // SUM(CargoServicio) — shown as a secondary line
  avgPrice: number;
  daysToEvent: number;
  totalSpend: number;
  budgetPm: number;
  budgetExecPct: number;
  goalTickets: number;
  cpa: number;
  fechaEvento: string;
};

export type CumulativeSalesRow = {
  date: string;
  dailyTickets: number;
  cumulativeTickets: number;
};

export type CumulativeSalesRelativeRow = {
  eventoId: string;
  daysToEvent: number;
  dailyTickets: number;
  cumulativeTickets: number;
};

export type CurrencySpend = {
  currency: string;
  spend: number; // raw amount in `currency`
  spendUsd: number; // converted with that row's own date rate (referencia.tipo_cambio)
};

export type PlatformSpend = {
  platform: string; // 'meta', 'google', 'tiktok', ... (raw value from ads_performance)
  spendUsd: number; // USD, so platforms with different currencies stay comparable
};

export type PaidMediaSummaryRow = {
  totalSpend: number; // USD (sum across currencies)
  budget: number; // USD (budgetPm is stored in USD)
  execPct: number;
  purchases: number; // Meta pixel conversions only
  purchasesPuntoticket: number;
  cpa: number; // USD
  spendByCurrency: CurrencySpend[];
  spendByPlatform: PlatformSpend[];
};

export type CommunityCount = {
  // People bought through "Venta Comunidad" channel. Mirrors the "Tickets
  // Vendidos" KPI weighting: FBM PACK rows count as 2 personas.
  personas: number;
  // Subset: number of PACK transactions counted (raw rows). Shown next to the
  // main number to surface that the "personas" figure is x2-weighted.
  packs: number;
  // Net revenue of the same subset, same formula as EventKpiRow.totalRevenue
  // (Precio - Descuento, service fee excluded) so the share over the event
  // total is comparable.
  revenue: number;
  // Service fee of the same subset — the part `revenue` leaves out, shown as
  // its own line just like the "Venta Tickets" card does with the event total.
  cargoServicio: number;
};

export type SalesOriginRow = {
  origin: string;
  tickets: number;
  revenue: number;
};

export type FollowerRow = {
  date: string;
  totalFollowers: number;
  deltaFollowers: number;
};

export type ClubSalesRow = {
  date: string;
  tickets: number;
  revenue: number;
  cumulativeTickets: number;
};

export type ClubMembersRow = {
  date: string;
  newMembers: number;
  cumulativeMembers: number;
};

export type CategorySalesRow = {
  date: string;
  category: string;
  tickets: number;
  revenue: number;
};

export type FunnelRow = {
  step: string;
  stepOrder: number;
  users: number;
};

export type CampaignRow = {
  date: string;
  campaign: string;
  platform: string;
  spend: number;
  purchases: number;
};

export type UtmTrafficRow = {
  canal: string;
  source: string;
  medium: string;
  content: string;
  term: string;
  sessions: number;
  totalUsers: number;
  pageViews: number;
  bounceRate: number;
  engPerSession: number;
};

// Una fila por día × canal, con las órdenes reales del día repetidas en cada
// fila (el componente pivotea). Para el gráfico tráfico vs ventas.
export type TrafficTimelineRow = {
  date: string;
  canal: string;
  sessions: number;
  ordenes: number;
};

export type TicketDateRange = {
  startDate: string;
  endDate: string;
};

// ---------- Queries ----------

export async function getEventList(scope?: Scope): Promise<EventOption[]> {
  const t = ticketeraFilter(scope, "t.");
  const joinType = hasScope(scope) ? "INNER" : "LEFT";
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      c.EventoID       AS evento_id,
      ANY_VALUE(c.NombreGlovox)   AS nombre,
      ANY_VALUE(c.CategoriaEvento) AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento)) AS fecha_evento,
      COUNT(*)         AS ticket_count
    FROM ${CATEGORY} c
    ${joinType} JOIN ${TICKETS} t ON c.EventoID = t.EventoID${t.sql}
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    ORDER BY fecha_evento DESC
  `,
    t.params,
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento: s(r.fecha_evento),
    ticketCount: n(r.ticket_count),
  }));
}

export async function getUpcomingEvents(scope?: Scope): Promise<EventOption[]> {
  const t = ticketeraFilter(scope, "t.");
  const joinType = hasScope(scope) ? "INNER" : "LEFT";
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      c.EventoID                                          AS evento_id,
      ANY_VALUE(c.NombreGlovox)                           AS nombre,
      ANY_VALUE(c.CategoriaEvento)                        AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento))   AS fecha_evento,
      COUNT(*)                                            AS ticket_count
    FROM ${CATEGORY} c
    ${joinType} JOIN ${TICKETS} t ON c.EventoID = t.EventoID${t.sql}
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    HAVING fecha_evento >= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE())
    ORDER BY fecha_evento ASC
  `,
    t.params,
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento: s(r.fecha_evento),
    ticketCount: n(r.ticket_count),
  }));
}

export async function getTicketDateRange(
  eventoId: string,
  scope?: Scope,
): Promise<TicketDateRange> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d', MIN(${FECHA_ORDEN_ADJ})) AS start_date,
      FORMAT_DATE('%Y-%m-%d', CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END) AS end_date
    FROM ${TICKETS}
    WHERE EventoID = @eventoId
      AND ${TICKET_TYPE_FILTER}${t.sql}
    `,
    { eventoId, ...t.params }
  );
  const r = rows[0] ?? {};
  return {
    startDate: s(r.start_date),
    endDate: s(r.end_date),
  };
}

// Four sections of the page ask for the same KPIs: React.cache (request-scoped)
// makes that one BigQuery job. Keyed on primitives because cache() compares
// arguments by identity. Same semantics as before; `scope` only carries country.
const getEventKpisCached = cache((eventoId: string, country: Scope["country"]) =>
  getEventKpisImpl(eventoId, { country }),
);

export function getEventKpis(eventoId: string, scope?: Scope): Promise<EventKpiRow> {
  return getEventKpisCached(eventoId, scope?.country ?? null);
}

async function getEventKpisImpl(
  eventoId: string,
  scope?: Scope,
): Promise<EventKpiRow> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_stats AS (
      SELECT
        -- Personas: SUM of the PersonasPorTicket column. Drives the "Personas" KPI.
        SUM(t.PersonasPorTicket) AS total_tickets,
        -- Raw transaction count. Used by CPA so the per-purchase economics stay intact.
        COUNT(*)                        AS total_transactions,
        -- Pack ROWS (one pack sold = one ticket worth >1 person). Annotation only.
        COUNTIF(t.PersonasPorTicket > 1) AS packs,
        -- Net ticket revenue: face value minus any per-row discount, excluding
        -- the service fee (which is exposed separately as cargo_servicio). This
        -- matches what the ticketera reports as "venta de tickets".
        -- Note: PrecioFinal = (Precio - Descuento) + CargoServicio in the source
        -- rows, so the old SUM(PrecioFinal) was inflating revenue by the fee.
        SUM(t.Precio - COALESCE(t.Descuento, 0)) AS total_revenue,
        SUM(t.CargoServicio)                     AS cargo_servicio,
        AVG(t.Precio - COALESCE(t.Descuento, 0)) AS avg_price,
        MAX(t.FechaEvento) AS fecha_evento
      FROM ${TICKETS} t
      -- No LEFT JOIN to categoriaEvento: it only existed to expose
      -- CategoriaEvento to personasExpr. Dropping it also fixes GLO042, which
      -- has 6 rows in categoriaEvento and was fanning this CTE out x6.
      WHERE t.EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
    ),
    ${ticketPeriodCte(t.sql)},
    ads_evt AS (${attributedAds(false)}),
    ad_stats AS (
      SELECT SUM(e.gasto_usd) AS total_spend
      FROM ads_evt e
    ),
    event_meta AS (
      SELECT budgetPm, goalTickets
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId
    )
    SELECT
      ts.total_tickets,
      ts.total_transactions,
      ts.packs,
      ts.total_revenue,
      ts.cargo_servicio,
      ts.avg_price,
      DATE_DIFF(DATE(ts.fecha_evento), CURRENT_DATE(), DAY) AS days_to_event,
      COALESCE(a.total_spend, 0) AS total_spend,
      COALESCE(em.budgetPm, 0) AS budget_pm,
      CASE WHEN em.budgetPm > 0 THEN ROUND(COALESCE(a.total_spend, 0) / em.budgetPm * 100, 1) ELSE 0 END AS budget_exec_pct,
      COALESCE(em.goalTickets, 0) AS goal_tickets,
      -- CPA = spend / transactions (NOT personas) so a "PACK 2 PERSONAS" stays one purchase.
      CASE WHEN ts.total_transactions > 0 THEN ROUND(COALESCE(a.total_spend, 0) / ts.total_transactions, 1) ELSE 0 END AS cpa,
      FORMAT_TIMESTAMP('%Y-%m-%d', ts.fecha_evento) AS fecha_evento
    FROM ticket_stats ts
    CROSS JOIN ad_stats a
    CROSS JOIN event_meta em
    `,
    { eventoId, ...t.params }
  );
  const r = rows[0] ?? {};
  return {
    totalTickets: n(r.total_tickets),
    totalTransactions: n(r.total_transactions),
    packs: n(r.packs),
    totalRevenue: n(r.total_revenue),
    cargoServicio: n(r.cargo_servicio),
    avgPrice: n(r.avg_price),
    daysToEvent: n(r.days_to_event),
    totalSpend: n(r.total_spend),
    budgetPm: n(r.budget_pm),
    budgetExecPct: n(r.budget_exec_pct),
    goalTickets: n(r.goal_tickets),
    cpa: n(r.cpa),
    fechaEvento: s(r.fecha_evento),
  };
}

// Tickets attributed to "VentaComunidad" (the community sales channel) for the
// event. Returns personas (SUM of PersonasPorTicket, matching the "Tickets
// Vendidos" KPI), the raw count of multi-person pack ROWS in that subset —
// exposed so the UI can show "(N packs)" next to the personas number — and the
// net revenue + service fee of the subset, so the card can switch between
// counting people and summing money.
export async function getCommunityTicketsCount(
  eventoId: string,
  scope?: Scope,
): Promise<CommunityCount> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      SUM(t.PersonasPorTicket) AS personas,
      -- 'packs' stays a ROW count (one pack sold = one transaction); only the
      -- predicate migrates: a pack row is now any row worth >1 person.
      COUNTIF(t.PersonasPorTicket > 1) AS packs,
      -- Same net-revenue formula as getEventKpis.total_revenue: face value
      -- minus discount, service fee excluded — and the fee on its own, also
      -- mirroring getEventKpis.cargo_servicio.
      SUM(t.Precio - COALESCE(t.Descuento, 0)) AS revenue,
      SUM(t.CargoServicio) AS cargo_servicio
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND t.VentaComunidad IS TRUE
      AND ${TICKET_TYPE_FILTER}${t.sql}
    `,
    { eventoId, ...t.params }
  );
  const r = rows[0] ?? {};
  return {
    personas: n(r.personas),
    packs: n(r.packs),
    revenue: n(r.revenue),
    cargoServicio: n(r.cargo_servicio),
  };
}

/**
 * Multi-event cumulative sales aligned by `days_to_event` so the same chart
 * can compare a main event against others of the same category.
 *
 * Returns one row per (event, daysToEvent). Positive daysToEvent = days
 * before the event; 0 = event day; negative = days after the event.
 */
export async function getCumulativeSalesRelative(
  eventoIds: string[],
  scope?: Scope,
  tipoTickets?: string[],
): Promise<CumulativeSalesRelativeRow[]> {
  if (eventoIds.length === 0) return [];
  const t = ticketeraFilter(scope);
  // Optional ticket-type filter. The user picks values from the union of all
  // selected events; matching is by exact TipoTicket string (each event has its
  // own naming, so cross-event semantics are the caller's concern).
  const hasTipo = (tipoTickets?.length ?? 0) > 0;
  const tipoSql = hasTipo ? ` AND TipoTicket IN UNNEST(@tipoTickets)` : ``;
  const rows = await query<Record<string, unknown>>(
    `
    WITH event_dates AS (
      SELECT EventoID, MAX(FechaEvento) AS fecha_evento
      FROM ${TICKETS}
      WHERE EventoID IN UNNEST(@eventoIds)
        AND ${TICKET_TYPE_FILTER}${t.sql}
      GROUP BY EventoID
    ),
    daily AS (
      SELECT
        t.EventoID                                                        AS evento_id,
        DATE_DIFF(DATE(e.fecha_evento), DATE(CASE WHEN t.EventoID = 'GLO198' AND t.TipoTicket = 'GENERAL DGTL' THEN TIMESTAMP('2026-03-18') ELSE t.FechaOrden END), DAY) AS days_to_event,
        -- Personas (SUM of PersonasPorTicket). Keeps the chart aligned with the
        -- "Personas" KPI and the event's people-based goalTickets.
        SUM(t.PersonasPorTicket)                                          AS daily_tickets
      FROM ${TICKETS} t
      JOIN event_dates e ON e.EventoID = t.EventoID
      WHERE t.EventoID IN UNNEST(@eventoIds)
        AND ${TICKET_TYPE_FILTER}${tipoSql}${t.sql}
      GROUP BY evento_id, days_to_event
    )
    SELECT
      evento_id,
      days_to_event,
      daily_tickets,
      SUM(daily_tickets) OVER (
        PARTITION BY evento_id
        ORDER BY days_to_event DESC
      ) AS cumulative_tickets
    FROM daily
    ORDER BY evento_id, days_to_event DESC
    `,
    { eventoIds, ...t.params, ...(hasTipo ? { tipoTickets } : {}) },
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    daysToEvent: n(r.days_to_event),
    dailyTickets: n(r.daily_tickets),
    cumulativeTickets: n(r.cumulative_tickets),
  }));
}

// Distinct TipoTicket values for the union of `eventoIds`. Each event has its
// own naming, so we return the union with per-value ticket counts (used to sort
// the dropdown by relevance). Filter rules mirror `getCumulativeSalesRelative`.
export async function getTipoTicketOptions(
  eventoIds: string[],
  scope?: Scope,
): Promise<{ tipoTicket: string; tickets: number }[]> {
  if (eventoIds.length === 0) return [];
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT TipoTicket AS tipo_ticket, COUNT(*) AS tickets
    FROM ${TICKETS}
    WHERE EventoID IN UNNEST(@eventoIds)
      AND ${TICKET_TYPE_FILTER}${t.sql}
      AND TipoTicket IS NOT NULL AND TipoTicket != ''
    GROUP BY tipo_ticket
    ORDER BY tickets DESC
    `,
    { eventoIds, ...t.params },
  );
  return rows.map((r) => ({
    tipoTicket: s(r.tipo_ticket),
    tickets: n(r.tickets),
  }));
}

export async function getPaidMediaSummary(
  eventoId: string,
  scope?: Scope,
): Promise<PaidMediaSummaryRow> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${ticketPeriodCte(t.sql)},
    ads_evt AS (${attributedAds(false)}),
    ads_usd AS (
      SELECT
        e.plataforma,
        e.currency,
        e.gasto,
        e.conversiones,
        e.gasto_usd
      FROM ads_evt e
    ),
    by_currency AS (
      SELECT currency, ROUND(SUM(gasto), 2) AS spend, ROUND(SUM(gasto_usd), 2) AS spend_usd
      FROM ads_usd
      GROUP BY currency
    ),
    by_platform AS (
      SELECT plataforma, ROUND(SUM(gasto_usd), 2) AS spend_usd
      FROM ads_usd
      GROUP BY plataforma
    ),
    totals AS (
      SELECT
        SUM(gasto_usd) AS total_spend_usd,
        SUM(CASE WHEN plataforma = 'meta' THEN conversiones ELSE 0 END) AS meta_purchases
      FROM ads_usd
    ),
    event_meta AS (
      SELECT budgetPm
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId
    ),
    pt_purchases AS (
      SELECT COUNT(*) AS purchases_pt
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND Referido LIKE 'PM_%'
        AND ${TICKET_TYPE_FILTER}${t.sql}
    )
    SELECT
      COALESCE(tt.total_spend_usd, 0) AS total_spend,
      COALESCE(em.budgetPm, 0) AS budget,
      CASE WHEN em.budgetPm > 0 THEN ROUND(COALESCE(tt.total_spend_usd, 0) / em.budgetPm * 100, 1) ELSE 0 END AS exec_pct,
      COALESCE(CAST(ROUND(tt.meta_purchases) AS INT64), 0) AS purchases,
      COALESCE(pt.purchases_pt, 0) AS purchases_puntoticket,
      CASE WHEN tt.meta_purchases > 0 THEN ROUND(tt.total_spend_usd / tt.meta_purchases, 1) ELSE 0 END AS cpa,
      ARRAY(
        SELECT AS STRUCT currency, spend, spend_usd
        FROM by_currency
        ORDER BY spend_usd DESC
      ) AS by_currency,
      ARRAY(
        SELECT AS STRUCT plataforma AS platform, spend_usd
        FROM by_platform
        ORDER BY spend_usd DESC
      ) AS by_platform
    FROM totals tt
    CROSS JOIN event_meta em
    CROSS JOIN pt_purchases pt
    `,
    { eventoId, ...t.params }
  );
  const r = rows[0] ?? {};
  const byCurrency = Array.isArray(r.by_currency)
    ? (r.by_currency as Record<string, unknown>[]).map((c) => ({
        currency: s(c.currency),
        spend: n(c.spend),
        spendUsd: n(c.spend_usd),
      }))
    : [];
  const byPlatform = Array.isArray(r.by_platform)
    ? (r.by_platform as Record<string, unknown>[]).map((p) => ({
        platform: s(p.platform),
        spendUsd: n(p.spend_usd),
      }))
    : [];
  return {
    totalSpend: n(r.total_spend),
    budget: n(r.budget),
    execPct: n(r.exec_pct),
    purchases: n(r.purchases),
    purchasesPuntoticket: n(r.purchases_puntoticket),
    cpa: n(r.cpa),
    spendByCurrency: byCurrency,
    spendByPlatform: byPlatform,
  };
}

export async function getSalesOrigin(
  eventoId: string,
  scope?: Scope,
): Promise<SalesOriginRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      -- Normalize empty / whitespace-only Referido to NULL so they don't become
      -- separate "directo" buckets (they all render as origin "" client-side,
      -- which collided as duplicate React keys). TRIM also folds accidental
      -- whitespace-only referrals into the single NULL "(directo)" group.
      CASE WHEN Referido LIKE 'FF%' THEN 'Club Glovox' ELSE NULLIF(TRIM(Referido), '') END AS origin,
      COUNT(*) AS tickets,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE EventoID = @eventoId
      AND ${TICKET_TYPE_FILTER}${t.sql}
    GROUP BY origin
    ORDER BY tickets DESC
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    origin: s(r.origin),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
  }));
}

export async function getFollowersEvolution(
  eventoId: string,
  scope?: Scope,
): Promise<FollowerRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
    ),
    event_ig AS (
      SELECT CuentaIG
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(f.date)) AS date,
      f.total_followers,
      f.delta_followers
    FROM ${FOLLOWERS} f
    CROSS JOIN ticket_period p
    CROSS JOIN event_ig e
    WHERE f.blog_id = e.CuentaIG
      AND f.network = 'instagram'
      AND DATE(f.date) BETWEEN p.start_date AND p.end_date
    ORDER BY date
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    totalFollowers: n(r.total_followers),
    deltaFollowers: n(r.delta_followers),
  }));
}

// Instagram followers info over the event's sale window:
//   - delta:   SUM of daily delta_followers across the window
//   - initial: total_followers on the first day with data in the window
//   - final:   total_followers on the last day with data in the window
// `initial`/`final` are null when no rows exist (e.g. very short past events or
// IG accounts not yet tracked). The window ends at CURRENT_DATE() for upcoming
// events or at MAX(FechaOrden) for past ones — same convention as the rest of
// the dashboard.
export type FollowersInfo = {
  delta: number;
  initial: number | null;
  final: number | null;
};

export async function getFollowersDelta(
  eventoId: string,
  scope?: Scope,
): Promise<FollowersInfo> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
    ),
    event_ig AS (
      SELECT CuentaIG
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId
    ),
    in_window AS (
      SELECT f.date, f.total_followers, f.delta_followers
      FROM ${FOLLOWERS} f
      CROSS JOIN ticket_period p
      CROSS JOIN event_ig e
      WHERE f.blog_id = e.CuentaIG
        AND f.network = 'instagram'
        AND DATE(f.date) BETWEEN p.start_date AND p.end_date
    )
    SELECT
      COALESCE(SUM(delta_followers), 0) AS total_delta,
      ARRAY_AGG(total_followers ORDER BY date ASC  LIMIT 1)[SAFE_OFFSET(0)] AS initial_followers,
      ARRAY_AGG(total_followers ORDER BY date DESC LIMIT 1)[SAFE_OFFSET(0)] AS final_followers
    FROM in_window
    `,
    { eventoId, ...t.params }
  );
  const r = rows[0] ?? {};
  // Distinguish "no row at all" (null) from a row with value 0. SUM defaults to
  // 0 via COALESCE; initial/final stay null when in_window is empty.
  const ini = r.initial_followers;
  const fin = r.final_followers;
  return {
    delta: n(r.total_delta),
    initial: ini == null ? null : n(ini),
    final: fin == null ? null : n(fin),
  };
}

export async function getClubMembersEvolution(
  eventoId: string,
  scope?: Scope,
): Promise<ClubMembersRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
    ),
    daily AS (
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d', u.createdAt) AS date,
        COUNT(*) AS new_members
      FROM ${USERS} u
      CROSS JOIN ticket_period p
      WHERE DATE(u.createdAt) BETWEEN p.start_date AND p.end_date
      GROUP BY date
    )
    SELECT
      date,
      new_members,
      SUM(new_members) OVER (ORDER BY date) AS cumulative_members
    FROM daily
    ORDER BY date
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    newMembers: n(r.new_members),
    cumulativeMembers: n(r.cumulative_members),
  }));
}

export async function getFunnelData(
  eventoId: string,
  landingPages?: string[],
  // Opt-in "Desde medición GA4": clips the steps to the GA4 measured window so
  // they line up with the "Compran" step (getFunnelCompra). Absent = unchanged.
  ventana?: VentanaMedida,
): Promise<FunnelRow[]> {
  const list = landingPages ?? [];
  const hasFilter = list.length > 0;
  const dateCond = ventana
    ? `f.date BETWEEN DATE(@medDesde) AND DATE(@medHasta)`
    : `f.date BETWEEN p.start_date AND p.end_date`;
  // Acotado por defecto a (a) la ventana de venta del evento — igual que la
  // sección UTM — y (b) las landings del evento: las del LANDING_MAP más las
  // URLs que traen el EventoID embebido (/codigo/GLO198/...). Piknic reusa el
  // mismo slug entre ediciones, por eso fechas y mapa se aplican JUNTOS. Si el
  // evento no tiene landings mapeadas, cae a toda la propiedad (solo excluye
  // códigos de otros eventos). La selección manual reemplaza el criterio (b).
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${ticketPeriodCte("")},
    mapa_evento AS (
      SELECT property_id, landing_normalizada
      FROM ${LANDING_MAP}
      WHERE evento_id = @eventoId
    )
    SELECT
      f.funnel_step AS step,
      f.step_order,
      SUM(f.total_users) AS users
    FROM ${FUNNEL} f
    JOIN ${CATEGORY} c ON f.property_id = CAST(c.property_ga4 AS STRING)
    LEFT JOIN mapa_evento m
      ON m.property_id = f.property_id
      AND m.landing_normalizada = f.landing_normalizada
    CROSS JOIN ticket_period p
    WHERE c.EventoID = @eventoId
      AND ${dateCond}
      AND CASE
        WHEN @hasFilter THEN f.landing_normalizada IN UNNEST(@landingPages)
        WHEN f.evento_id_url = @eventoId OR m.landing_normalizada IS NOT NULL THEN TRUE
        WHEN EXISTS (SELECT 1 FROM mapa_evento) THEN FALSE
        ELSE f.evento_id_url IS NULL
      END
    GROUP BY step, step_order
    ORDER BY step_order
    `,
    {
      eventoId,
      hasFilter,
      landingPages: hasFilter ? list : [""],
      ...(ventana ? { medDesde: ventana.desde, medHasta: ventana.hasta } : {}),
    }
  );
  return rows.map((r) => ({
    step: s(r.step),
    stepOrder: n(r.step_order),
    users: n(r.users),
  }));
}

export async function getFunnelLandingPages(
  eventoId: string
): Promise<string[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH mapa_evento AS (
      SELECT property_id, landing_normalizada
      FROM ${LANDING_MAP}
      WHERE evento_id = @eventoId
    )
    SELECT f.landing_normalizada AS landing_page
    FROM ${FUNNEL} f
    JOIN ${CATEGORY} c ON f.property_id = CAST(c.property_ga4 AS STRING)
    LEFT JOIN mapa_evento m
      ON m.property_id = f.property_id
      AND m.landing_normalizada = f.landing_normalizada
    WHERE c.EventoID = @eventoId
    GROUP BY landing_page
    ORDER BY
      MAX(IF(f.evento_id_url = @eventoId OR m.landing_normalizada IS NOT NULL, 1, 0)) DESC,
      MIN(CASE f.familia
        WHEN 'pagina_evento' THEN 0
        WHEN 'codigo_personal' THEN 1
        WHEN 'link_referido' THEN 2
        WHEN 'checkout_interno' THEN 3
        WHEN 'retorno_pago' THEN 4
        ELSE 5
      END),
      SUM(f.total_users) DESC
    `,
    { eventoId }
  );
  return rows.map((r) => s(r.landing_page)).filter((v) => v.length > 0);
}

export async function getCampaignBreakdown(
  eventoId: string,
  scope?: Scope,
): Promise<CampaignRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${ticketPeriodCte(t.sql)},
    ads_evt AS (${attributedAds(true)})
    SELECT
      FORMAT_DATE('%Y-%m-%d', e.fecha) AS date,
      e.campaign_name AS campaign,
      e.plataforma AS platform,
      SUM(e.gasto_usd) AS spend,
      SUM(e.conversiones) AS purchases
    FROM ads_evt e
    GROUP BY date, campaign, platform
    ORDER BY date, campaign
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    campaign: s(r.campaign),
    platform: s(r.platform),
    spend: n(r.spend),
    purchases: n(r.purchases),
  }));
}

export async function getUtmTraffic(
  eventoId: string,
  scope?: Scope,
): Promise<UtmTrafficRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
    ),
    mapa_evento AS (
      SELECT property_id, landing_normalizada
      FROM ${LANDING_MAP}
      WHERE evento_id = @eventoId
    )
    SELECT
      u.canal AS canal,
      COALESCE(u.medium, '(none)') AS medium,
      COALESCE(u.source, '(direct)') AS source,
      COALESCE(u.content, '') AS content,
      COALESCE(u.term, '') AS term,
      SUM(u.sessions) AS sessions,
      SUM(u.total_users) AS total_users,
      SUM(u.screen_page_views) AS page_views,
      SAFE_DIVIDE(SUM(u.bounce_rate * u.sessions), SUM(u.sessions)) AS bounce_rate,
      SAFE_DIVIDE(SUM(u.event_count), SUM(u.sessions)) AS eng_per_session
    FROM ${UTM} u
    JOIN ${CATEGORY} c ON u.property_id = CAST(c.property_ga4 AS STRING)
    LEFT JOIN mapa_evento m
      ON m.property_id = u.property_id
      AND m.landing_normalizada = u.landing_normalizada
    CROSS JOIN ticket_period p
    WHERE c.EventoID = @eventoId
      AND u.date BETWEEN p.start_date AND p.end_date
      AND CASE
        WHEN u.evento_id_url = @eventoId OR m.landing_normalizada IS NOT NULL THEN TRUE
        WHEN EXISTS (SELECT 1 FROM mapa_evento) THEN FALSE
        ELSE u.evento_id_url IS NULL
      END
    GROUP BY canal, medium, source, content, term
    ORDER BY sessions DESC
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    canal: s(r.canal),
    medium: s(r.medium),
    source: s(r.source),
    content: s(r.content),
    term: s(r.term),
    sessions: n(r.sessions),
    totalUsers: n(r.total_users),
    pageViews: n(r.page_views),
    bounceRate: n(r.bounce_rate),
    engPerSession: n(r.eng_per_session),
  }));
}

// Tráfico diario por canal + órdenes reales del día (glovox.tickets), dentro
// de la ventana de venta y acotado a las landings del evento — el cruce
// "termómetro web vs caja registradora". Las órdenes llegan repetidas en cada
// fila del mismo día (ANY_VALUE); el componente las desduplica al pivotear.
export async function getTrafficTimeline(
  eventoId: string,
  scope?: Scope,
): Promise<TrafficTimelineRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${ticketPeriodCte(t.sql)},
    mapa_evento AS (
      SELECT property_id, landing_normalizada
      FROM ${LANDING_MAP}
      WHERE evento_id = @eventoId
    ),
    ordenes_dia AS (
      SELECT DATE(${FECHA_ORDEN_ADJ}) AS dia, COUNT(DISTINCT OrdenID) AS ordenes
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
      GROUP BY dia
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', u.date) AS date,
      u.canal AS canal,
      SUM(u.sessions) AS sessions,
      ANY_VALUE(COALESCE(o.ordenes, 0)) AS ordenes
    FROM ${UTM} u
    JOIN ${CATEGORY} c ON u.property_id = CAST(c.property_ga4 AS STRING)
    LEFT JOIN mapa_evento m
      ON m.property_id = u.property_id
      AND m.landing_normalizada = u.landing_normalizada
    CROSS JOIN ticket_period p
    LEFT JOIN ordenes_dia o ON o.dia = u.date
    WHERE c.EventoID = @eventoId
      AND u.date BETWEEN p.start_date AND p.end_date
      AND CASE
        WHEN u.evento_id_url = @eventoId OR m.landing_normalizada IS NOT NULL THEN TRUE
        WHEN EXISTS (SELECT 1 FROM mapa_evento) THEN FALSE
        ELSE u.evento_id_url IS NULL
      END
    GROUP BY date, canal
    ORDER BY date
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    canal: s(r.canal),
    sessions: n(r.sessions),
    ordenes: n(r.ordenes),
  }));
}

// ---------- Atribución de compras (GA4 purchases × órdenes reales) ----------
//
// Every query below runs over the GA4 MEASURED window (spec D6), not the sale
// window: GA4 records purchases with their order number only since the tag
// started (16-sep-2026 for the CL properties; earlier for Fever). Orders are
// web-checkout only (D7, ES_WEB) and dated by DATE(FechaOrden) like the rest of
// the page. The mart is joined by (orden_id, ticketera), so a GA4 property that
// carries several events is split correctly per event.
//
// Timeout + process cache (governance playbook rule for heavy queries, same
// pattern as ffbb.ts / cierreMensual.ts): these four are the heaviest queries of
// the page (60-76 MB) and their data changes once a day (GA4 ETL at 06:00), so a
// 5-minute TTL is safe. The key is the SQL plus its params, which already carry
// the event, the window and the scope's ticketeras: users with different country
// scope never share an entry. A rejected query (error or timeout) is evicted at
// once. React.cache on getAtribucionCompras still dedupes within one request.
const GA4_QUERY_TIMEOUT_MS = 30_000;
const GA4_CACHE_TTL_MS = 5 * 60 * 1000;
const ga4QueryCache = new Map<string, { at: number; rows: Promise<Record<string, unknown>[]> }>();

function withTimeout<T>(p: Promise<T>, ms = GA4_QUERY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Vuelve a intentarlo.`)),
      ms,
    );
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

function queryGa4Cached(sql: string, params: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const key = `${sql}\u0000${JSON.stringify(params)}`;
  const now = Date.now();
  const hit = ga4QueryCache.get(key);
  if (hit && now - hit.at < GA4_CACHE_TTL_MS) return hit.rows;
  for (const [k, v] of ga4QueryCache) {
    if (now - v.at >= GA4_CACHE_TTL_MS) ga4QueryCache.delete(k);
  }
  const rows = withTimeout(query<Record<string, unknown>>(sql, params));
  ga4QueryCache.set(key, { at: now, rows });
  rows.catch(() => {
    if (ga4QueryCache.get(key)?.rows === rows) ga4QueryCache.delete(key);
  });
  return rows;
}

/** Order-level GA4 attribution for an event, over its measured window (D6). One BQ job.
 *  cache(): the attribution section, the Paid Media panel and the Funnel share it per
 *  request. Keyed on primitives (React.cache compares arguments by identity).
 *  `hastaMax` is for audits only: it pins the end of the measured window. */
export const getAtribucionCompras = cache(async function getAtribucionCompras(
  eventoId: string,
  country: Scope["country"],
  hastaMax: string = HASTA_ABIERTO,
): Promise<AtribucionCompras> {
  const t = ticketeraFilter({ country });
  const rows = await queryGa4Cached(
    `
    WITH ${ticketPeriodCte(t.sql)},
    ordenes AS (
      SELECT
        OrdenID AS orden_id,
        Ticketera AS ticketera,
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS dia,
        MIN(DATE(FechaEvento)) AS fecha_evento,
        ANY_VALUE(MedioPago) AS medio_pago,
        -- Deterministic: the (max) non-empty code of the order, '' when it has none.
        COALESCE(MAX(NULLIF(${REFERIDO_NORM}, '')), '') AS ref,
        LOGICAL_OR(MedioPago = 'Otro') AS es_pase,
        LOGICAL_AND(${ES_WEB}) AS es_web,
        SUM(PersonasPorTicket) AS personas,
        SUM(Precio - COALESCE(Descuento, 0)) AS venta
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
      GROUP BY orden_id, ticketera
    ),
    -- Scope also filters the mart: its \`ticketera\` column (BigQuery names are case-insensitive).
    vistas AS (
      SELECT orden_id, ticketera, property_id, canal, disparo_tardio
      FROM ${PURCHASES}
      WHERE evento_id = @eventoId AND match_ticketera${t.sql}
    ),
    props AS (   -- DISTINCT: categoriaEvento repeats rows for some events
      SELECT CAST(property_ga4 AS STRING) AS property_id
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId AND property_ga4 IS NOT NULL
      UNION DISTINCT
      SELECT property_id FROM vistas
    ),
    evento_pais AS (SELECT ANY_VALUE(Pais) AS pais FROM ${CATEGORY} WHERE EventoID = @eventoId),
    tracking AS (   -- first day the WHOLE property records purchases with an order number
      SELECT property_id, MIN(fecha_ga4) AS tracking_desde, MAX(ingested_at) AS ingested_at
      FROM ${PURCHASES}
      GROUP BY property_id
    ),
    -- Last day the GA4 ETL loaded, for BOTH reports the section reads. utm and
    -- purchases load independently (one try/except per property × report), so a
    -- failed purchases load must not turn its days into "measured, 0 seen".
    -- Purchases: the whole table's last load (Santiago) − 1 day, because a
    -- property with no sales in the refreshed range loads no rows at all (a
    -- per-property MAX would freeze exactly when a tag breaks and hide the break).
    etl AS (   -- a JOIN, not IN (subquery): BigQuery rejects that form here as a non-decorrelatable subquery
      SELECT
        LEAST(
          MAX(u.date),
          (SELECT DATE_SUB(DATE(MAX(ingested_at), 'America/Santiago'), INTERVAL 1 DAY) FROM tracking)
        ) AS etl_hasta,
        COUNT(DISTINCT pr.property_id) AS propiedades
      FROM props pr
      LEFT JOIN ${UTM} u
        ON u.property_id = pr.property_id
        AND u.date >= DATE_SUB(CURRENT_DATE('America/Santiago'), INTERVAL 30 DAY)
    ),
    inicio AS (   -- first FULL day of tracking, and not before the first order GA4 saw live
      SELECT GREATEST(
          DATE_ADD(MIN(s.tracking_desde), INTERVAL 1 DAY),
          MIN(IF(v.disparo_tardio, NULL, o.dia))
        ) AS medible_desde
      FROM vistas v
      JOIN ordenes o USING (orden_id, ticketera)
      JOIN tracking s ON s.property_id = v.property_id
    ),
    rango AS (
      SELECT
        p.start_date AS ventana_desde,
        p.end_date AS ventana_hasta,
        i.medible_desde,
        LEAST(p.end_date, COALESCE(e.etl_hasta, p.end_date), DATE(@hastaMax)) AS medible_hasta,
        e.etl_hasta,
        e.propiedades,
        (SELECT MIN(fecha_evento) FROM ordenes) AS fecha_evento,
        (SELECT pais FROM evento_pais) AS pais
      FROM ticket_period p CROSS JOIN inicio i CROSS JOIN etl e
    ),
    att AS (
      SELECT
        o.orden_id, o.dia, o.medio_pago, o.ref, o.personas, o.venta,
        v.orden_id IS NOT NULL AS vista,
        v.canal AS canal_ga4,
        ${referidoCanalSql("o.ref")} AS canal_ref,
        CASE
          WHEN o.es_pase THEN 'pase'
          WHEN NOT o.es_web THEN 'fuera_web'
          WHEN r.medible_desde IS NULL THEN 'sin_medicion'
          WHEN o.dia < r.medible_desde THEN 'antes'
          WHEN o.dia > r.medible_hasta THEN 'pendiente'
          ELSE 'medible'
        END AS fase
      FROM ordenes o
      CROSS JOIN rango r
      LEFT JOIN vistas v USING (orden_id, ticketera)
    ),
    real AS (   -- one channel per order: GA4 wins; Referido fills in when GA4 is missing or weak
      SELECT
        *,
        CASE
          WHEN canal_ga4 NOT IN (${GA4_DEBIL_SQL}) THEN 'ga4'
          WHEN canal_ref IS NOT NULL THEN 'referido'
          WHEN canal_ga4 IS NOT NULL THEN 'ga4'
          ELSE 'sin_dato'
        END AS fuente,
        CASE
          WHEN canal_ga4 NOT IN (${GA4_DEBIL_SQL}) THEN canal_ga4
          WHEN canal_ref IS NOT NULL THEN canal_ref
          WHEN canal_ga4 IS NOT NULL THEN canal_ga4
          ELSE '${CANAL_SIN_ORIGEN}'
        END AS canal_real
      FROM att
      WHERE fase = 'medible'
    ),
    ads_evt AS (${attributedAds(false)}),
    ads_w AS (   -- spend and pixel clipped to the SAME window as the GA4 and Referido lenses
      SELECT
        SUM(IF(e.plataforma = 'meta', e.gasto_usd, 0)) AS spend_meta,
        SUM(IF(e.plataforma = 'meta' AND e.objective = 'OUTCOME_SALES', e.gasto_usd, 0)) AS spend_meta_ventas,
        SUM(IF(e.plataforma = 'google', e.gasto_usd, 0)) AS spend_google,
        SUM(IF(e.plataforma = 'meta', e.conversiones, 0)) AS pixel_meta,
        SUM(IF(e.plataforma = 'meta' AND e.objective = 'OUTCOME_SALES', e.conversiones, 0)) AS pixel_meta_ventas
      FROM ads_evt e
      CROSS JOIN rango r
      WHERE e.fecha BETWEEN r.medible_desde AND r.medible_hasta
    ),
    resumen AS (
      SELECT
        COUNTIF(fase != 'pase') AS ordenes_no_pase,
        COUNTIF(fase = 'pase') AS ordenes_pase,
        COUNTIF(fase = 'fuera_web') AS ordenes_fuera_web,
        COUNTIF(fase = 'antes') AS ordenes_antes,
        COUNTIF(fase = 'pendiente') AS ordenes_pendientes,
        COUNTIF(fase = 'medible') AS ordenes_medibles,
        COUNTIF(fase = 'medible' AND vista) AS ordenes_vistas,
        COUNTIF(fase = 'medible' AND canal_ga4 = 'Pasarela de pago') AS vistas_pasarela,
        COUNTIF(fase = 'medible' AND canal_ga4 = '${CANAL_META}') AS ga4_meta,
        COUNTIF(fase = 'medible' AND canal_ga4 = '${CANAL_GOOGLE}') AS ga4_google,
        COUNTIF(fase = 'medible' AND REGEXP_CONTAINS(ref, r'^PM_MT')) AS ref_meta,
        COUNTIF(fase = 'medible' AND REGEXP_CONTAINS(ref, r'^PM_GG')) AS ref_google,
        COUNTIF(fase = 'medible' AND REGEXP_CONTAINS(ref, r'^PM_')) AS ref_pm,
        COUNTIF(fase = 'medible' AND NOT vista AND canal_ref IS NOT NULL) AS solo_referido
      FROM att
    )
    SELECT
      FORMAT_DATE('%F', r.ventana_desde) AS ventana_desde,
      FORMAT_DATE('%F', r.ventana_hasta) AS ventana_hasta,
      FORMAT_DATE('%F', r.medible_desde) AS medible_desde,
      FORMAT_DATE('%F', r.medible_hasta) AS medible_hasta,
      FORMAT_DATE('%F', r.etl_hasta) AS etl_hasta,
      FORMAT_DATE('%F', r.fecha_evento) AS fecha_evento,
      r.pais,
      r.propiedades,
      s.*,
      COALESCE(a.pixel_meta, 0) AS pixel_meta,
      COALESCE(a.pixel_meta_ventas, 0) AS pixel_meta_ventas,
      ROUND(COALESCE(a.spend_meta, 0), 2) AS spend_meta,
      ROUND(COALESCE(a.spend_meta_ventas, 0), 2) AS spend_meta_ventas,
      ROUND(COALESCE(a.spend_google, 0), 2) AS spend_google,
      ARRAY(SELECT AS STRUCT canal_real AS canal, fuente, COUNT(*) AS ordenes,
              SUM(personas) AS personas, SUM(venta) AS venta
            FROM real GROUP BY canal_real, fuente ORDER BY ordenes DESC, canal) AS canal_real,
      ARRAY(SELECT AS STRUCT medio_pago, COUNT(*) AS ordenes, COUNTIF(vista) AS vistas
            FROM real GROUP BY medio_pago ORDER BY ordenes DESC, medio_pago) AS por_medio_pago,
      ARRAY(SELECT AS STRUCT FORMAT_DATE('%F', dia) AS date, COUNT(*) AS ordenes,
              COUNTIF(vista) AS vistas, COUNTIF(canal_ga4 = 'Pasarela de pago') AS pasarela
            FROM real GROUP BY dia ORDER BY dia) AS por_dia,
      ARRAY(SELECT AS STRUCT FORMAT_DATE('%F', dia) AS date, canal_real AS canal, COUNT(*) AS ordenes
            FROM real GROUP BY dia, canal_real ORDER BY dia, ordenes DESC, canal) AS por_dia_canal
    FROM rango r
    CROSS JOIN resumen s
    CROSS JOIN ads_w a
    `,
    { eventoId, hastaMax, ...t.params },
  );
  const r = rows[0] ?? {};
  const d = (v: unknown) => s(v) || null;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const base = {
    ventanaDesde: d(r.ventana_desde),
    ventanaHasta: d(r.ventana_hasta),
    medibleDesde: d(r.medible_desde),
    medibleHasta: d(r.medible_hasta),
    etlHasta: d(r.etl_hasta),
    fechaEvento: d(r.fecha_evento),
    moneda: monedaDePais(s(r.pais)),
    propiedades: n(r.propiedades),
    ordenes: {
      noPase: n(r.ordenes_no_pase),
      pase: n(r.ordenes_pase),
      fueraWeb: n(r.ordenes_fuera_web),
      antes: n(r.ordenes_antes),
      pendientes: n(r.ordenes_pendientes),
      medibles: n(r.ordenes_medibles),
      vistas: n(r.ordenes_vistas),
      vistasPasarela: n(r.vistas_pasarela),
      soloReferido: n(r.solo_referido),
      referidoPm: n(r.ref_pm),
    },
    meta: {
      pixelVentas: n(r.pixel_meta_ventas),
      pixelTotal: n(r.pixel_meta),
      ga4: n(r.ga4_meta),
      referido: n(r.ref_meta),
      gastoVentasUsd: n(r.spend_meta_ventas),
      gastoTotalUsd: n(r.spend_meta),
    },
    google: { ga4: n(r.ga4_google), referido: n(r.ref_google), gastoUsd: n(r.spend_google) },
    canalReal: arr(r.canal_real).map((c) => ({
      canal: s(c.canal),
      fuente: s(c.fuente) as FuenteCanal,
      ordenes: n(c.ordenes),
      personas: n(c.personas),
      venta: n(c.venta),
    })),
    porMedioPago: arr(r.por_medio_pago).map((c) => ({
      medioPago: s(c.medio_pago),
      ordenes: n(c.ordenes),
      vistas: n(c.vistas),
    })),
    porDia: arr(r.por_dia).map((c) => ({
      date: s(c.date),
      ordenes: n(c.ordenes),
      vistas: n(c.vistas),
      pasarela: n(c.pasarela),
    })),
    porDiaCanal: arr(r.por_dia_canal).map((c) => ({
      date: s(c.date),
      canal: s(c.canal),
      ordenes: n(c.ordenes),
    })),
  };
  return { ...base, estado: estadoMedicion(base) };
});

/**
 * "Qué contenido vende": sesiones UTM y órdenes GA4 por contenido, en la ventana
 * medida. El tráfico se acota EXACTAMENTE como getUtmTraffic (propiedad del
 * evento + landings del mapa / EventoID en la URL, o toda la propiedad si el
 * evento no tiene mapa), pero recortado a [desde, hasta]; las órdenes son las
 * web medidas del evento, por la clave MANUAL source|medium|content|term (las
 * dims con las que se arma la tabla UTM). El cruce vive en mergeUtmOrdenes.
 * Una sola consulta. Llamar solo con una ventana medida (ventanaMedida()).
 */
export async function getContenidosQueVenden(
  eventoId: string,
  country: Scope["country"],
  medible: VentanaMedida,
): Promise<ContenidosQueVenden> {
  const t = ticketeraFilter({ country });
  const rows = await queryGa4Cached(
    `
    WITH mapa_evento AS (
      SELECT property_id, landing_normalizada
      FROM ${LANDING_MAP}
      WHERE evento_id = @eventoId
    ),
    prop AS (   -- DISTINCT: categoriaEvento repeats rows for some events
      SELECT DISTINCT CAST(property_ga4 AS STRING) AS property_id
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId AND property_ga4 IS NOT NULL
    ),
    utm_ses AS (
      SELECT
        u.canal AS canal,
        COALESCE(u.medium, '(none)') AS medium,
        COALESCE(u.source, '(direct)') AS source,
        COALESCE(u.content, '') AS content,
        COALESCE(u.term, '') AS term,
        SUM(u.sessions) AS sesiones
      FROM ${UTM} u
      JOIN prop pr ON pr.property_id = u.property_id
      LEFT JOIN mapa_evento m
        ON m.property_id = u.property_id
        AND m.landing_normalizada = u.landing_normalizada
      WHERE u.date BETWEEN DATE(@medDesde) AND DATE(@medHasta)
        AND CASE
          WHEN u.evento_id_url = @eventoId OR m.landing_normalizada IS NOT NULL THEN TRUE
          WHEN EXISTS (SELECT 1 FROM mapa_evento) THEN FALSE
          ELSE u.evento_id_url IS NULL
        END
      GROUP BY canal, medium, source, content, term
    ),
    ${ordenesWebMedidasCte(t.sql)},
    utm_ord AS (
      SELECT
        COALESCE(g.medium, '(none)') AS medium,
        COALESCE(g.source, '(direct)') AS source,
        COALESCE(g.content, '') AS content,
        COALESCE(g.term, '') AS term,
        COUNT(*) AS ordenes,
        SUM(o.venta) AS venta
      FROM ordenes_web o
      JOIN ${PURCHASES} g ON g.orden_id = o.orden_id AND g.ticketera = o.ticketera
      WHERE g.evento_id = @eventoId AND g.match_ticketera
      GROUP BY medium, source, content, term
    )
    SELECT
      ARRAY(SELECT AS STRUCT canal, source, medium, content, term, sesiones
            FROM utm_ses ORDER BY sesiones DESC) AS sesiones,
      ARRAY(SELECT AS STRUCT source, medium, content, term, ordenes, venta
            FROM utm_ord ORDER BY ordenes DESC) AS ordenes
    `,
    { eventoId, medDesde: medible.desde, medHasta: medible.hasta, ...t.params },
  );
  const r = rows[0] ?? {};
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return mergeUtmOrdenes(
    arr(r.sesiones).map((u) => ({
      canal: s(u.canal),
      source: s(u.source),
      medium: s(u.medium),
      content: s(u.content),
      term: s(u.term),
      sesiones: n(u.sesiones),
    })),
    arr(r.ordenes).map((o) => ({
      source: s(o.source),
      medium: s(o.medium),
      content: s(o.content),
      term: s(o.term),
      ordenes: n(o.ordenes),
      venta: n(o.venta),
    })),
  );
}

/**
 * "Rendimiento por conjunto (Meta)": gasto y pixel por adset (attributedAds,
 * recortado a la ventana medida) junto a las órdenes web medidas cuya sesión GA4
 * trae ese adset (sessionCampaignId = "<adset_id>_v2_…" → meta_adset_id).
 * FULL JOIN: aparecen también conjuntos con órdenes GA4 y sin gasto en la
 * ventana. Nombres y objetivo salen del mart de pauta (último valor visto).
 */
export async function getRendimientoConjuntos(
  eventoId: string,
  country: Scope["country"],
  medible: VentanaMedida,
): Promise<RendimientoConjuntos> {
  const t = ticketeraFilter({ country });
  const rows = await queryGa4Cached(
    `
    WITH ${ticketPeriodCte(t.sql)},
    ads_evt AS (${attributedAds(false)}),
    gasto AS (
      SELECT
        e.adset_id,
        SUM(e.gasto_usd) AS gasto_usd,
        SUM(e.conversiones) AS pixel
      FROM ads_evt e
      WHERE e.plataforma = 'meta'
        AND e.fecha BETWEEN DATE(@medDesde) AND DATE(@medHasta)
      GROUP BY e.adset_id
    ),
    ${ordenesWebMedidasCte(t.sql)},
    ga4 AS (
      SELECT g.meta_adset_id AS adset_id, g.canal
      FROM ordenes_web o
      JOIN ${PURCHASES} g ON g.orden_id = o.orden_id AND g.ticketera = o.ticketera
      WHERE g.evento_id = @eventoId AND g.match_ticketera
    ),
    ga4_adset AS (
      SELECT adset_id, COUNT(*) AS ordenes
      FROM ga4
      WHERE adset_id IS NOT NULL
      GROUP BY adset_id
    ),
    conjuntos AS (
      SELECT
        COALESCE(g.adset_id, a.adset_id) AS adset_id,
        COALESCE(g.gasto_usd, 0) AS gasto_usd,
        COALESCE(g.pixel, 0) AS pixel,
        COALESCE(a.ordenes, 0) AS ordenes_ga4
      FROM gasto g
      FULL JOIN ga4_adset a ON a.adset_id = g.adset_id
    ),
    nombres AS (
      SELECT
        x.adset_id,
        ARRAY_AGG(STRUCT(x.campaign_name, x.adset_name, x.objective) ORDER BY x.fecha DESC LIMIT 1)[OFFSET(0)] AS nm
      FROM ${ADS} x
      JOIN (SELECT DISTINCT adset_id FROM conjuntos) c ON c.adset_id = x.adset_id
      WHERE x.plataforma = 'meta'
      GROUP BY x.adset_id
    )
    SELECT
      ARRAY(
        SELECT AS STRUCT
          c.adset_id,
          n.nm.campaign_name AS campaign_name,
          n.nm.adset_name AS adset_name,
          n.nm.objective AS objective,
          ROUND(c.gasto_usd, 2) AS gasto_usd,
          c.pixel,
          c.ordenes_ga4
        FROM conjuntos c
        LEFT JOIN nombres n ON n.adset_id = c.adset_id
        ORDER BY c.gasto_usd DESC, c.ordenes_ga4 DESC, c.adset_id
      ) AS conjuntos,
      (SELECT COUNTIF(canal = '${CANAL_META}') FROM ga4) AS ga4_meta,
      (SELECT COUNTIF(canal = '${CANAL_META}' AND adset_id IS NULL) FROM ga4) AS ga4_meta_sin_conjunto
    `,
    { eventoId, medDesde: medible.desde, medHasta: medible.hasta, ...t.params },
  );
  const r = rows[0] ?? {};
  const conjuntos = Array.isArray(r.conjuntos) ? (r.conjuntos as Record<string, unknown>[]) : [];
  return {
    rows: conjuntos.map(
      (c): ConjuntoMetaRow => ({
        adsetId: s(c.adset_id),
        campana: s(c.campaign_name),
        conjunto: s(c.adset_name),
        objective: s(c.objective),
        objetivo: s(c.objective) ? tipoDeObjetivo("meta", s(c.objective)) : "",
        gastoUsd: n(c.gasto_usd),
        pixel: n(c.pixel),
        ordenesGa4: n(c.ordenes_ga4),
      }),
    ),
    ga4Meta: n(r.ga4_meta),
    ga4MetaSinConjunto: n(r.ga4_meta_sin_conjunto),
  };
}

/**
 * Paso "Compran (órdenes GA4)" del Funnel en modo "Desde medición GA4": órdenes
 * que GA4 registró con su número de orden, fechadas por la orden, en la ventana
 * medida. Mismo alcance que los pasos 1-4: si el evento tiene landings mapeadas
 * se cuenta solo el evento; si no, toda la propiedad GA4 (incluye compras de
 * otros eventos de la misma propiedad, que vuelven en `otrosEventos`).
 * No admite filtro por landing (la tabla de compras no trae landingPage).
 */
export async function getFunnelCompra(
  eventoId: string,
  country: Scope["country"],
  ventana: VentanaMedida,
): Promise<FunnelCompra> {
  const t = ticketeraFilter({ country });
  const rows = await queryGa4Cached(
    `
    WITH mapa_evento AS (
      SELECT property_id, landing_normalizada
      FROM ${LANDING_MAP}
      WHERE evento_id = @eventoId
    ),
    prop AS (
      SELECT DISTINCT CAST(property_ga4 AS STRING) AS property_id
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId AND property_ga4 IS NOT NULL
    ),
    tiene_mapa AS (SELECT COUNT(*) > 0 AS si FROM mapa_evento),
    compras AS (
      SELECT g.evento_id
      FROM ${PURCHASES} g
      CROSS JOIN tiene_mapa tm
      LEFT JOIN prop pr ON pr.property_id = g.property_id
      WHERE g.match_ticketera${t.sql}
        AND DATE(g.fecha_orden) BETWEEN DATE(@medDesde) AND DATE(@medHasta)
        AND IF(tm.si, g.evento_id = @eventoId, pr.property_id IS NOT NULL)
    )
    SELECT
      (SELECT COUNT(*) FROM compras) AS users,
      (SELECT si FROM tiene_mapa) AS por_evento,
      ARRAY(SELECT DISTINCT evento_id FROM compras WHERE evento_id != @eventoId ORDER BY evento_id) AS otros_eventos
    `,
    { eventoId, medDesde: ventana.desde, medHasta: ventana.hasta, ...t.params },
  );
  const r = rows[0] ?? {};
  const otros = Array.isArray(r.otros_eventos) ? (r.otros_eventos as unknown[]).map(s) : [];
  return {
    users: n(r.users),
    alcance: r.por_evento === true ? "evento" : "propiedad",
    otrosEventos: otros,
  };
}
