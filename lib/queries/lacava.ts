/**
 * Dashboard La Cava (`/lacava`) — eventos con `CategoriaEvento = 'JUMBO'`
 * (expo de vinos La Cava de Jumbo, producida por Glovox: GLO175 2025,
 * GLO209 2026, y las ediciones que vengan).
 *
 * Todas las queries acotan por la categoría en `glovox.categoriaEvento`, así
 * una edición nueva aparece sola sin tocar código. La curva comparativa entre
 * ediciones NO vive acá: reutiliza `getCurvasCompra` de `lib/queries/curvas.ts`
 * con el filtro `categoriaEventos: ["JUMBO"]` (misma matemática que
 * /marketing/curvas, ver `app/lacava/page.tsx`).
 *
 * Convenciones espejo de `lib/queries/marketing.ts`:
 *  - venta neta = SUM(Precio - Descuento), el CargoServicio se reporta aparte.
 *  - personas = SUM(PersonasPorTicket); transacciones = COUNT(*).
 *  - clase de ticket: MedioPago='Otro' → cortesía/pase/mesa; el resto es VENTA.
 *  - los devueltos quedan fuera de todos los agregados de venta.
 *
 * Solo lectura. Valores de usuario siempre por parámetros `@x`.
 */
import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;

/** Espejo del CASE de `TICKET_TYPE_FILTER` de lib/queries/marketing.ts. */
const CLASE_CASE = `
  CASE
    WHEN t.MedioPago = 'Otro' AND (LOWER(t.TipoTicket) LIKE '%pase%' OR LOWER(t.TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
    WHEN t.MedioPago = 'Otro' AND LOWER(t.TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
    WHEN t.MedioPago = 'Otro' THEN 'CORTESIA'
    ELSE 'VENTA'
  END`;

/** Fila que cuenta como venta real (incluye pases, excluye devueltos). */
const ES_VENTA = `${CLASE_CASE} IN ('VENTA', 'PASE TEMPORADA') AND t.EsDevuelto IS NOT TRUE`;

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

// ---------- Tipos ----------

export type LaCavaEvento = {
  eventoId: string;
  nombre: string;
  temporada: string;
  fechaEvento: string; // YYYY-MM-DD (último día del evento)
  /** fechaEvento - hoy; >= 0 mientras el evento no pasó. */
  diasParaEvento: number;
  goalTickets: number;
  personas: number;
  transacciones: number;
  ventaNeta: number;
  cargoServicio: number;
  /** Personas en cortesías (no devueltas). Fuera de `personas`/`ventaNeta`. */
  cortesias: number;
  devueltos: number;
  primeraOrden: string; // YYYY-MM-DD
  ultimaOrden: string; // YYYY-MM-DD
};

export type LaCavaDiaRow = {
  fecha: string; // YYYY-MM-DD
  personas: number;
  transacciones: number;
  venta: number;
  personasAcum: number;
  ventaAcum: number;
};

export type LaCavaTipoRow = {
  /** YYYY-MM-DD del día del evento para el que vale el ticket (FechaEvento). */
  diaEvento: string;
  tipoTicket: string;
  clase: string; // VENTA | CORTESIA | PASE TEMPORADA | MESA VIP
  transacciones: number;
  personas: number;
  venta: number;
};

export type LaCavaPrecioRow = {
  precioLista: number;
  /** % de descuento aplicado sobre el precio de lista, redondeado (0 = sin dcto). */
  pctDescuento: number;
  transacciones: number;
  personas: number;
  venta: number;
};

export type LaCavaMedioRow = {
  medioPago: string;
  transacciones: number;
  personas: number;
  venta: number;
};

// ---------- Queries ----------

/**
 * Una fila por edición de La Cava, con sus agregados de venta. Ordenadas de la
 * más reciente a la más antigua (por fecha del evento).
 */
export async function getLaCavaEventos(): Promise<LaCavaEvento[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID                                            AS evento_id,
      ANY_VALUE(c.NombreGlovox)                             AS nombre,
      ANY_VALUE(c.Temporada)                                AS temporada,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento))      AS fecha_evento,
      DATE_DIFF(DATE(MAX(t.FechaEvento)), CURRENT_DATE(), DAY) AS dias_para_evento,
      COALESCE(ANY_VALUE(c.goalTickets), 0)                 AS goal_tickets,
      SUM(IF(${ES_VENTA}, t.PersonasPorTicket, 0))          AS personas,
      COUNTIF(${ES_VENTA})                                  AS transacciones,
      SUM(IF(${ES_VENTA}, t.Precio - IFNULL(t.Descuento, 0), 0)) AS venta_neta,
      SUM(IF(${ES_VENTA}, t.CargoServicio, 0))              AS cargo_servicio,
      SUM(IF(${CLASE_CASE} = 'CORTESIA' AND t.EsDevuelto IS NOT TRUE, t.PersonasPorTicket, 0)) AS cortesias,
      COUNTIF(t.EsDevuelto IS TRUE)                         AS devueltos,
      FORMAT_DATE('%Y-%m-%d', MIN(DATE(t.FechaOrden)))      AS primera_orden,
      FORMAT_DATE('%Y-%m-%d', MAX(DATE(t.FechaOrden)))      AS ultima_orden
    FROM ${CATEGORY} c
    JOIN ${TICKETS} t ON t.EventoID = c.EventoID
    WHERE c.CategoriaEvento = 'JUMBO'
      AND c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    HAVING fecha_evento IS NOT NULL
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    temporada: s(r.temporada),
    fechaEvento: s(r.fecha_evento),
    diasParaEvento: n(r.dias_para_evento),
    goalTickets: n(r.goal_tickets),
    personas: n(r.personas),
    transacciones: n(r.transacciones),
    ventaNeta: n(r.venta_neta),
    cargoServicio: n(r.cargo_servicio),
    cortesias: n(r.cortesias),
    devueltos: n(r.devueltos),
    primeraOrden: s(r.primera_orden),
    ultimaOrden: s(r.ultima_orden),
  }));
}

/**
 * Venta diaria del evento (solo ventas reales) con acumulado, por fecha de
 * orden real — el gráfico de evolución, espejo del de /marketing/weekly.
 */
export async function getLaCavaVentaDiaria(
  eventoId: string,
): Promise<LaCavaDiaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH diario AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(t.FechaOrden))  AS fecha,
        SUM(t.PersonasPorTicket)                     AS personas,
        COUNT(*)                                     AS transacciones,
        SUM(t.Precio - IFNULL(t.Descuento, 0))       AS venta
      FROM ${TICKETS} t
      WHERE t.EventoID = @eventoId
        AND t.FechaOrden IS NOT NULL
        AND ${ES_VENTA}
      GROUP BY fecha
    )
    SELECT
      fecha,
      personas,
      transacciones,
      venta,
      SUM(personas) OVER (ORDER BY fecha) AS personas_acum,
      SUM(venta)    OVER (ORDER BY fecha) AS venta_acum
    FROM diario
    ORDER BY fecha
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    personas: n(r.personas),
    transacciones: n(r.transacciones),
    venta: n(r.venta),
    personasAcum: n(r.personas_acum),
    ventaAcum: n(r.venta_acum),
  }));
}

/**
 * Desglose por día del evento × tipo de ticket × clase. La Cava dura varios
 * días y cada ticket vale para un día específico (su `FechaEvento`), así que
 * el día es la primera dimensión. Incluye cortesías y pases (para eso está la
 * clase); solo excluye devueltos.
 */
export async function getLaCavaTipos(
  eventoId: string,
): Promise<LaCavaTipoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(t.FechaEvento))           AS dia_evento,
      COALESCE(NULLIF(TRIM(t.TipoTicket), ''), '(sin tipo)') AS tipo_ticket,
      ${CLASE_CASE}                                          AS clase,
      COUNT(*)                                               AS transacciones,
      SUM(t.PersonasPorTicket)                               AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0))                 AS venta
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND t.EsDevuelto IS NOT TRUE
      AND t.FechaEvento IS NOT NULL
    GROUP BY dia_evento, tipo_ticket, clase
    ORDER BY dia_evento, personas DESC
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    diaEvento: s(r.dia_evento),
    tipoTicket: s(r.tipo_ticket),
    clase: s(r.clase),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}

/**
 * Tramos de precio de lista × % de descuento aplicado (solo ventas reales).
 * En La Cava el TipoTicket es casi siempre "GENERAL": la diferenciación real
 * del producto está en el precio de lista (preventa 1/2/3, general) y en el
 * descuento del medio de pago (Cencosud / Prime / Prime+Cencosud).
 */
export async function getLaCavaPrecios(
  eventoId: string,
): Promise<LaCavaPrecioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      t.Precio AS precio_lista,
      CAST(ROUND(SAFE_DIVIDE(IFNULL(t.Descuento, 0), NULLIF(t.Precio, 0)) * 100) AS INT64) AS pct_descuento,
      COUNT(*)                               AS transacciones,
      SUM(t.PersonasPorTicket)               AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0)) AS venta
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND ${ES_VENTA}
    GROUP BY precio_lista, pct_descuento
    ORDER BY precio_lista, pct_descuento
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    precioLista: n(r.precio_lista),
    pctDescuento: n(r.pct_descuento),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}

/** Desglose por medio de pago (solo ventas reales), ordenado por venta. */
export async function getLaCavaMedios(
  eventoId: string,
): Promise<LaCavaMedioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      COALESCE(NULLIF(TRIM(t.MedioPago), ''), '(sin medio)') AS medio_pago,
      COUNT(*)                               AS transacciones,
      SUM(t.PersonasPorTicket)               AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0)) AS venta
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND ${ES_VENTA}
    GROUP BY medio_pago
    ORDER BY venta DESC
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    medioPago: s(r.medio_pago),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}
