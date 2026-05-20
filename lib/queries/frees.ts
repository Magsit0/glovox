import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const CORTESIAS = `\`${P}.glovox.cortesias\``;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;
const NOMBRES = `\`${P}.glovox.nombres_genero\``;

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
  emitidas?: number;
  total: number;
  canjeadas: number;
  tasaCanje: number;
};

export type FreesCategoryNode = FreesGroupRow & {
  recipients: FreesGroupRow[];
};

export type FreesGeneroRow = {
  label: string;
  total: number;
  hombres: number;
  mujeres: number;
  sinClasificar: number;
  pctMujeres: number;
};

export type FreesGeneroCategory = FreesGeneroRow & {
  recipients: FreesGeneroRow[];
};

export type FreesGeneroKpis = {
  totalHombres: number;
  totalMujeres: number;
  totalSinClasificar: number;
  pctClasificable: number;
  pctMujeres: number;
};

export type FreesGeneroData = {
  kpis: FreesGeneroKpis;
  byCategory: FreesGeneroCategory[];
};

export type FreesIngresoRow = {
  category: string;
  recipient: string;
  genero: "Hombre" | "Mujer" | "Sin clasificar";
  tsSeconds: number;
};

export type FreesDashboardData = {
  kpis: FreesKpis;
  byTicketType: FreesGroupRow[];
  byLinkType: FreesGroupRow[];
  byCategory: FreesCategoryNode[];
  byGenero: FreesGeneroData;
  ingresoRows: FreesIngresoRow[];
};

export type FreesEventOption = {
  eventoId: string;
  nombre: string;
  totalCortesias: number;
};

// ---------- Queries ----------

/**
 * Cortesia "canjeada" = existe al menos un ticket en glovox.tickets cuyo
 * CodigoPromocion coincide con los últimos 8 chars del sellerLink.
 */
const JOIN_CTE = `
  WITH cortesias_dedup AS (
    SELECT
      c.id,
      c.ticketType,
      c.recipient,
      c.category,
      c.linkType,
      c.externalId,
      c.assignedAt,
      c.sellerLink,
      ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY c.assignedAt DESC NULLS LAST) AS rn
    FROM ${CORTESIAS} c
    WHERE (@hasEvento = FALSE OR c.externalId = @eventoId)
  ),
  cortesias_base AS (
    SELECT
      id,
      ticketType,
      recipient,
      category,
      linkType,
      externalId,
      assignedAt,
      RIGHT(sellerLink, 8) AS promo
    FROM cortesias_dedup
    WHERE rn = 1
  ),
  cortesias_match AS (
    SELECT
      cb.id,
      cb.ticketType,
      cb.recipient,
      cb.category,
      cb.linkType,
      cb.externalId,
      cb.assignedAt,
      cb.promo,
      COUNT(t.CodigoPromocion) > 0 AS canjeada,
      ANY_VALUE(t.NombreNominado)   AS nombreNominado,
      MIN(t.HoraQuemado)            AS horaQuemado
    FROM cortesias_base cb
    LEFT JOIN ${TICKETS} t
      ON t.CodigoPromocion = cb.promo
    GROUP BY cb.id, cb.ticketType, cb.recipient, cb.category, cb.linkType, cb.externalId, cb.assignedAt, cb.promo
  ),
  nombres_norm AS (
    SELECT
      REGEXP_REPLACE(
        NORMALIZE(LOWER(IFNULL(nombre, '')), NFD),
        r'[^a-z]', ''
      ) AS nombre,
      UPPER(genero) AS genero
    FROM ${NOMBRES}
    WHERE nombre IS NOT NULL AND nombre != ''
  ),
  cortesias_tokens AS (
    SELECT
      cm.id,
      pos,
      token
    FROM cortesias_match cm,
    UNNEST(
      SPLIT(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            NORMALIZE(LOWER(IFNULL(cm.nombreNominado, '')), NFD),
            r'\pM', ''
          ),
          r'[^a-z ]', ' '
        ),
        ' '
      )
    ) AS token WITH OFFSET AS pos
    WHERE token != ''
  ),
  cortesias_token_match AS (
    SELECT
      ct.id,
      ct.pos,
      g.genero
    FROM cortesias_tokens ct
    JOIN nombres_norm g ON g.nombre = ct.token
  ),
  cortesias_first_match AS (
    SELECT
      id,
      ARRAY_AGG(genero ORDER BY pos LIMIT 1)[SAFE_OFFSET(0)] AS genero
    FROM cortesias_token_match
    GROUP BY id
  ),
  cortesias_with_genero AS (
    SELECT
      cm.*,
      CASE
        WHEN fm.genero = 'M' THEN 'Hombre'
        WHEN fm.genero = 'F' THEN 'Mujer'
        ELSE 'Sin clasificar'
      END AS generoLabel
    FROM cortesias_match cm
    LEFT JOIN cortesias_first_match fm ON fm.id = cm.id
  )
`;

const DELIVERED_FILTER =
  "(assignedAt IS NOT NULL OR (recipient IS NOT NULL AND recipient != ''))";

function eventoParams(eventoId?: string): Record<string, unknown> {
  return {
    hasEvento: !!eventoId,
    eventoId: eventoId ?? "",
  };
}

async function fetchKpis(eventoId?: string): Promise<FreesKpis> {
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
  const rows = await query<Record<string, unknown>>(sql, eventoParams(eventoId));
  const r = rows[0] ?? {};
  const total = n(r.totalCortesias);
  const canj = n(r.totalCanjeadas);
  const asignadas = n(r.cortesiasConRecipient);
  return {
    totalCortesias: total,
    totalCanjeadas: canj,
    totalNoCanjeadas: n(r.totalNoCanjeadas),
    tasaCanje: asignadas ? canj / asignadas : 0,
    cortesiasConRecipient: asignadas,
    cortesiasConCategory: n(r.cortesiasConCategory),
    ticketTypesUnicos: n(r.ticketTypesUnicos),
  };
}

async function fetchGroup(
  field: "ticketType" | "recipient" | "category" | "linkType",
  eventoId?: string,
): Promise<FreesGroupRow[]> {
  const sql = `
    ${JOIN_CTE}
    SELECT
      COALESCE(NULLIF(${field}, ''), '${SIN_DATO}') AS label,
      COUNT(*)                                       AS emitidas,
      COUNTIF(${DELIVERED_FILTER})                   AS total,
      COUNTIF(canjeada)                              AS canjeadas
    FROM cortesias_match
    GROUP BY label
    HAVING total > 0
    ORDER BY total DESC
  `;
  const rows = await query<Record<string, unknown>>(sql, eventoParams(eventoId));
  return rows.map((r) => {
    const emitidas = n(r.emitidas);
    const total = n(r.total);
    const canjeadas = n(r.canjeadas);
    return {
      label: s(r.label) || SIN_DATO,
      emitidas,
      total,
      canjeadas,
      tasaCanje: total ? canjeadas / total : 0,
    };
  });
}

async function fetchCategoryTree(
  eventoId?: string,
): Promise<FreesCategoryNode[]> {
  const sql = `
    ${JOIN_CTE}
    SELECT
      COALESCE(NULLIF(category, ''),  '${SIN_DATO}') AS category,
      COALESCE(NULLIF(recipient, ''), '${SIN_DATO}') AS recipient,
      COUNT(*)          AS total,
      COUNTIF(canjeada) AS canjeadas
    FROM cortesias_match
    WHERE ${DELIVERED_FILTER}
    GROUP BY category, recipient
    ORDER BY category, total DESC
  `;
  const rows = await query<Record<string, unknown>>(sql, eventoParams(eventoId));

  const byCat = new Map<string, FreesCategoryNode>();

  for (const r of rows) {
    const category = s(r.category) || SIN_DATO;
    const recipient = s(r.recipient) || SIN_DATO;
    const total = n(r.total);
    const canjeadas = n(r.canjeadas);

    let catNode = byCat.get(category);
    if (!catNode) {
      catNode = {
        label: category,
        total: 0,
        canjeadas: 0,
        tasaCanje: 0,
        recipients: [],
      };
      byCat.set(category, catNode);
    }

    catNode.total += total;
    catNode.canjeadas += canjeadas;
    catNode.recipients.push({
      label: recipient,
      total,
      canjeadas,
      tasaCanje: total ? canjeadas / total : 0,
    });
  }

  const result = Array.from(byCat.values());
  for (const cat of result) {
    cat.tasaCanje = cat.total ? cat.canjeadas / cat.total : 0;
    cat.recipients.sort((a, b) => b.total - a.total);
  }
  result.sort((a, b) => b.total - a.total);
  return result;
}

async function fetchGeneroTree(eventoId?: string): Promise<FreesGeneroData> {
  const sql = `
    ${JOIN_CTE}
    SELECT
      COALESCE(NULLIF(category, ''),  '${SIN_DATO}') AS category,
      COALESCE(NULLIF(recipient, ''), '${SIN_DATO}') AS recipient,
      generoLabel AS genero,
      COUNT(*) AS total
    FROM cortesias_with_genero
    WHERE (${DELIVERED_FILTER}) AND canjeada
    GROUP BY category, recipient, genero
  `;
  const rows = await query<Record<string, unknown>>(sql, eventoParams(eventoId));

  const byCategory = new Map<string, FreesGeneroCategory>();
  const byCatRec = new Map<string, FreesGeneroRow>();

  function ensureCat(label: string): FreesGeneroCategory {
    let node = byCategory.get(label);
    if (!node) {
      node = {
        label,
        total: 0,
        hombres: 0,
        mujeres: 0,
        sinClasificar: 0,
        pctMujeres: 0,
        recipients: [],
      };
      byCategory.set(label, node);
    }
    return node;
  }

  function ensureRecipient(
    catNode: FreesGeneroCategory,
    catLabel: string,
    recLabel: string,
  ): FreesGeneroRow {
    const key = `${catLabel}::${recLabel}`;
    let rec = byCatRec.get(key);
    if (!rec) {
      rec = {
        label: recLabel,
        total: 0,
        hombres: 0,
        mujeres: 0,
        sinClasificar: 0,
        pctMujeres: 0,
      };
      byCatRec.set(key, rec);
      catNode.recipients.push(rec);
    }
    return rec;
  }

  let totalHombres = 0;
  let totalMujeres = 0;
  let totalSinClasificar = 0;

  for (const r of rows) {
    const category = s(r.category) || SIN_DATO;
    const recipient = s(r.recipient) || SIN_DATO;
    const genero = s(r.genero);
    const total = n(r.total);

    const catNode = ensureCat(category);
    const recNode = ensureRecipient(catNode, category, recipient);

    catNode.total += total;
    recNode.total += total;

    if (genero === "Hombre") {
      catNode.hombres += total;
      recNode.hombres += total;
      totalHombres += total;
    } else if (genero === "Mujer") {
      catNode.mujeres += total;
      recNode.mujeres += total;
      totalMujeres += total;
    } else {
      catNode.sinClasificar += total;
      recNode.sinClasificar += total;
      totalSinClasificar += total;
    }
  }

  const result = Array.from(byCategory.values());
  for (const cat of result) {
    const denomCat = cat.hombres + cat.mujeres;
    cat.pctMujeres = denomCat ? cat.mujeres / denomCat : 0;
    for (const rec of cat.recipients) {
      const denomRec = rec.hombres + rec.mujeres;
      rec.pctMujeres = denomRec ? rec.mujeres / denomRec : 0;
    }
    cat.recipients.sort((a, b) => b.total - a.total);
  }
  result.sort((a, b) => b.total - a.total);

  const totalClasificable = totalHombres + totalMujeres;
  const totalAll = totalClasificable + totalSinClasificar;
  const kpis: FreesGeneroKpis = {
    totalHombres,
    totalMujeres,
    totalSinClasificar,
    pctClasificable: totalAll ? totalClasificable / totalAll : 0,
    pctMujeres: totalClasificable ? totalMujeres / totalClasificable : 0,
  };

  return { kpis, byCategory: result };
}

async function fetchIngresoRows(
  eventoId?: string,
): Promise<FreesIngresoRow[]> {
  const sql = `
    ${JOIN_CTE}
    SELECT
      COALESCE(NULLIF(category, ''),  '${SIN_DATO}') AS category,
      COALESCE(NULLIF(recipient, ''), '${SIN_DATO}') AS recipient,
      generoLabel AS genero,
      DATE_DIFF(EXTRACT(DATE FROM horaQuemado), DATE '1970-01-01', DAY) * 86400
        + EXTRACT(HOUR FROM horaQuemado) * 3600
        + EXTRACT(MINUTE FROM horaQuemado) * 60 AS tsSeconds
    FROM cortesias_with_genero
    WHERE ${DELIVERED_FILTER}
      AND horaQuemado IS NOT NULL
      AND EXTRACT(YEAR FROM horaQuemado) BETWEEN 2020 AND 2100
  `;
  const rows = await query<Record<string, unknown>>(sql, eventoParams(eventoId));
  return rows.map((r) => {
    const gen = s(r.genero);
    const genero: FreesIngresoRow["genero"] =
      gen === "Hombre" || gen === "Mujer" ? gen : "Sin clasificar";
    return {
      category: s(r.category) || SIN_DATO,
      recipient: s(r.recipient) || SIN_DATO,
      genero,
      tsSeconds: n(r.tsSeconds),
    };
  });
}

export async function getFreesDashboardData(
  eventoId?: string,
): Promise<FreesDashboardData> {
  const [kpis, byTicketType, byLinkType, byCategory, byGenero, ingresoRows] =
    await Promise.all([
      fetchKpis(eventoId),
      fetchGroup("ticketType", eventoId),
      fetchGroup("linkType", eventoId),
      fetchCategoryTree(eventoId),
      fetchGeneroTree(eventoId),
      fetchIngresoRows(eventoId),
    ]);

  return { kpis, byTicketType, byLinkType, byCategory, byGenero, ingresoRows };
}

export async function getFreesEventList(): Promise<FreesEventOption[]> {
  const sql = `
    SELECT
      c.externalId                       AS evento_id,
      ANY_VALUE(ce.NombreGlovox)         AS nombre,
      COUNT(*)                           AS total_cortesias
    FROM ${CORTESIAS} c
    LEFT JOIN ${CATEGORY} ce
      ON ce.EventoID = c.externalId
    WHERE c.externalId IS NOT NULL AND c.externalId != ''
    GROUP BY c.externalId
    ORDER BY total_cortesias DESC
  `;
  const rows = await query<Record<string, unknown>>(sql);
  return rows.map((r) => {
    const eventoId = s(r.evento_id);
    const nombre = s(r.nombre);
    return {
      eventoId,
      nombre: nombre || eventoId,
      totalCortesias: n(r.total_cortesias),
    };
  });
}
