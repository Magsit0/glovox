/**
 * Service layer del editor en vivo de la hoja de estandarización de eventos.
 *
 * La pestaña `CategoriaEvento` es la fuente de verdad de la que NACE la tabla
 * BigQuery `root-emissary-313321.glovox.categoriaEvento` (consumida en
 * lib/queries/{onepager,ticketing,marketing}.ts y el slack-data-agent). La
 * pestaña `venues` es la dimensión de recintos (clave = nombre en la columna A)
 * que alimenta el desplegable de la columna VENUE.
 *
 * El pipeline hoja → BigQuery NO vive acá: este módulo sólo lee y escribe las
 * pestañas. CategoriaEvento es una BASE TABLE (no externa sobre el Drive,
 * verificado vía INFORMATION_SCHEMA), así que editar la hoja no se refleja solo
 * en BQ — eso es Fase 2 (loader gobernado).
 *
 * Las server actions (app/admin/eventos/actions.ts) validan permisos; acá vive
 * la lógica de Sheets + el audit.
 */
import { getSheetsClient } from "@/lib/google-sheets";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * `USER_ENTERED`: Sheets interpreta el valor como si lo tipeara una persona, así
 * "123" queda numérico y "true" booleano. Es deliberado: la hoja alimenta
 * columnas tipadas en BQ (goalTickets/budgetPm INT64, isCanceled BOOL; en venues
 * capacidad INT64, activo BOOL) y un `RAW` las convertiría en texto. Riesgo:
 * interpreta fórmulas (=...); aceptable porque sólo edita un superadmin.
 */
const VALUE_INPUT_OPTION = "USER_ENTERED";

/** Pestañas editables del archivo. */
export type SheetTarget = "eventos" | "venues";

export interface CellEdit {
  /** Índice de fila 0-based dentro del rango leído (fila 0 = encabezados). */
  row: number;
  /** Índice de columna 0-based (0 = A). */
  col: number;
  /** Valor original leído, para detección optimista de conflicto. */
  oldValue: string;
  /** Valor nuevo a escribir. */
  newValue: string;
}

export interface SheetGrid {
  spreadsheetId: string;
  sheetTitle: string;
  /** URL para abrir la hoja real en Google Sheets. */
  viewUrl: string;
  /** Matriz completa del rango; values[0] son los encabezados. Ancho fijo. */
  values: string[][];
  rowCount: number;
  colCount: number;
}

// ---------- Helpers de A1 ----------

/** 0-based → letra de columna (0 → A, 25 → Z, 26 → AA). */
function colToA1(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Envuelve el nombre de la pestaña en comillas simples (escapa las internas). */
function quoteSheet(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** Dirección A1 absoluta de una celda. Asume que el rango empieza en A1. */
function cellA1(sheetTitle: string, row: number, col: number): string {
  return `${quoteSheet(sheetTitle)}!${colToA1(col)}${row + 1}`;
}

function getSpreadsheetId(): string {
  const id = process.env.EVENTOS_SHEET_ID?.trim();
  if (!id) throw new Error("Falta EVENTOS_SHEET_ID en el entorno");
  return id;
}

function venuesTabName(): string {
  return process.env.EVENTOS_VENUES_TAB?.trim() || "venues";
}

/**
 * Resuelve la pestaña y el rango a operar según el target.
 * - "venues": pestaña `EVENTOS_VENUES_TAB` (default "venues").
 * - "eventos": `EVENTOS_SHEET_RANGE` si está seteado (debe empezar en A1, ej.
 *   `Hoja1` o `Hoja1!A1:Z500`); si no, la primera pestaña del archivo.
 */
async function resolveTarget(target: SheetTarget): Promise<{
  spreadsheetId: string;
  sheetTitle: string;
  range: string;
  viewUrl: string;
}> {
  const spreadsheetId = getSpreadsheetId();
  const viewUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  if (target === "venues") {
    const tab = venuesTabName();
    return { spreadsheetId, sheetTitle: tab, range: quoteSheet(tab), viewUrl };
  }

  const envRange = process.env.EVENTOS_SHEET_RANGE?.trim();
  if (envRange) {
    const sheetTitle = (envRange.includes("!") ? envRange.split("!")[0] : envRange)
      .replace(/^'|'$/g, "")
      .replace(/''/g, "'");
    return { spreadsheetId, sheetTitle, range: envRange, viewUrl };
  }

  const meta = await getSheetsClient().spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,index)",
  });
  const first = (meta.data.sheets ?? [])
    .map((s) => s.properties)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
  const sheetTitle = first?.title;
  if (!sheetTitle) throw new Error("La hoja no tiene pestañas legibles");
  return { spreadsheetId, sheetTitle, range: quoteSheet(sheetTitle), viewUrl };
}

// ---------- Lectura ----------

/** Lee la pestaña indicada como una matriz de ancho fijo (values[0] = headers). */
export async function readSheetGrid(target: SheetTarget): Promise<SheetGrid> {
  const { spreadsheetId, sheetTitle, range, viewUrl } = await resolveTarget(target);

  const res = await getSheetsClient().spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
  });

  const raw = (res.data.values ?? []) as unknown[][];
  // Sheets recorta celdas vacías al final → filas de distinto largo. Normalizar
  // a ancho fijo y coercer todo a string para cruzar al cliente sin sorpresas.
  const colCount = raw.reduce((max, r) => Math.max(max, r.length), 1);
  const values: string[][] = raw.map((r) =>
    Array.from({ length: colCount }, (_, c) =>
      r[c] === null || r[c] === undefined ? "" : String(r[c]),
    ),
  );

  return {
    spreadsheetId,
    sheetTitle,
    viewUrl,
    values,
    rowCount: values.length,
    colCount,
  };
}

/**
 * Lista estandarizada de venues: columna A de la pestaña `venues`, sin header,
 * dedupe (case-insensitive) + orden. Si la pestaña falta, devuelve [] (no rompe).
 */
export async function readVenuesList(): Promise<string[]> {
  const spreadsheetId = getSpreadsheetId();
  try {
    const res = await getSheetsClient().spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheet(venuesTabName())}!A:A`,
      majorDimension: "ROWS",
    });
    const rows = res.data.values ?? [];
    const seen = new Set<string>();
    const out: string[] = [];
    rows.slice(1).forEach((r) => {
      const v = (r[0] === null || r[0] === undefined ? "" : String(r[0])).trim();
      const key = v.toLowerCase();
      if (v && !seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    });
    out.sort((a, b) => a.localeCompare(b, "es"));
    return out;
  } catch {
    return [];
  }
}

// ---------- Escritura ----------

async function logAudit(
  actorId: string | null,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Best-effort: una falla de auditoría no debe tumbar la edición.
  try {
    await db.insert(auditLog).values({ actorId, action, payload });
  } catch {
    /* noop */
  }
}

/**
 * Escribe sólo las celdas cambiadas en la pestaña `target`. Antes de escribir
 * relee esas mismas celdas y las compara contra `oldValue` (concurrencia
 * optimista): si alguien más editó la hoja entremedio, aborta.
 */
export async function saveCells(
  target: SheetTarget,
  actorId: string | null,
  email: string,
  edits: CellEdit[],
): Promise<void> {
  if (edits.length === 0) return;
  const { spreadsheetId, sheetTitle } = await resolveTarget(target);
  const client = getSheetsClient();
  const ranges = edits.map((e) => cellA1(sheetTitle, e.row, e.col));

  const check = await client.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    majorDimension: "ROWS",
  });
  const got = check.data.valueRanges ?? [];
  const conflicts: string[] = [];
  edits.forEach((e, i) => {
    const cell = got[i]?.values?.[0]?.[0];
    const current = cell === null || cell === undefined ? "" : String(cell);
    if (current !== e.oldValue) conflicts.push(ranges[i]);
  });
  if (conflicts.length > 0) {
    throw new Error(
      `La hoja cambió en ${conflicts.join(", ")}. Recargá para ver lo último antes de guardar.`,
    );
  }

  await client.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: VALUE_INPUT_OPTION,
      data: edits.map((e, i) => ({ range: ranges[i], values: [[e.newValue]] })),
    },
  });

  await logAudit(actorId, `${target}.sheet.save`, {
    email,
    count: edits.length,
    cells: ranges,
  });
}

/**
 * Agrega una columna nueva a `target`: escribe `name` como encabezado en la
 * primera columna libre (tras la última con nombre). Extiende la grilla si hace falta.
 */
export async function addColumn(
  target: SheetTarget,
  actorId: string | null,
  email: string,
  nameRaw: string,
): Promise<void> {
  const name = nameRaw.trim();
  if (!name) throw new Error("El nombre de la columna es obligatorio");
  const { spreadsheetId, sheetTitle } = await resolveTarget(target);
  const client = getSheetsClient();

  const meta = await client.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(title,sheetId,gridProperties)",
  });
  const props = (meta.data.sheets ?? [])
    .map((s) => s.properties)
    .find((p) => p?.title === sheetTitle);
  if (!props) throw new Error("No se encontró la pestaña de la hoja");
  const sheetId = props.sheetId ?? 0;
  const gridCols = props.gridProperties?.columnCount ?? 0;

  const headerRes = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(sheetTitle)}!1:1`,
    majorDimension: "ROWS",
  });
  const header = (headerRes.data.values?.[0] ?? []).map((v) =>
    v === null || v === undefined ? "" : String(v),
  );
  if (header.some((h) => h.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`Ya existe una columna llamada "${name}"`);
  }
  const targetCol = header.length;

  if (targetCol >= gridCols) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: "COLUMNS",
              length: targetCol - gridCols + 1,
            },
          },
        ],
      },
    });
  }

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: cellA1(sheetTitle, 0, targetCol),
    valueInputOption: "RAW",
    requestBody: { values: [[name]] },
  });

  await logAudit(actorId, `${target}.sheet.add_column`, { email, name, col: targetCol });
}

/** Agrega una fila nueva al final de la pestaña `target`. */
export async function appendRow(
  target: SheetTarget,
  actorId: string | null,
  email: string,
  values: string[],
): Promise<void> {
  const { spreadsheetId, sheetTitle } = await resolveTarget(target);

  await getSheetsClient().spreadsheets.values.append({
    spreadsheetId,
    range: quoteSheet(sheetTitle),
    valueInputOption: VALUE_INPUT_OPTION,
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });

  await logAudit(actorId, `${target}.sheet.append`, { email, cols: values.length });
}
