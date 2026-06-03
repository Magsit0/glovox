import { query } from "@/lib/bigquery";

const P     = process.env.BIGQUERY_PROJECT_ID;
const ADS   = `\`${P}.paidMedia.ads_performance\``;

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

// ---------- Filters ----------

export type Plataforma = "meta" | "google";

/**
 * Filtros del dashboard. `currency` es OBLIGATORIO porque sumar gasto/CPC/CPM
 * mezclando CLP, USD y BRL daría números sin sentido. Las queries siempre
 * agregan dentro de una única moneda.
 */
export type PaidMediaFilters = {
  currency: string;
  plataforma?: Plataforma;
  accountId?: string;
  campaignId?: string;
  adsetId?: string;
  objective?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

/**
 * Construye un CTE base `t` filtrado y los params correspondientes. Cada query
 * consume `t` y agrega según su dimensión.
 */
function baseCte(filters: PaidMediaFilters): {
  cte: string;
  params: Record<string, unknown>;
} {
  const conds: string[] = ["currency = @currency"];
  const params: Record<string, unknown> = { currency: filters.currency };

  if (filters.plataforma) {
    conds.push("plataforma = @plataforma");
    params.plataforma = filters.plataforma;
  }
  if (filters.accountId) {
    conds.push("account_id = @accountId");
    params.accountId = filters.accountId;
  }
  if (filters.campaignId) {
    conds.push("campaign_id = @campaignId");
    params.campaignId = filters.campaignId;
  }
  if (filters.adsetId) {
    conds.push("adset_id = @adsetId");
    params.adsetId = filters.adsetId;
  }
  if (filters.objective) {
    conds.push("objective = @objective");
    params.objective = filters.objective;
  }
  if (filters.from) {
    conds.push("fecha >= DATE(@from)");
    params.from = filters.from;
  }
  if (filters.to) {
    conds.push("fecha <= DATE(@to)");
    params.to = filters.to;
  }

  const cte = `
  WITH t AS (
    SELECT
      plataforma,
      fecha,
      account_id,
      account_name,
      campaign_id,
      campaign_name,
      adset_id,
      adset_name,
      objective,
      currency,
      IFNULL(impresiones, 0)       AS impresiones,
      IFNULL(clics, 0)             AS clics,
      IFNULL(alcance, 0)           AS alcance,
      IFNULL(gasto, 0)             AS gasto,
      IFNULL(conversiones, 0)      AS conversiones,
      IFNULL(valor_conversion, 0)  AS valor_conversion
    FROM ${ADS}
    WHERE ${conds.join("\n      AND ")}
  )`;

  return { cte, params };
}

// ---------- Types ----------

export type CurrencyOption = {
  currency: string;
  rows: number;
  gasto: number;
};

export type PlataformaOption = {
  plataforma: Plataforma;
  rows: number;
};

export type AccountOption = {
  accountId: string;
  accountName: string;
  plataforma: Plataforma;
};

export type CampaignOption = {
  campaignId: string;
  campaignName: string;
  accountId: string;
  objective: string;
};

export type AdsetOption = {
  adsetId: string;
  adsetName: string;
  campaignId: string;
};

export type DateRange = {
  min: string;
  max: string;
};

export type PaidMediaKpis = {
  gasto: number;
  impresiones: number;
  clics: number;
  alcance: number;
  conversiones: number;
  valorConversion: number;
  ctr: number;        // 0..1
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  campaigns: number;
  adsets: number;
  accounts: number;
  dias: number;
};

export type DailyRow = {
  fecha: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  valorConversion: number;
};

export type BreakdownRow = {
  key: string;
  label: string;
  extra?: string;
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  valorConversion: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
};

// ---------- Options (no respetan filtros para que el usuario pueda cambiar) ----------

/**
 * Monedas disponibles en la tabla, con su volumen de filas y gasto total.
 * No respetan los filtros: queremos mostrar todas las monedas existentes
 * y dejar que el usuario navegue entre ellas.
 */
export async function getCurrencyOptions(): Promise<CurrencyOption[]> {
  // `rows` es keyword reservado en BigQuery (ROWS BETWEEN ...) — uso `n_rows`.
  const rows = await query<Record<string, unknown>>(`
    SELECT
      currency              AS currency,
      COUNT(*)              AS n_rows,
      SUM(IFNULL(gasto, 0)) AS gasto
    FROM ${ADS}
    WHERE currency IS NOT NULL
    GROUP BY currency
    ORDER BY gasto DESC
  `);
  return rows.map((r) => ({
    currency: s(r.currency),
    rows:     n(r.n_rows),
    gasto:    n(r.gasto),
  }));
}

/** Plataformas con conteo de filas — solo para poblar el selector. */
export async function getPlatformOptions(): Promise<PlataformaOption[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT plataforma AS plataforma, COUNT(*) AS n_rows
    FROM ${ADS}
    WHERE plataforma IS NOT NULL
    GROUP BY plataforma
    ORDER BY n_rows DESC
  `);
  return rows.map((r) => ({
    plataforma: s(r.plataforma) as Plataforma,
    rows: n(r.n_rows),
  }));
}

/**
 * Cuentas disponibles en la moneda/plataforma seleccionada. Ordenadas por
 * gasto descendente para que las activas aparezcan arriba.
 */
export async function getAccountOptions(
  currency: string,
  plataforma?: Plataforma,
): Promise<AccountOption[]> {
  const conds: string[] = ["currency = @currency"];
  const params: Record<string, unknown> = { currency };
  if (plataforma) {
    conds.push("plataforma = @plataforma");
    params.plataforma = plataforma;
  }
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      account_id                       AS account_id,
      ANY_VALUE(account_name)          AS account_name,
      ANY_VALUE(plataforma)            AS plataforma,
      SUM(IFNULL(gasto, 0))            AS gasto
    FROM ${ADS}
    WHERE ${conds.join(" AND ")}
    GROUP BY account_id
    ORDER BY gasto DESC
    `,
    params,
  );
  return rows.map((r) => ({
    accountId:   s(r.account_id),
    accountName: s(r.account_name),
    plataforma:  s(r.plataforma) as Plataforma,
  }));
}

/** Campañas — opcionalmente acotadas a una cuenta. */
export async function getCampaignOptions(
  currency: string,
  accountId?: string,
): Promise<CampaignOption[]> {
  const conds: string[] = ["currency = @currency"];
  const params: Record<string, unknown> = { currency };
  if (accountId) {
    conds.push("account_id = @accountId");
    params.accountId = accountId;
  }
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      campaign_id                  AS campaign_id,
      ANY_VALUE(campaign_name)     AS campaign_name,
      ANY_VALUE(account_id)        AS account_id,
      ANY_VALUE(objective)         AS objective,
      SUM(IFNULL(gasto, 0))        AS gasto
    FROM ${ADS}
    WHERE ${conds.join(" AND ")}
    GROUP BY campaign_id
    ORDER BY gasto DESC
    LIMIT 500
    `,
    params,
  );
  return rows.map((r) => ({
    campaignId:   s(r.campaign_id),
    campaignName: s(r.campaign_name),
    accountId:    s(r.account_id),
    objective:    s(r.objective),
  }));
}

/** Adsets — opcionalmente acotados a una campaña. */
export async function getAdsetOptions(
  currency: string,
  campaignId?: string,
): Promise<AdsetOption[]> {
  const conds: string[] = ["currency = @currency"];
  const params: Record<string, unknown> = { currency };
  if (campaignId) {
    conds.push("campaign_id = @campaignId");
    params.campaignId = campaignId;
  }
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      adset_id                  AS adset_id,
      ANY_VALUE(adset_name)     AS adset_name,
      ANY_VALUE(campaign_id)    AS campaign_id,
      SUM(IFNULL(gasto, 0))     AS gasto
    FROM ${ADS}
    WHERE ${conds.join(" AND ")}
    GROUP BY adset_id
    ORDER BY gasto DESC
    LIMIT 500
    `,
    params,
  );
  return rows.map((r) => ({
    adsetId:   s(r.adset_id),
    adsetName: s(r.adset_name),
    campaignId: s(r.campaign_id),
  }));
}

/** Objetivos disponibles en la combinación moneda/plataforma. */
export async function getObjectiveOptions(
  currency: string,
  plataforma?: Plataforma,
): Promise<string[]> {
  const conds: string[] = ["currency = @currency", "objective IS NOT NULL"];
  const params: Record<string, unknown> = { currency };
  if (plataforma) {
    conds.push("plataforma = @plataforma");
    params.plataforma = plataforma;
  }
  const rows = await query<Record<string, unknown>>(
    `
    SELECT objective AS objective
    FROM ${ADS}
    WHERE ${conds.join(" AND ")}
    GROUP BY objective
    ORDER BY objective
    `,
    params,
  );
  return rows.map((r) => s(r.objective)).filter(Boolean);
}

/** Rango de fechas con datos para la moneda seleccionada. */
export async function getDateRange(currency: string): Promise<DateRange> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', MIN(fecha)) AS min_date,
      FORMAT_DATE('%Y-%m-%d', MAX(fecha)) AS max_date
    FROM ${ADS}
    WHERE currency = @currency
    `,
    { currency },
  );
  return { min: s(rows[0]?.min_date), max: s(rows[0]?.max_date) };
}

// ---------- KPIs y agregaciones ----------

export async function getKpis(filters: PaidMediaFilters): Promise<PaidMediaKpis> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      SUM(gasto)                                  AS gasto,
      SUM(impresiones)                            AS impresiones,
      SUM(clics)                                  AS clics,
      SUM(alcance)                                AS alcance,
      SUM(conversiones)                           AS conversiones,
      SUM(valor_conversion)                       AS valor_conversion,
      SAFE_DIVIDE(SUM(clics),         SUM(impresiones))         AS ctr,
      SAFE_DIVIDE(SUM(gasto),         SUM(clics))               AS cpc,
      SAFE_DIVIDE(SUM(gasto) * 1000,  SUM(impresiones))         AS cpm,
      SAFE_DIVIDE(SUM(gasto),         SUM(conversiones))        AS cpa,
      SAFE_DIVIDE(SUM(valor_conversion), SUM(gasto))            AS roas,
      COUNT(DISTINCT campaign_id)                 AS campaigns,
      COUNT(DISTINCT adset_id)                    AS adsets,
      COUNT(DISTINCT account_id)                  AS accounts,
      COUNT(DISTINCT fecha)                       AS dias
    FROM t
    `,
    params,
  );
  const r = rows[0] ?? {};
  return {
    gasto:           n(r.gasto),
    impresiones:     n(r.impresiones),
    clics:           n(r.clics),
    alcance:         n(r.alcance),
    conversiones:    n(r.conversiones),
    valorConversion: n(r.valor_conversion),
    ctr:             n(r.ctr),
    cpc:             n(r.cpc),
    cpm:             n(r.cpm),
    cpa:             n(r.cpa),
    roas:            n(r.roas),
    campaigns:       n(r.campaigns),
    adsets:          n(r.adsets),
    accounts:        n(r.accounts),
    dias:            n(r.dias),
  };
}

/** Serie diaria de gasto, clics, impresiones y conversiones. */
export async function getDaily(filters: PaidMediaFilters): Promise<DailyRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      FORMAT_DATE('%Y-%m-%d', fecha)  AS fecha,
      SUM(gasto)                      AS gasto,
      SUM(impresiones)                AS impresiones,
      SUM(clics)                      AS clics,
      SUM(conversiones)               AS conversiones,
      SUM(valor_conversion)           AS valor_conversion
    FROM t
    GROUP BY fecha
    ORDER BY fecha
    `,
    params,
  );
  return rows.map((r) => ({
    fecha:           s(r.fecha),
    gasto:           n(r.gasto),
    impresiones:     n(r.impresiones),
    clics:           n(r.clics),
    conversiones:    n(r.conversiones),
    valorConversion: n(r.valor_conversion),
  }));
}

/**
 * Helper interno: agrupa por una dimensión y devuelve una fila por valor con
 * KPIs derivados ya calculados desde las sumas (nunca promediando los
 * promedios per-fila, que rompen aritmética).
 */
async function getBreakdown(
  filters: PaidMediaFilters,
  groupBySql: string,
  selectExtra: string,
  limit: number,
): Promise<BreakdownRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      ${groupBySql} AS grp_key,
      ${selectExtra}
      SUM(gasto)                                            AS gasto,
      SUM(impresiones)                                      AS impresiones,
      SUM(clics)                                            AS clics,
      SUM(conversiones)                                     AS conversiones,
      SUM(valor_conversion)                                 AS valor_conversion,
      SAFE_DIVIDE(SUM(clics),         SUM(impresiones))     AS ctr,
      SAFE_DIVIDE(SUM(gasto),         SUM(clics))           AS cpc,
      SAFE_DIVIDE(SUM(gasto) * 1000,  SUM(impresiones))     AS cpm,
      SAFE_DIVIDE(SUM(valor_conversion), SUM(gasto))        AS roas
    FROM t
    GROUP BY grp_key
    ORDER BY gasto DESC NULLS LAST
    LIMIT ${limit}
    `,
    params,
  );
  return rows.map((r) => ({
    key:             s(r.grp_key),
    label:           s(r.grp_label ?? r.grp_key),
    extra:           r.grp_extra != null ? s(r.grp_extra) : undefined,
    gasto:           n(r.gasto),
    impresiones:     n(r.impresiones),
    clics:           n(r.clics),
    conversiones:    n(r.conversiones),
    valorConversion: n(r.valor_conversion),
    ctr:             n(r.ctr),
    cpc:             n(r.cpc),
    cpm:             n(r.cpm),
    roas:            n(r.roas),
  }));
}

export function getByPlatform(filters: PaidMediaFilters): Promise<BreakdownRow[]> {
  return getBreakdown(
    filters,
    "plataforma",
    "ANY_VALUE(plataforma) AS grp_label,",
    10,
  );
}

export function getByObjective(filters: PaidMediaFilters): Promise<BreakdownRow[]> {
  // grp_label envuelto en ANY_VALUE: BigQuery no acepta repetir la expresión
  // IFNULL(objective, '—') como un select no-agregado aunque sea idéntica al
  // grp_key agrupado (chequea la referencia textual a la columna, no el valor).
  return getBreakdown(
    filters,
    "IFNULL(objective, '—')",
    "ANY_VALUE(IFNULL(objective, '—')) AS grp_label,",
    20,
  );
}

export function getByAccount(filters: PaidMediaFilters): Promise<BreakdownRow[]> {
  return getBreakdown(
    filters,
    "account_id",
    "ANY_VALUE(account_name) AS grp_label, ANY_VALUE(plataforma) AS grp_extra,",
    50,
  );
}

export function getByCampaign(filters: PaidMediaFilters): Promise<BreakdownRow[]> {
  return getBreakdown(
    filters,
    "campaign_id",
    "ANY_VALUE(campaign_name) AS grp_label, ANY_VALUE(account_name) AS grp_extra,",
    50,
  );
}

export function getByAdset(filters: PaidMediaFilters): Promise<BreakdownRow[]> {
  return getBreakdown(
    filters,
    "adset_id",
    "ANY_VALUE(adset_name) AS grp_label, ANY_VALUE(campaign_name) AS grp_extra,",
    50,
  );
}
