import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const CORTESIAS = `\`${P}.glovox.cortesias\``;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;
const NOMBRES = `\`${P}.glovox.nombres_genero\``;
const CELEBRITIES = `\`${P}.glovox_inputs.input_celebrities\``;
const CELEB_ASISTENCIA = `\`${P}.marts.celebrities_asistencia\``;

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

export type FreesCelebEstado = "asistio" | "con_ticket" | "sin_ticket";

export type FreesCelebRow = {
  mail: string;
  rut: string;
  evento: string;
  tipoTicket: string;
  estado: FreesCelebEstado;
  horaLlegada: string | null;
  tsSeconds: number | null;
};

export type FreesCelebEvolutionRow = {
  eventoId: string;
  evento: string;
  /** ISO yyyy-mm-dd; null si el evento no tiene fecha ni llegadas registradas. */
  fecha: string | null;
  conTicket: number;
  asistieron: number;
};

export type FreesCelebData = {
  enLista: number;
  rows: FreesCelebRow[];
  /** Solo se calcula en la vista global (sin filtro de evento); con evento va vacío. */
  evolucion: FreesCelebEvolutionRow[];
};

export type FreesDashboardData = {
  kpis: FreesKpis;
  byTicketType: FreesGroupRow[];
  byLinkType: FreesGroupRow[];
  byCategory: FreesCategoryNode[];
  byGenero: FreesGeneroData;
  ingresoRows: FreesIngresoRow[];
  celebrities: FreesCelebData;
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

/**
 * Grupo Celebrities: lista curada en glovox_inputs.input_celebrities cruzada
 * contra glovox.tickets por RUT nominado (vista marts.celebrities_asistencia).
 *
 * Con evento seleccionado: universo completo de la lista (LEFT JOIN), así se
 * ve quién quedó sin ticket. Sin evento: solo filas con ticket, una por
 * celebrity×evento, con el nombre del evento como etiqueta.
 */
async function fetchCelebrities(eventoId?: string): Promise<FreesCelebData> {
  const TS_SECONDS = `
    DATE_DIFF(EXTRACT(DATE FROM v.hora_llegada), DATE '1970-01-01', DAY) * 86400
      + EXTRACT(HOUR FROM v.hora_llegada) * 3600
      + EXTRACT(MINUTE FROM v.hora_llegada) * 60
  `;

  const sql = eventoId
    ? `
      SELECT
        c.mail,
        c.rut,
        '' AS evento,
        v.tipo_ticket AS tipoTicket,
        CASE
          WHEN v.rut_norm IS NULL THEN 'sin_ticket'
          WHEN v.asistio THEN 'asistio'
          ELSE 'con_ticket'
        END AS estado,
        FORMAT_DATETIME('%H:%M', v.hora_llegada) AS horaLlegada,
        IF(v.hora_llegada IS NULL, NULL, ${TS_SECONDS}) AS tsSeconds
      FROM ${CELEBRITIES} c
      LEFT JOIN ${CELEB_ASISTENCIA} v
        ON v.rut_norm = c.rut_norm AND v.evento_id = @eventoId
      ORDER BY estado = 'asistio' DESC, v.hora_llegada ASC, c.mail
    `
    : `
      SELECT
        v.mail,
        v.rut,
        COALESCE(ce.NombreGlovox, v.evento_id) AS evento,
        v.tipo_ticket AS tipoTicket,
        IF(v.asistio, 'asistio', 'con_ticket') AS estado,
        FORMAT_DATETIME('%H:%M', v.hora_llegada) AS horaLlegada,
        IF(v.hora_llegada IS NULL, NULL, ${TS_SECONDS}) AS tsSeconds
      FROM ${CELEB_ASISTENCIA} v
      LEFT JOIN ${CATEGORY} ce ON ce.EventoID = v.evento_id
      ORDER BY v.asistio DESC, v.hora_llegada DESC, v.mail
    `;

  // Evolución global: una fila por evento con celebrities distintas con ticket
  // y asistentes. Fecha primaria de categoriaEvento (muchos eventos no la
  // tienen); fallback a la fecha de la primera llegada registrada — solo queda
  // NULL en eventos sin fecha y sin ninguna asistencia.
  const evolucionSql = `
    SELECT
      v.evento_id AS eventoId,
      COALESCE(ANY_VALUE(ce.NombreGlovox), ANY_VALUE(v.evento_nombre), v.evento_id) AS evento,
      CAST(COALESCE(ANY_VALUE(ce.Fecha), MIN(DATE(v.hora_llegada))) AS STRING) AS fecha,
      COUNT(DISTINCT v.rut_norm) AS conTicket,
      COUNT(DISTINCT IF(v.asistio, v.rut_norm, NULL)) AS asistieron
    FROM ${CELEB_ASISTENCIA} v
    LEFT JOIN ${CATEGORY} ce ON ce.EventoID = v.evento_id
    GROUP BY v.evento_id
    ORDER BY fecha NULLS LAST, eventoId
  `;

  const [rows, countRows, evolucionRows] = await Promise.all([
    query<Record<string, unknown>>(
      sql,
      eventoId ? { eventoId } : undefined,
    ),
    query<Record<string, unknown>>(
      `SELECT COUNT(*) AS enLista FROM ${CELEBRITIES}`,
    ),
    eventoId
      ? Promise.resolve([] as Record<string, unknown>[])
      : query<Record<string, unknown>>(evolucionSql),
  ]);

  return {
    enLista: n(countRows[0]?.enLista),
    evolucion: evolucionRows.map((r) => ({
      eventoId: s(r.eventoId),
      evento: s(r.evento) || s(r.eventoId),
      fecha: r.fecha == null ? null : s(r.fecha),
      conTicket: n(r.conTicket),
      asistieron: n(r.asistieron),
    })),
    rows: rows.map((r) => {
      const estado = s(r.estado) as FreesCelebEstado;
      return {
        mail: s(r.mail),
        rut: s(r.rut),
        evento: s(r.evento),
        tipoTicket: s(r.tipoTicket),
        estado,
        horaLlegada: r.horaLlegada == null ? null : s(r.horaLlegada),
        tsSeconds: r.tsSeconds == null ? null : n(r.tsSeconds),
      };
    }),
  };
}

export async function getFreesDashboardData(
  eventoId?: string,
): Promise<FreesDashboardData> {
  const [
    kpis,
    byTicketType,
    byLinkType,
    byCategory,
    byGenero,
    ingresoRows,
    celebrities,
  ] = await Promise.all([
    fetchKpis(eventoId),
    fetchGroup("ticketType", eventoId),
    fetchGroup("linkType", eventoId),
    fetchCategoryTree(eventoId),
    fetchGeneroTree(eventoId),
    fetchIngresoRows(eventoId),
    fetchCelebrities(eventoId),
  ]);

  return {
    kpis,
    byTicketType,
    byLinkType,
    byCategory,
    byGenero,
    ingresoRows,
    celebrities,
  };
}

export async function getFreesEventList(): Promise<FreesEventOption[]> {
  // Orden: fecha del evento descendente (el más reciente primero). Fuente
  // primaria categoriaEvento.Fecha; fallback a la FechaEvento de los tickets
  // (18 de ~43 eventos no tienen Fecha en categoriaEvento). Sin fecha → al final.
  // Las fechas de tickets se pre-agregan aparte para no inflar el COUNT de
  // cortesías con el fan-out del join.
  const sql = `
    WITH fechas_tickets AS (
      SELECT EventoID, DATE(MAX(FechaEvento)) AS fecha
      FROM ${TICKETS}
      GROUP BY EventoID
    )
    SELECT
      c.externalId                       AS evento_id,
      ANY_VALUE(ce.NombreGlovox)         AS nombre,
      COUNT(*)                           AS total_cortesias,
      COALESCE(
        ANY_VALUE(ce.Fecha),
        ANY_VALUE(ft.fecha)
      )                                  AS fecha_evento
    FROM ${CORTESIAS} c
    LEFT JOIN ${CATEGORY} ce
      ON ce.EventoID = c.externalId
    LEFT JOIN fechas_tickets ft
      ON ft.EventoID = c.externalId
    WHERE c.externalId IS NOT NULL AND c.externalId != ''
    GROUP BY c.externalId
    ORDER BY fecha_evento DESC NULLS LAST, total_cortesias DESC
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
