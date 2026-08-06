/**
 * Curvas de compra anticipada (dashboard `/marketing/curvas`).
 *
 * A diferencia de `/marketing/weekly` —que mira UN evento y sus comparadores—
 * acá el análisis es GLOBAL: se seleccionan N eventos por facetas de
 * `glovox.categoriaEvento` y se dibuja la curva de compra de cada uno alineada
 * por `diasDeCompraAnticipada` (días entre la compra y el evento).
 *
 * La query devuelve el grano mínimo (evento × día, venta diaria) y toda la
 * matemática de acumulado / agrupación / normalización vive en
 * `lib/marketing/curvas.ts`. Así el SQL queda simple y el cálculo es testeable.
 *
 * Solo lectura. Todos los valores de usuario van por parámetros `@x`.
 */
import { query } from "@/lib/bigquery";
import type { Country } from "@/lib/queries/comunidad";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;

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

// ---------- Filtros ----------

/** Segmento de comunidad (columna `VentaComunidad` de tickets). */
export type CurvaComunidad = "todos" | "solo" | "sin";

export type CurvasFilters = {
  /** País de la sesión / selector. Se deriva del prefijo de EventoID. */
  country: Country;
  /** Facetas de `categoriaEvento`. Vacío = sin restricción. */
  categoriaEventos?: string[];
  categoriaEventos2?: string[];
  categoriaEventos3?: string[];
  temporadas?: string[];
  eventoIds?: string[];
  /** `TipoTicket` exacto (texto original de la ticketera). Vacío = todos. */
  tipoTickets?: string[];
  comunidad: CurvaComunidad;
  /** Por default los devueltos quedan fuera. */
  incluirDevueltos: boolean;
  /** Por default las cortesías quedan fuera (solo VENTA + PASE TEMPORADA). */
  incluirCortesias: boolean;
};

/**
 * Clase de ticket. ESPEJO del `TICKET_TYPE_FILTER` de `lib/queries/marketing.ts`
 * para que la curva global sea comparable con la de venta diaria: "sin
 * cortesías" conserva VENTA + PASE TEMPORADA y descarta CORTESIA y MESA VIP
 * (ambas entran por `MedioPago='Otro'`).
 */
const CLASE_CASE = `
  CASE
    WHEN t.MedioPago = 'Otro' AND (LOWER(t.TipoTicket) LIKE '%pase%' OR LOWER(t.TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
    WHEN t.MedioPago = 'Otro' AND LOWER(t.TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
    WHEN t.MedioPago = 'Otro' THEN 'CORTESIA'
    ELSE 'VENTA'
  END`;

/**
 * Personas por fila de ticket. ESPEJO de `personasExpr` en
 * `lib/queries/marketing.ts`: los packs FBM se venden a dos personas en una
 * sola fila, así que cuentan 2. `catAlias` es la columna con CategoriaEvento.
 */
function personasExpr(catExpr: string): string {
  return `CASE
    WHEN ${catExpr} = 'FBM'
     AND UPPER(t.TipoTicket) LIKE '%PACK%'
     AND REGEXP_CONTAINS(t.TipoTicket, r'(^|\\D)2(\\D|$)')
    THEN 2
    ELSE 1
  END`;
}

/** Condiciones sobre `categoriaEvento` (alias `c`) + params. */
function eventConds(filters: CurvasFilters): {
  conds: string[];
  params: Record<string, unknown>;
} {
  const conds: string[] = ["c.isCanceled IS NOT TRUE"];
  const params: Record<string, unknown> = {};

  // El país se deriva del prefijo de EventoID (GLO=Chile, GLP=Perú). Literal
  // fijo, no entrada de usuario → seguro de interpolar.
  if (filters.country === "chile") conds.push("c.EventoID LIKE 'GLO%'");
  if (filters.country === "peru") conds.push("c.EventoID LIKE 'GLP%'");

  const facets: [keyof CurvasFilters, string, string][] = [
    ["categoriaEventos", "c.CategoriaEvento", "categoriaEventos"],
    ["categoriaEventos2", "c.CategoriaEvento2", "categoriaEventos2"],
    ["categoriaEventos3", "c.CategoriaEvento3", "categoriaEventos3"],
    ["temporadas", "c.Temporada", "temporadas"],
    ["eventoIds", "c.EventoID", "eventoIds"],
  ];
  for (const [key, column, param] of facets) {
    const values = filters[key] as string[] | undefined;
    if (values?.length) {
      conds.push(`${column} IN UNNEST(@${param})`);
      params[param] = values;
    }
  }
  return { conds, params };
}

/** Condiciones sobre `tickets` (alias `t`) + params. */
function ticketConds(filters: CurvasFilters): {
  conds: string[];
  params: Record<string, unknown>;
} {
  const conds: string[] = ["t.FechaOrden IS NOT NULL"];
  const params: Record<string, unknown> = {};

  if (!filters.incluirDevueltos) conds.push("t.EsDevuelto IS NOT TRUE");
  if (!filters.incluirCortesias)
    conds.push(`${CLASE_CASE} IN ('VENTA', 'PASE TEMPORADA')`);
  if (filters.comunidad === "solo") conds.push("t.VentaComunidad IS TRUE");
  if (filters.comunidad === "sin") conds.push("t.VentaComunidad IS NOT TRUE");
  if (filters.tipoTickets?.length) {
    conds.push("t.TipoTicket IN UNNEST(@tipoTickets)");
    params.tipoTickets = filters.tipoTickets;
  }
  return { conds, params };
}

// ---------- Tipos ----------

/** Un evento del universo seleccionable, con sus facetas. */
export type CurvaEventOption = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  categoriaEvento2: string;
  categoriaEvento3: string;
  temporada: string;
  fechaEvento: string; // YYYY-MM-DD
};

/**
 * Venta de un evento en un día relativo. `dias` = días de compra anticipada:
 * positivo antes del evento, 0 el día del evento, negativo después.
 */
export type CurvaRow = {
  eventoId: string;
  dias: number;
  tickets: number;
  personas: number;
  venta: number;
};

// ---------- Queries ----------

/**
 * Universo de eventos para poblar las facetas. Independiente de los filtros
 * (las facetas se cruzan en el cliente para atenuar las combinaciones
 * imposibles). Solo eventos con tickets y con FechaEvento conocida: sin fecha
 * no hay día relativo y por lo tanto no hay curva.
 */
export async function getCurvasEventOptions(
  country: Country = "all",
): Promise<CurvaEventOption[]> {
  let countryCond = "";
  if (country === "chile") countryCond = "AND t.EventoID LIKE 'GLO%'";
  if (country === "peru") countryCond = "AND t.EventoID LIKE 'GLP%'";

  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID                                       AS evento_id,
      ANY_VALUE(c.NombreGlovox)                        AS nombre,
      ANY_VALUE(c.CategoriaEvento)                     AS categoria_evento,
      ANY_VALUE(c.CategoriaEvento2)                    AS categoria_evento_2,
      ANY_VALUE(c.CategoriaEvento3)                    AS categoria_evento_3,
      ANY_VALUE(c.Temporada)                           AS temporada,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento)) AS fecha_evento
    FROM ${CATEGORY} c
    JOIN ${TICKETS} t ON t.EventoID = c.EventoID ${countryCond}
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    HAVING fecha_evento IS NOT NULL
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    categoriaEvento2: s(r.categoria_evento_2),
    categoriaEvento3: s(r.categoria_evento_3),
    temporada: s(r.temporada),
    fechaEvento: s(r.fecha_evento),
  }));
}

/**
 * Venta diaria por evento alineada por días de compra anticipada.
 *
 * El día del evento sale de `MAX(FechaEvento)` de sus tickets (mismo criterio
 * que la curva de `/marketing/weekly`). La curva NO se corta en el día del
 * evento: los días negativos (venta en puerta y posterior) vienen incluidos.
 */
export async function getCurvasCompra(
  filters: CurvasFilters,
): Promise<CurvaRow[]> {
  const ev = eventConds(filters);
  const tk = ticketConds(filters);

  const rows = await query<Record<string, unknown>>(
    `
    WITH ev AS (
      SELECT
        c.EventoID                    AS evento_id,
        ANY_VALUE(c.CategoriaEvento)  AS categoria,
        MAX(t.FechaEvento)            AS fecha_evento
      FROM ${CATEGORY} c
      JOIN ${TICKETS} t ON t.EventoID = c.EventoID
      WHERE ${ev.conds.join("\n        AND ")}
      GROUP BY evento_id
      HAVING fecha_evento IS NOT NULL
    )
    SELECT
      e.evento_id                                                       AS evento_id,
      DATE_DIFF(DATE(e.fecha_evento), DATE(t.FechaOrden), DAY)          AS dias,
      COUNT(*)                                                          AS tickets,
      SUM(${personasExpr("e.categoria")})                               AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0))                            AS venta
    FROM ${TICKETS} t
    JOIN ev e ON e.evento_id = t.EventoID
    WHERE ${tk.conds.join("\n      AND ")}
    GROUP BY evento_id, dias
    ORDER BY evento_id, dias DESC
    `,
    { ...ev.params, ...tk.params },
  );

  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    dias: n(r.dias),
    tickets: n(r.tickets),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}

/**
 * `TipoTicket` distintos del universo de eventos seleccionado por las facetas
 * de evento (no por el propio filtro de tipo, para que la lista no se vacíe a
 * sí misma). Cada evento nombra sus tipos a su manera: se devuelve la unión con
 * el conteo para ordenar el dropdown por relevancia.
 */
export async function getCurvasTipoTicketOptions(
  filters: CurvasFilters,
): Promise<{ tipoTicket: string; tickets: number }[]> {
  const ev = eventConds(filters);
  const tk = ticketConds({ ...filters, tipoTickets: undefined });

  const rows = await query<Record<string, unknown>>(
    `
    WITH ev AS (
      SELECT c.EventoID AS evento_id
      FROM ${CATEGORY} c
      JOIN ${TICKETS} t ON t.EventoID = c.EventoID
      WHERE ${ev.conds.join("\n        AND ")}
      GROUP BY evento_id
      HAVING MAX(t.FechaEvento) IS NOT NULL
    )
    SELECT t.TipoTicket AS tipo_ticket, COUNT(*) AS tickets
    FROM ${TICKETS} t
    JOIN ev e ON e.evento_id = t.EventoID
    WHERE ${tk.conds.join("\n      AND ")}
      AND t.TipoTicket IS NOT NULL AND t.TipoTicket != ''
    GROUP BY tipo_ticket
    ORDER BY tickets DESC
    `,
    { ...ev.params, ...tk.params },
  );

  return rows.map((r) => ({
    tipoTicket: s(r.tipo_ticket),
    tickets: n(r.tickets),
  }));
}
