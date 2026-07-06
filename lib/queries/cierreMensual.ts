import { query } from "@/lib/bigquery";
import type { NegocioRow, RawRow } from "@/lib/unabase/types";

const P = process.env.BIGQUERY_PROJECT_ID;

// Migrado 3-jul-2026 a las vistas curadas marts.finanzas_* (antes: tablas raw
// finanzas.unabase_*). Las columnas se alias-an a los nombres antiguos que
// consume lib/unabase/normalization.ts.
const PRESUPUESTO_ITEMS = `\`${P}.marts.finanzas_presupuesto_items\``;
const NEGOCIOS = `\`${P}.marts.finanzas_negocios\``;
const CATEGORIA_EVENTO = `\`${P}.glovox.categoriaEvento\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;

export type MontoMode = "neto" | "bruto";

/** Columna de ingreso neto/bruto (switch de montos). Mapa fijo: NUNCA interpolar
 *  input del usuario. Solo afecta ingreso_total_neto: `ingreso` (facturado) es
 *  una etapa del ciclo sin par bruto en el maestro, y el gasto del presupuesto
 *  es neto por diseño. */
const INGRESO_COL: Record<MontoMode, string> = {
  neto: "venta_neta",
  bruto: "venta_bruta",
};

export const cierreMensualSql = (monto: MontoMode) => `
  WITH cat AS (
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
    CAST(i.negocio_id AS STRING) AS external_id,
    i.categoria,
    IFNULL(i.subcategoria, '') AS subcategoria,
    i.item,
    i.descripcion,
    i.gasto_presupuestado AS subtotal_gasto_pre,
    i.gasto_real_item AS gasto_real,
    n.referencia AS nombre_negocio,
    n.area_negocio,
    n.estado,
    n.estadonv,
    n.cliente AS clientePrincipal,
    n.${INGRESO_COL[monto]} AS ingreso_total_neto,
    n.venta_facturada AS ingreso,
    n.venta_facturada AS ingresoAPI,
    n.fecha_realizacion AS fechaNegocio,
    n.fecha_asignacion AS fechaAsignacion,
    cat.EventoID AS EventoID,
    cat.CategoriaEvento AS CategoriaEvento,
    cat.CategoriaEvento2 AS CategoriaEvento2,
    cat.NombreGlovox AS NombreGlovox,
    ev.NombreID AS NombreID,
    ev.totalAsistentes AS totalAsistentes
  FROM ${PRESUPUESTO_ITEMS} i
  JOIN ${NEGOCIOS} n
    ON i.negocio_id = n.negocio_id
  LEFT JOIN cat
    ON cat.EventoID = n.evento_id
  LEFT JOIN ev
    ON ev.EventoID = n.evento_id
  WHERE LOWER(n.estadonv) <> 'nulo'
    AND LOWER(n.estado) <> 'cotizacion'
`;

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<MontoMode, { data: RawRow[]; timestamp: number }>();

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
  { timeoutMs = 22_000, monto = "neto" }: { timeoutMs?: number; monto?: MontoMode } = {},
): Promise<CierreMensualResult> {
  const now = Date.now();
  const cached = cache.get(monto);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      rows: cached.data,
      cached: true,
      cacheAgeSeconds: Math.floor((now - cached.timestamp) / 1000),
    };
  }

  const queryPromise = query<Record<string, unknown>>(cierreMensualSql(monto));
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(timeoutMs / 1000)}s). Intentá de nuevo.`)),
      timeoutMs,
    ),
  );

  const rawRows = await Promise.race([queryPromise, timeoutPromise]);
  const clean = rawRows.map(serializeRow);

  cache.set(monto, { data: clean, timestamp: Date.now() });
  return { rows: clean, cached: false, cacheAgeSeconds: 0 };
}

export function invalidateCierreMensualCache(): void {
  cache.clear();
}

// Columnas de la vista alias-adas al shape legacy NegocioRow (nombres del
// maestro crudo). estadocierre se deriva de compras_cerradas.
const NEGOCIOS_SELECT = `
  SELECT
    CAST(negocio_id AS STRING) AS id,
    folio,
    referencia,
    area_negocio,
    ejecutivo,
    user_name,
    estado,
    estadonv,
    LOWER(compras_cerradas) AS estadocierre,
    cliente AS razon_cliente,
    cliente_rut AS rut_cliente,
    nro_oc_cliente,
    total_oc_cliente,
    CAST(fecha_emision_oc_cliente AS STRING) AS fecha_emision_oc_cliente,
    CAST(fecha_asignacion AS STRING) AS fecha_asignacion,
    CAST(fecha_realizacion AS STRING) AS fecha_realizacion,
    CAST(fecha_cierre_negocio AS STRING) AS fecha_cierre_negocio,
    CAST(updated_at AS STRING) AS updated_at,
    venta_contratada AS total_venta,
    venta_neta AS total_neto,
    venta_bruta AS total_nv,
    venta_facturada AS total_facturado,
    venta_por_facturar AS total_por_facturar,
    venta_cobrada AS total_cobrado,
    venta_por_cobrar AS total_por_cobrar,
    gasto_presupuestado AS costo_presupuestado,
    gasto_real AS costo_real,
    gasto_justificado AS costo_total_justificado
  FROM ${NEGOCIOS}`;

export const NEGOCIOS_SQL = `
  ${NEGOCIOS_SELECT}
  WHERE LOWER(estado) <> 'cotizacion'
    AND LOWER(estadonv) <> 'nulo'
    AND LOWER(area_negocio) <> 'glovox'
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
  const sql = `${NEGOCIOS_SELECT} ORDER BY negocio_id DESC`;
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
