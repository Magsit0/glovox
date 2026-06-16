import { BigQuery } from "@google-cloud/bigquery";
import { buildSyncSql, type ExternalColumn } from "@/lib/eventos-sync-sql";
import { readColumnTypes } from "@/lib/eventos-sheet-service";

let client: BigQuery | null = null;

/**
 * Cliente BigQuery con permiso de ESCRITURA, aislado para el botón "Sincronizar
 * a BigQuery" de /admin/eventos. Usa credenciales de `BIGQUERY_SYNC_SERVICE_ACCOUNT`
 * (= SA `bqaccess@`, con dataEditor + jobUser). El cliente LECTOR de
 * lib/bigquery.ts queda intacto (solo lectura con `glovox-data-reader@`).
 *
 * Incluye scope Drive: las tablas externas leen el Sheet vía Drive (y el Sheet
 * está compartido con el SA).
 */
function getBigQuerySyncClient(): BigQuery {
  if (client) return client;
  const raw = process.env.BIGQUERY_SYNC_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "Falta BIGQUERY_SYNC_SERVICE_ACCOUNT en el entorno (SA con permiso de escritura)",
    );
  }
  client = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(raw),
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  return client;
}

const PROJECT = "root-emissary-313321";

/** Pestañas sincronizables a BigQuery. */
export type SyncTarget = "eventos" | "venues";

interface TargetConfig {
  /** Pestaña del Sheet: sheet_range de la externa + clave en `_tipos`. */
  sheetTab: string;
  nativeTable: string;
  externalTable: string;
}

function targetConfig(target: SyncTarget): TargetConfig {
  if (target === "venues") {
    return {
      sheetTab: process.env.EVENTOS_VENUES_TAB?.trim() || "venues",
      nativeTable: `${PROJECT}.glovox.venues`,
      externalTable: `${PROJECT}.glovox.venuesGS`,
    };
  }
  // eventos: la externa existente usa sheet_range='CategoriaEvento'.
  return {
    sheetTab: "CategoriaEvento",
    nativeTable: `${PROJECT}.glovox.categoriaEvento`,
    externalTable: `${PROJECT}.glovox.categoriaEventoGS`,
  };
}

/**
 * Recrea la tabla externa (autodetect) para REFRESCAR su esquema antes de
 * materializar. BigQuery cachea el esquema autodetectado de las Sheets externas
 * y no incorpora solo las columnas nuevas del Sheet. Recrear con las mismas
 * OPTIONS es idempotente y seguro: la externa es solo un puntero al Sheet (los
 * dashboards leen la tabla NATIVA, no esta). Crea la externa si no existía.
 */
async function refreshExternalTable(bq: BigQuery, cfg: TargetConfig): Promise<void> {
  const id = process.env.EVENTOS_SHEET_ID?.trim();
  if (!id) throw new Error("Falta EVENTOS_SHEET_ID en el entorno");
  const uri = `https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`;
  const range = cfg.sheetTab.replace(/'/g, "\\'");
  await bq.query({
    query:
      "CREATE OR REPLACE EXTERNAL TABLE `" + cfg.externalTable + "`\n" +
      "OPTIONS (\n" +
      "  format = 'GOOGLE_SHEETS',\n" +
      `  uris = ['${uri}'],\n` +
      `  sheet_range = '${range}',\n` +
      "  skip_leading_rows = 1\n" +
      ")",
  });
}

/**
 * Columnas reales (nombre + tipo autodetectado) que expone la tabla externa.
 * Vía dry-run, sin escanear datos. Una columna 100% vacía del Sheet NO aparece
 * acá (autodetect la omite) → el builder la trata como "ausente".
 */
async function getExternalColumns(
  bq: BigQuery,
  externalTable: string,
): Promise<ExternalColumn[]> {
  const [job] = await bq.createQueryJob({
    query: "SELECT * FROM `" + externalTable + "`",
    dryRun: true,
  });
  const meta = job.metadata as {
    statistics?: {
      query?: { schema?: { fields?: { name?: string; type?: string }[] } };
    };
  };
  const fields = meta?.statistics?.query?.schema?.fields ?? [];
  return fields
    .filter((f) => f.name)
    .map((f) => ({ name: f.name as string, type: f.type ?? "STRING" }));
}

/**
 * Sincroniza una pestaña del Sheet → su tabla nativa en BigQuery: refresca la
 * externa, arma el CREATE OR REPLACE con los casts de tipo registrados, lo
 * ejecuta y devuelve la cantidad de filas.
 */
export async function runSync(target: SyncTarget): Promise<{ rows: number }> {
  const cfg = targetConfig(target);
  const bq = getBigQuerySyncClient();

  await refreshExternalTable(bq, cfg);
  const castMap = await readColumnTypes(cfg.sheetTab);
  const externalColumns = await getExternalColumns(bq, cfg.externalTable);
  const sql = buildSyncSql(cfg.nativeTable, cfg.externalTable, castMap, externalColumns);

  await bq.query({ query: sql });

  const [rows] = await bq.query({
    query: "SELECT COUNT(*) AS n FROM `" + cfg.nativeTable + "`",
  });
  const raw = (rows?.[0] as { n?: unknown } | undefined)?.n;
  const n =
    typeof raw === "object" && raw !== null && "value" in raw
      ? Number((raw as { value: string }).value)
      : Number(raw ?? 0);
  return { rows: Number.isFinite(n) ? n : 0 };
}
