import { query } from "@/lib/bigquery";
import type { NegocioRow, RawRow } from "@/lib/unabase/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const NEGOCIO_ITEM = `\`${P}.unabase.negocioItem\``;
const ESTADO_NEGOCIO = `\`${P}.unabase.estadoNegocio\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;

// Se excluyen explícitamente 22 columnas sin uso en el dashboard (payload ~37MB → ~17MB).
export const CIERRE_MENSUAL_SQL = `
  SELECT
    a.* EXCEPT (row_id, cantidad, pu_venta, subtotal_venta, pu_gasto_presupuestado, diferencia, porc_diferencia, llave_item),
    b.* EXCEPT (external_id, external_folio, updated_at, Temporada, costo, costoAPI, ventaItems, gastoItems, recarga3, recarga2, difIngreso, difCosto, difIngreso_porcentaje, difCosto_Porcentaje),
    c.totalAsistentes
  FROM ${NEGOCIO_ITEM} a
  LEFT JOIN ${ESTADO_NEGOCIO} b
    ON a.external_id = b.external_id
  LEFT JOIN ${CIERRE_EVENTOS} c
    ON b.EventoID = c.EventoID
  WHERE LOWER(b.estadonv) <> 'nulo'
    AND LOWER(b.estado) <> 'cotizacion'
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

const NEGOCIOS = `\`${P}.unabase.negocios\``;

export const NEGOCIOS_SQL = `
  SELECT * FROM ${NEGOCIOS}
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
