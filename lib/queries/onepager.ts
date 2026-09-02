import { query } from "@/lib/bigquery";

const P          = process.env.BIGQUERY_PROJECT_ID;
const TICKETS    = `\`${P}.glovox.tickets\``;
const SOLD_ITEMS = `\`${P}.onfire.soldItems\``;
const CATEGORY   = `\`${P}.glovox.categoriaEvento\``;

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

export type OnepagerEventOption = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  fechaEvento: string;
  ticketCount: number;
};

export type OnepagerListadoRow = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  fechaEvento: string;
  ventaTickets: number;
  ticketsComprados: number;
  ventaFfBb: number;
};

// Desglose FF&BB (venta + cantidad) por evento × categoría × producto, a través
// de TODOS los eventos. Alimenta el gráfico de consumo comparado de la vista
// global; el cliente filtra por categoría/producto y agrupa por evento.
export type OnepagerFfbbConsumoRow = {
  eventoId: string;
  categoria: string;
  producto: string;
  venta: number;
  qtty: number;
};

// Sin `rebate`: el rebate modelado (Venta × 15% × 55%) se retiró el 2026-09-02.
// Ahora se calcula en page.tsx con el MISMO criterio que /cierre-negocio:
// % imputado (rebate_config) × cargo por servicio real (cierreEventos).
export type OnepagerIngresoRow = {
  ingreso: string;
  venta: number;
  qtty: number;
};

export type OnepagerKpiRow = {
  totalVenta: number;
  totalQtty: number;
  ventaTickets: number;
  ventaFfBb: number;
  ventaExtras: number;
};

export type OnepagerVipGralRow = {
  vipGral: string;
  venta: number;
  qtty: number;
};

export type OnepagerTipoProductoRow = {
  tipoProducto: string;
  venta: number;
  qtty: number;
};

export type OnepagerPuntoVentaRow = {
  puntoVenta: string;
  venta: number;
  qtty: number;
};


export type OnepagerFfbbCategoriaProductoRow = {
  categoria: string;
  producto: string;
  venta: number;
  qtty: number;
};

export type OnepagerAsistenciaRow = {
  ventaNoventa: string;
  qtty: number;
  qtty2: number;
};

export type OnepagerFfbbEvolucionRow = {
  slotIso: string;
  slotLabel: string;
  categoria: string;
  producto: string;
  puntoVenta: string;
  venta: number;
  qtty: number;
};

// Llegadas al evento (tickets quemados) por slot de 15 min × tipo (VENTA /
// CORTESIA), en PERSONAS. Alimenta la curva de hora de llegada del panel
// "Validación de asistencia".
export type OnepagerLlegadaRow = {
  slotIso: string; // YYYY-MM-DDTHH:MM:00 (hora local del evento)
  slotLabel: string; // HH:MM (inicio del slot)
  fecha: string; // YYYY-MM-DD
  ventaNoventa: string;
  personas: number;
};


// ---------- Event list queries ----------

export async function getOnepagerEventList(): Promise<OnepagerEventOption[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID                                       AS evento_id,
      ANY_VALUE(c.NombreGlovox)                        AS nombre,
      ANY_VALUE(c.CategoriaEvento)                     AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento)) AS fecha_evento,
      COUNT(*)                                         AS ticket_count
    FROM ${CATEGORY} c
    LEFT JOIN ${TICKETS} t ON c.EventoID = t.EventoID
    WHERE c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId:        s(r.evento_id),
    nombre:          s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento:     s(r.fecha_evento),
    ticketCount:     n(r.ticket_count),
  }));
}

/**
 * Listado multi-evento con agregados de venta de tickets y FF&BB (BigQuery).
 * Una fila por evento. Asistentes y Marcas se enriquecen aparte en el caller
 * (asistentes desde ticketsAndAABB.cierreEventos, marcas desde Postgres).
 */
export async function getOnepagerListadoKpis(): Promise<OnepagerListadoRow[]> {
  const rows = await query<Record<string, unknown>>(`
    WITH events AS (
      SELECT
        c.EventoID                                       AS evento_id,
        ANY_VALUE(c.NombreGlovox)                        AS nombre,
        ANY_VALUE(c.CategoriaEvento)                     AS categoria_evento,
        MAX(t.FechaEvento)                               AS fecha_ts
      FROM ${CATEGORY} c
      LEFT JOIN ${TICKETS} t ON c.EventoID = t.EventoID
      WHERE c.isCanceled IS NOT TRUE
      GROUP BY c.EventoID
    ),
    tickets_agg AS (
      SELECT
        EventoID                                                AS evento_id,
        SUM(Precio - IFNULL(Descuento, 0))                      AS venta,
        -- Mismo criterio "VENTA" usado en ticketsCte/baseCte: cualquier
        -- MedioPago distinto de 'Otro' es venta; con 'Otro' sólo cuenta si
        -- el TipoTicket contiene 'pase' (el resto son cortesías).
        -- Comprados en PERSONAS (2026-09-01), no en filas. Antes era COUNTIF, y
        -- un pase familiar de 4 contaba 1: la columna quedaba en otra unidad que
        -- "Asistentes" (que son personas), así que restarlas NO daba las cortesías.
        -- En GLO181: 4.969 filas contra 6.850 personas realmente compradas.
        SUM(
          IF(MedioPago != 'Otro' OR LOWER(TipoTicket) LIKE '%pase%',
             PersonasPorTicket, 0)
        )                                                        AS tickets_comprados
      FROM ${TICKETS}
      GROUP BY EventoID
    ),
    ffbb_agg AS (
      SELECT
        EventoID                                                AS evento_id,
        SUM(SubTotal)                                           AS venta
      FROM ${SOLD_ITEMS}
      GROUP BY EventoID
    )
    SELECT
      e.evento_id                                              AS evento_id,
      e.nombre                                                  AS nombre,
      e.categoria_evento                                        AS categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', e.fecha_ts)                  AS fecha_evento,
      COALESCE(t.venta, 0)                                      AS venta_tickets,
      COALESCE(t.tickets_comprados, 0)                          AS tickets_comprados,
      COALESCE(f.venta, 0)                                      AS venta_ff_bb
    FROM events e
    LEFT JOIN tickets_agg t ON e.evento_id = t.evento_id
    LEFT JOIN ffbb_agg    f ON e.evento_id = f.evento_id
    ORDER BY e.fecha_ts DESC NULLS LAST
  `);
  return rows.map((r) => ({
    eventoId:         s(r.evento_id),
    nombre:           s(r.nombre),
    categoriaEvento:  s(r.categoria_evento),
    fechaEvento:      s(r.fecha_evento),
    ventaTickets:     n(r.venta_tickets),
    ticketsComprados: n(r.tickets_comprados),
    ventaFfBb:        n(r.venta_ff_bb),
  }));
}

/**
 * Desglose FF&BB por evento × categoría × producto, para TODOS los eventos.
 * El caller (vista global) lo cruza con los eventos en pantalla y lo filtra
 * por categoría/producto en el cliente. Una sola pasada a soldItems.
 */
export async function getOnepagerFfbbConsumo(): Promise<OnepagerFfbbConsumoRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      EventoID                              AS evento_id,
      IFNULL(Categoria, 'Sin categoría')    AS categoria,
      IFNULL(Producto,  'Sin producto')     AS producto,
      SUM(IFNULL(SubTotal, 0))              AS venta,
      SUM(IFNULL(Cantidad, 0))              AS qtty
    FROM ${SOLD_ITEMS}
    WHERE EventoID IS NOT NULL
    GROUP BY 1, 2, 3
  `);
  return rows.map((r) => ({
    eventoId:  s(r.evento_id),
    categoria: s(r.categoria),
    producto:  s(r.producto),
    venta:     n(r.venta),
    qtty:      n(r.qtty),
  }));
}

export async function getOnepagerRecentEvents(): Promise<OnepagerEventOption[]> {
  const rows = await query<Record<string, unknown>>(`
    WITH events AS (
      SELECT
        t.EventoID                                       AS evento_id,
        ANY_VALUE(c.NombreGlovox)                        AS nombre,
        ANY_VALUE(c.CategoriaEvento)                     AS categoria_evento,
        MAX(t.FechaEvento)                               AS fecha_evento_ts,
        COUNT(*)                                         AS ticket_count
      FROM ${TICKETS} t
      LEFT JOIN ${CATEGORY} c ON c.EventoID = t.EventoID
      WHERE (c.isCanceled IS NULL OR c.isCanceled IS NOT TRUE)
      GROUP BY t.EventoID
    )
    SELECT
      evento_id,
      nombre,
      categoria_evento,
      FORMAT_TIMESTAMP('%Y-%m-%d', fecha_evento_ts) AS fecha_evento,
      ticket_count
    FROM events
    WHERE fecha_evento_ts IS NOT NULL
      AND fecha_evento_ts < CURRENT_TIMESTAMP()
    ORDER BY fecha_evento_ts DESC
    LIMIT 3
  `);
  return rows.map((r) => ({
    eventoId:        s(r.evento_id),
    nombre:          s(r.nombre),
    categoriaEvento: s(r.categoria_evento),
    fechaEvento:     s(r.fecha_evento),
    ticketCount:     n(r.ticket_count),
  }));
}

// ---------- Base CTE ----------
// Reusable UNION ALL filtered by EventoID

// Solo tickets — para queries que solo necesitan glovox.tickets
function ticketsCte() {
  return `
  WITH base AS (
    SELECT
      'TICKETS'                                               AS Ingreso,
      a.EventoID,
      CONCAT(a.EventoID,' - ',b.NombreGlovox)                AS NombreID,
      FORMAT_DATE('%Y-%m-%d', a.FechaEvento)                 AS FechaEvento,
      CASE
        WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%pase%' THEN 'VENTA'
        WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%mesa%' THEN 'CORTESIA'
        WHEN MedioPago = 'Otro'                              THEN 'CORTESIA'
        ELSE 'VENTA'
      END                                                     AS ventaNoventa,
      a.SucursalVenta                                         AS PuntoVenta,
      a.MedioPago                                             AS MedioPago,
      a.CategoriaTicket                                       AS Categoria,
      a.TipoTicket                                            AS TipoProducto,
      CASE
        WHEN UPPER(a.TipoTicket) LIKE '%VIP%'          OR
             UPPER(a.TipoTicket) LIKE '%BACKSTAGE%'    OR
             UPPER(a.TipoTicket) LIKE '%HOSPITALITY%'  OR
             UPPER(a.TipoTicket) LIKE '%STANDING%'     THEN 'VIP'
        ELSE 'GENERAL'
      END                                                     AS VipGral,
      a.EsDevuelto                                            AS Devuelto,
      a.EsQuemado                                             AS Quemado,
      COUNT(*)                                                AS Qtty,
      COUNTIF(a.EsQuemado IS TRUE)                           AS Qtty2,
      COUNTIF(a.EsQuemado IS FALSE)                          AS Qtty3,
      -- Personas (2026-09-01): las mismas dos medidas ponderadas por
      -- PersonasPorTicket. Qtty/Qtty2 siguen siendo FILAS y se conservan porque
      -- el ranking de producto se mide en unidades vendidas. El % de Asistencia
      -- usa el par de PERSONAS: mezclar unidades daba 108% en GLO181.
      SUM(a.PersonasPorTicket)                                AS QttyPersonas,
      SUM(IF(a.EsQuemado IS TRUE, a.PersonasPorTicket, 0))   AS Qtty2Personas,
      SUM(a.Precio - IFNULL(Descuento, 0))                   AS Venta,
      b.CategoriaEvento
    FROM ${TICKETS} a
      LEFT JOIN ${CATEGORY} b ON a.EventoID = b.EventoID
    WHERE a.EventoID = @eventoId
    GROUP BY
      a.EventoID, NombreID, FechaEvento, ventaNoventa,
      PuntoVenta, MedioPago, Categoria, TipoProducto,
      Devuelto, Quemado, b.CategoriaEvento
  )`;
}

// Solo FF&BB — para queries que solo necesitan onfire.soldItems
function ffbbCte() {
  return `
  WITH base AS (
    SELECT
      'FFBB'                                                               AS Ingreso,
      a.EventoID,
      CONCAT(a.EventoID,' - ',b.NombreGlovox)                              AS NombreID,
      FORMAT_DATE('%Y-%m-%d', DATE(DATETIME_SUB(HoraPedido, INTERVAL 6 HOUR))) AS FechaEvento,
      'VENTA'                                                               AS ventaNoventa,
      a.NombrePunto                                                         AS PuntoVenta,
      'NA'                                                                  AS MedioPago,
      a.Categoria                                                           AS Categoria,
      a.Producto                                                            AS TipoProducto,
      'NA'                                                                  AS VipGral,
      FALSE                                                                 AS Devuelto,
      FALSE                                                                 AS Quemado,
      SUM(a.Cantidad)                                                       AS Qtty,
      0                                                                     AS Qtty2,
      0                                                                     AS Qtty3,
      0                                                                     AS QttyPersonas,
      0                                                                     AS Qtty2Personas,
      SUM(SubTotal)                                                         AS Venta,
      b.CategoriaEvento
    FROM ${SOLD_ITEMS} a
      LEFT JOIN ${CATEGORY} b ON a.EventoID = b.EventoID
    WHERE a.EventoID = @eventoId
    GROUP BY
      EventoID, NombreID, FechaEvento, PuntoVenta,
      MedioPago, Categoria, TipoProducto, b.CategoriaEvento
  )`;
}

// UNION ALL de ambas fuentes — para KPIs y resumen agregado
function baseCte() {
  return `
  WITH base AS (
    (
      SELECT 'TICKETS' AS Ingreso, a.EventoID,
        CONCAT(a.EventoID,' - ',b.NombreGlovox) AS NombreID,
        FORMAT_DATE('%Y-%m-%d', a.FechaEvento) AS FechaEvento,
        CASE
          WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%pase%' THEN 'VENTA'
          WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%mesa%' THEN 'CORTESIA'
          WHEN MedioPago = 'Otro' THEN 'CORTESIA'
          ELSE 'VENTA'
        END AS ventaNoventa,
        a.SucursalVenta AS PuntoVenta, a.MedioPago AS MedioPago,
        a.CategoriaTicket AS Categoria, a.TipoTicket AS TipoProducto,
        CASE
          WHEN UPPER(a.TipoTicket) LIKE '%VIP%' OR UPPER(a.TipoTicket) LIKE '%BACKSTAGE%' OR
               UPPER(a.TipoTicket) LIKE '%HOSPITALITY%' OR UPPER(a.TipoTicket) LIKE '%STANDING%' THEN 'VIP'
          ELSE 'GENERAL'
        END AS VipGral,
        a.EsDevuelto AS Devuelto, a.EsQuemado AS Quemado,
        COUNT(*) AS Qtty, COUNTIF(a.EsQuemado IS TRUE) AS Qtty2, COUNTIF(a.EsQuemado IS FALSE) AS Qtty3,
        SUM(a.PersonasPorTicket) AS QttyPersonas,
        SUM(IF(a.EsQuemado IS TRUE, a.PersonasPorTicket, 0)) AS Qtty2Personas,
        SUM(a.Precio - IFNULL(Descuento, 0)) AS Venta,
        b.CategoriaEvento
      FROM ${TICKETS} a LEFT JOIN ${CATEGORY} b ON a.EventoID = b.EventoID
      WHERE a.EventoID = @eventoId
      GROUP BY a.EventoID, NombreID, FechaEvento, ventaNoventa, PuntoVenta, MedioPago,
               Categoria, TipoProducto, Devuelto, Quemado, b.CategoriaEvento
    )
    UNION ALL
    (
      SELECT 'FFBB' AS Ingreso, a.EventoID,
        CONCAT(a.EventoID,' - ',b.NombreGlovox) AS NombreID,
        FORMAT_DATE('%Y-%m-%d', DATE(DATETIME_SUB(HoraPedido, INTERVAL 6 HOUR))) AS FechaEvento,
        'VENTA' AS ventaNoventa, a.NombrePunto AS PuntoVenta, 'NA' AS MedioPago,
        a.Categoria AS Categoria, a.Producto AS TipoProducto, 'NA' AS VipGral,
        FALSE AS Devuelto, FALSE AS Quemado,
        SUM(a.Cantidad) AS Qtty, 0 AS Qtty2, 0 AS Qtty3,
        0 AS QttyPersonas, 0 AS Qtty2Personas,
        SUM(SubTotal) AS Venta, b.CategoriaEvento
      FROM ${SOLD_ITEMS} a LEFT JOIN ${CATEGORY} b ON a.EventoID = b.EventoID
      WHERE a.EventoID = @eventoId
      GROUP BY EventoID, NombreID, FechaEvento, PuntoVenta, MedioPago,
               Categoria, TipoProducto, b.CategoriaEvento
    )
  )`;
}

// ---------- Queries ----------

export async function getOnepagerKpis(
  eventoId: string
): Promise<OnepagerKpiRow> {
  const rows = await query<Record<string, unknown>>(
    `
    ${baseCte()}
    SELECT
      SUM(Venta)                                                       AS total_venta,
      SUM(CASE WHEN Ingreso = 'TICKETS' THEN Qtty ELSE 0 END)         AS total_qtty,
      SUM(CASE WHEN Ingreso = 'TICKETS' THEN Venta ELSE 0 END)        AS venta_tickets,
      SUM(CASE WHEN Ingreso = 'FFBB'   THEN Venta ELSE 0 END)        AS venta_ff_bb,
      SUM(CASE WHEN Ingreso NOT IN ('TICKETS','FFBB') THEN Venta ELSE 0 END) AS venta_extras
    FROM base
    `,
    { eventoId }
  );
  const r = rows[0] ?? {};
  return {
    totalVenta:   n(r.total_venta),
    totalQtty:    n(r.total_qtty),
    ventaTickets: n(r.venta_tickets),
    ventaFfBb:    n(r.venta_ff_bb),
    ventaExtras:  n(r.venta_extras),
  };
}

export async function getOnepagerByIngreso(
  eventoId: string
): Promise<OnepagerIngresoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${baseCte()}
    SELECT
      Ingreso   AS ingreso,
      SUM(Venta) AS venta,
      SUM(Qtty)  AS qtty
    FROM base
    GROUP BY Ingreso
    ORDER BY venta DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    ingreso: s(r.ingreso),
    venta:   n(r.venta),
    qtty:    n(r.qtty),
  }));
}

export async function getOnepagerTicketsByTipo(
  eventoId: string
): Promise<OnepagerTipoProductoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${ticketsCte()}
    SELECT
      TipoProducto  AS tipo_producto,
      SUM(Venta)    AS venta,
      SUM(Qtty)     AS qtty
    FROM base
    GROUP BY TipoProducto
    ORDER BY venta DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    tipoProducto: s(r.tipo_producto),
    venta:        n(r.venta),
    qtty:         n(r.qtty),
  }));
}

export async function getOnepagerFfbbByTipo(
  eventoId: string
): Promise<OnepagerTipoProductoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${ffbbCte()}
    SELECT
      TipoProducto  AS tipo_producto,
      SUM(Venta)    AS venta,
      SUM(Qtty)     AS qtty
    FROM base
    GROUP BY TipoProducto
    ORDER BY venta DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    tipoProducto: s(r.tipo_producto),
    venta:        n(r.venta),
    qtty:         n(r.qtty),
  }));
}

export async function getOnepagerFfbbByPuntoVenta(
  eventoId: string
): Promise<OnepagerPuntoVentaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${ffbbCte()}
    SELECT
      PuntoVenta   AS punto_venta,
      SUM(Venta)   AS venta,
      SUM(Qtty)    AS qtty
    FROM base
    GROUP BY PuntoVenta
    ORDER BY venta DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    puntoVenta: s(r.punto_venta),
    venta:      n(r.venta),
    qtty:       n(r.qtty),
  }));
}

export async function getOnepagerTicketsAsistencia(
  eventoId: string
): Promise<OnepagerAsistenciaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${ticketsCte()}
    SELECT
      ventaNoventa   AS venta_noventa,
      -- PERSONAS en ambos lados: el % de Asistencia es qtty2/qtty y mezclar
      -- unidades daba 108,3% en GLO181 (más gente entrando que tickets emitidos).
      -- Con el par de personas da 85,9%; con el par de filas daba 83,1%.
      SUM(QttyPersonas)  AS qtty,
      SUM(Qtty2Personas) AS qtty2
    FROM base
    -- BUG ARREGLADO 2026-09-01: faltaba este filtro. El bloque FF&BB del CTE
    -- marca ventaNoventa='VENTA', así que SUM(Qtty) metía los ítems de comida
    -- en el denominador del % de Asistencia. En GLO181 el denominador daba
    -- 50.190 (7.190 tickets + 43.000 empanadas y tragos) en vez de 7.190, o sea
    -- el panel mostraba ~12% de asistencia en vez de ~86%.
    WHERE Ingreso = 'TICKETS'
    GROUP BY ventaNoventa
    ORDER BY ventaNoventa
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    ventaNoventa: s(r.venta_noventa),
    qtty:         n(r.qtty),
    qtty2:        n(r.qtty2),
  }));
}

export async function getOnepagerFfbbByCategoriaProducto(
  eventoId: string
): Promise<OnepagerFfbbCategoriaProductoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${ffbbCte()}
    SELECT
      Categoria      AS categoria,
      TipoProducto   AS producto,
      SUM(Venta)     AS venta,
      SUM(Qtty)      AS qtty
    FROM base
    GROUP BY Categoria, TipoProducto
    ORDER BY venta DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    categoria: s(r.categoria),
    producto:  s(r.producto),
    venta:     n(r.venta),
    qtty:      n(r.qtty),
  }));
}

export async function getOnepagerFfbbEvolucion(
  eventoId: string
): Promise<OnepagerFfbbEvolucionRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH bucketed AS (
      SELECT
        TIMESTAMP_SUB(
          TIMESTAMP_TRUNC(HoraPedido, MINUTE),
          INTERVAL MOD(EXTRACT(MINUTE FROM HoraPedido), 30) MINUTE
        )                                    AS slot,
        IFNULL(Categoria,   '—')             AS categoria,
        IFNULL(Producto,    '—')             AS producto,
        IFNULL(NombrePunto, '—')             AS punto_venta,
        IFNULL(SubTotal, 0)                  AS venta,
        IFNULL(Cantidad, 0)                  AS qtty
      FROM ${SOLD_ITEMS}
      WHERE EventoID = @eventoId
        AND HoraPedido IS NOT NULL
    )
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:00', slot) AS slot_iso,
      FORMAT_TIMESTAMP('%H:%M', slot)             AS slot_label,
      categoria,
      producto,
      punto_venta,
      SUM(venta)  AS venta,
      SUM(qtty)   AS qtty
    FROM bucketed
    GROUP BY slot, categoria, producto, punto_venta
    ORDER BY slot
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    slotIso:    s(r.slot_iso),
    slotLabel:  s(r.slot_label),
    categoria:  s(r.categoria),
    producto:   s(r.producto),
    puntoVenta: s(r.punto_venta),
    venta:      n(r.venta),
    qtty:       n(r.qtty),
  }));
}

/**
 * Curva de llegada: personas que entraron (EsQuemado) por slot de 15 min, según
 * `HoraQuemado` (DATETIME en hora local — NO se convierte). Mismo criterio
 * VENTA/CORTESIA y misma unidad (PersonasPorTicket) que la tabla de validación,
 * así la suma de la curva cuadra con la columna "Asistentes".
 */
export async function getOnepagerLlegadas(
  eventoId: string
): Promise<OnepagerLlegadaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH bucketed AS (
      SELECT
        DATETIME_SUB(
          DATETIME_TRUNC(HoraQuemado, MINUTE),
          INTERVAL MOD(EXTRACT(MINUTE FROM HoraQuemado), 15) MINUTE
        )                                                     AS slot,
        CASE
          WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%pase%' THEN 'VENTA'
          WHEN MedioPago = 'Otro'                                     THEN 'CORTESIA'
          ELSE 'VENTA'
        END                                                   AS venta_noventa,
        PersonasPorTicket                                     AS personas
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
        AND EsQuemado IS TRUE
        AND HoraQuemado IS NOT NULL
        -- Sentinels tipo 1900/0001 que a veces trae la ticketera.
        AND EXTRACT(YEAR FROM HoraQuemado) BETWEEN 2015 AND 2100
    )
    SELECT
      FORMAT_DATETIME('%Y-%m-%dT%H:%M:00', slot) AS slot_iso,
      FORMAT_DATETIME('%H:%M', slot)             AS slot_label,
      FORMAT_DATETIME('%Y-%m-%d', slot)          AS fecha,
      venta_noventa,
      SUM(personas)                              AS personas
    FROM bucketed
    GROUP BY slot, venta_noventa
    ORDER BY slot
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    slotIso:      s(r.slot_iso),
    slotLabel:    s(r.slot_label),
    fecha:        s(r.fecha),
    ventaNoventa: s(r.venta_noventa),
    personas:     n(r.personas),
  }));
}

export async function getOnepagerByVipGral(
  eventoId: string
): Promise<OnepagerVipGralRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    ${ticketsCte()}
    SELECT
      VipGral        AS vip_gral,
      SUM(Venta)     AS venta,
      SUM(Qtty)      AS qtty
    FROM base
    GROUP BY VipGral
    ORDER BY venta DESC
    `,
    { eventoId }
  );
  return rows.map((r) => ({
    vipGral: s(r.vip_gral),
    venta:   n(r.venta),
    qtty:    n(r.qtty),
  }));
}
