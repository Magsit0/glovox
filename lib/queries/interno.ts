import { query } from "@/lib/bigquery";
import type { MontoMode } from "@/components/montoMode";

/**
 * Dashboard GASTO INTERNO — negocios internos GLOVOX.
 *
 * Fuente: `marts.finanzas_gastos` (vista curada, 1 fila por ítem de gasto) y
 * `marts.finanzas_negocios` para el mini P&L. Es el ESPEJO de /proveedor: donde
 * aquel filtra `NOT es_interno_glovox`, acá el scope es EXACTAMENTE ese universo
 * — los contenedores anuales del área 'GLOVOX' de Unabase (GASTOS OFICINA,
 * ADMINISTRACION, SUELDOS, BOTILLERIA, RENTAL, DATA…): sueldos y gasto
 * administrativo que quedan fuera de todos los dashboards de eventos.
 *
 * Reglas de scope (aplican a TODAS las queries):
 *  - `es_interno_glovox` (SOLO negocios internos area 'GLOVOX').
 *  - `incluir_en_totales` (= NOT excluir_gasto).
 *
 * Dimensión principal: `categoria_oficial` (curada vía el seed
 * finanzas.unabase_categoria_map; lo no mapeado llega como 'SIN CLASIFICAR').
 * Métrica: `gasto_neto` | `gasto_bruto` según el switch neto/bruto (?monto=).
 * Proveedor: `proveedor_efectivo` (mismo criterio que /proveedor).
 *
 * ⚠ Data sensible (sueldos): el dashboard nace visible solo para superadmins;
 * cualquier otro usuario necesita un grant explícito desde /admin.
 */

const P = process.env.BIGQUERY_PROJECT_ID;

const GASTOS = `\`${P}.marts.finanzas_gastos\``;
const NEGOCIOS = `\`${P}.marts.finanzas_negocios\``;

/** Columna de monto por modo. Mapa fijo: NUNCA interpolar input del usuario. */
const MONTO_COL: Record<MontoMode, string> = {
  neto: "IFNULL(gasto_neto, 0)",
  bruto: "gasto_bruto",
};

// Tope de filas para el detalle descargable. El universo interno completo es
// ~1.8K líneas (jul-2026), así que el tope solo protege contra crecimiento raro.
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

export type InternoFilters = {
  /** Categoría oficial seleccionada (drill). */
  categoria?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  /** Switch neto/bruto del dashboard (default: neto). */
  monto?: MontoMode;
};

export type InternoKpis = {
  gasto: number;
  documentos: number;
  negocios: number;
  proveedores: number;
  categorias: number;
  primeraFecha: string;
  ultimaFecha: string;
};

export type MensualRow = {
  mes: string; // YYYY-MM
  gasto: number;
  docs: number;
};

export type MensualCategoriaRow = {
  mes: string; // YYYY-MM
  categoria: string;
  gasto: number;
};

export type CategoriaBreakdownRow = {
  categoria: string;
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

export type ProveedorBreakdownRow = {
  proveedor: string;
  rut: string;
  gasto: number;
  docs: number;
  negocios: number;
};

/** Mismo shape que DocumentoRow de /proveedor: DocumentosTable se reutiliza. */
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

export type PnlInternoRow = {
  negocioId: string;
  referencia: string;
  venta: number;
  gasto: number;
  margen: number;
};

export type DateRange = { min: string; max: string };

// ---------- CTE base ----------

/**
 * Construye el CTE `g` con el scope interno ya filtrado (es_interno_glovox +
 * incluir_en_totales + categoría + rango de fechas). Cada query consume `FROM g`.
 * `categoria` se normaliza en el SELECT interno, así que su filtro (igual que
 * el de fechas) vive en el subquery externo.
 */
function baseCte(filters: InternoFilters): {
  cte: string;
  params: Record<string, unknown>;
} {
  const outer: string[] = ["TRUE"];
  const params: Record<string, unknown> = {};
  const montoCol = MONTO_COL[filters.monto === "bruto" ? "bruto" : "neto"];

  if (filters.categoria) {
    outer.push("categoria = @categoria");
    params.categoria = filters.categoria;
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
        IFNULL(NULLIF(TRIM(categoria_oficial), ''), 'SIN CLASIFICAR')   AS categoria,
        proveedor_efectivo                                              AS proveedor,
        proveedor_efectivo_rut                                          AS rut,
        CAST(negocio_id AS STRING)                                      AS negocio_id,
        negocio_nombre,
        fecha,
        folio,
        tipo_documento                                                  AS doc,
        tipo_gasto                                                      AS tipo,
        estado_documento                                                AS estado,
        CAST(validado AS STRING)                                        AS validado,
        categoria_raw                                                   AS item_categoria,
        subcategoria_raw                                                AS item_sub_categoria,
        item_nombre,
        ${montoCol}                                                     AS costo,
        CONCAT(IFNULL(proveedor_rut, ''), '|', IFNULL(folio, ''))       AS doc_key
      FROM ${GASTOS}
      WHERE es_interno_glovox
        AND incluir_en_totales
    )
    WHERE ${outer.join("\n      AND ")}
  )`;

  return { cte, params };
}

// ---------- opciones / rango ----------

let categoriasCache: { data: CategoriaBreakdownRow[]; timestamp: number } | null =
  null;

/**
 * Lista completa de categorías oficiales dentro del scope interno, ordenada por
 * gasto desc. No respeta la categoría ni las fechas seleccionadas: el selector
 * siempre muestra todas. Cacheada por 5 minutos.
 */
export async function getCategoriaOptions(): Promise<CategoriaBreakdownRow[]> {
  const now = Date.now();
  if (categoriasCache && now - categoriasCache.timestamp < CACHE_TTL_MS) {
    return categoriasCache.data;
  }
  const data = await getByCategoria({});
  categoriasCache = { data, timestamp: now };
  return data;
}

let rangeCache: { data: DateRange; timestamp: number } | null = null;

/** Rango de fechas con datos dentro del scope interno. Cacheado por 5 minutos. */
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

export async function getKpis(filters: InternoFilters): Promise<InternoKpis> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        SUM(costo)                              AS gasto,
        COUNT(DISTINCT doc_key)                 AS documentos,
        COUNT(DISTINCT negocio_id)              AS negocios,
        COUNT(DISTINCT IFNULL(NULLIF(TRIM(proveedor), ''), 'Sin proveedor')) AS proveedores,
        COUNT(DISTINCT categoria)               AS categorias,
        FORMAT_DATE('%Y-%m-%d', MIN(fecha))     AS primera,
        FORMAT_DATE('%Y-%m-%d', MAX(fecha))     AS ultima
      FROM g
      `,
      params,
    ),
  );
  const r = rows[0] ?? {};
  return {
    gasto: n(r.gasto),
    documentos: n(r.documentos),
    negocios: n(r.negocios),
    proveedores: n(r.proveedores),
    categorias: n(r.categorias),
    primeraFecha: s(r.primera),
    ultimaFecha: s(r.ultima),
  };
}

/** Serie mensual de gasto. Filas sin fecha parseable quedan fuera del eje temporal. */
export async function getMensual(filters: InternoFilters): Promise<MensualRow[]> {
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

/** Serie mensual apilada por categoría oficial (para el gráfico principal). */
export async function getMensualPorCategoria(
  filters: InternoFilters,
): Promise<MensualCategoriaRow[]> {
  const { cte, params } = baseCte(filters);
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      ${cte}
      SELECT
        FORMAT_DATE('%Y-%m', fecha)  AS mes,
        categoria,
        SUM(costo)                   AS gasto
      FROM g
      WHERE fecha IS NOT NULL
      GROUP BY mes, categoria
      ORDER BY mes
      `,
      params,
    ),
  );
  return rows.map((r) => ({
    mes: s(r.mes),
    categoria: s(r.categoria),
    gasto: n(r.gasto),
  }));
}

/** Gasto por categoría oficial. Respeta fechas; NO aplica el filtro de categoría. */
export async function getByCategoria(
  filters: InternoFilters,
): Promise<CategoriaBreakdownRow[]> {
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
        categoria,
        SUM(costo)               AS gasto,
        COUNT(DISTINCT doc_key)  AS docs
      FROM g
      GROUP BY categoria
      ORDER BY gasto DESC
      LIMIT 100
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

/** Gasto por negocio interno (contenedor anual por rubro). Respeta categoría + fechas. */
export async function getByNegocio(
  filters: InternoFilters,
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
      LIMIT 200
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

/** Ranking de proveedores dentro del scope interno. Respeta categoría + fechas. */
export async function getByProveedor(
  filters: InternoFilters,
): Promise<ProveedorBreakdownRow[]> {
  const { cte, params } = baseCte(filters);
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
      LIMIT 1000
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

/** Detalle a nivel de ítem para tabla + descarga. Respeta categoría + fechas. */
export async function getDocumentos(
  filters: InternoFilters,
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

/**
 * Mini P&L de los negocios internos CON venta asociada (BOTILLERIA, RENTAL…).
 * Cifras del MAESTRO Unabase (marts.finanzas_negocios): venta según el switch
 * neto/bruto y gasto_real (neto por diseño del API). No respeta el filtro de
 * fechas ni categoría: el maestro no tiene esa granularidad.
 */
export async function getPnlInterno(
  monto: MontoMode = "neto",
): Promise<PnlInternoRow[]> {
  const ventaCol = monto === "bruto" ? "venta_bruta" : "venta_neta";
  const rows = await withTimeout(
    query<Record<string, unknown>>(
      `
      SELECT
        CAST(negocio_id AS STRING)              AS negocio_id,
        referencia,
        SAFE_CAST(${ventaCol} AS FLOAT64)       AS venta,
        SAFE_CAST(gasto_real AS FLOAT64)        AS gasto
      FROM ${NEGOCIOS}
      WHERE es_interno_glovox
        AND SAFE_CAST(${ventaCol} AS FLOAT64) > 0
      ORDER BY venta DESC
      LIMIT 100
      `,
    ),
  );
  return rows.map((r) => {
    const venta = n(r.venta);
    const gasto = n(r.gasto);
    return {
      negocioId: s(r.negocio_id),
      referencia: s(r.referencia),
      venta,
      gasto,
      margen: venta - gasto,
    };
  });
}

export const DOCUMENTOS_LIMIT = DETAIL_LIMIT;
