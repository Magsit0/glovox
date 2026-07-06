import { auth, drive, type drive_v3 } from "@googleapis/drive";

let client: drive_v3.Drive | null = null;

/**
 * Scope de Drive completo: se necesita para crear archivos (convertidos a
 * Google Docs) y compartirlos. Igual que Sheets, Drive exige scope explícito.
 */
const SCOPES = ["https://www.googleapis.com/auth/drive"];

/**
 * Cliente Drive v3 autenticado con Service Account, cacheado a nivel módulo
 * (mismo patrón que lib/google-sheets.ts). Credenciales: SHEETS_SERVICE_ACCOUNT
 * con fallback a BIGQUERY_SERVICE_ACCOUNT. Requiere la Drive API habilitada en
 * el proyecto GCP del service account.
 */
export function getDriveClient(): drive_v3.Drive {
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

  client = drive({ version: "v3", auth: authClient });
  return client;
}
