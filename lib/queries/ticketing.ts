import { query } from "@/lib/bigquery";
import type { Country } from "@/lib/queries/comunidad";
import { ETAPA_LABEL, type Etapa } from "@/lib/ticketing-pricing/formulas";

const P        = process.env.BIGQUERY_PROJECT_ID;
const TICKETS  = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;
const ADS      = `\`${P}.paidMedia.ads_performance\``;
const RRSS     = `\`${P}.marketing.rrss_fllws\``;
const VENUES   = `\`${P}.glovox.venues\``;
// Vista canónica tipo×etapa (etapa_norm estandarizada, ya sin devueltos):
//   venta = Precio - IFNULL(Descuento, 0). Misma fuente que el pricing.
const DEMAND   = `\`${P}.marts.ticketing_demand_by_stage\``;

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

export type ClaseVenta = "VENTA" | "CORTESIA" | "OTRO";

export type TicketingFilters = {
  eventoId?: string;
  categoriaEvento?: string;
  country: Country;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  clase?: ClaseVenta; // undefined = todas
  /** Por default los devueltos quedan fuera. */
  incluirDevueltos: boolean;
};

/**
 * Clasificación de cada ticket en VENTA / CORTESIA / OTRO.
 *  - OTRO     → MedioPago='Otro' + TipoTicket contiene 'pase' (accesos especiales)
 *  - CORTESIA → MedioPago='Otro' (entradas liberadas)
 *  - VENTA    → cualquier medio de pago real
 * Alineado con la lógica VENTA/CORTESIA del onepager, separando los pases.
 */
const CLASE_VENTA_CASE = `
  CASE
    WHEN a.MedioPago = 'Otro' AND LOWER(a.TipoTicket) LIKE '%pase%' THEN 'OTRO'
    WHEN a.MedioPago = 'Otro'                                       THEN 'CORTESIA'
    ELSE 'VENTA'
  END`;

const VIP_GRAL_CASE = `
  CASE
    WHEN UPPER(a.TipoTicket) LIKE '%VIP%'         OR
         UPPER(a.TipoTicket) LIKE '%BACKSTAGE%'   OR
         UPPER(a.TipoTicket) LIKE '%HOSPITALITY%' OR
         UPPER(a.TipoTicket) LIKE '%STANDING%'    THEN 'VIP'
    ELSE 'GENERAL'
  END`;

/**
 * Construye el CTE base `t` (una fila por ticket, ya clasificada) más el
 * objeto de params. Cada query consume `t` y agrega según su dimensión.
 */
function baseCte(filters: TicketingFilters): {
  cte: string;
  params: Record<string, unknown>;
} {
  const conds: string[] = ["1 = 1"];
  const params: Record<string, unknown> = {};

  if (filters.eventoId) {
    conds.push("a.EventoID = @eventoId");
    params.eventoId = filters.eventoId;
  }
  if (filters.categoriaEvento) {
    conds.push("b.CategoriaEvento = @categoriaEvento");
    params.categoriaEvento = filters.categoriaEvento;
  }
  // El país se deriva del prefijo de EventoID (GLO=Chile, GLP=Perú). Es un
  // literal fijo, no entrada de usuario → seguro de interpolar.
  if (filters.country === "chile") conds.push("a.EventoID LIKE 'GLO%'");
  if (filters.country === "peru") conds.push("a.EventoID LIKE 'GLP%'");

  if (filters.from) {
    conds.push("DATE(a.FechaEvento) >= DATE(@from)");
    params.from = filters.from;
  }
  if (filters.to) {
    conds.push("DATE(a.FechaEvento) <= DATE(@to)");
    params.to = filters.to;
  }
  if (!filters.incluirDevueltos) {
    conds.push("a.EsDevuelto IS NOT TRUE");
  }

  // El filtro de clase se aplica afuera porque depende del CASE calculado.
  const claseFilter = filters.clase ? "WHERE claseVenta = @clase" : "";
  if (filters.clase) params.clase = filters.clase;

  const cte = `
  WITH t AS (
    SELECT * FROM (
      SELECT
        a.EventoID                          AS eventoId,
        b.NombreGlovox                      AS nombre,
        b.CategoriaEvento                   AS categoriaEvento,
        a.FechaEvento                       AS fechaTs,
        a.TipoTicket                        AS tipoTicket,
        a.CategoriaTicket                   AS categoriaTicket,
        ${CLASE_VENTA_CASE}                 AS claseVenta,
        ${VIP_GRAL_CASE}                    AS vipGral,
        a.Precio - IFNULL(a.Descuento, 0)   AS venta
      FROM ${TICKETS} a
        LEFT JOIN ${CATEGORY} b ON a.EventoID = b.EventoID
      WHERE ${conds.join("\n        AND ")}
    )
    ${claseFilter}
  )`;

  return { cte, params };
}

// ---------- Types ----------

export type TicketingEventOption = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  fechaEvento: string;
};

export type TicketingKpis = {
  tickets: number;
  venta: number;
  ticketPromedio: number;
  eventos: number;
};

export type TicketingProductoRow = {
  label: string;
  venta: number;
  qtty: number;
};

export type TicketingVipGralRow = {
  vipGral: string;
  venta: number;
  qtty: number;
};

export type TicketingPrecioMatrizRow = {
  tipoTicket: string;
  categoriaTicket: string;
  qtty: number;
  venta: number;
};

export type TicketingEvolucionRow = {
  eventoId: string;
  nombre: string;
  fechaEvento: string;
  qtty: number;
  venta: number;
};

// ---------- Filter options ----------

/** Lista de eventos para poblar los selectores (independiente de los filtros). */
export async function getTicketingEventOptions(
  country: Country = "all",
): Promise<TicketingEventOption[]> {
  let countryCond = "";
  if (country === "chile") countryCond = "AND t.EventoID LIKE 'GLO%'";
  if (country === "peru") countryCond = "AND t.EventoID LIKE 'GLP%'";

  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID                                       AS evento_id,
      ANY_VALUE(c.NombreGlovox)                        AS nombre,
      ANY_VALUE(c.CategoriaEvento)                     AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento)) AS fecha_evento
    FROM ${CATEGORY} c
    LEFT JOIN ${TICKETS} t ON c.EventoID = t.EventoID ${countryCond}
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    HAVING fecha_evento IS NOT NULL
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId:        s(r.evento_id),
    nombre:          s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento:     s(r.fecha_evento),
  }));
}

// ---------- Aggregations ----------

export async function getTicketingKpis(
  filters: TicketingFilters,
): Promise<TicketingKpis> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      COUNT(*)                       AS tickets,
      SUM(venta)                     AS venta,
      COUNT(DISTINCT eventoId)       AS eventos
    FROM t
    `,
    params,
  );
  const r = rows[0] ?? {};
  const tickets = n(r.tickets);
  const venta = n(r.venta);
  return {
    tickets,
    venta,
    ticketPromedio: tickets > 0 ? venta / tickets : 0,
    eventos: n(r.eventos),
  };
}

export async function getTicketingByTipo(
  filters: TicketingFilters,
): Promise<TicketingProductoRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      IFNULL(tipoTicket, '—') AS label,
      SUM(venta)              AS venta,
      COUNT(*)                AS qtty
    FROM t
    GROUP BY label
    ORDER BY venta DESC
    `,
    params,
  );
  return rows.map((r) => ({
    label: s(r.label),
    venta: n(r.venta),
    qtty:  n(r.qtty),
  }));
}

export async function getTicketingByCategoria(
  filters: TicketingFilters,
): Promise<TicketingProductoRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      IFNULL(categoriaTicket, '—') AS label,
      SUM(venta)                   AS venta,
      COUNT(*)                     AS qtty
    FROM t
    GROUP BY label
    ORDER BY venta DESC
    `,
    params,
  );
  return rows.map((r) => ({
    label: s(r.label),
    venta: n(r.venta),
    qtty:  n(r.qtty),
  }));
}

export async function getTicketingByVipGral(
  filters: TicketingFilters,
): Promise<TicketingVipGralRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      vipGral    AS vip_gral,
      SUM(venta) AS venta,
      COUNT(*)   AS qtty
    FROM t
    GROUP BY vip_gral
    ORDER BY venta DESC
    `,
    params,
  );
  return rows.map((r) => ({
    vipGral: s(r.vip_gral),
    venta:   n(r.venta),
    qtty:    n(r.qtty),
  }));
}

/**
 * Cantidad y venta de tickets por cada cruce TipoTicket × CategoriaTicket.
 * Alimenta la matriz de precio promedio (venta / cantidad) por cruce.
 */
export async function getTicketingPrecioMatriz(
  filters: TicketingFilters,
): Promise<TicketingPrecioMatrizRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      IFNULL(tipoTicket, '—')       AS tipo_ticket,
      IFNULL(categoriaTicket, '—')  AS categoria_ticket,
      COUNT(*)                      AS qtty,
      SUM(venta)                    AS venta
    FROM t
    GROUP BY tipo_ticket, categoria_ticket
    ORDER BY tipo_ticket, categoria_ticket
    `,
    params,
  );
  return rows.map((r) => ({
    tipoTicket:      s(r.tipo_ticket),
    categoriaTicket: s(r.categoria_ticket),
    qtty:            n(r.qtty),
    venta:           n(r.venta),
  }));
}

/** Una fila por evento — para la evolución y comparación entre eventos. */
export async function getTicketingEvolucion(
  filters: TicketingFilters,
): Promise<TicketingEvolucionRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await query<Record<string, unknown>>(
    `
    ${cte}
    SELECT
      eventoId                                  AS evento_id,
      ANY_VALUE(nombre)                         AS nombre,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(fechaTs)) AS fecha_evento,
      COUNT(*)                                  AS qtty,
      SUM(venta)                                AS venta
    FROM t
    GROUP BY eventoId
    ORDER BY MAX(fechaTs) ASC
    `,
    params,
  );
  return rows.map((r) => ({
    eventoId:    s(r.evento_id),
    nombre:      s(r.nombre),
    fechaEvento: s(r.fecha_evento),
    qtty:        n(r.qtty),
    venta:       n(r.venta),
  }));
}

// ---------- Análisis global ----------

/**
 * Filtros del tab "Análisis global". País por prefijo de EventoID, más un
 * acotamiento opcional por una o más categorías de evento
 * (categoriaEvento.CategoriaEvento) y/o uno o más eventos. Vacíos = sin acotar.
 */
export type GlobalMatrizFilters = {
  country: Country;
  categoriaEventos?: string[];
  eventoIds?: string[];
  /** Familias de producto (producto de marts.ticketing_demand_by_stage) a
   *  incluir en la matriz. Vacío = todos. Solo aplica a la matriz de precio. */
  productos?: string[];
};

export type GlobalEventoRow = {
  eventoId: string;
  /** NombreGlovox de glovox.categoriaEvento (vacío si el evento no está mapeado). */
  nombre: string;
  /** Venue (recinto) de glovox.categoriaEvento; vacío si no está cargado. */
  venue: string;
  /** Inicio de venta = primera orden registrada del evento (MIN(FechaOrden)). */
  fechaInicioVenta: string;
  /** Fecha del evento (MIN(FechaEvento)). */
  fechaEvento: string;
  /** Días de campaña = días entre el inicio de venta y la fecha del evento. */
  diasCampania: number | null;
};

/** Días entre dos fechas ISO (YYYY-MM-DD); null si falta alguna. */
function diasEntre(desde: string, hasta: string): number | null {
  if (!desde || !hasta) return null;
  const ms = new Date(`${hasta}T00:00:00`).getTime() - new Date(`${desde}T00:00:00`).getTime();
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

/**
 * Vista general de todos los eventos: una fila por EventoID con su fecha de
 * inicio de venta (MIN(FechaOrden) en glovox.tickets). Filtra por país según el
 * prefijo del EventoID (GLO=Chile, GLP=Perú), igual que el resto del ticketing,
 * y opcionalmente por categoría de evento y/o un único evento.
 */
export async function getGlobalEventos(
  filters: GlobalMatrizFilters,
): Promise<GlobalEventoRow[]> {
  const conds: string[] = ["t.EventoID IS NOT NULL", "t.FechaOrden IS NOT NULL"];
  const params: Record<string, unknown> = {};
  if (filters.country === "chile") conds.push("t.EventoID LIKE 'GLO%'");
  if (filters.country === "peru") conds.push("t.EventoID LIKE 'GLP%'");
  if (filters.categoriaEventos?.length) {
    conds.push("c.CategoriaEvento IN UNNEST(@categoriaEventos)");
    params.categoriaEventos = filters.categoriaEventos;
  }
  if (filters.eventoIds?.length) {
    conds.push("t.EventoID IN UNNEST(@eventoIds)");
    params.eventoIds = filters.eventoIds;
  }
  const rows = await query<Record<string, unknown>>(
    `
    WITH cat AS (
      SELECT EventoID, NombreGlovox, venue, CategoriaEvento
      FROM ${CATEGORY}
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    )
    SELECT
      t.EventoID                                         AS evento_id,
      ANY_VALUE(c.NombreGlovox)                          AS nombre,
      ANY_VALUE(c.venue)                                 AS venue,
      FORMAT_TIMESTAMP('%Y-%m-%d', MIN(t.FechaOrden))    AS fecha_inicio_venta,
      FORMAT_TIMESTAMP('%Y-%m-%d', MIN(t.FechaEvento))   AS fecha_evento
    FROM ${TICKETS} t
    LEFT JOIN cat c ON c.EventoID = t.EventoID
    WHERE ${conds.join("\n      AND ")}
    GROUP BY t.EventoID
    ORDER BY fecha_inicio_venta DESC
  `,
    params,
  );
  return rows.map((r) => {
    const fechaInicioVenta = s(r.fecha_inicio_venta);
    const fechaEvento = s(r.fecha_evento);
    return {
      eventoId: s(r.evento_id),
      nombre: s(r.nombre),
      venue: s(r.venue),
      fechaInicioVenta,
      fechaEvento,
      diasCampania: diasEntre(fechaInicioVenta, fechaEvento),
    };
  });
}

// ---------- Matriz precio medio por etapa × evento ----------

/** Un evento (columna de la matriz). */
export type GlobalPrecioMatrizEvento = {
  eventoId: string;
  nombre: string;
  /** Fecha del evento (categoriaEvento.Fecha); "" si no está cargada. */
  fechaEvento: string;
};

/** Una etapa de venta (fila de la matriz). */
export type GlobalPrecioMatrizFila = {
  etapaNorm: string;
  etapaOrden: number;
  label: string;
  /** Precio medio (Precio − Descuento) por evento; clave = eventoId. Ausente si
   *  el evento no tuvo ventas en esa etapa. */
  precios: Record<string, number>;
  /** Promedio simple de los eventos con dato en esta etapa (sin ponderar por
   *  volumen): "precio promedio total de los eventos" de la fila. */
  promedio: number;
  /** Menor precio medio entre los eventos con dato en esta etapa. */
  minimo: number;
  /** Mayor precio medio entre los eventos con dato en esta etapa. */
  maximo: number;
};

export type GlobalPrecioMatriz = {
  eventos: GlobalPrecioMatrizEvento[];
  filas: GlobalPrecioMatrizFila[];
};

/**
 * Matriz de precio medio: filas = etapa de venta canónica (etapa_norm de
 * marts.ticketing_demand_by_stage, el mismo eje del pricing), columnas =
 * eventos. En cada cruce, el precio medio = SUM(Precio − Descuento) / nº tickets
 * de esa etapa en ese evento. La última columna ("promedio") es el promedio
 * simple de los eventos con dato en la fila. Devueltos ya excluidos por la
 * vista. Acota por país, una o más categorías de evento y/o uno o más eventos.
 */
export async function getGlobalPrecioMatriz(
  filters: GlobalMatrizFilters,
): Promise<GlobalPrecioMatriz> {
  const conds: string[] = ["d.etapa_norm IS NOT NULL"];
  const params: Record<string, unknown> = {};
  if (filters.country === "chile") conds.push("d.evento_id LIKE 'GLO%'");
  if (filters.country === "peru") conds.push("d.evento_id LIKE 'GLP%'");
  if (filters.categoriaEventos?.length) {
    conds.push("d.categoria_evento IN UNNEST(@categoriaEventos)");
    params.categoriaEventos = filters.categoriaEventos;
  }
  if (filters.eventoIds?.length) {
    conds.push("d.evento_id IN UNNEST(@eventoIds)");
    params.eventoIds = filters.eventoIds;
  }
  if (filters.productos?.length) {
    conds.push("d.producto IN UNNEST(@productos)");
    params.productos = filters.productos;
  }

  const rows = await query<Record<string, unknown>>(
    `
    WITH cat AS (
      SELECT EventoID, Fecha
      FROM ${CATEGORY}
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    )
    SELECT
      d.evento_id                                  AS evento_id,
      ANY_VALUE(d.nombre)                          AS nombre,
      FORMAT_DATE('%Y-%m-%d', ANY_VALUE(c.Fecha))  AS fecha_evento,
      d.etapa_norm                                 AS etapa_norm,
      ANY_VALUE(d.etapa_orden)                     AS etapa_orden,
      SUM(d.tickets)                               AS tickets,
      SAFE_DIVIDE(SUM(d.ingreso), SUM(d.tickets))  AS precio_medio
    FROM ${DEMAND} d
    LEFT JOIN cat c ON c.EventoID = d.evento_id
    WHERE ${conds.join("\n      AND ")}
    GROUP BY d.evento_id, d.etapa_norm
    HAVING tickets > 0
  `,
    params,
  );

  // Pivote: una columna por evento, una fila por etapa.
  const eventos = new Map<string, GlobalPrecioMatrizEvento>();
  const filas = new Map<string, { etapaOrden: number; precios: Map<string, number> }>();
  for (const r of rows) {
    const eventoId = s(r.evento_id);
    if (!eventos.has(eventoId)) {
      eventos.set(eventoId, {
        eventoId,
        nombre: s(r.nombre),
        fechaEvento: s(r.fecha_evento),
      });
    }
    const etapaNorm = s(r.etapa_norm);
    let fila = filas.get(etapaNorm);
    if (!fila) {
      fila = { etapaOrden: n(r.etapa_orden), precios: new Map() };
      filas.set(etapaNorm, fila);
    }
    fila.precios.set(eventoId, n(r.precio_medio));
  }

  // Columnas: evento más reciente primero (los sin fecha, al final).
  const eventosOrden = [...eventos.values()].sort((a, b) => {
    if (a.fechaEvento && b.fechaEvento && a.fechaEvento !== b.fechaEvento)
      return b.fechaEvento.localeCompare(a.fechaEvento);
    if (a.fechaEvento !== b.fechaEvento) return a.fechaEvento ? -1 : 1;
    return b.eventoId.localeCompare(a.eventoId, "es", { numeric: true });
  });

  // Filas: orden canónico de etapa; promedio/mín/máx = media simple, menor y
  // mayor entre los eventos con dato en la fila.
  const filasOrden = [...filas.entries()]
    .map(([etapaNorm, f]) => {
      const vals = [...f.precios.values()];
      const promedio = vals.length ? vals.reduce((acc, v) => acc + v, 0) / vals.length : 0;
      const minimo = vals.length ? Math.min(...vals) : 0;
      const maximo = vals.length ? Math.max(...vals) : 0;
      return {
        etapaNorm,
        etapaOrden: f.etapaOrden,
        label: ETAPA_LABEL[etapaNorm as Etapa] ?? etapaNorm,
        precios: Object.fromEntries(f.precios),
        promedio,
        minimo,
        maximo,
      };
    })
    .sort((a, b) => a.etapaOrden - b.etapaOrden);

  return { eventos: eventosOrden, filas: filasOrden };
}

// ---------- Pace histórico de venta (para el forecast) ----------

export type PacePoint = {
  diasAlEvento: number; // 0 = día del evento
  pctAcum: number; // fracción acumulada de la venta (0..1) a ese día
};

/**
 * Curva de pace: % acumulado de venta esperado a "d días del evento",
 * promediando los eventos pasados indicados. Por cada evento se ancla en
 * MIN(FechaEvento) y se normaliza por su total; luego se promedia. Ventana 0..120
 * días (la venta anterior a 120d se pliega en d=120). Vacío si no hay eventos.
 */
export async function getPaceCurve(eventoIds: string[]): Promise<PacePoint[]> {
  if (!eventoIds.length) return [];
  const rows = await query<Record<string, unknown>>(
    `
    WITH ev AS (
      SELECT EventoID, DATE(MIN(FechaEvento)) AS event_date, COUNT(*) AS total
      FROM ${TICKETS}
      WHERE EventoID IN UNNEST(@ids) AND EsDevuelto IS NOT TRUE
        AND FechaOrden IS NOT NULL AND FechaEvento IS NOT NULL
      GROUP BY EventoID
    ),
    daily AS (
      SELECT t.EventoID,
             GREATEST(DATE_DIFF(e.event_date, DATE(t.FechaOrden), DAY), 0) AS d,
             COUNT(*) AS tickets
      FROM ${TICKETS} t JOIN ev e ON e.EventoID = t.EventoID
      WHERE t.EsDevuelto IS NOT TRUE AND t.FechaOrden IS NOT NULL
      GROUP BY t.EventoID, d
    ),
    days AS (SELECT d FROM UNNEST(GENERATE_ARRAY(0, 120)) AS d),
    cum AS (
      SELECT e.EventoID, dd.d,
             SAFE_DIVIDE(SUM(daily.tickets), ANY_VALUE(e.total)) AS pct
      FROM ev e
      CROSS JOIN days dd
      LEFT JOIN daily ON daily.EventoID = e.EventoID AND daily.d >= dd.d
      GROUP BY e.EventoID, dd.d
    )
    SELECT d AS dias_al_evento, AVG(IFNULL(pct, 0)) AS pct_acum
    FROM cum GROUP BY d ORDER BY d DESC
    `,
    { ids: eventoIds },
  );
  return rows.map((r) => ({ diasAlEvento: n(r.dias_al_evento), pctAcum: n(r.pct_acum) }));
}

// ---------- Eventos de categoriaEvento (para crear planes) ----------

export type EventoOption = {
  eventoId: string;
  nombre: string;
  venue: string;
  fecha: string; // categoriaEvento.Fecha (YYYY-MM-DD) o ""
  country: "CL" | "PE" | "";
};

/**
 * Eventos del catálogo glovox.categoriaEvento (para elegir al crear un plan).
 * Filtra cancelados y por país (prefijo del EventoID). Dedup defensivo.
 */
export async function getCategoriaEventos(country: Country): Promise<EventoOption[]> {
  const cond =
    country === "chile" ? "AND EventoID LIKE 'GLO%'"
    : country === "peru" ? "AND EventoID LIKE 'GLP%'"
    : "";
  const rows = await query<Record<string, unknown>>(`
    SELECT
      EventoID                              AS evento_id,
      NombreGlovox                          AS nombre,
      venue                                 AS venue,
      FORMAT_DATE('%Y-%m-%d', Fecha)        AS fecha
    FROM ${CATEGORY}
    WHERE EventoID IS NOT NULL AND isCanceled IS NOT TRUE ${cond}
    QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    ORDER BY fecha DESC
  `);
  return rows.map((r) => {
    const eventoId = s(r.evento_id);
    return {
      eventoId,
      nombre: s(r.nombre),
      venue: s(r.venue),
      fecha: s(r.fecha),
      country: eventoId.startsWith("GLP") ? "PE" : eventoId.startsWith("GLO") ? "CL" : "",
    };
  });
}

// ---------- Info general del evento (desde categoriaEvento) ----------

export type EventInfo = {
  eventoId: string;
  nombre: string; // NombreGlovox
  venue: string;
  capacidad: number | null; // glovox.venues.capacidad (cruce por nombre de venue)
  country: "CL" | "PE" | "";
  fechaEvento: string; // categoriaEvento.Fecha (fallback tickets)
  fechaInicioVenta: string; // MIN(FechaOrden) de tickets
};

/**
 * Info general de un evento, fuente de verdad = glovox.categoriaEvento
 * (nombre, venue) + glovox.tickets (fechas). País por prefijo del EventoID.
 * Devuelve null si el evento no está en categoriaEvento.
 */
export async function getEventInfo(eventoId: string): Promise<EventInfo | null> {
  if (!eventoId) return null;
  const rows = await query<Record<string, unknown>>(
    `
    WITH cat AS (
      SELECT EventoID, NombreGlovox, venue, Fecha FROM ${CATEGORY}
      WHERE EventoID = @id
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    )
    SELECT
      c.EventoID                                       AS evento_id,
      c.NombreGlovox                                   AS nombre,
      c.venue                                          AS venue,
      -- capacidad del venue: cruce de categoriaEvento.venue con glovox.venues
      (SELECT MAX(capacidad) FROM ${VENUES} v WHERE v.venue = c.venue) AS capacidad,
      FORMAT_DATE('%Y-%m-%d', DATE(MIN(t.FechaOrden))) AS inicio,
      -- fecha del evento: categoriaEvento.Fecha (fuente), fallback a tickets
      FORMAT_DATE('%Y-%m-%d', COALESCE(c.Fecha, DATE(MIN(t.FechaEvento)))) AS evento
    FROM cat c
    LEFT JOIN ${TICKETS} t ON t.EventoID = c.EventoID
    GROUP BY c.EventoID, c.NombreGlovox, c.venue, c.Fecha
    `,
    { id: eventoId },
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const country = eventoId.startsWith("GLP") ? "PE" : eventoId.startsWith("GLO") ? "CL" : "";
  return {
    eventoId,
    nombre: s(r.nombre),
    venue: s(r.venue),
    capacidad: r.capacidad == null ? null : n(r.capacidad),
    country,
    fechaEvento: s(r.evento),
    fechaInicioVenta: s(r.inicio),
  };
}

// ---------- Serie temporal del evento (tickets · PM · RRSS) ----------

export type EventTimeseriesPoint = {
  fecha: string; // YYYY-MM-DD
  tickets: number; // tickets vendidos ese día (no devueltos)
  gastoPm: number; // gasto de paid media ese día
  rrssDelta: number | null; // delta diario de seguidores IG (null = sin dato)
};

/**
 * Serie diaria de un evento desde el inicio de venta (MIN FechaOrden) hasta el
 * día del evento, combinando:
 *  - tickets: glovox.tickets por DATE(FechaOrden)
 *  - PM: paidMedia.ads_performance, SUM(gasto) por fecha, ligado por el EventoID
 *    al inicio del campaign_name
 *  - RRSS: marketing.rrss_fllws (instagram) por blog_id = categoriaEvento.CuentaIG
 * Devuelve vacío si el evento no tiene ventas.
 */
export async function getEventTimeseries(eventoId: string): Promise<EventTimeseriesPoint[]> {
  if (!eventoId) return [];
  const rows = await query<Record<string, unknown>>(
    `
    WITH cuenta AS (
      SELECT CuentaIG, Fecha FROM ${CATEGORY} WHERE EventoID = @id
      QUALIFY ROW_NUMBER() OVER (PARTITION BY EventoID ORDER BY NombreGlovox) = 1
    ),
    win AS (
      SELECT DATE(MIN(FechaOrden)) AS d0,
             -- cierre = fecha del evento (categoriaEvento.Fecha), fallback a tickets
             COALESCE((SELECT Fecha FROM cuenta), DATE(MIN(FechaEvento)), DATE(MAX(FechaOrden))) AS d1
      FROM ${TICKETS} WHERE EventoID = @id AND FechaOrden IS NOT NULL
    ),
    spine AS (
      SELECT d FROM win, UNNEST(GENERATE_DATE_ARRAY(d0, d1)) AS d
      WHERE d0 IS NOT NULL
    ),
    tk AS (
      SELECT DATE(FechaOrden) AS d, COUNT(*) AS tickets
      FROM ${TICKETS}
      WHERE EventoID = @id AND EsDevuelto IS NOT TRUE AND FechaOrden IS NOT NULL
      GROUP BY d
    ),
    pm AS (
      SELECT fecha AS d, SUM(gasto) AS gasto
      FROM ${ADS}
      WHERE REGEXP_EXTRACT(campaign_name, r'^([A-Z]{2,3}[0-9]+|[0-9]{6})') = @id
      GROUP BY fecha
    ),
    rs AS (
      SELECT date AS d, delta_followers
      FROM ${RRSS}
      WHERE network = 'instagram' AND blog_id = (SELECT CuentaIG FROM cuenta)
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', s.d) AS fecha,
      IFNULL(tk.tickets, 0)        AS tickets,
      IFNULL(pm.gasto, 0)          AS gasto_pm,
      rs.delta_followers           AS rrss_delta
    FROM spine s
    LEFT JOIN tk ON tk.d = s.d
    LEFT JOIN pm ON pm.d = s.d
    LEFT JOIN rs ON rs.d = s.d
    ORDER BY s.d
    `,
    { id: eventoId },
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    tickets: n(r.tickets),
    gastoPm: n(r.gasto_pm),
    rrssDelta: r.rrss_delta == null ? null : n(r.rrss_delta),
  }));
}

export type EventCampaignRow = {
  campaignName: string;
  objective: string;
  plataforma: string;
  gasto: number;
  impresiones: number;
  clics: number;
  desde: string;
  hasta: string;
};

/**
 * Campañas de paid media de un evento (las que alimentan la curva PM del
 * gráfico): ligadas por el EventoID al inicio del campaign_name, dentro de la
 * misma ventana del evento. Agrupadas por nombre × objective × plataforma.
 */
export async function getEventCampaigns(eventoId: string): Promise<EventCampaignRow[]> {
  if (!eventoId) return [];
  const rows = await query<Record<string, unknown>>(
    `
    WITH win AS (
      SELECT DATE(MIN(FechaOrden)) AS d0,
             COALESCE(DATE(MIN(FechaEvento)), DATE(MAX(FechaOrden))) AS d1
      FROM ${TICKETS} WHERE EventoID = @id AND FechaOrden IS NOT NULL
    )
    SELECT
      campaign_name                            AS campaign_name,
      objective                                AS objective,
      plataforma                               AS plataforma,
      SUM(gasto)                               AS gasto,
      SUM(impresiones)                         AS impresiones,
      SUM(clics)                               AS clics,
      FORMAT_DATE('%Y-%m-%d', MIN(fecha))      AS desde,
      FORMAT_DATE('%Y-%m-%d', MAX(fecha))      AS hasta
    FROM ${ADS}, win
    WHERE REGEXP_EXTRACT(campaign_name, r'^([A-Z]{2,3}[0-9]+|[0-9]{6})') = @id
      AND fecha BETWEEN win.d0 AND win.d1
    GROUP BY campaign_name, objective, plataforma
    ORDER BY gasto DESC
    `,
    { id: eventoId },
  );
  return rows.map((r) => ({
    campaignName: s(r.campaign_name),
    objective: s(r.objective),
    plataforma: s(r.plataforma),
    gasto: n(r.gasto),
    impresiones: n(r.impresiones),
    clics: n(r.clics),
    desde: s(r.desde),
    hasta: s(r.hasta),
  }));
}
