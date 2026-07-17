import { query } from "@/lib/bigquery";

/**
 * Dashboard PROVEEDOR — gasto por proveedor.
 *
 * Fuente: `marts.finanzas_gastos` (vista curada, 1 fila por ítem de gasto, con
 * el contexto del negocio ya joineado). Migrado 3-jul-2026 desde el par
 * detalle_gasto+negocios crudo — diff verificado 0 exacto en 5.803 proveedores.
 *
 * Reglas de scope (aplican a TODAS las queries):
 *  - `NOT es_interno_glovox` (negocios internos area 'GLOVOX' fuera).
 *  - `incluir_en_totales` (= NOT excluir_gasto).
 *
 * Métrica de gasto: `gasto_neto` (= item_costo_empresa, canónica; reconcilia
 * con el costo_real del maestro) o `gasto_bruto` (= neto + IVA) según el
 * switch neto/bruto del dashboard (?monto=bruto).
 *
 * Proveedor: este dashboard usa `proveedor_efectivo` (17-jul-2026) — el REAL
 * del servicio cuando Espacio Riesco re-factura a terceros (Provetec,
 * Casablanca, VDS, Denis Leiva…), resuelto en la vista vía el seed
 * `finanzas.gasto_proveedor_real` (workbook de finanzas) + Nº DOC. Así el
 * gasto no se infla en Riesco ni se desinfla en el proveedor real. Para el
 * resto de las filas proveedor_efectivo = proveedor declarado. El doc_key
 * mantiene el RUT DECLARADO: identifica el documento (emitido por Riesco),
 * no al prestador del servicio.
 */

const P = process.env.BIGQUERY_PROJECT_ID;

const GASTOS = `\`${P}.marts.finanzas_gastos\``;

/** Columna de monto por modo. Mapa fijo: NUNCA interpolar input del usuario. */
const MONTO_COL: Record<"neto" | "bruto", string> = {
  neto: "IFNULL(gasto_neto, 0)",
  bruto: "gasto_bruto",
};

// Tope de filas para el detalle descargable de un proveedor. Más que suficiente
// para un único proveedor; evita traer toda la tabla si algo se filtra mal.
const DETAIL_LIMIT = 5000;

const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 25_000;

// ---------- helpers ----------

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object)) {
    return Number((v as { value: unknown }).value);
  }
  return Number(v);
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object)) {
    return String((v as { value: unknown }).value);
  }
  return String(v);
}

function withTimeout<T>(p: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Intentá de nuevo.`,
          ),
        ),
      ms,
    ),
  );
  return Promise.race([p, timeout]);
}

// ---------- tipos ----------

export type ProveedorFilters = {
  proveedor?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  /** Switch neto/bruto del dashboard (default: neto). */
  monto?: "neto" | "bruto";
};

export type ProveedorOption = {
  proveedor: string;
  rut: string;
  gasto: number;
  docs: number;
  negocios: number;
};

export type ProveedorKpis = {
  gasto: number;
  documentos: number;
  negocios: number;
  categorias: number;
  ticketPromedio: number;
  primeraFecha: string;
  ultimaFecha: string;
};

export type MensualRow = {
  mes: string; // YYYY-MM
  gasto: number;
  docs: number;
};

export type NegocioBreakdownRow = {
  negocioId: string;
  nombre: string;
  gasto: number;
  docs: number;
  ultimaFecha: string;
};

export type CategoriaBreakdownRow = {
  categoria: string;
  gasto: number;
  docs: number;
};

export type DocumentoRow = {
  fecha: string;
  folio: string;
  doc: string;
  tipo: string;
  rut: string;
  proveedor: string;
  negocioId: string;
  negocioNombre: string;
  categoria: string;
  subCategoria: string;
  itemNombre: string;
  estado: string;
  validado: string;
  costo: number;
};

export type DateRange = { min: string; max: string };

export type MatrizProveedorAnioRow = {
  proveedor: string;
  rut: string;
  /** Gasto por año, indexado por año en string ("2024"). Año ausente = sin gasto. */
  byYear: Record<string, number>;
  total: number;
};

export type ProveedorDimension = "categoria" | "subcategoria" | "item";

export type ProveedorDimensionRow = {
  proveedor: string;
  rut: string;
  /** Valor de la dimensión (categoría, subcategoría o ítem). */
  dimension: string;
  /** Suma de item_costo_empresa en el período. */
  gasto: number;
  /** Negocios distintos donde el proveedor participó con esta dimensión. */
  negocios: number;
  /** Promedio por negocio = gasto / negocios. */
  promedio: number;
  ultimaFecha: string;
};

export type MatrizProveedorAnio = {
  /** Años con datos, ascendente. */
  years: number[];
  rows: MatrizProveedorAnioRow[];
};

// ---------- CTE base ----------

/**
 * Construye el CTE `g` con el scope ya filtrado (área + excluir_gasto + proveedor
 * + rango de fechas) sobre `marts.finanzas_gastos`. Cada query consume `FROM g`.
 *
 * El filtro de fechas vive en el subquery externo para conservar la estructura
 * histórica (la vista ya entrega `fecha` como DATE saneada).
 */
function baseCte(filters: ProveedorFilters): {
  cte: string;
  params: Record<string, unknown>;
} {
  const inner: string[] = ["NOT es_interno_glovox", "incluir_en_totales"];
  const outer: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  const montoCol = MONTO_COL[filters.monto === "bruto" ? "bruto" : "neto"];

  if (filters.proveedor) {
    inner.push("proveedor_efectivo = @proveedor");
    params.proveedor = filters.proveedor;
  }
  if (filters.from) {
    outer.push("fecha >= DATE(@from)");
    params.from = filters.from;
  }
  if (filters.to) {
    outer.push("fecha <= DATE(@to)");
    params.to = filters.to;
  }

  const cte = `
  WITH g AS (
    SELECT * FROM (
      SELECT
        proveedor_efectivo                                               AS proveedor,
        proveedor_efectivo_rut                                           AS rut,
        CAST(negocio_id AS STRING)                                       AS negocio_id,
        negocio_nombre,
        fecha,
        folio,
        tipo_documento                                                   AS doc,
        tipo_gasto                                                       AS tipo,
        estado_documento                                                 AS estado,
        CAST(validado AS STRING)                                         AS validado,
        categoria_raw                                                    AS item_categoria,
        subcategoria_raw                                                 AS item_sub_categoria,
        item_nombre,
        ${montoCol}                                                      AS costo,
        CONCAT(IFNULL(proveedor_rut, ''), '|', IFNULL(folio, ''))        AS doc_key
      FROM ${GASTOS}
      WHERE ${inner.join("\n        AND ")}
    )
    WHERE ${outer.join("\n      AND ")}
  )`;

  return { cte, params };
}

// ---------- opciones / rango ----------

let optionsCache: { data: ProveedorOption[]; timestamp: number } | null = null;

/**
 * Lista completa de proveedores dentro del scope (área + excluir_gasto), ordenada
 * por gasto desc. No respeta el proveedor ni las fechas seleccionadas: el selector
 * siempre muestra todos. Cacheada por 5 minutos.
 */
export async function getProveedorOptions(): Promise<ProveedorOption[]> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.timestamp < CACHE_TTL_MS) {
    return optionsCache.data;
  }
  const data = await getByProveedor({});
  optionsCache = { data, timestamp: now };
  return data;
}

let rangeCache: { data: DateRange; timestamp: number } | null = null;

/** Rango de fechas con datos dentro del scope. Cacheado por 5 minutos. */
export async function getDateRange(): Promise<DateRange> {
  const now = Date.now();
  if (rangeCache && now - rangeCache.timestamp < CACHE_TTL_MS) {
    return rangeCache.data;
  }
  const { cte, params } = baseCte({});
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        FORMAT_DATE('%Y-%m-%d', MIN(fecha)) AS min_date,
        FORMAT_DATE('%Y-%m-%d', MAX(fecha)) AS max_date
      FROM g
      `,
      params,
    ),
  );
  const data = { min: s(rows[0]?.min_date), max: s(rows[0]?.max_date) };
  rangeCache = { data, timestamp: now };
  return data;
}

// ---------- agregaciones ----------

/** Ranking por proveedor. Respeta fechas; NO aplica el filtro de proveedor. */
export async function getByProveedor(
  filters: ProveedorFilters,
): Promise<ProveedorOption[]> {
  const { cte, params } = baseCte({
    from: filters.from,
    to: filters.to,
    monto: filters.monto,
  });
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        proveedor                       AS proveedor,
        ANY_VALUE(rut)                  AS rut,
        SUM(costo)                      AS gasto,
        COUNT(DISTINCT doc_key)         AS docs,
        COUNT(DISTINCT negocio_id)      AS negocios
      FROM g
      WHERE proveedor IS NOT NULL AND TRIM(proveedor) <> ''
      GROUP BY proveedor
      ORDER BY gasto DESC
      LIMIT 5000
      `,
      params,
    ),
  );
  return rows.map((r) => ({
    proveedor: s(r.proveedor),
    rut: s(r.rut),
    gasto: n(r.gasto),
    docs: n(r.docs),
    negocios: n(r.negocios),
  }));
}

export async function getKpis(filters: ProveedorFilters): Promise<ProveedorKpis> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        SUM(costo)                                              AS gasto,
        COUNT(DISTINCT doc_key)                                 AS documentos,
        COUNT(DISTINCT negocio_id)                              AS negocios,
        COUNT(DISTINCT IFNULL(NULLIF(TRIM(item_categoria), ''), 'Sin categoría')) AS categorias,
        FORMAT_DATE('%Y-%m-%d', MIN(fecha))                    AS primera,
        FORMAT_DATE('%Y-%m-%d', MAX(fecha))                    AS ultima
      FROM g
      `,
      params,
    ),
  );
  const r = rows[0] ?? {};
  const gasto = n(r.gasto);
  const documentos = n(r.documentos);
  return {
    gasto,
    documentos,
    negocios: n(r.negocios),
    categorias: n(r.categorias),
    ticketPromedio: documentos > 0 ? gasto / documentos : 0,
    primeraFecha: s(r.primera),
    ultimaFecha: s(r.ultima),
  };
}

/** Serie mensual de gasto. Filas sin fecha parseable quedan fuera del eje temporal. */
export async function getMensual(filters: ProveedorFilters): Promise<MensualRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        FORMAT_DATE('%Y-%m', fecha)  AS mes,
        SUM(costo)                   AS gasto,
        COUNT(DISTINCT doc_key)      AS docs
      FROM g
      WHERE fecha IS NOT NULL
      GROUP BY mes
      ORDER BY mes
      `,
      params,
    ),
  );
  return rows.map((r) => ({
    mes: s(r.mes),
    gasto: n(r.gasto),
    docs: n(r.docs),
  }));
}

/** Gasto por negocio. Respeta proveedor + fechas. */
export async function getByNegocio(
  filters: ProveedorFilters,
): Promise<NegocioBreakdownRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        negocio_id                          AS negocio_id,
        ANY_VALUE(negocio_nombre)           AS nombre,
        SUM(costo)                          AS gasto,
        COUNT(DISTINCT doc_key)             AS docs,
        FORMAT_DATE('%Y-%m-%d', MAX(fecha)) AS ultima
      FROM g
      GROUP BY negocio_id
      ORDER BY gasto DESC
      LIMIT 500
      `,
      params,
    ),
  );
  return rows.map((r) => ({
    negocioId: s(r.negocio_id),
    nombre: s(r.nombre),
    gasto: n(r.gasto),
    docs: n(r.docs),
    ultimaFecha: s(r.ultima),
  }));
}

/** Gasto por categoría de ítem. Respeta proveedor + fechas. */
export async function getByCategoria(
  filters: ProveedorFilters,
): Promise<CategoriaBreakdownRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        IFNULL(NULLIF(TRIM(item_categoria), ''), 'Sin categoría') AS categoria,
        SUM(costo)                                                AS gasto,
        COUNT(DISTINCT doc_key)                                   AS docs
      FROM g
      GROUP BY categoria
      ORDER BY gasto DESC
      LIMIT 50
      `,
      params,
    ),
  );
  return rows.map((r) => ({
    categoria: s(r.categoria),
    gasto: n(r.gasto),
    docs: n(r.docs),
  }));
}

/**
 * Matriz gasto por proveedor × año (pivote). Respeta fechas; NO aplica el filtro
 * de proveedor. Solo cuenta filas con fecha parseable (el año sale de la fecha
 * del documento), así que el total = suma de las columnas de año.
 */
export async function getMatrizProveedorAnio(
  filters: ProveedorFilters,
): Promise<MatrizProveedorAnio> {
  const { cte, params } = baseCte({
    from: filters.from,
    to: filters.to,
    monto: filters.monto,
  });
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        proveedor                   AS proveedor,
        ANY_VALUE(rut)              AS rut,
        EXTRACT(YEAR FROM fecha)    AS anio,
        SUM(costo)                  AS gasto
      FROM g
      WHERE proveedor IS NOT NULL AND TRIM(proveedor) <> '' AND fecha IS NOT NULL
      GROUP BY proveedor, anio
      `,
      params,
    ),
  );

  const yearSet = new Set<number>();
  const map = new Map<string, MatrizProveedorAnioRow>();
  for (const r of rows) {
    const prov = s(r.proveedor);
    const anio = n(r.anio);
    const gasto = n(r.gasto);
    const rut = s(r.rut);
    if (!prov || !Number.isFinite(anio) || anio === 0) continue;
    yearSet.add(anio);
    let row = map.get(prov);
    if (!row) {
      row = { proveedor: prov, rut, byYear: {}, total: 0 };
      map.set(prov, row);
    }
    row.byYear[String(anio)] = (row.byYear[String(anio)] ?? 0) + gasto;
    row.total += gasto;
    if (!row.rut && rut) row.rut = rut;
  }

  return {
    years: [...yearSet].sort((a, b) => a - b),
    rows: [...map.values()].sort((a, b) => b.total - a.total),
  };
}

/**
 * Mapeo seguro de dimensión → columna BigQuery (NO interpolar input del usuario
 * directo en SQL; este map es la única fuente de verdad).
 */
const DIMENSION_COL: Record<ProveedorDimension, string> = {
  categoria: "item_categoria",
  subcategoria: "item_sub_categoria",
  item: "item_nombre",
};

const DIMENSION_FALLBACK: Record<ProveedorDimension, string> = {
  categoria: "Sin categoría",
  subcategoria: "Sin subcategoría",
  item: "Sin ítem",
};

/**
 * Tope de filas para la matriz proveedor × dimensión. Cubre con margen el caso
 * sin filtros (más grande): ~28K combinaciones para `item` en producción.
 * Si se alcanza, el componente avisa que está topado.
 */
export const DIMENSION_LIMIT = 30000;

/**
 * Gasto por proveedor × dimensión (categoría / subcategoría / ítem). Devuelve
 * monto total, cantidad de negocios donde el proveedor participó con esa
 * dimensión, promedio por negocio y última fecha. Respeta filtros (proveedor,
 * fechas, área, excluir_gasto).
 */
export async function getProveedorPorDimension(
  filters: ProveedorFilters,
  dimension: ProveedorDimension,
): Promise<ProveedorDimensionRow[]> {
  const col = DIMENSION_COL[dimension];
  const fallback = DIMENSION_FALLBACK[dimension];
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        proveedor                                                       AS proveedor,
        ANY_VALUE(rut)                                                  AS rut,
        IFNULL(NULLIF(TRIM(${col}), ''), @fallback)                    AS dimension,
        SUM(costo)                                                      AS gasto,
        COUNT(DISTINCT negocio_id)                                      AS negocios,
        FORMAT_DATE('%Y-%m-%d', MAX(fecha))                            AS ultima
      FROM g
      WHERE proveedor IS NOT NULL AND TRIM(proveedor) <> ''
      GROUP BY proveedor, dimension
      ORDER BY gasto DESC
      LIMIT ${DIMENSION_LIMIT}
      `,
      { ...params, fallback },
    ),
  );
  return rows.map((r) => {
    const gasto = n(r.gasto);
    const negocios = n(r.negocios);
    return {
      proveedor: s(r.proveedor),
      rut: s(r.rut),
      dimension: s(r.dimension),
      gasto,
      negocios,
      promedio: negocios > 0 ? gasto / negocios : 0,
      ultimaFecha: s(r.ultima),
    };
  });
}

/** Detalle a nivel de ítem para tabla + descarga. Requiere un proveedor en filtros. */
export async function getDocumentos(
  filters: ProveedorFilters,
): Promise<DocumentoRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        FORMAT_DATE('%Y-%m-%d', fecha) AS fecha,
        folio, doc, tipo, rut, proveedor,
        negocio_id, negocio_nombre,
        item_categoria, item_sub_categoria, item_nombre,
        estado, validado, costo
      FROM g
      ORDER BY fecha DESC NULLS LAST, folio DESC
      LIMIT ${DETAIL_LIMIT}
      `,
      params,
    ),
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    folio: s(r.folio),
    doc: s(r.doc),
    tipo: s(r.tipo),
    rut: s(r.rut),
    proveedor: s(r.proveedor),
    negocioId: s(r.negocio_id),
    negocioNombre: s(r.negocio_nombre),
    categoria: s(r.item_categoria),
    subCategoria: s(r.item_sub_categoria),
    itemNombre: s(r.item_nombre),
    estado: s(r.estado),
    validado: s(r.validado),
    costo: n(r.costo),
  }));
}

export const DOCUMENTOS_LIMIT = DETAIL_LIMIT;
