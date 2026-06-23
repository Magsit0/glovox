/**
 * Columnas reales de cada tabla en BigQuery, vía INFORMATION_SCHEMA.COLUMNS
 * (metadata, barato). Server-only: importa el cliente de BigQuery, así que NO
 * debe importarse desde componentes cliente — por eso vive separado de
 * `quality.ts` (que es puro y sí lo consume la UI).
 */
import { PROJECT, forEachDatasetTable } from "./freshness";
import type { ColumnsResult } from "./quality";

export async function getColumns(): Promise<ColumnsResult> {
  const byFqn: Record<string, { name: string; type: string }[]> = {};
  const datasetsOk = await forEachDatasetTable<{
    table_name: string;
    column_name: string;
    data_type: string;
  }>(
    "columns",
    (ds) =>
      `SELECT table_name, column_name, data_type FROM \`${PROJECT}.${ds}\`.INFORMATION_SCHEMA.COLUMNS`,
    (_ds, rows) => {
      for (const r of rows) {
        const fqn = `${_ds}.${r.table_name}`;
        (byFqn[fqn] ??= []).push({ name: r.column_name, type: r.data_type });
      }
    },
  );
  return { byFqn, datasetsOk };
}
