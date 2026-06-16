import { auth, sheets, type sheets_v4 } from "@googleapis/sheets";

let client: sheets_v4.Sheets | null = null;

/**
 * Scope de lectura + escritura sobre Google Sheets. A diferencia de BigQuery
 * (que infiere los scopes del service account), Sheets exige pedirlo explícito.
 */
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * Cliente Sheets v4 autenticado con un Service Account, cacheado a nivel módulo
 * (mismo patrón que lib/bigquery.ts).
 *
 * Credenciales: el JSON del SA vive en `SHEETS_SERVICE_ACCOUNT`; como fallback
 * se usa `BIGQUERY_SERVICE_ACCOUNT`. Para ESCRIBIR, ese SA debe tener la hoja
 * compartida como **Editor** (no Viewer) o `batchUpdate` falla con 403.
 *
 * Se recomienda un SA dedicado para esto (menor privilegio) en vez de reusar el
 * de BigQuery, que es de solo lectura.
 */
export function getSheetsClient(): sheets_v4.Sheets {
  if (client) return client;

  const raw =
    process.env.SHEETS_SERVICE_ACCOUNT ?? process.env.BIGQUERY_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "Falta SHEETS_SERVICE_ACCOUNT (o BIGQUERY_SERVICE_ACCOUNT) en el entorno",
    );
  }

  const authClient = new auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: SCOPES,
  });

  client = sheets({ version: "v4", auth: authClient });
  return client;
}
