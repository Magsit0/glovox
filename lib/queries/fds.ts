import { query } from "@/lib/bigquery";
import {
  getTicketingByCategoria,
  getTicketingByTipo,
  getTicketingKpis,
} from "@/lib/queries/ticketing";
import type {
  FdsEventOption,
  FdsFfbbData,
  FdsFinanzas,
  FdsGastoBucket,
  FdsGastoEdicion,
  FdsGastosData,
  FdsHistoricoRow,
  FdsResumen,
  FdsTicketsData,
} from "@/lib/fds/types";
import type { FfbbCategoriaRow } from "@/lib/ffbb/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const CATEGORIA_EV = `\`${P}.glovox.categoriaEvento\``;
const TICKETS = `\`${P}.glovox.tickets\``;
const SOLD_ITEMS = `\`${P}.onfire.soldItems\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;
const NEGOCIOS = `\`${P}.finanzas.unabase_negocios\``;
const NEGOCIO_ITEM = `\`${P}.finanzas.unabase_negocio_items\``;
const DETALLE_GASTO = `\`${P}.finanzas.unabase_detalle_gasto\``;

// Negocio de producción del evento: se conecta por los primeros 6 caracteres de
// `referencia` (= EventoID). Igual criterio que /cierre-negocio y estadoNegocio.
const NEGOCIO_PRODUCCION_WHERE = `
  LOWER(CAST(area_negocio AS STRING)) = 'produccion de eventos propios'
  AND LOWER(CAST(estado AS STRING)) <> 'cotizacion'
`;

const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 22_000;

function serialize(row: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      obj[key] = null;
      continue;
    }
    if (typeof val === "object") {
      const anyVal = val as {
        value?: unknown;
        constructor?: { name?: string };
        toString(): string;
      };
      if (typeof anyVal.value === "string") {
        obj[key] = anyVal.value;
      } else if (anyVal.constructor?.name === "Big") {
        obj[key] = parseFloat(anyVal.toString());
      } else {
        obj[key] = val;
      }
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function boolish(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() === "true";
}

function safePerCapita(total: number, asistentes: number | null): number | null {
  if (!asistentes || asistentes <= 0) return null;
  return total / asistentes;
}

function withTimeout<T>(p: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(`BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Intentá de nuevo.`),
        ),
      ms,
    ),
  );
  return Promise.race([p, timeoutPromise]);
}

// --- Selector de ediciones -------------------------------------------------

const EVENT_OPTIONS_SQL = `
  WITH fds AS (
    SELECT EventoID,
           ANY_VALUE(NombreGlovox) AS nombre,
           IFNULL(ANY_VALUE(Temporada), '') AS temporada
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  ),
  fe AS (
    SELECT EventoID, FORMAT_DATE('%Y-%m-%d', DATE(MIN(FechaEvento))) AS fecha
    FROM ${TICKETS}
    WHERE EventoID IN (SELECT EventoID FROM fds) AND FechaEvento IS NOT NULL
    GROUP BY EventoID
  ),
  ce AS (
    SELECT EventoID, MAX(TotalAsistentes) AS asistentes
    FROM ${CIERRE_EVENTOS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  ff AS (
    SELECT EventoID, COUNT(*) AS filas
    FROM ${SOLD_ITEMS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  fin AS (
    SELECT UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) AS eid
    FROM ${NEGOCIOS}
    WHERE ${NEGOCIO_PRODUCCION_WHERE}
      AND UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) IN (SELECT EventoID FROM fds)
    GROUP BY 1
  )
  SELECT
    f.EventoID           AS eventoId,
    f.nombre             AS nombre,
    f.temporada          AS temporada,
    fe.fecha             AS fechaEvento,
    ce.asistentes        AS asistentes,
    IFNULL(ff.filas, 0) > 0        AS tieneFfbb,
    fin.eid IS NOT NULL            AS tieneFinanzas
  FROM fds f
  LEFT JOIN fe ON fe.EventoID = f.EventoID
  LEFT JOIN ce ON ce.EventoID = f.EventoID
  LEFT JOIN ff ON ff.EventoID = f.EventoID
  LEFT JOIN fin ON fin.eid = f.EventoID
  ORDER BY fe.fecha DESC NULLS LAST, f.EventoID DESC
`;

let optionsCache: { data: FdsEventOption[]; timestamp: number } | null = null;

export async function getFdsEventOptions(): Promise<FdsEventOption[]> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.timestamp < CACHE_TTL_MS) {
    return optionsCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(EVENT_OPTIONS_SQL));
  const data: FdsEventOption[] = rows.map((r) => {
    const s = serialize(r);
    return {
      eventoId: str(s.eventoId),
      nombre: str(s.nombre) || str(s.eventoId),
      fechaEvento: strOrNull(s.fechaEvento),
      temporada: str(s.temporada),
      asistentes: s.asistentes == null ? null : num(s.asistentes),
      tieneFfbb: boolish(s.tieneFfbb),
      tieneFinanzas: boolish(s.tieneFinanzas),
    };
  });
  optionsCache = { data, timestamp: now };
  return data;
}

// --- Resumen ---------------------------------------------------------------

const RESUMEN_SQL = `
  WITH tk AS (
    SELECT SUM(Precio - IFNULL(Descuento, 0)) AS venta, COUNT(*) AS tickets
    FROM ${TICKETS}
    WHERE EventoID = @id AND EsDevuelto IS NOT TRUE
  ),
  ff AS (
    SELECT SUM(IFNULL(SubTotal, 0)) AS venta, SUM(IFNULL(Cantidad, 0)) AS unidades, COUNT(*) AS filas
    FROM ${SOLD_ITEMS}
    WHERE EventoID = @id
  ),
  ce AS (
    SELECT MAX(TotalAsistentes) AS asistentes, MAX(TotalCargoServicio) AS cargo
    FROM ${CIERRE_EVENTOS}
    WHERE EventoID = @id
  ),
  cat AS (
    SELECT ANY_VALUE(NombreGlovox) AS nombre, IFNULL(ANY_VALUE(Temporada), '') AS temporada
    FROM ${CATEGORIA_EV}
    WHERE EventoID = @id
  ),
  fe AS (
    SELECT FORMAT_DATE('%Y-%m-%d', DATE(MIN(FechaEvento))) AS fecha
    FROM ${TICKETS}
    WHERE EventoID = @id AND FechaEvento IS NOT NULL
  ),
  fin AS (
    SELECT COUNT(*) AS n
    FROM ${NEGOCIOS}
    WHERE UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) = @id AND ${NEGOCIO_PRODUCCION_WHERE}
  )
  SELECT
    cat.nombre AS nombre, cat.temporada AS temporada, fe.fecha AS fechaEvento,
    IFNULL(tk.venta, 0) AS ventaTickets, IFNULL(tk.tickets, 0) AS tickets,
    IFNULL(ff.venta, 0) AS ventaFfbb, IFNULL(ff.unidades, 0) AS unidadesFfbb,
    IFNULL(ff.filas, 0) AS ffbbFilas,
    ce.asistentes AS asistentes, IFNULL(ce.cargo, 0) AS cargoServicio,
    fin.n AS finN
  FROM tk, ff, ce, cat, fe, fin
`;

const resumenCache = new Map<string, { data: FdsResumen; timestamp: number }>();

export async function getFdsResumen(eventoId: string): Promise<FdsResumen> {
  const now = Date.now();
  const cached = resumenCache.get(eventoId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.data;

  const rows = await withTimeout(query<Record<string, unknown>>(RESUMEN_SQL, { id: eventoId }));
  const s = rows[0] ? serialize(rows[0]) : {};
  const asistentes = s.asistentes == null ? null : num(s.asistentes);
  const ventaTickets = num(s.ventaTickets);
  const ventaFfbb = num(s.ventaFfbb);
  const cargoServicio = num(s.cargoServicio);

  const data: FdsResumen = {
    eventoId,
    nombre: str(s.nombre) || eventoId,
    fechaEvento: strOrNull(s.fechaEvento),
    temporada: str(s.temporada),
    asistentes,
    tickets: num(s.tickets),
    ventaTickets,
    ventaFfbb,
    unidadesFfbb: num(s.unidadesFfbb),
    cargoServicio,
    ventaTotal: ventaTickets + ventaFfbb + cargoServicio,
    perCapitaTickets: safePerCapita(ventaTickets, asistentes),
    perCapitaFfbb: safePerCapita(ventaFfbb, asistentes),
    tieneFfbb: num(s.ffbbFilas) > 0,
    tieneFinanzas: num(s.finN) > 0,
  };
  resumenCache.set(eventoId, { data, timestamp: now });
  return data;
}

// --- Tickets (reusa lib/queries/ticketing) ---------------------------------

export async function getFdsTickets(eventoId: string): Promise<FdsTicketsData> {
  const filters = { eventoId, country: "all" as const, incluirDevueltos: false };
  const [kpis, porTipo, porCategoria, cortesias] = await Promise.all([
    getTicketingKpis(filters),
    getTicketingByTipo(filters),
    getTicketingByCategoria(filters),
    getTicketingKpis({ ...filters, clases: ["CORTESIA"] }),
  ]);
  return {
    kpis: {
      tickets: kpis.tickets,
      venta: kpis.venta,
      ticketPromedio: kpis.ticketPromedio,
      cortesias: cortesias.tickets,
    },
    porTipo,
    porCategoria,
  };
}

// --- FF&BB (onfire.soldItems, INCLUYE comida) ------------------------------

const FFBB_KPIS_SQL = `
  SELECT
    SUM(IFNULL(SubTotal, 0))    AS ventas,
    SUM(IFNULL(Cantidad, 0))    AS unidades,
    COUNT(DISTINCT NumeroOrden) AS transacciones,
    COUNT(DISTINCT Producto)    AS productosUnicos,
    (SELECT MAX(TotalAsistentes) FROM ${CIERRE_EVENTOS} WHERE EventoID = @id) AS asistentes
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @id
`;

const FFBB_CATEGORIA_SQL = `
  SELECT UPPER(IFNULL(Categoria, 'Sin categoría')) AS categoria,
         SUM(IFNULL(SubTotal, 0)) AS ventas,
         SUM(IFNULL(Cantidad, 0)) AS unidades
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @id
  GROUP BY categoria
  ORDER BY ventas DESC
`;

const FFBB_PRODUCTOS_SQL = `
  SELECT Producto AS producto,
         SUM(IFNULL(SubTotal, 0)) AS ventas,
         SUM(IFNULL(Cantidad, 0)) AS unidades
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @id AND Producto IS NOT NULL
  GROUP BY producto
  ORDER BY ventas DESC
  LIMIT 15
`;

const FFBB_PUNTO_SQL = `
  SELECT IFNULL(NombrePunto, 'Sin punto') AS nombreBarra,
         SUM(IFNULL(SubTotal, 0)) AS ventas,
         SUM(IFNULL(Cantidad, 0)) AS unidades,
         COUNT(DISTINCT NumeroOrden) AS transacciones
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @id
  GROUP BY nombreBarra
  ORDER BY ventas DESC
`;

const TOP_CATEGORIAS = 7;

/** Agrupa la cola de categorías (más allá de las top N) en "Otros". */
function groupCategorias(raw: FfbbCategoriaRow[]): FfbbCategoriaRow[] {
  if (raw.length <= TOP_CATEGORIAS + 1) return raw;
  const top = raw.slice(0, TOP_CATEGORIAS);
  const rest = raw.slice(TOP_CATEGORIAS);
  const otros = rest.reduce(
    (acc, r) => ({
      ventas: acc.ventas + r.ventas,
      unidades: acc.unidades + r.unidades,
      sharePct: acc.sharePct + r.sharePct,
    }),
    { ventas: 0, unidades: 0, sharePct: 0 },
  );
  return [...top, { categoria: "Otros", ...otros }];
}

const ffbbCache = new Map<string, { data: FdsFfbbData; timestamp: number }>();

export async function getFdsFfbb(eventoId: string): Promise<FdsFfbbData> {
  const now = Date.now();
  const cached = ffbbCache.get(eventoId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.data;

  const params = { id: eventoId };
  const [kpisRaw, catRaw, prodRaw, puntoRaw] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(FFBB_KPIS_SQL, params)),
    withTimeout(query<Record<string, unknown>>(FFBB_CATEGORIA_SQL, params)),
    withTimeout(query<Record<string, unknown>>(FFBB_PRODUCTOS_SQL, params)),
    withTimeout(query<Record<string, unknown>>(FFBB_PUNTO_SQL, params)),
  ]);

  const k = kpisRaw[0] ? serialize(kpisRaw[0]) : {};
  const ventas = num(k.ventas);
  const transacciones = num(k.transacciones);
  const asistentes = k.asistentes == null ? null : num(k.asistentes);

  const totalCat = catRaw.reduce((acc, r) => acc + num(serialize(r).ventas), 0);
  const porCategoria = groupCategorias(
    catRaw.map((r) => {
      const cs = serialize(r);
      const v = num(cs.ventas);
      return {
        categoria: str(cs.categoria),
        ventas: v,
        unidades: num(cs.unidades),
        sharePct: totalCat > 0 ? (v / totalCat) * 100 : 0,
      };
    }),
  );

  const data: FdsFfbbData = {
    kpis: {
      ventas,
      unidades: num(k.unidades),
      transacciones,
      productosUnicos: num(k.productosUnicos),
      ticketPromedio: transacciones > 0 ? ventas / transacciones : 0,
    },
    perCapita: safePerCapita(ventas, asistentes),
    porCategoria,
    topProductos: prodRaw.map((r) => {
      const s = serialize(r);
      return { producto: str(s.producto), ventas: num(s.ventas), unidades: num(s.unidades) };
    }),
    porPunto: puntoRaw.map((r) => {
      const s = serialize(r);
      const v = num(s.ventas);
      const t = num(s.transacciones);
      return {
        nombreBarra: str(s.nombreBarra) || "Sin punto",
        ventas: v,
        unidades: num(s.unidades),
        transacciones: t,
        ticketPromedio: t > 0 ? v / t : 0,
      };
    }),
  };
  ffbbCache.set(eventoId, { data, timestamp: now });
  return data;
}

// --- Finanzas & Admin (finanzas.unabase_*) ---------------------------------

const NEGOCIO_SQL = `
  SELECT
    CAST(id AS STRING) AS id,
    CAST(referencia AS STRING) AS referencia,
    CAST(estado AS STRING) AS estado,
    CAST(area_negocio AS STRING) AS area,
    CAST(razon_cliente AS STRING) AS cliente,
    IFNULL(total_facturado, 0) AS facturado,
    IFNULL(total_neto, 0) AS neto,
    IFNULL(costo_presupuestado, 0) AS costoPre,
    IFNULL(costo_real, 0) AS costoReal
  FROM ${NEGOCIOS}
  WHERE UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) = @id AND ${NEGOCIO_PRODUCCION_WHERE}
  ORDER BY total_facturado DESC
  LIMIT 1
`;

const NEGOCIO_ITEMS_SQL = `
  SELECT
    CAST(categoria AS STRING) AS categoria,
    SUM(IFNULL(sub_gasto_pre, 0)) AS presupuestado,
    SUM(IFNULL(total_gasto_real, 0)) AS real
  FROM ${NEGOCIO_ITEM}
  WHERE CAST(negocio AS STRING) = @nid AND tipo_item = 'ITEM' AND isSubCat = FALSE
  GROUP BY categoria
  ORDER BY real DESC
`;

const PROVEEDORES_SQL = `
  SELECT
    CAST(proveedor AS STRING) AS proveedor,
    SUM(IFNULL(costoempresa, 0)) AS monto,
    COUNT(*) AS docs
  FROM ${DETALLE_GASTO}
  WHERE CAST(negocio AS STRING) = @nid AND IFNULL(excluir_gasto, FALSE) = FALSE
  GROUP BY proveedor
  ORDER BY monto DESC
  LIMIT 10
`;

const finanzasCache = new Map<string, { data: FdsFinanzas | null; timestamp: number }>();

export async function getFdsFinanzas(eventoId: string): Promise<FdsFinanzas | null> {
  const now = Date.now();
  const cached = finanzasCache.get(eventoId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.data;

  const negRows = await withTimeout(query<Record<string, unknown>>(NEGOCIO_SQL, { id: eventoId }));
  if (!negRows[0]) {
    finanzasCache.set(eventoId, { data: null, timestamp: now });
    return null;
  }
  const n = serialize(negRows[0]);
  const nid = str(n.id);

  const [itemsRaw, provRaw] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(NEGOCIO_ITEMS_SQL, { nid })),
    withTimeout(query<Record<string, unknown>>(PROVEEDORES_SQL, { nid })),
  ]);

  const neto = num(n.neto);
  const costoReal = num(n.costoReal);
  const margen = neto - costoReal;

  const data: FdsFinanzas = {
    negocioId: nid,
    referencia: str(n.referencia),
    estado: str(n.estado),
    area: str(n.area),
    cliente: str(n.cliente),
    facturado: num(n.facturado),
    neto,
    costoPresupuestado: num(n.costoPre),
    costoReal,
    margen,
    margenPct: neto > 0 ? margen / neto : null,
    itemsPorCategoria: itemsRaw
      .map((r) => {
        const s = serialize(r);
        const pre = num(s.presupuestado);
        const real = num(s.real);
        return {
          categoria: str(s.categoria) || "Sin categoría",
          presupuestado: pre,
          real,
          diferencia: real - pre,
        };
      })
      .filter((i) => i.presupuestado !== 0 || i.real !== 0),
    topProveedores: provRaw
      .map((r) => {
        const s = serialize(r);
        return { proveedor: str(s.proveedor) || "Sin proveedor", monto: num(s.monto), docs: num(s.docs) };
      })
      .filter((p) => p.monto !== 0),
  };
  finanzasCache.set(eventoId, { data, timestamp: now });
  return data;
}

// --- Histórico entre ediciones ---------------------------------------------

const HISTORICO_SQL = `
  WITH fds AS (
    SELECT EventoID,
           ANY_VALUE(NombreGlovox) AS nombre,
           IFNULL(ANY_VALUE(Temporada), '') AS temporada
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  ),
  fe AS (
    SELECT EventoID, FORMAT_DATE('%Y-%m-%d', DATE(MIN(FechaEvento))) AS fecha
    FROM ${TICKETS}
    WHERE EventoID IN (SELECT EventoID FROM fds) AND FechaEvento IS NOT NULL
    GROUP BY EventoID
  ),
  tk AS (
    SELECT EventoID, SUM(Precio - IFNULL(Descuento, 0)) AS venta
    FROM ${TICKETS}
    WHERE EventoID IN (SELECT EventoID FROM fds) AND EsDevuelto IS NOT TRUE
    GROUP BY EventoID
  ),
  ff AS (
    SELECT EventoID, SUM(IFNULL(SubTotal, 0)) AS venta
    FROM ${SOLD_ITEMS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  ce AS (
    SELECT EventoID, MAX(TotalAsistentes) AS asistentes
    FROM ${CIERRE_EVENTOS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  fin AS (
    SELECT UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) AS eid,
           SUM(IFNULL(total_neto, 0)) AS facturado,
           SUM(IFNULL(costo_real, 0)) AS costoReal
    FROM ${NEGOCIOS}
    WHERE ${NEGOCIO_PRODUCCION_WHERE}
      AND UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) IN (SELECT EventoID FROM fds)
    GROUP BY 1
  )
  SELECT
    f.EventoID AS eventoId, f.nombre AS nombre, f.temporada AS temporada,
    fe.fecha AS fechaEvento, ce.asistentes AS asistentes,
    IFNULL(tk.venta, 0) AS ventaTickets, IFNULL(ff.venta, 0) AS ventaFfbb,
    fin.facturado AS facturado, fin.costoReal AS costoReal
  FROM fds f
  LEFT JOIN fe ON fe.EventoID = f.EventoID
  LEFT JOIN tk ON tk.EventoID = f.EventoID
  LEFT JOIN ff ON ff.EventoID = f.EventoID
  LEFT JOIN ce ON ce.EventoID = f.EventoID
  LEFT JOIN fin ON fin.eid = f.EventoID
  ORDER BY fe.fecha ASC NULLS LAST, f.EventoID ASC
`;

let historicoCache: { data: FdsHistoricoRow[]; timestamp: number } | null = null;

export async function getFdsHistorico(): Promise<FdsHistoricoRow[]> {
  const now = Date.now();
  if (historicoCache && now - historicoCache.timestamp < CACHE_TTL_MS) {
    return historicoCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(HISTORICO_SQL));
  const data: FdsHistoricoRow[] = rows.map((r) => {
    const s = serialize(r);
    const asistentes = s.asistentes == null ? null : num(s.asistentes);
    const ventaFfbb = num(s.ventaFfbb);
    const facturado = s.facturado == null ? null : num(s.facturado);
    const costoReal = s.costoReal == null ? null : num(s.costoReal);
    return {
      eventoId: str(s.eventoId),
      nombre: str(s.nombre) || str(s.eventoId),
      temporada: str(s.temporada),
      fechaEvento: strOrNull(s.fechaEvento),
      asistentes,
      ventaTickets: num(s.ventaTickets),
      ventaFfbb,
      perCapitaFfbb: safePerCapita(ventaFfbb, asistentes),
      facturado,
      costoReal,
      margen: facturado != null && costoReal != null ? facturado - costoReal : null,
    };
  });
  historicoCache = { data, timestamp: now };
  return data;
}

// --- Gastos del negocio por categoría (baseline de presupuesto) ------------
//
// Monto y universo = misma base canónica que getCostShareDefaults
// (finanzas.unabase_detalle_gasto, item_costo_real, excluir_gasto=FALSE, join
// referencia[:6]=EventoID sobre negocios de producción con filtro completo de
// estado). PERO la categoría se mapea a la ESTRUCTURA OFICIAL DE PRESUPUESTO en
// finanzas.unabase_catalogo (17 categorías top: OPERACIONES, PRODUCCION SITE/
// TECNICA, VENUE, SEGURIDAD, PERMISOS & AUTORIDADES, ARTISTICA, LOGISTICA &
// BODEGA, CONTENIDOS & EXPERIENCIAS, MARCAS & PATROCINIOS, SOSTENIBILIDAD,
// MARKETING, SUELDOS, RENTAL, BOTILLERIA, FINIQUITOS, ADMINISTRACION), NO a los
// 7 buckets genéricos de /presupuesto (que dejaban 9-87% en "otras" para FDS).
// El crosswalk es por NOMBRE (el item_codigo histórico —IT-NN/15.xx— no matchea
// el codigo 01.xx del catálogo): item_categoria → categoria del catálogo; si no,
// rollup desde sub_categoria/item/nombre; si no, "Otras / sin clasificar".
const CATALOGO = `\`${P}.finanzas.unabase_catalogo\``;
const OTRAS_LABEL = "Otras / sin clasificar";

const GASTOS_CATEGORIA_SQL = `
  WITH universo AS (
    SELECT EventoID
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  ),
  neg AS (
    SELECT
      CAST(id AS INT64) AS negocio_id,
      UPPER(SUBSTR(CAST(referencia AS STRING), 1, 6)) AS evento_id
    FROM ${NEGOCIOS}
    WHERE LOWER(CAST(area_negocio AS STRING)) = 'produccion de eventos propios'
      AND LOWER(IFNULL(CAST(estadonv AS STRING), '')) <> 'nulo'
      AND LOWER(IFNULL(CAST(estado AS STRING), '')) <> 'cotizacion'
  ),
  gasto AS (
    SELECT
      neg.evento_id,
      UPPER(TRIM(CAST(g.item_categoria AS STRING)))     AS item_categoria,
      UPPER(TRIM(CAST(g.item_sub_categoria AS STRING))) AS item_sub_categoria,
      SUM(IFNULL(SAFE_CAST(g.item_costo_real AS FLOAT64), 0)) AS monto
    FROM ${DETALLE_GASTO} g
    JOIN neg ON neg.negocio_id = g.negocio
    WHERE IFNULL(g.excluir_gasto, FALSE) = FALSE
      AND neg.evento_id IN (SELECT EventoID FROM universo)
    GROUP BY neg.evento_id, item_categoria, item_sub_categoria
  )
  SELECT evento_id, item_categoria, item_sub_categoria, monto
  FROM gasto
  WHERE monto > 0
`;

/** Normaliza un label para el crosswalk: sin acentos, mayúsculas, "&"→"Y",
 *  solo alfanumérico y espacios colapsados. */
function normCat(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, " Y ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Presentación Title Case de una categoría del catálogo (viene en MAYÚSCULAS). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s/&(-])([a-záéíóúñ])/g, (_, p, c) => p + c.toUpperCase());
}

// Crosswalk curado del vocabulario libre de FDS → categoría del catálogo, para
// las etiquetas históricas que NO son nodos del catálogo (sobre todo FDS 24 y
// las ediciones viejas). PROPUESTA revisable por el usuario: ajustar acá. El
// valor DEBE ser una `categoria` top-level real de finanzas.unabase_catalogo.
// Las marcadas (*) son mezclas/ambiguas y conviene validarlas.
const FDS_ALIAS_RAW: [string, string][] = [
  // Producción site
  ["IMPLEMENTACION STANDS", "PRODUCCION SITE"],
  ["IMPLEMENTACION GENERAL", "PRODUCCION SITE"],
  ["AMBIENTACIÓN & DECORACION", "PRODUCCION SITE"],
  ["AMBIENTACION Y DECORACION", "PRODUCCION SITE"],
  ["ESTRUCTURA PERI", "PRODUCCION SITE"],
  ["ENERGIA & GENERADORES", "PRODUCCION SITE"],
  ["EQUIPO SUPERVISIÓN Y PRODUCCION GENERAL EVENTO", "PRODUCCION SITE"], // *
  // Producción técnica
  ["ESCENARIO, PANTALLAS, AUDIO E ILUMINACION", "PRODUCCION TECNICA"],
  ["TÉCNICA ESCENARIO", "PRODUCCION TECNICA"],
  // Operaciones
  ["BAÑOS", "OPERACIONES"],
  ["ASEO GENERAL", "OPERACIONES"],
  ["EQUIPO BARRAS Y CAJAS", "OPERACIONES"],
  ["EQUIPO BARRAS CAJAS PUERTA", "OPERACIONES"],
  ["BAÑOS SERVICIOS Y ASEO GENERAL  SEGURIDAD", "OPERACIONES"], // * mezcla baños+aseo+seguridad
  ["INSUMOS BARRAS LIQUIDOS (VARIABLES)", "OPERACIONES"], // * insumos F&B
  ["INSUMOS BARRAS", "OPERACIONES"],
  // Marketing
  ["DIFUSION, COMUNICACIONES & RRSS", "MARKETING"],
  ["MARKETING Y COMUNICACIONES", "MARKETING"],
  ["PARTNERS DIFUSIÓN", "MARKETING"],
  // Artística / contenidos
  ["CONTENIDO MUSICAL", "ARTISTICA"],
  ["CONTENIDO ESCENARIO", "CONTENIDOS & EXPERIENCIAS"],
  ["CONTENIDOS", "CONTENIDOS & EXPERIENCIAS"],
  // Sueldos
  ["RRHH PRODUCCIÓN GENERAL (INTERNO)", "SUELDOS"],
  // Venue / permisos (mezcla)
  ["PARQUE & PERMISOS", "VENUE"], // * parque(venue)+permisos
  // Marcas
  ["SOCIOS", "MARCAS & PATROCINIOS"], // *
  // Variantes adicionales (misma idea, distinta escritura en ediciones viejas)
  ["AMBIENTACION DECORACION", "PRODUCCION SITE"],
  ["DIFUSION COMUNICACIONES RRSS", "MARKETING"],
  ["SERVICIOS Y ASEO GENERAL", "OPERACIONES"],
  ["EQUIPO SUPERVISION Y PRODUCCION", "PRODUCCION SITE"], // *
  ["STAND", "PRODUCCION SITE"],
  ["CONTENIDO AREA NIÑOS", "CONTENIDOS & EXPERIENCIAS"],
];
const FDS_CATEGORIA_ALIASES = new Map(FDS_ALIAS_RAW.map(([k, v]) => [normCat(k), v]));

interface CatalogoLookup {
  byName: Map<string, string>; // nombre normalizado → categoria canónica (top-level)
  categorias: string[]; // categorias top-level en orden del catálogo (por codigo)
}

let catalogoCache: { data: CatalogoLookup; timestamp: number } | null = null;

/** Índice del catálogo oficial finanzas.unabase_catalogo: mapea cualquier nivel
 *  (categoria/sub_categoria/item/nombre) al top-level `categoria`, con precedencia
 *  categoria > sub_categoria > item/nombre. */
async function getFdsCatalogoLookup(): Promise<CatalogoLookup> {
  const now = Date.now();
  if (catalogoCache && now - catalogoCache.timestamp < CACHE_TTL_MS) {
    return catalogoCache.data;
  }
  const raw = await withTimeout(
    query<Record<string, unknown>>(
      `SELECT categoria, sub_categoria, item, nombre, codigo FROM ${CATALOGO} WHERE categoria IS NOT NULL`,
    ),
  );
  const R = raw.map(serialize);
  const byName = new Map<string, string>();
  const set = (name: unknown, cat: string) => {
    const k = normCat(name);
    if (k && !byName.has(k)) byName.set(k, cat);
  };
  // Precedencia por pasadas: primero categoria, luego subcat, luego item/nombre.
  for (const r of R) {
    const cat = str(r.categoria);
    if (cat) set(cat, cat);
  }
  for (const r of R) {
    const cat = str(r.categoria);
    if (cat) set(r.sub_categoria, cat);
  }
  for (const r of R) {
    const cat = str(r.categoria);
    if (cat) {
      set(r.item, cat);
      set(r.nombre, cat);
    }
  }
  // Orden de las categorias top-level por su menor codigo.
  const minCodigo = new Map<string, string>();
  for (const r of R) {
    const cat = str(r.categoria);
    const cod = str(r.codigo);
    if (!cat) continue;
    const prev = minCodigo.get(cat);
    if (prev == null || cod < prev) minCodigo.set(cat, cod);
  }
  const categorias = [...minCodigo.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([c]) => c);

  const data: CatalogoLookup = { byName, categorias };
  catalogoCache = { data, timestamp: now };
  return data;
}

/** Mapea una línea de gasto histórica a una categoria del catálogo. */
function classifyToCatalogo(
  lookup: CatalogoLookup,
  itemCategoria: unknown,
  itemSubCategoria: unknown,
): { categoria: string; matched: boolean } {
  const n1 = normCat(itemCategoria);
  if (n1 && lookup.byName.has(n1)) return { categoria: lookup.byName.get(n1)!, matched: true };
  // Plural simple: "VENUES" → "VENUE".
  if (n1.endsWith("S") && lookup.byName.has(n1.slice(0, -1))) {
    return { categoria: lookup.byName.get(n1.slice(0, -1))!, matched: true };
  }
  // Crosswalk curado del vocabulario libre de FDS.
  if (n1 && FDS_CATEGORIA_ALIASES.has(n1)) {
    return { categoria: FDS_CATEGORIA_ALIASES.get(n1)!, matched: true };
  }
  const n2 = normCat(itemSubCategoria);
  if (n2 && lookup.byName.has(n2)) return { categoria: lookup.byName.get(n2)!, matched: true };
  if (n2 && FDS_CATEGORIA_ALIASES.has(n2)) {
    return { categoria: FDS_CATEGORIA_ALIASES.get(n2)!, matched: true };
  }
  return { categoria: OTRAS_LABEL, matched: false };
}

function tierForOtras(otrasPct: number): FdsGastoEdicion["tier"] {
  if (otrasPct < 0.15) return "A";
  if (otrasPct < 0.35) return "B";
  return "C";
}

let gastosCache: { data: FdsGastosData; timestamp: number } | null = null;

export async function getFdsGastosPorCategoria(): Promise<FdsGastosData> {
  const now = Date.now();
  if (gastosCache && now - gastosCache.timestamp < CACHE_TTL_MS) {
    return gastosCache.data;
  }

  const [rows, options, catalogo] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(GASTOS_CATEGORIA_SQL)),
    getFdsEventOptions(),
    getFdsCatalogoLookup(),
  ]);

  const optById = new Map(options.map((o) => [o.eventoId, o]));

  // Agrupar filas crudas por edición → montos por categoría canónica + sin mapear.
  const perEdition = new Map<string, Map<string, number>>();
  const sinMapearMap = new Map<string, number>();
  const seenCategorias = new Set<string>();
  for (const r of rows) {
    const s = serialize(r);
    const eventoId = str(s.evento_id);
    const itemCategoria = str(s.item_categoria);
    const monto = num(s.monto);
    if (!eventoId) continue;
    const { categoria, matched } = classifyToCatalogo(catalogo, itemCategoria, s.item_sub_categoria);
    seenCategorias.add(categoria);
    let byCat = perEdition.get(eventoId);
    if (!byCat) {
      byCat = new Map();
      perEdition.set(eventoId, byCat);
    }
    byCat.set(categoria, (byCat.get(categoria) ?? 0) + monto);
    if (!matched && itemCategoria) {
      sinMapearMap.set(itemCategoria, (sinMapearMap.get(itemCategoria) ?? 0) + monto);
    }
  }

  // Keys canónicas: categorias del catálogo que aparecen (en orden del catálogo)
  // + "Otras" al final si hubo gasto sin clasificar.
  const bucketKeys = catalogo.categorias.filter((c) => seenCategorias.has(c));
  if (seenCategorias.has(OTRAS_LABEL)) bucketKeys.push(OTRAS_LABEL);
  const bucketLabels: Record<string, string> = {};
  for (const k of bucketKeys) bucketLabels[k] = k === OTRAS_LABEL ? OTRAS_LABEL : titleCase(k);

  const editions: FdsGastoEdicion[] = [];
  for (const [eventoId, byCat] of perEdition) {
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    const buckets: FdsGastoBucket[] = bucketKeys.map((key) => {
      const monto = byCat.get(key) ?? 0;
      return { key, label: bucketLabels[key], monto, pct: total > 0 ? monto / total : 0 };
    });
    const otrasPct = (byCat.get(OTRAS_LABEL) ?? 0) / total;
    const opt = optById.get(eventoId);
    editions.push({
      eventoId,
      nombre: opt?.nombre ?? eventoId,
      fechaEvento: opt?.fechaEvento ?? null,
      asistentes: opt?.asistentes ?? null,
      totalReal: total,
      otrasPct,
      tier: tierForOtras(otrasPct),
      buckets,
    });
  }

  editions.sort((a, b) => {
    if (a.fechaEvento && b.fechaEvento) return a.fechaEvento.localeCompare(b.fechaEvento);
    if (a.fechaEvento !== b.fechaEvento) return a.fechaEvento ? -1 : 1;
    return a.eventoId.localeCompare(b.eventoId, "es", { numeric: true });
  });

  const sinMapear = [...sinMapearMap.entries()]
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 12);

  const data: FdsGastosData = { editions, bucketKeys, bucketLabels, sinMapear };
  gastosCache = { data, timestamp: now };
  return data;
}

export function invalidateFdsCache(eventoId?: string): void {
  if (eventoId) {
    resumenCache.delete(eventoId);
    ffbbCache.delete(eventoId);
    finanzasCache.delete(eventoId);
    return;
  }
  optionsCache = null;
  historicoCache = null;
  gastosCache = null;
  resumenCache.clear();
  ffbbCache.clear();
  finanzasCache.clear();
}
