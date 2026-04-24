import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const USERS = `\`${P}.comunidadGlovox.users\``;
const FF_JOIN = `CAST(REGEXP_EXTRACT(t.Referido, r'FF(\\d+)') AS INT64) = u.id`;
const ACTIVE_FF = `t.Referido LIKE 'FF%' AND t.EsDevuelto = false`;

export type KpiRow = {
  total_tickets: number;
  total_revenue: number;
  total_referrers: number;
  total_orders: number;
  avg_price: number;
};

export type MonthlyRow = {
  month: string;
  tickets: number;
  revenue: number;
  referrers: number;
};

export type SellerRow = {
  referido: string;
  tickets: number;
  revenue: number;
  avg_price: number;
};

export type EnrichedSellerRow = {
  referido: string;
  first_name: string;
  last_name: string;
  instagram: string | null;
  tickets: number;
  revenue: number;
  avg_price: number;
  last_sale: string;
};

export type DormantSellerRow = {
  referido: string;
  first_name: string;
  last_name: string;
  instagram: string | null;
  tickets_ever: number;
  revenue_ever: number;
  last_sale: string;
  days_silent: number;
};

export type EventRow = {
  evento: string;
  tickets: number;
  revenue: number;
  referrers: number;
};

export type ActivationFunnelRow = {
  total_members: number;
  ever_sold: number;
  sold_last_90d: number;
  never_sold: number;
};

export type MonthlyActivationRow = {
  month: string;
  new_sellers: number;
};

export type Country = "all" | "chile" | "peru";

function countryFilter(country: Country, alias?: string): string {
  const col = alias ? `${alias}.EventoID` : "EventoID";
  if (country === "chile") return `AND ${col} LIKE 'GLO%'`;
  if (country === "peru") return `AND ${col} LIKE 'GLP%'`;
  return "";
}

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

export async function getKpis(country: Country = "all"): Promise<KpiRow> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      COUNT(*)                 AS total_tickets,
      SUM(PrecioFinal)         AS total_revenue,
      COUNT(DISTINCT Referido) AS total_referrers,
      COUNT(DISTINCT OrdenID)  AS total_orders,
      AVG(PrecioFinal)         AS avg_price
    FROM ${TICKETS}
    WHERE Referido LIKE 'FF%' AND EsDevuelto = false
    ${countryFilter(country)}
  `);
  const r = rows[0];
  return {
    total_tickets: n(r.total_tickets),
    total_revenue: n(r.total_revenue),
    total_referrers: n(r.total_referrers),
    total_orders: n(r.total_orders),
    avg_price: n(r.avg_price),
  };
}

export async function getMonthlySales(country: Country = "all"): Promise<MonthlyRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', FechaOrden) AS month,
      COUNT(*)                              AS tickets,
      SUM(PrecioFinal)                      AS revenue,
      COUNT(DISTINCT Referido)              AS referrers
    FROM ${TICKETS}
    WHERE Referido LIKE 'FF%' AND EsDevuelto = false
    ${countryFilter(country)}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map((r) => ({
    month: s(r.month),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
    referrers: n(r.referrers),
  }));
}

export async function getTopSellers(): Promise<SellerRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      Referido       AS referido,
      COUNT(*)       AS tickets,
      SUM(PrecioFinal) AS revenue,
      AVG(PrecioFinal) AS avg_price
    FROM ${TICKETS}
    WHERE Referido LIKE 'FF%' AND EsDevuelto = false
    GROUP BY 1
    ORDER BY revenue DESC
    LIMIT 25
  `);
  return rows.map((r) => ({
    referido: s(r.referido),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
    avg_price: n(r.avg_price),
  }));
}

export async function getTopEvents(country: Country = "all"): Promise<EventRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      Evento                   AS evento,
      COUNT(*)                 AS tickets,
      SUM(PrecioFinal)         AS revenue,
      COUNT(DISTINCT Referido) AS referrers
    FROM ${TICKETS}
    WHERE Referido LIKE 'FF%' AND EsDevuelto = false
    ${countryFilter(country)}
    GROUP BY 1
    ORDER BY revenue DESC
    LIMIT 10
  `);
  return rows.map((r) => ({
    evento: s(r.evento),
    tickets: n(r.tickets),
    revenue: n(r.revenue),
    referrers: n(r.referrers),
  }));
}

export async function getActivationFunnel(country: Country = "all"): Promise<ActivationFunnelRow> {
  const cf = countryFilter(country);
  const rows = await query<Record<string, unknown>>(`
    WITH sellers AS (
      SELECT DISTINCT CAST(REGEXP_EXTRACT(Referido, r'FF(\\d+)') AS INT64) AS user_id
      FROM ${TICKETS}
      WHERE Referido LIKE 'FF%' AND EsDevuelto = false
      ${cf}
    ),
    recent_sellers AS (
      SELECT DISTINCT CAST(REGEXP_EXTRACT(Referido, r'FF(\\d+)') AS INT64) AS user_id
      FROM ${TICKETS}
      WHERE Referido LIKE 'FF%' AND EsDevuelto = false
      ${cf}
        AND FechaOrden >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
    )
    SELECT
      COUNT(DISTINCT u.id)                                              AS total_members,
      COUNT(DISTINCT s.user_id)                                         AS ever_sold,
      COUNT(DISTINCT rs.user_id)                                        AS sold_last_90d,
      COUNT(DISTINCT u.id) - COUNT(DISTINCT s.user_id)                  AS never_sold
    FROM ${USERS} u
    LEFT JOIN sellers s ON s.user_id = u.id
    LEFT JOIN recent_sellers rs ON rs.user_id = u.id
  `);
  const r = rows[0];
  return {
    total_members: n(r.total_members),
    ever_sold: n(r.ever_sold),
    sold_last_90d: n(r.sold_last_90d),
    never_sold: n(r.never_sold),
  };
}

export async function getMonthlyNewSellers(country: Country = "all"): Promise<MonthlyActivationRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', first_sale) AS month,
      COUNT(*)                               AS new_sellers
    FROM (
      SELECT
        CAST(REGEXP_EXTRACT(Referido, r'FF(\\d+)') AS INT64) AS user_id,
        MIN(FechaOrden)                                        AS first_sale
      FROM ${TICKETS}
      WHERE Referido LIKE 'FF%' AND EsDevuelto = false
      ${countryFilter(country)}
      GROUP BY 1
    )
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map((r) => ({
    month: s(r.month),
    new_sellers: n(r.new_sellers),
  }));
}

export async function getEnrichedTopSellers(country: Country = "all"): Promise<EnrichedSellerRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      t.Referido                                  AS referido,
      u.firstName                                 AS first_name,
      u.lastName                                  AS last_name,
      u.instagram                                 AS instagram,
      COUNT(*)                                    AS tickets,
      SUM(t.PrecioFinal)                          AS revenue,
      AVG(t.PrecioFinal)                          AS avg_price,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaOrden)) AS last_sale
    FROM ${TICKETS} t
    JOIN ${USERS} u ON ${FF_JOIN}
    WHERE ${ACTIVE_FF}
    ${countryFilter(country, "t")}
    GROUP BY 1, 2, 3, 4
    ORDER BY revenue DESC
    LIMIT 25
  `);
  return rows.map((r) => ({
    referido: s(r.referido),
    first_name: s(r.first_name),
    last_name: s(r.last_name),
    instagram: r.instagram ? s(r.instagram) : null,
    tickets: n(r.tickets),
    revenue: n(r.revenue),
    avg_price: n(r.avg_price),
    last_sale: s(r.last_sale),
  }));
}

export type EventSalesRow = {
  evento_id: string;
  fecha_evento: string;
  evento: string;
  cantidad: number;
  venta_con_cargo: number;
  pct_precio_final: number;
  pct_cantidad: number;
};

export async function getEventSales(): Promise<EventSalesRow[]> {
  const rows = await query<Record<string, unknown>>(`
    WITH TotalTickets AS (
      SELECT
        EventoID,
        COUNT(*)         AS CantidadTotal,
        SUM(PrecioFinal) AS TotalPrecioFinal
      FROM ${TICKETS}
      WHERE PrecioFinal <> 0
      GROUP BY EventoID
    )
    SELECT
      s.EventoID                                              AS evento_id,
      FORMAT_TIMESTAMP('%Y-%m-%d', MIN(s.FechaEvento))       AS fecha_evento,
      MIN(s.Evento)                                           AS evento,
      COUNT(*)                                                AS cantidad,
      SUM(s.PrecioFinal)                                      AS venta_con_cargo,
      ROUND(SUM(s.PrecioFinal) / t.TotalPrecioFinal * 100, 0) AS pct_precio_final,
      ROUND(COUNT(*) / t.CantidadTotal * 100, 0)              AS pct_cantidad
    FROM ${TICKETS} s
    JOIN TotalTickets t ON s.EventoID = t.EventoID
    WHERE s.Referido LIKE 'FF%'
    GROUP BY s.EventoID, t.CantidadTotal, t.TotalPrecioFinal
    ORDER BY cantidad DESC
  `);
  return rows.map((r) => ({
    evento_id: s(r.evento_id),
    fecha_evento: s(r.fecha_evento),
    evento: s(r.evento),
    cantidad: n(r.cantidad),
    venta_con_cargo: n(r.venta_con_cargo),
    pct_precio_final: n(r.pct_precio_final),
    pct_cantidad: n(r.pct_cantidad),
  }));
}

export type CountryMonthlyRow = {
  month: string;
  country: "chile" | "peru";
  tickets: number;
  revenue: number;
};

export async function getMonthlyEarningsByCountry(): Promise<CountryMonthlyRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', FechaOrden) AS month,
      CASE
        WHEN EventoID LIKE 'GLO%' THEN 'chile'
        WHEN EventoID LIKE 'GLP%' THEN 'peru'
      END AS country,
      COUNT(*)         AS tickets,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE
      Referido LIKE 'FF%'
      AND FechaOrden >= '2025-01-01'
      AND (EventoID LIKE 'GLO%' OR EventoID LIKE 'GLP%')
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  return rows.map((r) => ({
    month: s(r.month),
    country: s(r.country) as "chile" | "peru",
    tickets: n(r.tickets),
    revenue: n(r.revenue),
  }));
}

export async function getDormantSellers(country: Country = "all"): Promise<DormantSellerRow[]> {
  const rows = await query<Record<string, unknown>>(`
    WITH seller_stats AS (
      SELECT
        CAST(REGEXP_EXTRACT(Referido, r'FF(\\d+)') AS INT64) AS user_id,
        t.Referido                                             AS referido,
        COUNT(*)                                               AS tickets_ever,
        SUM(t.PrecioFinal)                                     AS revenue_ever,
        MAX(t.FechaOrden)                                      AS last_sale_ts
      FROM ${TICKETS} t
      WHERE ${ACTIVE_FF}
      ${countryFilter(country, "t")}
      GROUP BY 1, 2
    )
    SELECT
      ss.referido,
      u.firstName  AS first_name,
      u.lastName   AS last_name,
      u.instagram  AS instagram,
      ss.tickets_ever,
      ss.revenue_ever,
      FORMAT_TIMESTAMP('%Y-%m-%d', ss.last_sale_ts)                     AS last_sale,
      DATE_DIFF(CURRENT_DATE(), DATE(ss.last_sale_ts), DAY)             AS days_silent
    FROM seller_stats ss
    JOIN ${USERS} u ON u.id = ss.user_id
    WHERE ss.last_sale_ts < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
    ORDER BY ss.revenue_ever DESC
    LIMIT 30
  `);
  return rows.map((r) => ({
    referido: s(r.referido),
    first_name: s(r.first_name),
    last_name: s(r.last_name),
    instagram: r.instagram ? s(r.instagram) : null,
    tickets_ever: n(r.tickets_ever),
    revenue_ever: n(r.revenue_ever),
    last_sale: s(r.last_sale),
    days_silent: n(r.days_silent),
  }));
}
