import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const ADS = `\`${P}.paidMedia.generalAds\``;
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

export type PaidMediaSummaryRow = {
  totalSpend: number;
  budget: number;
  execPct: number;
  purchases: number;
  purchasesPuntoticket: number;
  cpa: number;
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

export async function getEventList(): Promise<EventOption[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID       AS evento_id,
      ANY_VALUE(c.NombreGlovox)   AS nombre,
      ANY_VALUE(c.CategoriaEvento) AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento)) AS fecha_evento,
      COUNT(*)         AS ticket_count
    FROM ${CATEGORY} c
    LEFT JOIN ${TICKETS} t ON c.EventoID = t.EventoID
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento: s(r.fecha_evento),
    ticketCount: n(r.ticket_count),
  }));
}

export async function getUpcomingEvents(): Promise<EventOption[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID                                          AS evento_id,
      ANY_VALUE(c.NombreGlovox)                           AS nombre,
      ANY_VALUE(c.CategoriaEvento)                        AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento))   AS fecha_evento,
      COUNT(*)                                            AS ticket_count
    FROM ${CATEGORY} c
    LEFT JOIN ${TICKETS} t ON c.EventoID = t.EventoID
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    HAVING fecha_evento >= FORMAT_DATE('%Y-%m-%d', CURRENT_DATE())
    ORDER BY fecha_evento ASC
    LIMIT 5
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento: s(r.fecha_evento),
    ticketCount: n(r.ticket_count),
  }));
}

export async function getTicketDateRange(eventoId: string): Promise<TicketDateRange> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d', MIN(${FECHA_ORDEN_ADJ})) AS start_date,
      FORMAT_DATE('%Y-%m-%d', CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END) AS end_date
    FROM ${TICKETS}
    WHERE EventoID = @eventoId
      AND ${TICKET_TYPE_FILTER}
    `,
    { eventoId }
  );
  const r = rows[0] ?? {};
  return {
    startDate: s(r.start_date),
    endDate: s(r.end_date),
  };
}

export async function getEventKpis(eventoId: string): Promise<EventKpiRow> {
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
        AND ${TICKET_TYPE_FILTER}
    ),
    ad_stats AS (
      SELECT
        SUM(CASE WHEN Account_Currency = 'CLP' THEN Spend / 900 ELSE Spend END) AS total_spend
      FROM ${ADS}
      WHERE EventoID = @eventoId AND Spend > 0
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
    { eventoId }
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
  eventoId: string
): Promise<CumulativeSalesRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH daily AS (
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d', ${FECHA_ORDEN_ADJ}) AS date,
        COUNT(*) AS daily_tickets
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}
      GROUP BY date
    )
    SELECT
      date,
      daily_tickets,
      SUM(daily_tickets) OVER (ORDER BY date) AS cumulative_tickets
    FROM daily
    ORDER BY date
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    date: s(r.date),
    dailyTickets: n(r.daily_tickets),
    cumulativeTickets: n(r.cumulative_tickets),
  }));
}

export async function getPaidMediaSummary(
  eventoId: string
): Promise<PaidMediaSummaryRow> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ad_stats AS (
      SELECT
        SUM(CASE WHEN Account_Currency = 'CLP' THEN Spend / 900 ELSE Spend END) AS total_spend,
        SUM(Purchase) AS purchases
      FROM ${ADS}
      WHERE EventoID = @eventoId AND Spend > 0
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
        AND ${TICKET_TYPE_FILTER}
    )
    SELECT
      COALESCE(a.total_spend, 0) AS total_spend,
      COALESCE(em.budgetPm, 0) AS budget,
      CASE WHEN em.budgetPm > 0 THEN ROUND(COALESCE(a.total_spend, 0) / em.budgetPm * 100, 1) ELSE 0 END AS exec_pct,
      COALESCE(a.purchases, 0) AS purchases,
      COALESCE(pt.purchases_pt, 0) AS purchases_puntoticket,
      CASE WHEN a.purchases > 0 THEN ROUND(a.total_spend / a.purchases, 1) ELSE 0 END AS cpa
    FROM ad_stats a
    CROSS JOIN event_meta em
    CROSS JOIN pt_purchases pt
    `,
    { eventoId }
  );
  const r = rows[0] ?? {};
  return {
    totalSpend: n(r.total_spend),
    budget: n(r.budget),
    execPct: n(r.exec_pct),
    purchases: n(r.purchases),
    purchasesPuntoticket: n(r.purchases_puntoticket),
    cpa: n(r.cpa),
  };
}

export async function getSalesOrigin(
  eventoId: string
): Promise<SalesOriginRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      CASE WHEN Referido LIKE 'FF%' THEN 'Club Glovox' ELSE Referido END AS origin,
      COUNT(*) AS tickets,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE EventoID = @eventoId
      AND ${TICKET_TYPE_FILTER}
    GROUP BY origin
    ORDER BY tickets DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    origin: s(r.origin),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
  }));
}

export async function getFollowersEvolution(
  eventoId: string
): Promise<FollowerRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}
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
    { eventoId }
  );
  return rows.map((r) => ({
    date: s(r.date),
    totalFollowers: n(r.total_followers),
    deltaFollowers: n(r.delta_followers),
  }));
}

export async function getFollowersDelta(
  eventoId: string
): Promise<number> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}
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
    { eventoId }
  );
  return n(rows[0]?.total_delta);
}

export async function getClubSales(
  eventoId: string
): Promise<ClubSalesRow[]> {
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
        AND EsDevuelto IS FALSE
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
    { eventoId }
  );
  return rows.map((r) => ({
    date: s(r.date),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
    cumulativeTickets: n(r.cumulative_tickets),
  }));
}

export async function getClubMembersEvolution(
  eventoId: string
): Promise<ClubMembersRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}
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
    { eventoId }
  );
  return rows.map((r) => ({
    date: s(r.date),
    newMembers: n(r.new_members),
    cumulativeMembers: n(r.cumulative_members),
  }));
}

export async function getSalesByCategory(
  eventoId: string
): Promise<CategorySalesRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d', ${FECHA_ORDEN_ADJ}) AS date,
      CategoriaTicket AS category,
      COUNT(*) AS tickets,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE EventoID = @eventoId
      AND ${TICKET_TYPE_FILTER}
    GROUP BY date, category
    ORDER BY date, category
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    date: s(r.date),
    category: s(r.category),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
  }));
}

export async function getFunnelData(
  eventoId: string
): Promise<FunnelRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      f.funnel_step AS step,
      f.step_order,
      SUM(f.total_users) AS users
    FROM ${FUNNEL} f
    JOIN ${CATEGORY} c ON f.property_id = CAST(c.property_ga4 AS STRING)
    WHERE c.EventoID = @eventoId
    GROUP BY step, step_order
    ORDER BY step_order
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    step: s(r.step),
    stepOrder: n(r.step_order),
    users: n(r.users),
  }));
}

export async function getCampaignBreakdown(
  eventoId: string
): Promise<CampaignRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}
    )
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d', a.Fecha) AS date,
      a.Campaign_Name AS campaign,
      a.Platform AS platform,
      SUM(CASE WHEN a.Account_Currency = 'CLP' THEN a.Spend / 900 ELSE a.Spend END) AS spend,
      SUM(a.Purchase) AS purchases
    FROM ${ADS} a
    CROSS JOIN ticket_period p
    WHERE a.EventoID = @eventoId AND a.Spend > 0
      AND DATE(a.Fecha) BETWEEN p.start_date AND p.end_date
    GROUP BY date, campaign, platform
    ORDER BY date, campaign
    `,
    { eventoId }
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
  eventoId: string
): Promise<UtmTrafficRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ticket_period AS (
      SELECT
        MIN(DATE(${FECHA_ORDEN_ADJ})) AS start_date,
        CASE WHEN MAX(FechaEvento) >= CURRENT_TIMESTAMP() THEN CURRENT_DATE() ELSE MAX(DATE(${FECHA_ORDEN_ADJ})) END AS end_date
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND ${TICKET_TYPE_FILTER}
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
    { eventoId }
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
