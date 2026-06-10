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

export type OnepagerIngresoRow = {
  ingreso: string;
  venta: number;
  qtty: number;
  rebate: number;
};

export type OnepagerKpiRow = {
  totalVenta: number;
  totalQtty: number;
  totalRebate: number;
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
        COUNTIF(
          MedioPago != 'Otro'
          OR LOWER(TipoTicket) LIKE '%pase%'
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
      SUM(a.Precio - IFNULL(Descuento, 0))                   AS Venta,
      SUM(a.Precio - IFNULL(Descuento, 0)) * 0.15 * 0.55    AS Rebate,
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
      SUM(SubTotal)                                                         AS Venta,
      0                                                                     AS Rebate,
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
        SUM(a.Precio - IFNULL(Descuento, 0)) AS Venta,
        SUM(a.Precio - IFNULL(Descuento, 0)) * 0.15 * 0.55 AS Rebate,
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
        SUM(SubTotal) AS Venta, 0 AS Rebate, b.CategoriaEvento
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
      SUM(Rebate)                                                      AS total_rebate,
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
    totalRebate:  n(r.total_rebate),
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
      SUM(Qtty)  AS qtty,
      SUM(Rebate) AS rebate
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
    rebate:  n(r.rebate),
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
      SUM(Qtty)      AS qtty,
      SUM(Qtty2)     AS qtty2
    FROM base
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
