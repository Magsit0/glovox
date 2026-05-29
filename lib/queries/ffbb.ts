import { query } from "@/lib/bigquery";
import type {
  EvolucionRow,
  FfbbBarraRow,
  FfbbCategoriaRow,
  FfbbEventDetail,
  FfbbEventOption,
  FfbbKpis,
  FfbbListadoRow,
  FfbbProductoRow,
  InsumoConsumoRow,
} from "@/lib/ffbb/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const SOLD_ITEMS = `\`${P}.onfire.soldItems\``;
const FORMULA_TRAGO = `\`${P}.onfire.formulaTragoBQ\``;
const CATEGORIA_EV = `\`${P}.glovox.categoriaEvento\``;

const FFBB_FILTER = `LOWER(IFNULL(Categoria, '')) NOT IN ('on-fire', 'comida')`;
const BARRA_EXPR = `CASE WHEN LOWER(IFNULL(NombrePunto, '')) LIKE '%vip mesa%' THEN 'Barra Vip Cocteles' ELSE NombrePunto END`;

// Fecha del evento = 5° valor ascendente de HoraPedido (descarta timestamps
// de pruebas o aperturas tempranas). Sin filtro FFBB porque la fecha existe
// para todo el evento, no solo para barra.
const EVENTO_FECHA_CTE = `
  eventoFecha AS (
    SELECT
      EventoID,
      CAST(
        DATE(ARRAY_AGG(HoraPedido ORDER BY HoraPedido ASC LIMIT 5)[SAFE_OFFSET(4)])
        AS STRING
      ) AS fechaEvento
    FROM ${SOLD_ITEMS}
    WHERE EventoID IS NOT NULL AND HoraPedido IS NOT NULL
    GROUP BY EventoID
  )
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
      const anyVal = val as { value?: unknown; constructor?: { name?: string }; toString(): string };
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

function withTimeout<T>(p: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Intentá de nuevo.`)),
      ms,
    ),
  );
  return Promise.race([p, timeoutPromise]);
}

// --- Event options (selector + base de listado) -----------------------------

const EVENT_OPTIONS_SQL = `
  WITH eventos AS (
    SELECT DISTINCT EventoID
    FROM ${SOLD_ITEMS}
    WHERE ${FFBB_FILTER} AND EventoID IS NOT NULL
  ),
  ${EVENTO_FECHA_CTE}
  SELECT
    e.EventoID                                              AS eventoId,
    IFNULL(ANY_VALUE(c.NombreGlovox), e.EventoID)           AS nombre,
    ANY_VALUE(ef.fechaEvento)                                AS fechaEvento,
    IFNULL(ANY_VALUE(c.CategoriaEvento), '')                AS categoriaEvento
  FROM eventos e
  LEFT JOIN ${CATEGORIA_EV} c USING (EventoID)
  LEFT JOIN eventoFecha ef USING (EventoID)
  GROUP BY e.EventoID
  ORDER BY fechaEvento DESC NULLS LAST, e.EventoID DESC
`;

let optionsCache: { data: FfbbEventOption[]; timestamp: number } | null = null;

export async function getFfbbEventOptions(): Promise<FfbbEventOption[]> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.timestamp < CACHE_TTL_MS) {
    return optionsCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(EVENT_OPTIONS_SQL));
  const data: FfbbEventOption[] = rows.map((r) => {
    const s = serialize(r);
    return {
      eventoId: str(s.eventoId),
      nombre: str(s.nombre),
      fechaEvento: strOrNull(s.fechaEvento),
      categoriaEvento: str(s.categoriaEvento),
    };
  });
  optionsCache = { data, timestamp: now };
  return data;
}

// --- Listado --------------------------------------------------------------

const LISTADO_SQL = `
  WITH ventas AS (
    SELECT
      EventoID,
      SUM(IFNULL(SubTotal, 0))     AS ventas,
      SUM(IFNULL(Cantidad, 0))     AS unidades,
      COUNT(DISTINCT Producto)     AS productosUnicos,
      COUNT(DISTINCT ${BARRA_EXPR}) AS barras
    FROM ${SOLD_ITEMS}
    WHERE ${FFBB_FILTER} AND EventoID IS NOT NULL
    GROUP BY EventoID
  ),
  ${EVENTO_FECHA_CTE}
  SELECT
    v.EventoID                                              AS eventoId,
    IFNULL(ANY_VALUE(c.NombreGlovox), v.EventoID)           AS nombre,
    ANY_VALUE(ef.fechaEvento)                                AS fechaEvento,
    IFNULL(ANY_VALUE(c.CategoriaEvento), '')                AS categoriaEvento,
    ANY_VALUE(v.ventas)                                     AS ventas,
    ANY_VALUE(v.unidades)                                   AS unidades,
    ANY_VALUE(v.productosUnicos)                            AS productosUnicos,
    ANY_VALUE(v.barras)                                     AS barras
  FROM ventas v
  LEFT JOIN ${CATEGORIA_EV} c USING (EventoID)
  LEFT JOIN eventoFecha ef USING (EventoID)
  GROUP BY v.EventoID
  ORDER BY fechaEvento DESC NULLS LAST, v.EventoID DESC
`;

let listadoCache: { data: FfbbListadoRow[]; timestamp: number } | null = null;

export async function getFfbbListadoKpis(): Promise<FfbbListadoRow[]> {
  const now = Date.now();
  if (listadoCache && now - listadoCache.timestamp < CACHE_TTL_MS) {
    return listadoCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(LISTADO_SQL));
  const data: FfbbListadoRow[] = rows.map((r) => {
    const s = serialize(r);
    return {
      eventoId: str(s.eventoId),
      nombre: str(s.nombre),
      fechaEvento: strOrNull(s.fechaEvento),
      categoriaEvento: str(s.categoriaEvento),
      ventas: num(s.ventas),
      unidades: num(s.unidades),
      productosUnicos: num(s.productosUnicos),
      barras: num(s.barras),
    };
  });
  listadoCache = { data, timestamp: now };
  return data;
}

// --- Detalle por evento ----------------------------------------------------

const KPIS_SQL = `
  SELECT
    SUM(IFNULL(SubTotal, 0))     AS ventas,
    SUM(IFNULL(Cantidad, 0))     AS unidades,
    COUNT(DISTINCT NumeroOrden)  AS transacciones,
    COUNT(DISTINCT Producto)     AS productosUnicos
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @eventoId AND ${FFBB_FILTER}
`;

const POR_CATEGORIA_SQL = `
  SELECT
    IFNULL(Categoria, 'Sin categoría') AS categoria,
    SUM(IFNULL(SubTotal, 0))           AS ventas,
    SUM(IFNULL(Cantidad, 0))           AS unidades
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @eventoId AND ${FFBB_FILTER}
  GROUP BY categoria
  ORDER BY ventas DESC
`;

const TOP_PRODUCTOS_SQL = `
  SELECT
    Producto                AS producto,
    SUM(IFNULL(SubTotal, 0)) AS ventas,
    SUM(IFNULL(Cantidad, 0)) AS unidades
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @eventoId AND ${FFBB_FILTER}
  GROUP BY producto
  ORDER BY ventas DESC
  LIMIT 15
`;

const POR_BARRA_SQL = `
  SELECT
    ${BARRA_EXPR}                AS nombreBarra,
    SUM(IFNULL(SubTotal, 0))     AS ventas,
    SUM(IFNULL(Cantidad, 0))     AS unidades,
    COUNT(DISTINCT NumeroOrden)  AS transacciones
  FROM ${SOLD_ITEMS}
  WHERE EventoID = @eventoId AND ${FFBB_FILTER}
  GROUP BY nombreBarra
  ORDER BY ventas DESC
`;

const detailCache = new Map<string, { data: FfbbEventDetail; timestamp: number }>();

export async function getFfbbEventDetail(eventoId: string): Promise<FfbbEventDetail> {
  const now = Date.now();
  const cached = detailCache.get(eventoId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = { eventoId };
  const [kpisRaw, catRaw, prodRaw, barraRaw, options] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(KPIS_SQL, params)),
    withTimeout(query<Record<string, unknown>>(POR_CATEGORIA_SQL, params)),
    withTimeout(query<Record<string, unknown>>(TOP_PRODUCTOS_SQL, params)),
    withTimeout(query<Record<string, unknown>>(POR_BARRA_SQL, params)),
    getFfbbEventOptions(),
  ]);

  const kpisRow = kpisRaw[0] ? serialize(kpisRaw[0]) : {};
  const ventas = num(kpisRow.ventas);
  const transacciones = num(kpisRow.transacciones);
  const kpis: FfbbKpis = {
    ventas,
    unidades: num(kpisRow.unidades),
    transacciones,
    productosUnicos: num(kpisRow.productosUnicos),
    ticketPromedio: transacciones > 0 ? ventas / transacciones : 0,
  };

  const totalVentasCat = catRaw.reduce(
    (acc, r) => acc + num(serialize(r).ventas),
    0,
  );

  const porCategoria: FfbbCategoriaRow[] = catRaw.map((r) => {
    const s = serialize(r);
    const v = num(s.ventas);
    return {
      categoria: str(s.categoria),
      ventas: v,
      unidades: num(s.unidades),
      sharePct: totalVentasCat > 0 ? (v / totalVentasCat) * 100 : 0,
    };
  });

  const topProductos: FfbbProductoRow[] = prodRaw.map((r) => {
    const s = serialize(r);
    return {
      producto: str(s.producto),
      ventas: num(s.ventas),
      unidades: num(s.unidades),
    };
  });

  const porBarra: FfbbBarraRow[] = barraRaw.map((r) => {
    const s = serialize(r);
    const v = num(s.ventas);
    const t = num(s.transacciones);
    return {
      nombreBarra: str(s.nombreBarra) || "Sin barra",
      ventas: v,
      unidades: num(s.unidades),
      transacciones: t,
      ticketPromedio: t > 0 ? v / t : 0,
    };
  });

  const optionMeta = options.find((o) => o.eventoId === eventoId);

  const detail: FfbbEventDetail = {
    eventoId,
    nombre: optionMeta?.nombre ?? eventoId,
    fechaEvento: optionMeta?.fechaEvento ?? null,
    categoriaEvento: optionMeta?.categoriaEvento ?? "",
    kpis,
    porCategoria,
    topProductos,
    porBarra,
  };
  detailCache.set(eventoId, { data: detail, timestamp: now });
  return detail;
}

// --- Insumos consumidos ----------------------------------------------------

const INSUMOS_SQL = `
  WITH sold AS (
    SELECT
      ${BARRA_EXPR}            AS nombreBarra,
      Producto                 AS producto,
      IFNULL(Cantidad, 0)      AS cantidad
    FROM ${SOLD_ITEMS}
    WHERE EventoID = @eventoId AND ${FFBB_FILTER}
  )
  SELECT
    IFNULL(s.nombreBarra, 'Sin barra')  AS nombreBarra,
    f.Insumo                            AS insumo,
    SUM(s.cantidad * IFNULL(f.Cantidad, 0)) AS cantidadConsumida
  FROM sold s
  JOIN ${FORMULA_TRAGO} f
    ON s.producto = f.Producto
  GROUP BY nombreBarra, insumo
  ORDER BY cantidadConsumida DESC
`;

const insumosCache = new Map<string, { data: InsumoConsumoRow[]; timestamp: number }>();

export async function getFfbbInsumosConsumidos(
  eventoId: string,
): Promise<InsumoConsumoRow[]> {
  const now = Date.now();
  const cached = insumosCache.get(eventoId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const rows = await withTimeout(
    query<Record<string, unknown>>(INSUMOS_SQL, { eventoId }),
  );
  const data: InsumoConsumoRow[] = rows.map((r) => {
    const s = serialize(r);
    return {
      nombreBarra: str(s.nombreBarra) || "Sin barra",
      insumo: str(s.insumo),
      cantidadConsumida: num(s.cantidadConsumida),
    };
  });
  insumosCache.set(eventoId, { data, timestamp: now });
  return data;
}

// --- Selectores de evolución -----------------------------------------------

const PRODUCTOS_SQL = `
  SELECT DISTINCT Producto AS producto
  FROM ${SOLD_ITEMS}
  WHERE ${FFBB_FILTER} AND Producto IS NOT NULL
  ORDER BY producto ASC
`;

const INSUMOS_LIST_SQL = `
  SELECT DISTINCT Insumo AS insumo
  FROM ${FORMULA_TRAGO}
  WHERE Insumo IS NOT NULL
  ORDER BY insumo ASC
`;

let productosCache: { data: string[]; timestamp: number } | null = null;
let insumosListCache: { data: string[]; timestamp: number } | null = null;

export async function getFfbbProductos(): Promise<string[]> {
  const now = Date.now();
  if (productosCache && now - productosCache.timestamp < CACHE_TTL_MS) {
    return productosCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(PRODUCTOS_SQL));
  const data = rows.map((r) => str(serialize(r).producto)).filter(Boolean);
  productosCache = { data, timestamp: now };
  return data;
}

export async function getFfbbInsumos(): Promise<string[]> {
  const now = Date.now();
  if (insumosListCache && now - insumosListCache.timestamp < CACHE_TTL_MS) {
    return insumosListCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(INSUMOS_LIST_SQL));
  const data = rows.map((r) => str(serialize(r).insumo)).filter(Boolean);
  insumosListCache = { data, timestamp: now };
  return data;
}

// --- Evolución a través de eventos ----------------------------------------

const EVOLUCION_PRODUCTO_SQL = `
  WITH ${EVENTO_FECHA_CTE}
  SELECT
    a.EventoID                                              AS eventoId,
    IFNULL(ANY_VALUE(c.NombreGlovox), a.EventoID)           AS nombre,
    ANY_VALUE(ef.fechaEvento)                                AS fechaEvento,
    SUM(IFNULL(a.SubTotal, 0))                              AS ventas,
    SUM(IFNULL(a.Cantidad, 0))                              AS unidades
  FROM ${SOLD_ITEMS} a
  LEFT JOIN ${CATEGORIA_EV} c USING (EventoID)
  LEFT JOIN eventoFecha ef USING (EventoID)
  WHERE a.Producto = @producto AND ${FFBB_FILTER}
  GROUP BY a.EventoID
  ORDER BY fechaEvento ASC NULLS LAST, a.EventoID ASC
`;

const EVOLUCION_INSUMO_SQL = `
  WITH ${EVENTO_FECHA_CTE},
  sold AS (
    SELECT
      a.EventoID,
      a.Producto,
      a.Cantidad
    FROM ${SOLD_ITEMS} a
    WHERE ${FFBB_FILTER}
  ),
  consumo AS (
    SELECT
      s.EventoID,
      SUM(IFNULL(s.Cantidad, 0) * IFNULL(f.Cantidad, 0)) AS cantidadConsumida
    FROM sold s
    JOIN ${FORMULA_TRAGO} f ON s.Producto = f.Producto
    WHERE f.Insumo = @insumo
    GROUP BY s.EventoID
  )
  SELECT
    co.EventoID                                             AS eventoId,
    IFNULL(ANY_VALUE(c.NombreGlovox), co.EventoID)          AS nombre,
    ANY_VALUE(ef.fechaEvento)                                AS fechaEvento,
    ANY_VALUE(co.cantidadConsumida)                         AS valor
  FROM consumo co
  LEFT JOIN ${CATEGORIA_EV} c USING (EventoID)
  LEFT JOIN eventoFecha ef USING (EventoID)
  GROUP BY co.EventoID
  ORDER BY fechaEvento ASC NULLS LAST, co.EventoID ASC
`;

function mapEvolucionRow(r: Record<string, unknown>, valueKey: string): EvolucionRow {
  const s = serialize(r);
  return {
    eventoId: str(s.eventoId),
    nombre: str(s.nombre),
    fechaEvento: strOrNull(s.fechaEvento),
    valor: num(s[valueKey]),
  };
}

export async function getFfbbEvolucionProducto(
  producto: string,
  metric: "ventas" | "unidades" = "ventas",
): Promise<EvolucionRow[]> {
  const rows = await withTimeout(
    query<Record<string, unknown>>(EVOLUCION_PRODUCTO_SQL, { producto }),
  );
  return rows.map((r) => mapEvolucionRow(r, metric));
}

export async function getFfbbEvolucionInsumo(insumo: string): Promise<EvolucionRow[]> {
  const rows = await withTimeout(
    query<Record<string, unknown>>(EVOLUCION_INSUMO_SQL, { insumo }),
  );
  return rows.map((r) => mapEvolucionRow(r, "valor"));
}

// --- Cache busting ---------------------------------------------------------

export function invalidateFfbbCache(eventoId?: string): void {
  if (eventoId) {
    detailCache.delete(eventoId);
    insumosCache.delete(eventoId);
    return;
  }
  detailCache.clear();
  insumosCache.clear();
  optionsCache = null;
  listadoCache = null;
  productosCache = null;
  insumosListCache = null;
}
