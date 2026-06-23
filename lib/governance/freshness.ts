/**
 * Resuelve la frescura real de las tablas en BigQuery.
 *
 * Usa la meta-tabla `<dataset>.__TABLES__` (una por dataset) que expone
 * `row_count` y `last_modified_time` sin necesidad de habilitar config a nivel
 * proyecto y sin depender de la región del dataset. Es metadata: barata y rápida.
 *
 * Best-effort: cada dataset se consulta por separado y se captura su error, así
 * un dataset inexistente o sin acceso no tumba al resto. Devolvemos también el
 * conjunto de datasets que SÍ respondieron, para distinguir "la tabla no existe"
 * de "no pudimos consultar ese dataset". Nunca lanza.
 */
import { query } from "@/lib/bigquery";
import { loadCatalog } from "./catalog";
import type { FreshnessMap } from "./types";

export const PROJECT = process.env.BIGQUERY_PROJECT_ID ?? "root-emissary-313321";

export interface FreshnessResult {
  map: FreshnessMap;
  /** datasets que respondieron OK (para inferir inexistencia con certeza). */
  datasetsOk: Set<string>;
}

type TablesRow = {
  table_id: string;
  row_count: number | string | null;
  last_modified_time: number | string | null; // ms desde epoch
};

/** Datasets distintos presentes en el catálogo (prefijo antes del primer "."). */
export function datasetsFromCatalog(): string[] {
  const set = new Set<string>();
  for (const a of loadCatalog().assets) {
    const dot = a.key.indexOf(".");
    if (dot > 0) set.add(a.key.slice(0, dot));
  }
  return [...set];
}

/**
 * Corre una query de metadata por cada dataset del catálogo, best-effort.
 * Devuelve el set de datasets que respondieron (un dataset inexistente cuenta
 * como "consultado y vacío" para poder afirmar inexistencia; otros errores se
 * loguean y se omiten). Lo comparten getFreshness (__TABLES__) y getColumns
 * (INFORMATION_SCHEMA.COLUMNS).
 */
export async function forEachDatasetTable<T>(
  label: string,
  sql: (ds: string) => string,
  onRows: (ds: string, rows: T[]) => void,
): Promise<Set<string>> {
  const datasetsOk = new Set<string>();
  await Promise.all(
    datasetsFromCatalog().map(async (ds) => {
      try {
        const rows = await query<T>(sql(ds));
        datasetsOk.add(ds);
        onRows(ds, rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/not found/i.test(msg)) {
          datasetsOk.add(ds);
        } else {
          console.error(`[governance/${label}] dataset "${ds}" no consultable: ${msg}`);
        }
      }
    }),
  );
  return datasetsOk;
}

export async function getFreshness(): Promise<FreshnessResult> {
  const map: FreshnessMap = {};
  const datasetsOk = await forEachDatasetTable<TablesRow>(
    "freshness",
    (ds) => `SELECT table_id, row_count, last_modified_time FROM \`${PROJECT}.${ds}.__TABLES__\``,
    (ds, rows) => {
      for (const r of rows) {
        const ms = r.last_modified_time == null ? NaN : Number(r.last_modified_time);
        map[`${ds}.${r.table_id}`] = {
          exists: true,
          rows: r.row_count == null ? null : Number(r.row_count),
          lastModified: Number.isNaN(ms) ? null : new Date(ms).toISOString(),
        };
      }
    },
  );
  return { map, datasetsOk };
}
