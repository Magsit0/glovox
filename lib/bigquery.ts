import { BigQuery } from "@google-cloud/bigquery";

let client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (client) return client;

  const raw = process.env.BIGQUERY_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("BIGQUERY_SERVICE_ACCOUNT env var is not set");
  }

  client = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(raw),
  });

  return client;
}

/**
 * Run a parameterized query and return rows as plain objects.
 * Always use params for user-supplied values — never interpolate into the SQL string.
 *
 * @example
 * const rows = await query(
 *   "SELECT * FROM `my_dataset.my_table` WHERE date = @date LIMIT 100",
 *   { date: "2024-01-01" }
 * )
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const bq = getBigQueryClient();
  const [rows] = await bq.query({ query: sql, params });
  return rows as T[];
}
