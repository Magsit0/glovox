import { query } from "@/lib/bigquery";
import type {
  DetalleGastoRow,
  NegocioItemRow,
  NegocioOption,
} from "@/lib/unabase/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const NEGOCIOS = `\`${P}.unabase.negocios\``;
const NEGOCIO_ITEM = `\`${P}.unabase.negocioItem\``;
const DETALLE_GASTO = `\`${P}.unabase.detalleGasto\``;

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

function withTimeout<T>(p: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Intentá de nuevo.`)),
      ms,
    ),
  );
  return Promise.race([p, timeoutPromise]);
}

// --- Selector options (lista global de negocios) ---

const NEGOCIO_OPTIONS_SQL = `
  SELECT
    CAST(id AS STRING) AS external_id,
    CAST(referencia AS STRING) AS referencia,
    CAST(area_negocio AS STRING) AS area_negocio,
    CAST(estado AS STRING) AS estado,
    CAST(estadocierre AS STRING) AS estadocierre
  FROM ${NEGOCIOS}
  WHERE LOWER(CAST(estado AS STRING)) <> 'cotizacion'
    AND LOWER(CAST(estadonv AS STRING)) <> 'nulo'
  ORDER BY SAFE_CAST(id AS INT64) DESC
`;

let optionsCache: { data: NegocioOption[]; timestamp: number } | null = null;

export async function getNegocioOptions(): Promise<NegocioOption[]> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.timestamp < CACHE_TTL_MS) {
    return optionsCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(NEGOCIO_OPTIONS_SQL));
  const clean = rows.map((r) => serialize(r) as unknown as NegocioOption);
  optionsCache = { data: clean, timestamp: now };
  return clean;
}

// --- Detail por negocio ---

export interface NegocioDetail {
  negocio: NegocioOption | null;
  items: NegocioItemRow[];
  gastos: DetalleGastoRow[];
}

const detailCache = new Map<string, { data: NegocioDetail; timestamp: number }>();

const ITEMS_SQL = `
  SELECT *
  FROM ${NEGOCIO_ITEM}
  WHERE CAST(external_id AS STRING) = @id
`;

const GASTOS_SQL = `
  SELECT *
  FROM ${DETALLE_GASTO}
  WHERE CAST(negocio AS STRING) = @id
    AND LOWER(IFNULL(CAST(excluir_gasto AS STRING), '')) <> 'true'
`;

export async function getNegocioDetail(externalId: string): Promise<NegocioDetail> {
  const now = Date.now();
  const cached = detailCache.get(externalId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const [itemsRaw, gastosRaw, options] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(ITEMS_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(GASTOS_SQL, { id: externalId })),
    getNegocioOptions(),
  ]);

  const items = itemsRaw.map((r) => serialize(r) as unknown as NegocioItemRow);
  const gastos = gastosRaw.map((r) => serialize(r) as unknown as DetalleGastoRow);
  const negocio = options.find((o) => o.external_id === externalId) ?? null;

  const detail: NegocioDetail = { negocio, items, gastos };
  detailCache.set(externalId, { data: detail, timestamp: now });
  return detail;
}

export function invalidateCierreNegocioCache(externalId?: string): void {
  if (externalId) {
    detailCache.delete(externalId);
    return;
  }
  detailCache.clear();
  optionsCache = null;
}
