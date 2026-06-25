import { query } from "@/lib/bigquery";
import type { NegocioRow, RawRow } from "@/lib/unabase/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const NEGOCIO_ITEM = `\`${P}.finanzas.unabase_negocio_items\``;
const NEGOCIOS = `\`${P}.finanzas.unabase_negocios\``;
const CATEGORIA_EVENTO = `\`${P}.glovox.categoriaEvento\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;

// Migrado de unabase.* a finanzas.unabase_*. La antigua tabla estadoNegocio
// (negocio + metadata de evento + ingresos) se reemplaza por:
//   - finanzas.unabase_negocios: negocio + financieros (id, estado, área, fechas, totales)
//   - glovox.categoriaEvento: metadata del evento (EventoID = primeros 6 chars de
//     referencia, en mayúscula; CategoriaEvento/2, NombreGlovox)
//   - ticketsAndAABB.cierreEventos: NombreID + totalAsistentes
// negocioItem nuevo es jerárquico: se toman solo ítems hoja y se reconstruye la
// subcategoría vía llaveSubCat. Las columnas se alias-an a los nombres antiguos
// que consume lib/unabase/normalization.ts.
export const CIERRE_MENSUAL_SQL = `
  WITH items AS (
    SELECT
      CAST(i.negocio AS STRING) AS external_id,
      CAST(i.categoria AS STRING) AS categoria,
      IFNULL(CAST(sub.nombre AS STRING), '') AS subcategoria,
      CAST(i.nombre AS STRING) AS item,
      CAST(i.descripcion AS STRING) AS descripcion,
      i.sub_gasto_pre AS subtotal_gasto_pre,
      i.total_gasto_real AS gasto_real
    FROM ${NEGOCIO_ITEM} i
    LEFT JOIN ${NEGOCIO_ITEM} sub
      ON sub.negocio = i.negocio
      AND sub.llave_item = i.llaveSubCat
      AND sub.isSubCat = TRUE
    WHERE i.tipo_item = 'ITEM' AND i.isSubCat = FALSE
  ),
  cat AS (
    SELECT
      EventoID,
      ANY_VALUE(CategoriaEvento) AS CategoriaEvento,
      ANY_VALUE(CategoriaEvento2) AS CategoriaEvento2,
      ANY_VALUE(NombreGlovox) AS NombreGlovox
    FROM ${CATEGORIA_EVENTO}
    GROUP BY EventoID
  ),
  ev AS (
    SELECT
      EventoID,
      ANY_VALUE(NombreID) AS NombreID,
      ANY_VALUE(totalAsistentes) AS totalAsistentes
    FROM ${CIERRE_EVENTOS}
    GROUP BY EventoID
  )
  SELECT
    items.external_id,
    items.categoria,
    items.subcategoria,
    items.item,
    items.descripcion,
    items.subtotal_gasto_pre,
    items.gasto_real,
    CAST(n.referencia AS STRING) AS nombre_negocio,
    CAST(n.area_negocio AS STRING) AS area_negocio,
    CAST(n.estado AS STRING) AS estado,
    CAST(n.estadonv AS STRING) AS estadonv,
    CAST(n.razon_cliente AS STRING) AS clientePrincipal,
    n.total_neto AS ingreso_total_neto,
    n.total_facturado AS ingreso,
    n.total_facturado AS ingresoAPI,
    n.fecha_realizacion AS fechaNegocio,
    n.fecha_asignacion AS fechaAsignacion,
    cat.EventoID AS EventoID,
    cat.CategoriaEvento AS CategoriaEvento,
    cat.CategoriaEvento2 AS CategoriaEvento2,
    cat.NombreGlovox AS NombreGlovox,
    ev.NombreID AS NombreID,
    ev.totalAsistentes AS totalAsistentes
  FROM items
  JOIN ${NEGOCIOS} n
    ON items.external_id = CAST(n.id AS STRING)
  LEFT JOIN cat
    ON cat.EventoID = UPPER(SUBSTR(CAST(n.referencia AS STRING), 1, 6))
  LEFT JOIN ev
    ON ev.EventoID = UPPER(SUBSTR(CAST(n.referencia AS STRING), 1, 6))
  WHERE LOWER(CAST(n.estadonv AS STRING)) <> 'nulo'
    AND LOWER(CAST(n.estado AS STRING)) <> 'cotizacion'
`;

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: RawRow[]; timestamp: number } | null = null;

function serializeRow(row: Record<string, unknown>): RawRow {
  const obj: RawRow = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      obj[key] = null;
    } else if (typeof val === "object" && val !== null) {
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

export interface CierreMensualResult {
  rows: RawRow[];
  cached: boolean;
  cacheAgeSeconds: number;
}

export async function getCierreMensualRows(
  { timeoutMs = 22_000 }: { timeoutMs?: number } = {},
): Promise<CierreMensualResult> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return {
      rows: cache.data,
      cached: true,
      cacheAgeSeconds: Math.floor((now - cache.timestamp) / 1000),
    };
  }

  const queryPromise = query<Record<string, unknown>>(CIERRE_MENSUAL_SQL);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(timeoutMs / 1000)}s). Intentá de nuevo.`)),
      timeoutMs,
    ),
  );

  const rawRows = await Promise.race([queryPromise, timeoutPromise]);
  const clean = rawRows.map(serializeRow);

  cache = { data: clean, timestamp: Date.now() };
  return { rows: clean, cached: false, cacheAgeSeconds: 0 };
}

export function invalidateCierreMensualCache(): void {
  cache = null;
}

// estadocierre se deriva de closed_compras (la tabla nueva no lo trae).
export const NEGOCIOS_SQL = `
  SELECT *, LOWER(CAST(closed_compras AS STRING)) AS estadocierre
  FROM ${NEGOCIOS}
  WHERE LOWER(CAST(estado AS STRING)) <> 'cotizacion'
    AND LOWER(CAST(estadonv AS STRING)) <> 'nulo'
    AND LOWER(CAST(area_negocio AS STRING)) <> 'glovox'
`;

const NEGOCIOS_CACHE_TTL_MS = 5 * 60 * 1000;
let negociosCache: { data: NegocioRow[]; timestamp: number } | null = null;

export interface NegociosResult {
  rows: NegocioRow[];
  cached: boolean;
  cacheAgeSeconds: number;
}

export async function getNegociosRows(
  { timeoutMs = 22_000 }: { timeoutMs?: number } = {},
): Promise<NegociosResult> {
  const now = Date.now();
  if (negociosCache && now - negociosCache.timestamp < NEGOCIOS_CACHE_TTL_MS) {
    return {
      rows: negociosCache.data,
      cached: true,
      cacheAgeSeconds: Math.floor((now - negociosCache.timestamp) / 1000),
    };
  }

  const queryPromise = query<Record<string, unknown>>(NEGOCIOS_SQL);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(timeoutMs / 1000)}s). Intentá de nuevo.`)),
      timeoutMs,
    ),
  );

  const rawRows = await Promise.race([queryPromise, timeoutPromise]);
  const clean = rawRows.map((row) => serializeRow(row) as unknown as NegocioRow);

  negociosCache = { data: clean, timestamp: Date.now() };
  return { rows: clean, cached: false, cacheAgeSeconds: 0 };
}

export async function getAllNegociosAdmin(
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {},
): Promise<NegocioRow[]> {
  // estadocierre ya no existe en la tabla nueva: se deriva de closed_compras
  // (normalizado a 'true'/'false') para que el listado/filtros sigan funcionando.
  const sql = `SELECT *, LOWER(CAST(closed_compras AS STRING)) AS estadocierre FROM \`${P}.finanzas.unabase_negocios\` ORDER BY CAST(id AS INT64) DESC`;
  const queryPromise = query<Record<string, unknown>>(sql);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(timeoutMs / 1000)}s).`)),
      timeoutMs,
    ),
  );
  const rawRows = await Promise.race([queryPromise, timeoutPromise]);
  return rawRows.map((row) => serializeRow(row) as unknown as NegocioRow);
}
