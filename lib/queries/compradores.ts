/**
 * Queries del dashboard COMPRADORES (`/marketing/compradores`).
 *
 * Objetivo: exportar la lista de contacto de los ASISTENTES (nombre, email y
 * teléfono NOMINADO de `glovox.tickets`) por evento y por tipo (venta /
 * cortesía), más métricas de cobertura para saber qué tan completa viene esa
 * data por evento.
 *
 * Semántica de columnas de `glovox.tickets` (ver glovox_tickets.sql en
 * data-governance): `Nombres` / `Email` / `Telefono` = COMPRADOR;
 * `*Nominado` = ASISTENTE. Este dashboard trabaja sobre el asistente; el
 * comprador va solo como respaldo en el modo "por ticket".
 *
 * Clase de ticket: ESPEJO del CASE de `TICKET_TYPE_FILTER` (marketing.ts) y de
 * `CLASE_CASE` (curvas.ts). "Ventas" = VENTA + PASE TEMPORADA; "Cortesías" =
 * CORTESIA + MESA VIP (ambas entran por `MedioPago = 'Otro'`). Los devueltos
 * (`EsDevuelto`) quedan siempre fuera: no son asistentes.
 *
 * Todo SQL con parámetros nombrados; el único texto interpolado son constantes
 * de código (CASE de clase, fragmentos `AND ...` sin valores).
 *
 * Los tipos de filtros, columnas y formato viven en `lib/compradores/filtros.ts`
 * (client-safe); acá solo lo que toca BigQuery.
 */
import { Readable, Transform } from "node:stream";
import { getBigQueryClient, query } from "@/lib/bigquery";
import { countryTicketeraFilter, type DataScope } from "@/lib/scopes";
import {
  exportColumns,
  formatCell,
  type CompradoresEventOption,
  type CompradoresFilters,
  type CompradoresModo,
  type ExportRow,
} from "@/lib/compradores/filtros";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;

// ---------- Helpers de parseo de filas ----------

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

// ---------- Clase de ticket ----------

/** Espejo del CASE de marketing.ts / curvas.ts (alias `t`). */
const CLASE_CASE = `
  CASE
    WHEN t.MedioPago = 'Otro' AND (LOWER(t.TipoTicket) LIKE '%pase%' OR LOWER(t.TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
    WHEN t.MedioPago = 'Otro' AND LOWER(t.TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
    WHEN t.MedioPago = 'Otro' THEN 'CORTESIA'
    ELSE 'VENTA'
  END`;

// ---------- Fuente de los datos de contacto ----------

/**
 * Expresiones SQL (constantes de código, no input) de cada fuente.
 * NOMINADO = el asistente del ticket; COMPRADOR = quien pagó la orden.
 * `t.Telefono` (comprador) hoy solo lo trae FeverUp: PuntoTicket y TeleTicket
 * no lo entregan (ver glovox_tickets.sql en data-governance).
 */
const FUENTE = {
  nominados: {
    nombre: "NULLIF(TRIM(t.NombreNominado), '')",
    email: "NULLIF(LOWER(TRIM(t.EmailNominado)), '')",
    telefono: "NULLIF(TRIM(t.TelefonoNominado), '')",
  },
  compradores: {
    nombre: "NULLIF(TRIM(t.Nombres), '')",
    email: "NULLIF(LOWER(TRIM(t.Email)), '')",
    telefono: "NULLIF(TRIM(t.Telefono), '')",
  },
} as const;

// ---------- CTEs base ----------

type SqlPart = { sql: string; params: Record<string, unknown> };

/**
 * `ev` (catálogo dedup por EventoID — categoriaEvento tiene duplicados, ej.
 * GLO042 ×6) + `base` (tickets no devueltos con la clase y los contactos
 * normalizados) + `filtrado` (tipo / contacto). Todo lo demás consulta
 * `filtrado`.
 */
function baseCtes(filters: CompradoresFilters, scope: DataScope | undefined): SqlPart {
  const t = countryTicketeraFilter(scope, "t.");
  // `*_contacto` = la fuente elegida en el toggle; `*_otro` = la otra (solo
  // se exporta en el modo por ticket, como respaldo).
  const c = FUENTE[filters.datos];
  const o = FUENTE[filters.datos === "compradores" ? "nominados" : "compradores"];
  const params: Record<string, unknown> = { ...t.params };
  const condsBase: string[] = ["t.EsDevuelto IS NOT TRUE"];
  if (t.sql) condsBase.push(t.sql.replace(/^\s*AND\s+/, ""));
  if (filters.eventos.length > 0) {
    condsBase.push("t.EventoID IN UNNEST(@eventos)");
    params.eventos = filters.eventos;
  }
  if (filters.categorias.length > 0) {
    condsBase.push("ev.categoria IN UNNEST(@categorias)");
    params.categorias = filters.categorias;
  }

  const condsFiltro: string[] = ["TRUE"];
  if (filters.tipo === "ventas") condsFiltro.push("clase IN ('VENTA', 'PASE TEMPORADA')");
  if (filters.tipo === "cortesias") condsFiltro.push("clase IN ('CORTESIA', 'MESA VIP')");
  if (filters.contacto === "email") condsFiltro.push("email_contacto IS NOT NULL");
  if (filters.contacto === "telefono") condsFiltro.push("telefono_contacto IS NOT NULL");

  const sql = `
    WITH ev AS (
      SELECT
        EventoID,
        ANY_VALUE(NombreGlovox)    AS nombre,
        ANY_VALUE(CategoriaEvento) AS categoria,
        ANY_VALUE(Fecha)           AS fecha
      FROM ${CATEGORY}
      WHERE EventoID IS NOT NULL
      GROUP BY EventoID
    ),
    base AS (
      SELECT
        t.Ticketera                                              AS ticketera,
        t.EventoID                                               AS evento_id,
        COALESCE(ev.nombre, t.Evento, t.EventoID)                AS evento_nombre,
        ev.categoria                                             AS categoria_evento,
        FORMAT_DATE('%Y-%m-%d', COALESCE(ev.fecha, DATE(t.FechaEvento))) AS fecha_evento,
        t.FechaOrden                                             AS fecha_orden,
        ${CLASE_CASE}                                            AS clase,
        t.TipoTicket                                             AS tipo_ticket,
        t.CategoriaTicket                                        AS categoria_ticket,
        t.OrdenID                                                AS orden_id,
        t.Item                                                   AS item,
        IFNULL(t.PersonasPorTicket, 1)                           AS personas,
        IFNULL(t.EsQuemado, FALSE)                               AS asistio,
        ${c.nombre}                                              AS nombre_contacto,
        ${c.email}                                               AS email_contacto,
        ${c.telefono}                                            AS telefono_contacto,
        ${o.nombre}                                              AS nombre_otro,
        ${o.email}                                               AS email_otro
      FROM ${TICKETS} t
      LEFT JOIN ev ON ev.EventoID = t.EventoID
      WHERE ${condsBase.join("\n        AND ")}
    ),
    filtrado AS (
      SELECT * FROM base
      WHERE ${condsFiltro.join("\n        AND ")}
    )
  `;
  return { sql, params };
}

// ---------- Eventos disponibles ----------

/**
 * Eventos con al menos un ticket no devuelto (dentro del scope de país), con
 * nombre y categoría del catálogo. Incluye eventos que no están en
 * categoriaEvento (nombre = `tickets.Evento`); excluye los cancelados.
 */
export async function getCompradoresEventOptions(
  scope?: DataScope,
): Promise<CompradoresEventOption[]> {
  const t = countryTicketeraFilter(scope, "t.");
  const rows = await query<Record<string, unknown>>(
    `
    WITH cat AS (
      SELECT
        EventoID,
        ANY_VALUE(NombreGlovox)    AS nombre,
        ANY_VALUE(CategoriaEvento) AS categoria,
        ANY_VALUE(Fecha)           AS fecha,
        LOGICAL_OR(IFNULL(isCanceled, FALSE)) AS cancelado
      FROM ${CATEGORY}
      WHERE EventoID IS NOT NULL
      GROUP BY EventoID
    ),
    tk AS (
      SELECT
        t.EventoID,
        ANY_VALUE(t.Evento)   AS evento,
        MAX(t.FechaEvento)    AS fecha_evento,
        COUNT(*)              AS tickets
      FROM ${TICKETS} t
      WHERE t.EsDevuelto IS NOT TRUE AND t.EventoID IS NOT NULL${t.sql}
      GROUP BY t.EventoID
    )
    SELECT
      tk.EventoID                                   AS evento_id,
      COALESCE(cat.nombre, tk.evento, tk.EventoID)  AS nombre,
      IFNULL(cat.categoria, '')                     AS categoria,
      FORMAT_DATE('%Y-%m-%d', COALESCE(cat.fecha, DATE(tk.fecha_evento))) AS fecha,
      tk.tickets                                    AS tickets
    FROM tk
    LEFT JOIN cat ON cat.EventoID = tk.EventoID
    WHERE cat.EventoID IS NULL OR cat.cancelado IS NOT TRUE
    ORDER BY fecha DESC NULLS LAST, tickets DESC
    `,
    t.params,
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoria: s(r.categoria),
    fecha: s(r.fecha),
    tickets: n(r.tickets),
  }));
}

/**
 * Evento por defecto cuando la URL no trae selección: el próximo por fecha
 * (>= hoy); si no hay, el último realizado. `hoy` en ISO (hora Santiago).
 */
export function eventoPorDefecto(
  events: CompradoresEventOption[],
  hoy: string,
): string | null {
  const proximos = events
    .filter((e) => e.fecha && e.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (proximos[0]) return proximos[0].eventoId;
  const pasados = events
    .filter((e) => e.fecha && e.fecha < hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return pasados[0]?.eventoId ?? events[0]?.eventoId ?? null;
}

// ---------- Métricas ----------

export type CompradoresKpis = {
  tickets: number;
  personas: number;
  ventas: number;
  cortesias: number;
  conNombre: number;
  conEmail: number;
  conTelefono: number;
  emailsUnicos: number;
  telefonosUnicos: number;
  /** Contactos distintos: email; si no hay email, teléfono. */
  contactosUnicos: number;
  /** Tickets sin email ni teléfono de la fuente elegida. */
  sinContacto: number;
  /** Tickets con nombre pero sin email ni teléfono (fuente elegida): en modo persona
   *  van una fila por ticket (hay a quién nombrar, no a quién escribir). */
  soloNombre: number;
  asistieron: number;
  eventos: number;
};

export type CompradoresEventoRow = {
  eventoId: string;
  nombre: string;
  fecha: string;
  ticketera: string;
  tickets: number;
  ventas: number;
  cortesias: number;
  conEmail: number;
  conTelefono: number;
  emailsUnicos: number;
};

export type CompradoresClaseRow = {
  clase: string;
  tickets: number;
  personas: number;
  conEmail: number;
  conTelefono: number;
};

export type CompradoresResumen = {
  kpis: CompradoresKpis;
  porEvento: CompradoresEventoRow[];
  porClase: CompradoresClaseRow[];
};

/**
 * Filas que tendrá el CSV con los filtros dados (según el modo). En modo
 *  persona quedan fuera los tickets sin NINGÚN dato de contacto (típicamente
 * cortesías sin canjear): no hay a quién contactar.
 */
export function filasExport(kpis: CompradoresKpis, modo: CompradoresModo): number {
  return modo === "ticket" ? kpis.tickets : kpis.contactosUnicos + kpis.soloNombre;
}

export async function getCompradoresResumen(
  filters: CompradoresFilters,
  scope?: DataScope,
): Promise<CompradoresResumen> {
  const base = baseCtes(filters, scope);

  const kpisSql = `
    ${base.sql}
    SELECT
      COUNT(*)                                                     AS tickets,
      IFNULL(SUM(personas), 0)                                     AS personas,
      COUNTIF(clase IN ('VENTA', 'PASE TEMPORADA'))                AS ventas,
      COUNTIF(clase IN ('CORTESIA', 'MESA VIP'))                   AS cortesias,
      COUNTIF(nombre_contacto IS NOT NULL)                         AS con_nombre,
      COUNTIF(email_contacto IS NOT NULL)                          AS con_email,
      COUNTIF(telefono_contacto IS NOT NULL)                       AS con_telefono,
      COUNT(DISTINCT email_contacto)                               AS emails_unicos,
      COUNT(DISTINCT telefono_contacto)                            AS telefonos_unicos,
      COUNT(DISTINCT COALESCE(email_contacto, CONCAT('tel:', telefono_contacto))) AS contactos_unicos,
      COUNTIF(email_contacto IS NULL AND telefono_contacto IS NULL) AS sin_contacto,
      COUNTIF(email_contacto IS NULL AND telefono_contacto IS NULL AND nombre_contacto IS NOT NULL) AS solo_nombre,
      COUNTIF(asistio)                                             AS asistieron,
      COUNT(DISTINCT evento_id)                                    AS eventos
    FROM filtrado
  `;

  const eventoSql = `
    ${base.sql}
    SELECT
      evento_id,
      ANY_VALUE(evento_nombre)                        AS nombre,
      ANY_VALUE(fecha_evento)                         AS fecha,
      ANY_VALUE(ticketera)                            AS ticketera,
      COUNT(*)                                        AS tickets,
      COUNTIF(clase IN ('VENTA', 'PASE TEMPORADA'))   AS ventas,
      COUNTIF(clase IN ('CORTESIA', 'MESA VIP'))      AS cortesias,
      COUNTIF(email_contacto IS NOT NULL)             AS con_email,
      COUNTIF(telefono_contacto IS NOT NULL)          AS con_telefono,
      COUNT(DISTINCT email_contacto)                  AS emails_unicos
    FROM filtrado
    GROUP BY evento_id
    ORDER BY fecha DESC NULLS LAST, tickets DESC
    LIMIT 300
  `;

  const claseSql = `
    ${base.sql}
    SELECT
      clase,
      COUNT(*)                                AS tickets,
      IFNULL(SUM(personas), 0)                AS personas,
      COUNTIF(email_contacto IS NOT NULL)     AS con_email,
      COUNTIF(telefono_contacto IS NOT NULL)  AS con_telefono
    FROM filtrado
    GROUP BY clase
    ORDER BY tickets DESC
  `;

  const [kpiRows, eventoRows, claseRows] = await Promise.all([
    query<Record<string, unknown>>(kpisSql, base.params),
    query<Record<string, unknown>>(eventoSql, base.params),
    query<Record<string, unknown>>(claseSql, base.params),
  ]);

  const k = kpiRows[0] ?? {};
  return {
    kpis: {
      tickets: n(k.tickets),
      personas: n(k.personas),
      ventas: n(k.ventas),
      cortesias: n(k.cortesias),
      conNombre: n(k.con_nombre),
      conEmail: n(k.con_email),
      conTelefono: n(k.con_telefono),
      emailsUnicos: n(k.emails_unicos),
      telefonosUnicos: n(k.telefonos_unicos),
      contactosUnicos: n(k.contactos_unicos),
      sinContacto: n(k.sin_contacto),
      soloNombre: n(k.solo_nombre),
      asistieron: n(k.asistieron),
      eventos: n(k.eventos),
    },
    porEvento: eventoRows.map((r) => ({
      eventoId: s(r.evento_id),
      nombre: s(r.nombre),
      fecha: s(r.fecha),
      ticketera: s(r.ticketera),
      tickets: n(r.tickets),
      ventas: n(r.ventas),
      cortesias: n(r.cortesias),
      conEmail: n(r.con_email),
      conTelefono: n(r.con_telefono),
      emailsUnicos: n(r.emails_unicos),
    })),
    porClase: claseRows.map((r) => ({
      clase: s(r.clase),
      tickets: n(r.tickets),
      personas: n(r.personas),
      conEmail: n(r.con_email),
      conTelefono: n(r.con_telefono),
    })),
  };
}

// ---------- Export (vista previa + CSV) ----------

/**
 * SQL del export. Mismo SELECT para la vista previa (con LIMIT) y el CSV
 * completo (sin LIMIT), así lo que se ve es exactamente lo que se descarga.
 * La columna `grupo` se deriva de `clase` en TS (`formatCell`), por eso el
 * SQL la devuelve como alias de `clase`.
 */
function exportSql(
  filters: CompradoresFilters,
  scope: DataScope | undefined,
  limit?: number,
): SqlPart {
  const base = baseCtes(filters, scope);
  const params: Record<string, unknown> = { ...base.params };
  const limitSql = limit != null ? "LIMIT @limit" : "";
  if (limit != null) params.limit = limit;

  if (filters.modo === "ticket") {
    return {
      params,
      sql: `
        ${base.sql}
        SELECT
          nombre_contacto,
          email_contacto,
          telefono_contacto,
          evento_id,
          evento_nombre,
          fecha_evento,
          clase AS grupo,
          clase,
          tipo_ticket,
          categoria_ticket,
          FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', fecha_orden) AS fecha_compra,
          personas,
          asistio,
          ticketera,
          CAST(orden_id AS STRING) AS orden,
          nombre_otro,
          email_otro
        FROM filtrado
        ORDER BY fecha_orden DESC, orden_id, item
        ${limitSql}
      `,
    };
  }

  // Modo persona: una fila por contacto (de la fuente elegida: nominado o
  // comprador). Clave = email; si no hay, teléfono; si solo hay nombre, cada
  // ticket es su propia fila (uuid). Los tickets sin ningún dato de contacto
  // (cortesías sin canjear, eventos no nominales) quedan fuera: no hay a quién
  // contactar. Los datos de contacto salen del ticket
  // más completo (con nombre y teléfono), y el "último evento / última
  // compra" del ticket más reciente.
  return {
    params,
    sql: `
      ${base.sql},
      keyed AS (
        SELECT
          *,
          COALESCE(email_contacto, CONCAT('tel:', telefono_contacto), GENERATE_UUID()) AS persona_key
        FROM filtrado
        WHERE nombre_contacto IS NOT NULL
          OR email_contacto IS NOT NULL
          OR telefono_contacto IS NOT NULL
      ),
      agg AS (
        SELECT
          persona_key,
          ARRAY_AGG(
            STRUCT(nombre_contacto, email_contacto, telefono_contacto)
            ORDER BY nombre_contacto IS NULL, telefono_contacto IS NULL, fecha_orden DESC
            LIMIT 1
          )[OFFSET(0)] AS contacto,
          ARRAY_AGG(
            STRUCT(evento_nombre, fecha_evento, fecha_orden, clase)
            ORDER BY fecha_orden DESC
            LIMIT 1
          )[OFFSET(0)] AS ult,
          COUNT(*)                                     AS tickets,
          SUM(personas)                                AS personas,
          COUNT(DISTINCT evento_id)                    AS eventos,
          STRING_AGG(DISTINCT evento_id, ', ' ORDER BY evento_id) AS eventos_lista,
          LOGICAL_OR(asistio)                          AS asistio
        FROM keyed
        GROUP BY persona_key
      )
      SELECT
        contacto.nombre_contacto                                   AS nombre_contacto,
        contacto.email_contacto                                    AS email_contacto,
        contacto.telefono_contacto                                 AS telefono_contacto,
        tickets,
        personas,
        eventos,
        eventos_lista,
        ult.evento_nombre                                          AS ultimo_evento,
        ult.fecha_evento                                           AS ultima_fecha_evento,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', ult.fecha_orden)        AS ultima_compra,
        ult.clase                                                  AS grupo,
        ult.clase                                                  AS clase,
        asistio
      FROM agg
      ORDER BY ult.fecha_orden DESC, email_contacto
      ${limitSql}
    `,
  };
}

/** Primeras `limit` filas del export (vista previa en la página). */
export async function getCompradoresPreview(
  filters: CompradoresFilters,
  scope: DataScope | undefined,
  limit = 50,
): Promise<ExportRow[]> {
  const { sql, params } = exportSql(filters, scope, limit);
  const rows = await query<Record<string, unknown>>(sql, params);
  return rows.map((r) => {
    const out: ExportRow = {};
    for (const [k, v] of Object.entries(r)) {
      if (v == null) out[k] = null;
      else if (typeof v === "boolean" || typeof v === "number") out[k] = v;
      else out[k] = s(v);
    }
    return out;
  });
}

// ---------- CSV streaming ----------

const CSV_BOM = "﻿";
const CRLF = "\r\n";

/** Celda siempre entre comillas (cubre comas, saltos de línea y comillas). */
function escapeCsv(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Stream web del CSV completo. Lee BigQuery fila a fila (`createQueryStream`)
 * y lo transforma con backpressure, así un export de cientos de miles de
 * filas no se carga entero en memoria. BOM UTF-8 + CRLF para que Excel abra
 * bien los acentos. El encabezado se escribe aunque no haya filas.
 */
export function createCompradoresCsvStream(
  filters: CompradoresFilters,
  scope?: DataScope,
): ReadableStream<Uint8Array> {
  const cols = exportColumns(filters.modo, filters.datos);
  const { sql, params } = exportSql(filters, scope);
  const header = CSV_BOM + cols.map((c) => escapeCsv(c.header)).join(",") + CRLF;

  const bq = getBigQueryClient();
  const rowStream = bq.createQueryStream({ query: sql, params });

  let wroteHeader = false;
  const toCsv = new Transform({
    writableObjectMode: true,
    transform(row: Record<string, unknown>, _enc, cb) {
      let out = "";
      if (!wroteHeader) {
        out += header;
        wroteHeader = true;
      }
      out += cols.map((c) => escapeCsv(formatCell(c, row[c.key]))).join(",") + CRLF;
      cb(null, out);
    },
    flush(cb) {
      if (!wroteHeader) {
        this.push(header);
        wroteHeader = true;
      }
      cb();
    },
  });

  // `pipe` no propaga errores: si BigQuery falla, cortamos el CSV con error
  // para que el navegador no guarde un archivo truncado como si estuviera bien.
  rowStream.on("error", (err) => toCsv.destroy(err));
  const nodeStream = rowStream.pipe(toCsv);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
}
