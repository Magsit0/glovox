import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;

const PERU_FILTER = `Ticketera = 'TeleTicket'`;
const VENTA_FILTER = `ventaNoventa = 'VENTA' AND EsDevuelto IS FALSE`;
const CORTESIA_FILTER = `ventaNoventa = 'CORTESIA'`;

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

export type PeruKpis = {
  totalSold: number;
  totalCortesias: number;
  totalRevenue: number;
  avgPrice: number;
  events: number;
  refundRate: number;
};

export type PeruEventRow = {
  eventoId: string;
  nombre: string;
  fechaEvento: string;
  ventas: number;
  cortesias: number;
  revenue: number;
  avgPrice: number;
};

export type PeruMonthlyRow = {
  ym: string;
  ventas: number;
  cortesias: number;
  revenue: number;
};

export type PeruTipoTicketRow = {
  tipo: string;
  ventas: number;
  revenue: number;
};

export type PeruMedioPagoRow = {
  medio: string;
  ventas: number;
  revenue: number;
};

export type PeruHourlyRow = {
  hour: number;
  ventas: number;
};

export type PeruEventListItem = {
  eventoId: string;
  nombre: string;
  fechaEvento: string;
  ticketCount: number;
};

// ---------- Queries ----------

export async function getPeruKpis(): Promise<PeruKpis> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      SUM(CASE WHEN ${VENTA_FILTER} THEN 1 ELSE 0 END) AS total_sold,
      SUM(CASE WHEN ${CORTESIA_FILTER} THEN 1 ELSE 0 END) AS total_cortesias,
      SUM(CASE WHEN ${VENTA_FILTER} THEN PrecioFinal ELSE 0 END) AS total_revenue,
      SAFE_DIVIDE(
        SUM(CASE WHEN ${VENTA_FILTER} THEN PrecioFinal ELSE 0 END),
        NULLIF(SUM(CASE WHEN ${VENTA_FILTER} THEN 1 ELSE 0 END), 0)
      ) AS avg_price,
      COUNT(DISTINCT EventoID) AS events,
      SAFE_DIVIDE(
        SUM(CASE WHEN EsDevuelto IS TRUE THEN 1 ELSE 0 END),
        NULLIF(COUNT(*), 0)
      ) AS refund_rate
    FROM ${TICKETS}
    WHERE ${PERU_FILTER}
  `);
  const r = rows[0] ?? {};
  return {
    totalSold: n(r.total_sold),
    totalCortesias: n(r.total_cortesias),
    totalRevenue: n(r.total_revenue),
    avgPrice: n(r.avg_price),
    events: n(r.events),
    refundRate: n(r.refund_rate),
  };
}

export async function getPeruEventList(): Promise<PeruEventListItem[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      EventoID AS evento_id,
      ANY_VALUE(Evento) AS nombre,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(FechaEvento)) AS fecha_evento,
      SUM(CASE WHEN ${VENTA_FILTER} THEN 1 ELSE 0 END) AS ticket_count
    FROM ${TICKETS}
    WHERE ${PERU_FILTER}
    GROUP BY EventoID
    ORDER BY MAX(FechaEvento) DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    fechaEvento: s(r.fecha_evento),
    ticketCount: n(r.ticket_count),
  }));
}

export async function getPeruEventBreakdown(): Promise<PeruEventRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      EventoID AS evento_id,
      ANY_VALUE(Evento) AS nombre,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(FechaEvento)) AS fecha_evento,
      SUM(CASE WHEN ${VENTA_FILTER} THEN 1 ELSE 0 END) AS ventas,
      SUM(CASE WHEN ${CORTESIA_FILTER} THEN 1 ELSE 0 END) AS cortesias,
      SUM(CASE WHEN ${VENTA_FILTER} THEN PrecioFinal ELSE 0 END) AS revenue,
      SAFE_DIVIDE(
        SUM(CASE WHEN ${VENTA_FILTER} THEN PrecioFinal ELSE 0 END),
        NULLIF(SUM(CASE WHEN ${VENTA_FILTER} THEN 1 ELSE 0 END), 0)
      ) AS avg_price
    FROM ${TICKETS}
    WHERE ${PERU_FILTER}
    GROUP BY EventoID
    ORDER BY MAX(FechaEvento) DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    fechaEvento: s(r.fecha_evento),
    ventas: n(r.ventas),
    cortesias: n(r.cortesias),
    revenue: n(r.revenue),
    avgPrice: n(r.avg_price),
  }));
}

export async function getPeruMonthlyEvolution(): Promise<PeruMonthlyRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      FORMAT_TIMESTAMP('%Y-%m', FechaOrden) AS ym,
      SUM(CASE WHEN ${VENTA_FILTER} THEN 1 ELSE 0 END) AS ventas,
      SUM(CASE WHEN ${CORTESIA_FILTER} THEN 1 ELSE 0 END) AS cortesias,
      SUM(CASE WHEN ${VENTA_FILTER} THEN PrecioFinal ELSE 0 END) AS revenue
    FROM ${TICKETS}
    WHERE ${PERU_FILTER} AND FechaOrden IS NOT NULL
    GROUP BY ym
    ORDER BY ym
  `);
  return rows.map((r) => ({
    ym: s(r.ym),
    ventas: n(r.ventas),
    cortesias: n(r.cortesias),
    revenue: n(r.revenue),
  }));
}

export async function getPeruTopTipoTicket(
  limit = 8
): Promise<PeruTipoTicketRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      TipoTicket AS tipo,
      COUNT(*) AS ventas,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE ${PERU_FILTER} AND ${VENTA_FILTER}
    GROUP BY tipo
    ORDER BY ventas DESC
    LIMIT @limit
    `,
    { limit }
  );
  return rows.map((r) => ({
    tipo: s(r.tipo),
    ventas: n(r.ventas),
    revenue: n(r.revenue),
  }));
}

export async function getPeruMedioPago(): Promise<PeruMedioPagoRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      MedioPago AS medio,
      COUNT(*) AS ventas,
      SUM(PrecioFinal) AS revenue
    FROM ${TICKETS}
    WHERE ${PERU_FILTER} AND ${VENTA_FILTER}
    GROUP BY medio
    ORDER BY ventas DESC
  `);
  return rows.map((r) => ({
    medio: s(r.medio),
    ventas: n(r.ventas),
    revenue: n(r.revenue),
  }));
}

export async function getPeruHourly(): Promise<PeruHourlyRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      EXTRACT(HOUR FROM FechaOrden AT TIME ZONE 'America/Lima') AS hour,
      COUNT(*) AS ventas
    FROM ${TICKETS}
    WHERE ${PERU_FILTER} AND ${VENTA_FILTER} AND FechaOrden IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `);
  return rows.map((r) => ({
    hour: n(r.hour),
    ventas: n(r.ventas),
  }));
}
