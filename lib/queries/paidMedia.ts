import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;

/**
 * Vista GOBERNADA de paid media. Define la conversión a USD una sola vez
 * (join por fecha a `referencia.tipo_cambio`) y la comparte con
 * /inversion-medios y /marketing/weekly. Este dashboard leía antes la tabla
 * cruda `paidMedia.ads_performance` y obligaba a elegir una moneda; ahora
 * consolida en dólares y la moneda de origen es solo un desglose informativo.
 *
 * COLUMNAS CONSUMIBLES (lista blanca):
 *   gasto_usd, valor_conversion_usd  — montos ya convertidos, aditivos.
 *   fx_units_per_usd, fx_imputado    — trazabilidad de la tasa aplicada.
 *   gasto                            — monto en la moneda NATIVA. Solo se
 *                                      agrega DENTRO de un mismo `currency`.
 *   impresiones, clics, conversiones — currency-free, aditivas.
 *   currency, EventoID, fecha, plataforma, *_id, *_name, objective.
 *
 * COLUMNAS PROHIBIDAS (lista negra): `ctr`, `cpc`, `cpm`, `roas`, `cpc_usd`,
 *   `cpm_usd` son ratios PER FILA — promediarlos o sumarlos rompe la
 *   aritmética. Todos los ratios de este archivo se recalculan desde los SUM.
 *   `alcance` no es aditivo entre cuentas ni plataformas (Google lo reporta
 *   NULL): no se expone.
 */
const MART = `\`${P}.marts.paidmedia_ads_performance\``;
const CAT = `\`${P}.glovox.categoriaEvento\``;
const FX = `\`${P}.referencia.tipo_cambio\``;

/**
 * Moneda en que se DESPLIEGA el dashboard. No es un filtro: el scope de datos
 * es siempre el mismo (todas las cuentas, todas las monedas de origen); lo
 * único que cambia es la unidad en que se expresa el consolidado.
 *
 * USD es la unidad canónica —es lo que el mart convierte y lo que compara
 * cuentas de países distintos— y CLP existe porque la operación se presupuesta
 * y se reporta en pesos.
 */
export type DisplayCurrency = "USD" | "CLP";

export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["USD", "CLP"];

export function parseDisplayCurrency(v?: string): DisplayCurrency {
  return v === "CLP" ? "CLP" : "USD";
}

/**
 * Expresión SQL del monto en la moneda de despliegue.
 *
 * CLP se deriva del USD ya convertido, con la tasa del día de CADA FILA:
 *   monto_clp = monto_usd * units_per_usd(CLP, fecha_de_la_fila)
 *
 * Es la misma disciplina que hace correcto el consolidado en dólares. Aplicar
 * una sola tasa al total daría un número distinto —hay 567 tasas distintas en
 * el histórico CLP— y volvería a introducir el error que esta migración vino a
 * eliminar.
 *
 * OJO con lo que NO es invariante. La tasa varía por día, así que reexpresar
 * fila a fila cambia el PESO relativo de cada día dentro de un agregado:
 *  - CTR sí es invariante (no toca dinero).
 *  - Los TOTALES y los costos unitarios escalan, como se espera.
 *  - El ORDEN de un ranking PUEDE CAMBIAR: dos eventos con el mismo gasto en
 *    dólares difieren en pesos si invirtieron en fechas con tasas distintas.
 *    Eso es real y es justamente por lo que la moneda de reporte importa —
 *    medido: PPR025 sale a 958,9 CLP/USD contra 926,6 del consolidado.
 *  - ROAS, en cambio, NO se deja variar: es adimensional y tiene un único valor
 *    correcto, así que se ancla a USD (ver ROAS_USD_SQL).
 */
function montoSql(col: string, moneda: DisplayCurrency): string {
  return moneda === "CLP" ? `(${col} * fx.units_per_usd)` : col;
}

/** JOIN al tipo de cambio CLP del día. Solo se agrega en modo CLP. */
function fxJoinSql(moneda: DisplayCurrency, fechaCol = "a.fecha"): string {
  return moneda === "CLP"
    ? `LEFT JOIN ${FX} fx ON fx.currency = 'CLP' AND fx.fecha = ${fechaCol}`
    : "";
}

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
}

/** Igual que `n`, pero conserva el NULL como `null` en vez de convertirlo a 0.
 *  Un gasto sin tipo de cambio NO es un gasto de cero: si lo aplastamos a 0 el
 *  dashboard reporta con confianza una cifra que no midió. */
function nOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "object" && "value" in (v as object)) {
    const inner = (v as { value: unknown }).value;
    return inner == null ? null : Number(inner);
  }
  return Number(v);
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

// ---------- Filters ----------

export type Plataforma = "meta" | "google" | "tiktok";

/**
 * Filtros del dashboard. Ya NO existe `currency`: todo se agrega en USD sobre
 * `gasto_usd`, así que las cuentas CLP, USD y BRL conviven en el mismo scope.
 */
export type PaidMediaFilters = {
  /** Plataforma única — solo la usa el tab Overall (eventoScope mono-plataforma). */
  plataforma?: Plataforma;
  plataformas?: Plataforma[]; // vacío = todas (tab Detalle, multi-select)
  accountIds?: string[];
  campaignIds?: string[];
  adsetIds?: string[];
  objectives?: string[];
  prefix?: string; // familia de EventoID (3 chars: GLO, GLP, …) — solo tab Overall
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

function filterList<T extends string>(values?: T[]): T[] {
  return Array.from(new Set((values ?? []).filter(Boolean)));
}

function effectiveList<T extends string>(multi?: T[], single?: T): T[] {
  const values = filterList(multi);
  return values.length > 0 ? values : single ? [single] : [];
}

function addListFilter(
  conds: string[],
  params: Record<string, unknown>,
  column: string,
  param: string,
  values: string[],
) {
  if (values.length === 0) return;
  conds.push(`${column} IN UNNEST(@${param})`);
  params[param] = values;
}

/**
 * Atribución del gasto a un evento. Regla HÍBRIDA: manda la columna gobernada
 * `EventoID` del mart y, cuando viene vacía, se cae a la convención de nombre
 * (primeros 6 caracteres del `campaign_name`).
 *
 * Medido sobre el universo completo: la heurística sola atribuye 212.647 USD,
 * la columna gobernada sola 207.580 USD, y el híbrido 219.260 USD — es la
 * única de las tres que no empeora la atribución. La gobernada sola perdería
 * PPR025 "Yein Fonda 2025" (11.680 USD, el evento de mayor gasto del panel),
 * que tiene EventoID NULL en sus 158 filas; la heurística sola pierde los
 * EventoID de 7 caracteres (GLA5736 se trunca a GLA573) y los numéricos con
 * separador (`15068 - DGTL` → `15068 `).
 */
const EVENTO_ID_SQL = `COALESCE(NULLIF(TRIM(EventoID), ''), UPPER(LEFT(campaign_name, 6)))`;

/** Catálogo de eventos agregado a UNA fila por EventoID.
 *  `glovox.categoriaEvento` tiene 230 filas para 225 EventoID distintos
 *  (GLO042 aparece 6 veces): un JOIN directo multiplicaría por 6 el gasto de
 *  ese evento. Hoy GLO042 no tiene inversión, así que el bug está latente. */
const CAT_UNICO = `(
    SELECT EventoID, ANY_VALUE(NombreGlovox) AS NombreGlovox
    FROM ${CAT}
    GROUP BY EventoID
  )`;

/**
 * Construye un CTE base `t` filtrado y los params correspondientes. Cada query
 * consume `t` y agrega según su dimensión.
 *
 * `gasto_usd` se deja pasar TAL CUAL, sin IFNULL: cuando el mart todavía no
 * tiene tipo de cambio para esa fecha el valor es NULL, y esa distinción entre
 * "gastó cero" y "no sabemos cuánto es en dólares" tiene que sobrevivir hasta
 * la UI. Cada agregación lleva su centinela `filas_sin_fx`.
 */
function baseCte(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): {
  cte: string;
  params: Record<string, unknown>;
} {
  // Sembramos TRUE porque ya no hay ningún filtro obligatorio: sin esto el
  // WHERE quedaría vacío cuando el usuario no eligió nada.
  const conds: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  const plataformas = effectiveList(filters.plataformas, filters.plataforma);
  const accountIds = filterList(filters.accountIds);
  const campaignIds = filterList(filters.campaignIds);
  const adsetIds = filterList(filters.adsetIds);
  const objectives = filterList(filters.objectives);

  addListFilter(conds, params, "a.plataforma", "plataformas", plataformas);
  addListFilter(conds, params, "a.account_id", "accountIds", accountIds);
  addListFilter(conds, params, "a.campaign_id", "campaignIds", campaignIds);
  addListFilter(conds, params, "a.adset_id", "adsetIds", adsetIds);
  addListFilter(conds, params, "a.objective", "objectives", objectives);
  if (filters.from) {
    conds.push("a.fecha >= DATE(@from)");
    params.from = filters.from;
  }
  if (filters.to) {
    conds.push("a.fecha <= DATE(@to)");
    params.to = filters.to;
  }

  const cte = `
  WITH t AS (
    SELECT
      a.plataforma,
      a.fecha,
      a.account_id,
      a.account_name,
      a.campaign_id,
      a.campaign_name,
      a.adset_id,
      a.adset_name,
      a.objective,
      a.currency,
      IFNULL(a.impresiones, 0)  AS impresiones,
      IFNULL(a.clics, 0)        AS clics,
      IFNULL(a.conversiones, 0) AS conversiones,
      IFNULL(a.gasto, 0)        AS gasto_local,
      -- Monto en la moneda de despliegue. En USD es la columna del mart tal
      -- cual; en CLP se reexpresa con la tasa del día de esta misma fila.
      ${montoSql("a.gasto_usd", moneda)}             AS gasto_disp,
      ${montoSql("a.valor_conversion_usd", moneda)}  AS valor_conversion_disp,
      -- Columnas USD sin reexpresar: las consume ROAS, que es adimensional y
      -- por lo tanto no puede depender de la unidad en que se mire el panel.
      a.gasto_usd                                    AS gasto_usd,
      a.valor_conversion_usd                         AS valor_conversion_usd,
      IFNULL(a.fx_imputado, FALSE) AS fx_imputado
    FROM ${MART} a
    ${fxJoinSql(moneda)}
    WHERE ${conds.join("\n      AND ")}
  )`;

  return { cte, params };
}

/**
 * ROAS anclado a la unidad canónica.
 *
 * ROAS es adimensional (ingreso / gasto), así que tiene UN valor correcto y no
 * debería moverse al cambiar la moneda de despliegue. Pero un cociente de dos
 * agregados SÍ se mueve si cada fila se reexpresa con una tasa distinta por
 * día: medido, el ROAS global daba 4,8104 en dólares y 4,8591 en pesos, un 1%
 * de diferencia que el usuario leería como un bug del switch.
 *
 * Por eso se calcula siempre sobre las columnas en USD, en las dos monedas.
 */
const ROAS_USD_SQL = `SAFE_DIVIDE(SUM(valor_conversion_usd), SUM(gasto_usd))`;

/**
 * Fragmento SQL reutilizable con las métricas agregadas. Todos los ratios se
 * calculan desde los SUM (nunca promediando promedios per-fila).
 *
 * Los denominadores de CPC / CPM / CPA excluyen las filas SIN conversión a
 * dólares: si el numerador no puede incluir ese gasto, el denominador tampoco
 * puede incluir sus clics, o el ratio sale diluido. CTR queda con el
 * denominador COMPLETO porque no toca dinero — es clics sobre impresiones y no
 * depende del tipo de cambio.
 *
 * El centinela y la exclusión usan la MISMA condición (`gasto_usd IS NULL`) a
 * propósito: si divergieran, una fila con gasto 0 y sin FX se excluiría del
 * denominador sin encender el aviso.
 */
const METRICAS_SQL = `
      SUM(gasto_disp)                                      AS gasto,
      SUM(impresiones)                                     AS impresiones,
      SUM(clics)                                           AS clics,
      SUM(conversiones)                                    AS conversiones,
      SUM(valor_conversion_disp)                           AS valor_conversion,
      SAFE_DIVIDE(SUM(clics), SUM(impresiones))            AS ctr,
      SAFE_DIVIDE(SUM(gasto_disp),
                  SUM(IF(gasto_disp IS NULL, 0, clics)))   AS cpc,
      SAFE_DIVIDE(SUM(gasto_disp) * 1000,
                  SUM(IF(gasto_disp IS NULL, 0, impresiones))) AS cpm,
      ${ROAS_USD_SQL}                                       AS roas,
      COUNTIF(gasto_disp IS NULL)                          AS filas_sin_fx,
      SUM(IF(gasto_disp IS NULL, gasto_local, 0))          AS gasto_local_sin_fx`;

// ---------- Types ----------

/** Desglose del gasto por moneda de origen. NO es un filtro: es la lista que
 *  permite cuadrar el consolidado contra la factura de cada plataforma, que
 *  llega siempre en la moneda nativa de la cuenta. */
export type CurrencyBreakdown = {
  currency: string;
  /** Monto en la moneda nativa — solo comparable dentro de su propia moneda. */
  gastoLocal: number;
  /** El mismo monto expresado en la moneda de despliegue activa. */
  gastoConvertido: number;
  /** Tasa efectiva del rango: unidades de la moneda nativa por unidad de la
   *  moneda de despliegue. No hay "una" tasa (hay 567 distintas en el histórico
   *  CLP), así que se publica el promedio ponderado por gasto del scope activo. */
  fxEfectivo: number;
  filasSinFx: number;
  gastoLocalSinFx: number;
};

export type PlataformaOption = {
  plataforma: Plataforma;
  rows: number;
};

export type AccountOption = {
  accountId: string;
  accountName: string;
  plataforma: Plataforma;
  /** Moneda nativa de la cuenta. Se muestra como metadato del selector: la
   *  moneda es propiedad de la cuenta (ninguna cuenta factura en dos monedas). */
  currency: string;
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
  /** Último día con tipo de cambio publicado. Si es menor que `max`, hay días
   *  con gasto que todavía no tienen conversión y el encabezado debe decirlo
   *  en vez de prometer cobertura hasta `max`. */
  maxFx: string;
};

/** Hueco de conversión: filas cuyo gasto existe en moneda local pero no en
 *  dólares porque `referencia.tipo_cambio` todavía no cubre esa fecha. */
export type FxGap = {
  filas: number;
  /** Cuánto gasto quedó fuera del total, por moneda y en su unidad nativa.
   *  Se informa el MONTO, no el conteo de filas: un aviso que no permite
   *  dimensionar lo que falta no permite decidir nada. */
  porMoneda: { currency: string; gastoLocal: number }[];
};

export type PaidMediaKpis = {
  /** Monto en la moneda de DESPLIEGUE activa (ver DisplayCurrency). */
  gasto: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  valorConversion: number;
  ctr: number;        // 0..1
  cpc: number;        // moneda de despliegue
  cpm: number;        // moneda de despliegue
  cpa: number;        // moneda de despliegue
  roas: number;
  campaigns: number;
  adsets: number;
  accounts: number;
  dias: number;
  /** Clics e impresiones que SÍ entraron en el denominador de CPC/CPM. Cuando
   *  difieren de `clics`/`impresiones` es porque hay filas sin conversión. */
  clicsConvertidos: number;
  impresionesConvertidas: number;
  gap: FxGap;
};

export type DailyRow = {
  fecha: string;
  /** `null` cuando ese día tiene gasto pero ninguna fila pudo convertirse.
   *  El chart tiene que dejar el hueco visible, no dibujar una caída a cero. */
  gasto: number | null;
  impresiones: number;
  clics: number;
  conversiones: number;
  valorConversion: number;
  filasSinFx: number;
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
  filasSinFx: number;
};

/** Resultado de un breakdown con su cardinalidad real, para que la tabla pueda
 *  decir "50 de 1.097" en vez de dar a entender que muestra todo. Consolidar
 *  llevó las campañas de 81 (vista CLP) a 1.097, así que el truncado pasó de
 *  ser un detalle a ser la mayor parte de la tabla. */
export type Breakdown = {
  rows: BreakdownRow[];
  total: number;
};

// ---------- Options (no respetan filtros para que el usuario pueda navegar) ----------

/** Plataformas con conteo de filas — solo para poblar el selector. */
export async function getPlatformOptions(): Promise<PlataformaOption[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT plataforma AS plataforma, COUNT(*) AS n_rows
    FROM ${MART}
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
 * Cuentas disponibles, opcionalmente acotadas a una plataforma. Ordenadas por
 * gasto en dólares para que las activas aparezcan arriba — antes se ordenaban
 * por gasto en moneda local, lo que dejaba cualquier cuenta CLP por encima de
 * todas las USD sin que eso significara nada.
 */
export async function getAccountOptions(
  plataforma?: Plataforma | Plataforma[],
): Promise<AccountOption[]> {
  const conds: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  addListFilter(
    conds,
    params,
    "plataforma",
    "plataformas",
    Array.isArray(plataforma) ? filterList(plataforma) : plataforma ? [plataforma] : [],
  );
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      account_id                    AS account_id,
      ANY_VALUE(account_name)       AS account_name,
      ANY_VALUE(plataforma)         AS plataforma,
      ANY_VALUE(currency)           AS currency,
      SUM(IFNULL(gasto_usd, 0))     AS gasto_usd
    FROM ${MART}
    WHERE ${conds.join(" AND ")}
    GROUP BY account_id
    ORDER BY gasto_usd DESC
    `,
    params,
  );
  return rows.map((r) => ({
    accountId:   s(r.account_id),
    accountName: s(r.account_name),
    plataforma:  s(r.plataforma) as Plataforma,
    currency:    s(r.currency),
  }));
}

/** Campañas — opcionalmente acotadas a una cuenta. */
export async function getCampaignOptions(
  accountId?: string | string[],
): Promise<CampaignOption[]> {
  const conds: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  addListFilter(
    conds,
    params,
    "account_id",
    "accountIds",
    Array.isArray(accountId) ? filterList(accountId) : accountId ? [accountId] : [],
  );
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      campaign_id                  AS campaign_id,
      ANY_VALUE(campaign_name)     AS campaign_name,
      ANY_VALUE(account_id)        AS account_id,
      ANY_VALUE(objective)         AS objective,
      SUM(IFNULL(gasto_usd, 0))    AS gasto_usd
    FROM ${MART}
    WHERE ${conds.join(" AND ")}
    GROUP BY campaign_id
    ORDER BY gasto_usd DESC
    LIMIT 1000
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
  campaignId?: string | string[],
): Promise<AdsetOption[]> {
  const conds: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  addListFilter(
    conds,
    params,
    "campaign_id",
    "campaignIds",
    Array.isArray(campaignId) ? filterList(campaignId) : campaignId ? [campaignId] : [],
  );
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      adset_id                  AS adset_id,
      ANY_VALUE(adset_name)     AS adset_name,
      ANY_VALUE(campaign_id)    AS campaign_id,
      SUM(IFNULL(gasto_usd, 0)) AS gasto_usd
    FROM ${MART}
    WHERE ${conds.join(" AND ")}
    GROUP BY adset_id
    ORDER BY gasto_usd DESC
    LIMIT 1000
    `,
    params,
  );
  return rows.map((r) => ({
    adsetId:   s(r.adset_id),
    adsetName: s(r.adset_name),
    campaignId: s(r.campaign_id),
  }));
}

/** Objetivos disponibles en la plataforma seleccionada. */
export async function getObjectiveOptions(
  plataforma?: Plataforma | Plataforma[],
): Promise<string[]> {
  const conds: string[] = ["objective IS NOT NULL"];
  const params: Record<string, unknown> = {};
  addListFilter(
    conds,
    params,
    "plataforma",
    "plataformas",
    Array.isArray(plataforma) ? filterList(plataforma) : plataforma ? [plataforma] : [],
  );
  const rows = await query<Record<string, unknown>>(
    `
    SELECT objective AS objective
    FROM ${MART}
    WHERE ${conds.join(" AND ")}
    GROUP BY objective
    ORDER BY objective
    `,
    params,
  );
  return rows.map((r) => s(r.objective)).filter(Boolean);
}

/**
 * Rango de fechas con datos, más el último día con tipo de cambio publicado.
 * El encabezado necesita los dos: prometer cobertura hasta `max` cuando la
 * conversión solo llega hasta `maxFx` es exactamente la clase de dato que hace
 * que el usuario deje de confiar en el panel.
 */
export async function getDateRange(): Promise<DateRange> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      FORMAT_DATE('%Y-%m-%d', MIN(fecha)) AS min_date,
      FORMAT_DATE('%Y-%m-%d', MAX(fecha)) AS max_date,
      (SELECT FORMAT_DATE('%Y-%m-%d', MIN(max_fecha))
       FROM (SELECT currency, MAX(fecha) AS max_fecha
             FROM \`${P}.referencia.tipo_cambio\`
             GROUP BY currency)) AS max_fx
    FROM ${MART}
  `);
  return {
    min:   s(rows[0]?.min_date),
    max:   s(rows[0]?.max_date),
    maxFx: s(rows[0]?.max_fx),
  };
}

// ---------- KPIs y agregaciones ----------

function parseGap(raw: unknown): FxGap {
  const arr = Array.isArray(raw) ? raw : [];
  return {
    filas: 0, // lo rellena el caller con su propio COUNTIF
    porMoneda: arr.map((x) => {
      const row = x as Record<string, unknown>;
      return { currency: s(row.currency), gastoLocal: n(row.gasto_local) };
    }),
  };
}

export async function getKpis(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<PaidMediaKpis> {
  const { cte, params } = baseCte(filters, moneda);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      ${METRICAS_SQL},
      SAFE_DIVIDE(SUM(gasto_disp),
                  SUM(IF(gasto_disp IS NULL, 0, conversiones))) AS cpa,
      SUM(IF(gasto_disp IS NULL, 0, clics))       AS clics_convertidos,
      SUM(IF(gasto_disp IS NULL, 0, impresiones)) AS impresiones_convertidas,
      COUNT(DISTINCT campaign_id)                 AS campaigns,
      COUNT(DISTINCT adset_id)                    AS adsets,
      COUNT(DISTINCT account_id)                  AS accounts,
      COUNT(DISTINCT fecha)                       AS dias,
      ARRAY(
        SELECT AS STRUCT currency, ROUND(SUM(gasto_local), 2) AS gasto_local
        FROM t
        WHERE gasto_disp IS NULL
        GROUP BY currency
        ORDER BY 2 DESC
      ) AS gap_por_moneda
    FROM t
    `,
    params,
  );
  const r = rows[0] ?? {};
  const gap = parseGap(r.gap_por_moneda);
  gap.filas = n(r.filas_sin_fx);
  return {
    gasto:               n(r.gasto),
    impresiones:            n(r.impresiones),
    clics:                  n(r.clics),
    conversiones:           n(r.conversiones),
    valorConversion:     n(r.valor_conversion),
    ctr:                    n(r.ctr),
    cpc:                    n(r.cpc),
    cpm:                    n(r.cpm),
    cpa:                    n(r.cpa),
    roas:                   n(r.roas),
    campaigns:              n(r.campaigns),
    adsets:                 n(r.adsets),
    accounts:               n(r.accounts),
    dias:                   n(r.dias),
    clicsConvertidos:       n(r.clics_convertidos),
    impresionesConvertidas: n(r.impresiones_convertidas),
    gap,
  };
}

/**
 * Gasto por moneda de origen dentro del scope activo. Alimenta la lista que
 * cuelga del KPI de gasto: el consolidado en dólares es el titular, pero el
 * analista que reconcilia contra la factura de Meta necesita el monto en la
 * moneda en que efectivamente se pagó.
 */
export async function getByCurrency(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<CurrencyBreakdown[]> {
  const { cte, params } = baseCte(filters, moneda);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      currency                                     AS currency,
      SUM(gasto_local)                             AS gasto_local,
      SUM(gasto_disp)                              AS gasto_convertido,
      -- Tasa efectiva: solo sobre las filas que SÍ se convirtieron, o el
      -- numerador incluiría gasto que el denominador no tiene.
      SAFE_DIVIDE(SUM(IF(gasto_disp IS NULL, 0, gasto_local)),
                  SUM(gasto_disp))                 AS fx_efectivo,
      COUNTIF(gasto_disp IS NULL)                  AS filas_sin_fx,
      SUM(IF(gasto_disp IS NULL, gasto_local, 0))  AS gasto_local_sin_fx
    FROM t
    WHERE currency IS NOT NULL
    GROUP BY currency
    ORDER BY gasto_convertido DESC NULLS LAST
    `,
    params,
  );
  return rows.map((r) => ({
    currency:        s(r.currency),
    gastoLocal:      n(r.gasto_local),
    gastoConvertido: n(r.gasto_convertido),
    fxEfectivo:      n(r.fx_efectivo),
    filasSinFx:      n(r.filas_sin_fx),
    gastoLocalSinFx: n(r.gasto_local_sin_fx),
  }));
}

/** Serie diaria de gasto, clics, impresiones y conversiones. */
export async function getDaily(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<DailyRow[]> {
  const { cte, params } = baseCte(filters, moneda);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      FORMAT_DATE('%Y-%m-%d', fecha)  AS fecha,
      SUM(gasto_disp)                 AS gasto,
      SUM(impresiones)                AS impresiones,
      SUM(clics)                      AS clics,
      SUM(conversiones)               AS conversiones,
      SUM(valor_conversion_disp)      AS valor_conversion,
      COUNTIF(gasto_disp IS NULL)     AS filas_sin_fx,
      COUNT(*)                        AS filas
    FROM t
    GROUP BY fecha
    ORDER BY fecha
    `,
    params,
  );
  return rows.map((r) => {
    const filas = n(r.filas);
    const sinFx = n(r.filas_sin_fx);
    // Un día 100% sin conversión vale `null`, no 0: si lo mandáramos como 0 el
    // área del chart cerraría contra el eje y se leería como "ese día no se
    // invirtió", que es lo contrario de lo que pasó.
    const gasto = filas > 0 && sinFx === filas ? null : nOrNull(r.gasto);
    return {
      fecha:              s(r.fecha),
      gasto,
      impresiones:        n(r.impresiones),
      clics:              n(r.clics),
      conversiones:       n(r.conversiones),
      valorConversion: n(r.valor_conversion),
      filasSinFx:         sinFx,
    };
  });
}

/**
 * Helper interno: agrupa por una dimensión y devuelve una fila por valor con
 * los ratios ya calculados desde las sumas. Devuelve además la cardinalidad
 * total para que la tabla pueda declarar cuánto está dejando fuera.
 *
 * El ORDER BY usa `IFNULL(gasto_usd, 0)`: BigQuery manda los NULL al final en
 * DESC, así que sin esto las filas sin conversión se caen del LIMIT y la
 * campaña que arrancó hoy no aparece "en cero" — desaparece.
 */
async function getBreakdown(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
  groupBySql: string,
  selectExtra: string,
  limit: number,
): Promise<Breakdown> {
  const { cte, params } = baseCte(filters, moneda);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte},
    agg AS (
      SELECT
        ${groupBySql} AS grp_key,
        ${selectExtra}
        ${METRICAS_SQL}
      FROM t
      GROUP BY grp_key
    )
    SELECT *, (SELECT COUNT(*) FROM agg) AS grp_total
    FROM agg
    ORDER BY IFNULL(gasto, 0) DESC
    LIMIT ${limit}
    `,
    params,
  );
  return {
    total: n(rows[0]?.grp_total),
    rows: rows.map((r) => ({
      key:                s(r.grp_key),
      label:              s(r.grp_label ?? r.grp_key),
      extra:              r.grp_extra != null ? s(r.grp_extra) : undefined,
      gasto:           n(r.gasto),
      impresiones:        n(r.impresiones),
      clics:              n(r.clics),
      conversiones:       n(r.conversiones),
      valorConversion: n(r.valor_conversion),
      ctr:                n(r.ctr),
      cpc:                n(r.cpc),
      cpm:                n(r.cpm),
      roas:               n(r.roas),
      filasSinFx:         n(r.filas_sin_fx),
    })),
  };
}

export function getByPlatform(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<Breakdown> {
  return getBreakdown(filters, moneda, "plataforma", "ANY_VALUE(plataforma) AS grp_label,", 10);
}

export function getByObjective(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<Breakdown> {
  // grp_label envuelto en ANY_VALUE: BigQuery no acepta repetir la expresión
  // IFNULL(objective, '—') como un select no-agregado aunque sea idéntica al
  // grp_key agrupado (chequea la referencia textual a la columna, no el valor).
  return getBreakdown(
    filters,
    moneda,
    "IFNULL(objective, '—')",
    "ANY_VALUE(IFNULL(objective, '—')) AS grp_label,",
    20,
  );
}

export function getByAccount(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<Breakdown> {
  return getBreakdown(
    filters,
    moneda,
    "account_id",
    "ANY_VALUE(account_name) AS grp_label, ANY_VALUE(plataforma) AS grp_extra,",
    50,
  );
}

// Consolidar multiplicó la cardinalidad: las campañas pasaron de 81 (vista CLP)
// a 1.097 y los adsets de 120 a 1.301. Con el LIMIT 50 anterior quedaba fuera el
// 95% de la tabla, así que subimos el techo y la UI declara el total.
export function getByCampaign(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<Breakdown> {
  return getBreakdown(
    filters,
    moneda,
    "campaign_id",
    "ANY_VALUE(campaign_name) AS grp_label, ANY_VALUE(account_name) AS grp_extra,",
    200,
  );
}

export function getByAdset(
  filters: PaidMediaFilters,
  moneda: DisplayCurrency,
): Promise<Breakdown> {
  return getBreakdown(
    filters,
    moneda,
    "adset_id",
    "ANY_VALUE(adset_name) AS grp_label, ANY_VALUE(campaign_name) AS grp_extra,",
    200,
  );
}

// ---------- Resumen por evento (tab Overall) ----------

export type EventoRow = {
  eventoId: string;   // EventoID de categoriaEvento (p. ej. "GLO198")
  nombre: string;     // NombreGlovox
  gasto: number;
  gastoMeta: number;
  gastoGoogle: number;
  gastoTiktok: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  valorConversion: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  /** Monedas de origen del gasto de este evento. Con 2+ el evento estaba
   *  partido entre dos vistas del dashboard viejo y era imposible verlo entero:
   *  son 12 eventos que suman el 29% del gasto atribuido. */
  monedas: string[];
  filasSinFx: number;
};

/** Scope del tab Overall: plataforma + rango de fechas. No hereda los
 *  drill-downs de cuenta/campaña/adset (es la vista transversal). El filtro de
 *  familia NO va acá: se aplica después de resolver el evento (ver getByEvento). */
function eventoScopeConds(
  filters: Pick<PaidMediaFilters, "plataforma" | "from" | "to">,
): { conds: string; params: Record<string, unknown> } {
  const conds: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  if (filters.plataforma) {
    conds.push("a.plataforma = @plataforma");
    params.plataforma = filters.plataforma;
  }
  if (filters.from) {
    conds.push("a.fecha >= DATE(@from)");
    params.from = filters.from;
  }
  if (filters.to) {
    conds.push("a.fecha <= DATE(@to)");
    params.to = filters.to;
  }
  return { conds: conds.join("\n        AND "), params };
}

/** CTE base del tab Overall, con el evento ya resuelto por la regla híbrida. */
function eventoBaseCte(
  filters: Pick<PaidMediaFilters, "plataforma" | "from" | "to">,
  moneda: DisplayCurrency,
): { cte: string; params: Record<string, unknown> } {
  const { conds, params } = eventoScopeConds(filters);
  const cte = `
    WITH base AS (
      SELECT
        ${EVENTO_ID_SQL.replace(/EventoID/g, "a.EventoID").replace(/campaign_name/g, "a.campaign_name")} AS evento_id,
        a.campaign_id,
        a.campaign_name,
        a.account_name,
        a.plataforma,
        a.currency,
        IFNULL(a.impresiones, 0)      AS impresiones,
        IFNULL(a.clics, 0)            AS clics,
        IFNULL(a.conversiones, 0)     AS conversiones,
        IFNULL(a.gasto, 0)            AS gasto_local,
        ${montoSql("a.gasto_usd", moneda)}            AS gasto_disp,
        ${montoSql("a.valor_conversion_usd", moneda)} AS valor_conversion_disp,
        a.gasto_usd                                   AS gasto_usd,
        a.valor_conversion_usd                        AS valor_conversion_usd
      FROM ${MART} a
      ${fxJoinSql(moneda)}
      WHERE ${conds}
    )`;
  return { cte, params };
}

/**
 * Resumen de paid media agregado por evento, consolidado en dólares.
 *
 * El filtro de FAMILIA (GLO, GLP, …) se aplica sobre el EventoID YA RESUELTO,
 * no sobre el nombre de campaña. Antes se prefiltraba con
 * `UPPER(LEFT(campaign_name, 3))`, que funcionaba solo por coincidencia:
 * cualquier campaña cuyo nombre no arranque con su EventoID —"Copy 1 of
 * GLP009…" cae en la familia "COP"— quedaba invisible bajo su familia real.
 */
export async function getByEvento(
  filters: Pick<PaidMediaFilters, "plataforma" | "prefix" | "from" | "to">,
  moneda: DisplayCurrency,
): Promise<EventoRow[]> {
  const { cte, params } = eventoBaseCte(filters, moneda);
  const prefixCond = filters.prefix ? "AND UPPER(LEFT(c.EventoID, 3)) = @prefix" : "";
  if (filters.prefix) params.prefix = filters.prefix;

  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      c.EventoID                                              AS evento_id,
      c.NombreGlovox                                          AS nombre,
      SUM(base.gasto_disp)                                     AS gasto,
      SUM(IF(base.plataforma = 'meta',   base.gasto_disp, 0))  AS gasto_meta,
      SUM(IF(base.plataforma = 'google', base.gasto_disp, 0))  AS gasto_google,
      SUM(IF(base.plataforma = 'tiktok', base.gasto_disp, 0))  AS gasto_tiktok,
      SUM(base.impresiones)                                   AS impresiones,
      SUM(base.clics)                                         AS clics,
      SUM(base.conversiones)                                  AS conversiones,
      SUM(base.valor_conversion_disp)                          AS valor_conversion,
      SAFE_DIVIDE(SUM(base.clics), SUM(base.impresiones))     AS ctr,
      SAFE_DIVIDE(SUM(base.gasto_disp),
                  SUM(IF(base.gasto_disp IS NULL, 0, base.clics)))       AS cpc,
      SAFE_DIVIDE(SUM(base.gasto_disp) * 1000,
                  SUM(IF(base.gasto_disp IS NULL, 0, base.impresiones))) AS cpm,
      SAFE_DIVIDE(SUM(base.valor_conversion_usd), SUM(base.gasto_usd))    AS roas,
      ARRAY_AGG(DISTINCT base.currency IGNORE NULLS ORDER BY base.currency) AS monedas,
      COUNTIF(base.gasto_disp IS NULL)                         AS filas_sin_fx
    FROM base
    JOIN ${CAT_UNICO} c ON c.EventoID = base.evento_id
    WHERE TRUE ${prefixCond}
    GROUP BY evento_id, nombre
    ORDER BY IFNULL(gasto, 0) DESC
    `,
    params,
  );

  return rows.map((r) => ({
    eventoId:           s(r.evento_id),
    nombre:             s(r.nombre),
    gasto:           n(r.gasto),
    gastoMeta:          n(r.gasto_meta),
    gastoGoogle:        n(r.gasto_google),
    gastoTiktok:        n(r.gasto_tiktok),
    impresiones:        n(r.impresiones),
    clics:              n(r.clics),
    conversiones:       n(r.conversiones),
    valorConversion: n(r.valor_conversion),
    ctr:                n(r.ctr),
    cpc:                n(r.cpc),
    cpm:                n(r.cpm),
    roas:               n(r.roas),
    monedas:            Array.isArray(r.monedas) ? r.monedas.map(s) : [],
    filasSinFx:         n(r.filas_sin_fx),
  }));
}

/**
 * Campañas cuyo evento no mapea a ningún registro del catálogo (búsqueda
 * genérica, boosts de publicaciones de Instagram, naming fuera de convención).
 * Una fila por campaña. Mismo scope que `getByEvento` pero SIN el filtro de
 * familia: por definición estas campañas no tienen familia conocida.
 */
export async function getOtrasCampanias(
  filters: Pick<PaidMediaFilters, "plataforma" | "from" | "to">,
  moneda: DisplayCurrency,
): Promise<Breakdown> {
  const { cte, params } = eventoBaseCte(filters, moneda);

  const rows = await query<Record<string, unknown>>(
    `
    ${cte},
    sin_evento AS (
      SELECT * FROM base
      WHERE NOT EXISTS (
        SELECT 1 FROM ${CAT_UNICO} c WHERE c.EventoID = base.evento_id
      )
    ),
    agg AS (
      SELECT
        campaign_id                                             AS grp_key,
        ANY_VALUE(campaign_name)                                AS grp_label,
        ANY_VALUE(account_name)                                 AS grp_extra,
        SUM(gasto_disp)                                         AS gasto,
        SUM(impresiones)                                        AS impresiones,
        SUM(clics)                                              AS clics,
        SUM(conversiones)                                       AS conversiones,
        SUM(valor_conversion_disp)                              AS valor_conversion,
        SAFE_DIVIDE(SUM(clics), SUM(impresiones))               AS ctr,
        SAFE_DIVIDE(SUM(gasto_disp),
                    SUM(IF(gasto_disp IS NULL, 0, clics)))       AS cpc,
        SAFE_DIVIDE(SUM(gasto_disp) * 1000,
                    SUM(IF(gasto_disp IS NULL, 0, impresiones))) AS cpm,
        ${ROAS_USD_SQL}                                       AS roas,
        COUNTIF(gasto_disp IS NULL)                              AS filas_sin_fx
      FROM sin_evento
      GROUP BY campaign_id
    )
    SELECT *, (SELECT COUNT(*) FROM agg) AS grp_total
    FROM agg
    ORDER BY IFNULL(gasto, 0) DESC
    LIMIT 200
    `,
    params,
  );

  return {
    total: n(rows[0]?.grp_total),
    rows: rows.map((r) => ({
      key:                s(r.grp_key),
      label:              s(r.grp_label ?? r.grp_key),
      extra:              r.grp_extra != null ? s(r.grp_extra) : undefined,
      gasto:           n(r.gasto),
      impresiones:        n(r.impresiones),
      clics:              n(r.clics),
      conversiones:       n(r.conversiones),
      valorConversion: n(r.valor_conversion),
      ctr:                n(r.ctr),
      cpc:                n(r.cpc),
      cpm:                n(r.cpm),
      roas:               n(r.roas),
      filasSinFx:         n(r.filas_sin_fx),
    })),
  };
}

/**
 * Familias de EventoID presentes en el scope, tomadas de los primeros 3
 * caracteres del EventoID del catálogo: GLO (Chile), GLP (Perú), GLB, … Al
 * consolidar aparecen las 7 familias juntas (antes cada moneda mostraba un
 * subconjunto distinto). Ordenadas por gasto en dólares.
 */
export async function getEventoPrefixes(
  filters: Pick<PaidMediaFilters, "plataforma" | "from" | "to">,
  moneda: DisplayCurrency,
): Promise<string[]> {
  const { cte, params } = eventoBaseCte(filters, moneda);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      UPPER(LEFT(c.EventoID, 3))     AS prefix,
      SUM(IFNULL(base.gasto_disp, 0)) AS gasto
    FROM base
    JOIN ${CAT_UNICO} c ON c.EventoID = base.evento_id
    GROUP BY prefix
    ORDER BY gasto DESC
    `,
    params,
  );
  return rows.map((r) => s(r.prefix)).filter(Boolean);
}
