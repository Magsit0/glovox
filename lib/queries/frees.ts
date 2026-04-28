import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const CORTESIAS = `\`${P}.glovox.cortesias\``;
const TICKETS = `\`${P}.glovox.tickets\``;

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

const SIN_DATO = "Sin dato";

// ---------- Types ----------

export type FreesKpis = {
  totalCortesias: number;
  totalCanjeadas: number;
  totalNoCanjeadas: number;
  tasaCanje: number;
  cortesiasConRecipient: number;
  cortesiasConCategory: number;
  ticketTypesUnicos: number;
};

export type FreesGroupRow = {
  label: string;
  total: number;
  canjeadas: number;
  tasaCanje: number;
};

export type FreesDashboardData = {
  kpis: FreesKpis;
  byTicketType: FreesGroupRow[];
  byRecipient: FreesGroupRow[];
  byCategory: FreesGroupRow[];
};

// ---------- Queries ----------

/**
 * Cortesia "canjeada" = existe al menos un ticket en glovox.tickets cuyo
 * CodigoPromocion coincide con los últimos 8 chars del sellerLink.
 */
const JOIN_CTE = `
  WITH cortesias_base AS (
    SELECT
      c.id,
      c.ticketType,
      c.recipient,
      c.category,
      RIGHT(c.sellerLink, 8) AS promo
    FROM ${CORTESIAS} c
  ),
  cortesias_match AS (
    SELECT
      cb.id,
      cb.ticketType,
      cb.recipient,
      cb.category,
      cb.promo,
      COUNT(t.CodigoPromocion) > 0 AS canjeada
    FROM cortesias_base cb
    LEFT JOIN ${TICKETS} t
      ON t.CodigoPromocion = cb.promo
    GROUP BY cb.id, cb.ticketType, cb.recipient, cb.category, cb.promo
  )
`;

async function fetchKpis(): Promise<FreesKpis> {
  const sql = `
    ${JOIN_CTE}
    SELECT
      COUNT(*)                                                AS totalCortesias,
      COUNTIF(canjeada)                                       AS totalCanjeadas,
      COUNTIF(NOT canjeada)                                   AS totalNoCanjeadas,
      COUNTIF(recipient IS NOT NULL AND recipient != '')      AS cortesiasConRecipient,
      COUNTIF(category IS NOT NULL AND category != '')        AS cortesiasConCategory,
      COUNT(DISTINCT ticketType)                              AS ticketTypesUnicos
    FROM cortesias_match
  `;
  const rows = await query<Record<string, unknown>>(sql);
  const r = rows[0] ?? {};
  const total = n(r.totalCortesias);
  const canj = n(r.totalCanjeadas);
  return {
    totalCortesias: total,
    totalCanjeadas: canj,
    totalNoCanjeadas: n(r.totalNoCanjeadas),
    tasaCanje: total ? canj / total : 0,
    cortesiasConRecipient: n(r.cortesiasConRecipient),
    cortesiasConCategory: n(r.cortesiasConCategory),
    ticketTypesUnicos: n(r.ticketTypesUnicos),
  };
}

async function fetchGroup(field: "ticketType" | "recipient" | "category"): Promise<FreesGroupRow[]> {
  const sql = `
    ${JOIN_CTE}
    SELECT
      COALESCE(NULLIF(${field}, ''), '${SIN_DATO}') AS label,
      COUNT(*)                                       AS total,
      COUNTIF(canjeada)                              AS canjeadas
    FROM cortesias_match
    GROUP BY label
    ORDER BY total DESC
  `;
  const rows = await query<Record<string, unknown>>(sql);
  return rows.map((r) => {
    const total = n(r.total);
    const canjeadas = n(r.canjeadas);
    return {
      label: s(r.label) || SIN_DATO,
      total,
      canjeadas,
      tasaCanje: total ? canjeadas / total : 0,
    };
  });
}

export async function getFreesDashboardData(): Promise<FreesDashboardData> {
  const [kpis, byTicketType, byRecipient, byCategory] = await Promise.all([
    fetchKpis(),
    fetchGroup("ticketType"),
    fetchGroup("recipient"),
    fetchGroup("category"),
  ]);

  return { kpis, byTicketType, byRecipient, byCategory };
}
