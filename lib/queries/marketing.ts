import { query } from "@/lib/bigquery";
import {
  countryTicketeraFilter,
  hasCountryScope,
  type DataScope,
} from "@/lib/scopes";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
// Paid-media source. `ads_performance` replaces the old `generalAds` table: it has
// no EventoID, multiple currencies, and combined Meta + Google rows. See
// `attributedAds()` for how each row is tied back to an event.
const ADS = `\`${P}.paidMedia.ads_performance\``;
// Maps a Google `campaign_id` to the EventoID(s) it funds (1 campaign -> many
// events for season-long campaigns). Meta needs no map (EventoID is derived from
// the campaign name). Populated manually in BigQuery.
const CAMP_MAP = `\`${P}.paidMedia.campaign_event_map\``;
// Per-currency USD conversion rates: `usd = gasto / units_per_usd`.
const FX = `\`${P}.paidMedia.fx_rates\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;
const FOLLOWERS = `\`${P}.marketing.rrssFollowers\``;
const FUNNEL = `\`${P}.google_analytics.funnel\``;
const UTM = `\`${P}.google_analytics.utm\``;
const USERS = `\`${P}.comunidadGlovox.users\``;

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

// ---------- Paid-media attribution (ads_performance) ----------
//
// `ads_performance` has no EventoID. Each row is tied to an event two ways:
//   - Meta:   EventoID = SUBSTR(campaign_name, 1, 6) — each campaign is event-specific.
//   - Google: campaign_id is mapped to its event(s) via `campaign_event_map`. A single
//             season campaign funds many events, so its daily spend is attributed to an
//             event only on days inside that event's sale window. A campaign mapped to
//             overlapping events double-counts by design (agreed product decision).
//
// Spend is multi-currency (USD / CLP / BRL …); callers convert to USD via `fx_rates`.

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
  const cols = `a.plataforma, a.fecha, a.campaign_id, a.campaign_name, a.currency, a.gasto, a.conversiones`;
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
  totalRevenue: number;
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
  spendUsd: number; // converted to USD via fx_rates
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
    LIMIT 5
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

export async function getEventKpis(
  eventoId: string,
  scope?: Scope,
): Promise<EventKpiRow> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_stats AS (
      SELECT
        COUNT(*)         AS total_tickets,
        SUM(PrecioFinal) AS total_revenue,
        AVG(PrecioFinal) AS avg_price,
        MAX(FechaEvento) AS fecha_evento
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
    ),
    ${ticketPeriodCte(t.sql)},
    ads_evt AS (${attributedAds(false)}),
    ad_stats AS (
      SELECT SUM(e.gasto / COALESCE(f.units_per_usd, 1)) AS total_spend
      FROM ads_evt e
      LEFT JOIN ${FX} f ON f.currency = e.currency
    ),
    event_meta AS (
      SELECT budgetPm, goalTickets
      FROM ${CATEGORY}
      WHERE EventoID = @eventoId
    )
    SELECT
      ts.total_tickets,
      ts.total_revenue,
      ts.avg_price,
      DATE_DIFF(DATE(ts.fecha_evento), CURRENT_DATE(), DAY) AS days_to_event,
      COALESCE(a.total_spend, 0) AS total_spend,
      COALESCE(em.budgetPm, 0) AS budget_pm,
      CASE WHEN em.budgetPm > 0 THEN ROUND(COALESCE(a.total_spend, 0) / em.budgetPm * 100, 1) ELSE 0 END AS budget_exec_pct,
      COALESCE(em.goalTickets, 0) AS goal_tickets,
      CASE WHEN ts.total_tickets > 0 THEN ROUND(COALESCE(a.total_spend, 0) / ts.total_tickets, 1) ELSE 0 END AS cpa,
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
    totalRevenue: n(r.total_revenue),
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

export async function getCumulativeSales(
  eventoId: string,
  scope?: Scope,
): Promise<CumulativeSalesRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH daily AS (
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d', ${FECHA_ORDEN_ADJ}) AS date,
        COUNT(*) AS daily_tickets
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}${t.sql}
      GROUP BY date
    )
    SELECT
      date,
      daily_tickets,
      SUM(daily_tickets) OVER (ORDER BY date) AS cumulative_tickets
    FROM daily
    ORDER BY date
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    dailyTickets: n(r.daily_tickets),
    cumulativeTickets: n(r.cumulative_tickets),
  }));
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
): Promise<CumulativeSalesRelativeRow[]> {
  if (eventoIds.length === 0) return [];
  const t = ticketeraFilter(scope);
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
        COUNT(*)                                                           AS daily_tickets
      FROM ${TICKETS} t
      JOIN event_dates e ON e.EventoID = t.EventoID
      WHERE t.EventoID IN UNNEST(@eventoIds)
        AND ${TICKET_TYPE_FILTER}${t.sql}
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
    { eventoIds, ...t.params },
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    daysToEvent: n(r.days_to_event),
    dailyTickets: n(r.daily_tickets),
    cumulativeTickets: n(r.cumulative_tickets),
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
        e.gasto / COALESCE(f.units_per_usd, 1) AS gasto_usd
      FROM ads_evt e
      LEFT JOIN ${FX} f ON f.currency = e.currency
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
      CASE WHEN Referido LIKE 'FF%' THEN 'Club Glovox' ELSE Referido END AS origin,
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

export async function getFollowersDelta(
  eventoId: string,
  scope?: Scope,
): Promise<number> {
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
      COALESCE(SUM(f.delta_followers), 0) AS total_delta
    FROM ${FOLLOWERS} f
    CROSS JOIN ticket_period p
    CROSS JOIN event_ig e
    WHERE f.blog_id = e.CuentaIG
      AND DATE(f.date) BETWEEN p.start_date AND p.end_date
    `,
    { eventoId, ...t.params }
  );
  return n(rows[0]?.total_delta);
}

export async function getClubSales(
  eventoId: string,
  scope?: Scope,
): Promise<ClubSalesRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    WITH daily AS (
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d', ${FECHA_ORDEN_ADJ}) AS date,
        COUNT(*) AS tickets,
        SUM(PrecioFinal) AS revenue
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND Referido LIKE 'FF%'
        AND EsDevuelto IS FALSE${t.sql}
      GROUP BY date
    )
    SELECT
      date,
      tickets,
      revenue,
      SUM(tickets) OVER (ORDER BY date) AS cumulative_tickets
    FROM daily
    ORDER BY date
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
    cumulativeTickets: n(r.cumulative_tickets),
  }));
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

export async function getSalesByCategory(
  eventoId: string,
  scope?: Scope,
): Promise<CategorySalesRow[]> {
  const t = ticketeraFilter(scope);
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d', ${FECHA_ORDEN_ADJ}) AS date,
      CategoriaTicket AS category,
      COUNT(*) AS tickets,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE EventoID = @eventoId
      AND ${TICKET_TYPE_FILTER}${t.sql}
    GROUP BY date, category
    ORDER BY date, category
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
    date: s(r.date),
    category: s(r.category),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
  }));
}

export async function getFunnelData(
  eventoId: string,
  landingPages?: string[]
): Promise<FunnelRow[]> {
  const list = landingPages ?? [];
  const hasFilter = list.length > 0;
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      f.funnel_step AS step,
      f.step_order,
      SUM(f.total_users) AS users
    FROM ${FUNNEL} f
    JOIN ${CATEGORY} c ON f.property_id = CAST(c.property_ga4 AS STRING)
    WHERE c.EventoID = @eventoId
      AND (@hasFilter = FALSE OR f.landing_page IN UNNEST(@landingPages))
    GROUP BY step, step_order
    ORDER BY step_order
    `,
    {
      eventoId,
      hasFilter,
      landingPages: hasFilter ? list : [""],
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
    SELECT DISTINCT f.landing_page AS landing_page
    FROM ${FUNNEL} f
    JOIN ${CATEGORY} c ON f.property_id = CAST(c.property_ga4 AS STRING)
    WHERE c.EventoID = @eventoId
      AND f.landing_page IS NOT NULL
    ORDER BY landing_page
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
      SUM(e.gasto / COALESCE(f.units_per_usd, 1)) AS spend,
      SUM(e.conversiones) AS purchases
    FROM ads_evt e
    LEFT JOIN ${FX} f ON f.currency = e.currency
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
    )
    SELECT
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
    CROSS JOIN ticket_period p
    WHERE c.EventoID = @eventoId
      AND u.date BETWEEN p.start_date AND p.end_date
    GROUP BY medium, source, content, term
    ORDER BY sessions DESC
    `,
    { eventoId, ...t.params }
  );
  return rows.map((r) => ({
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
