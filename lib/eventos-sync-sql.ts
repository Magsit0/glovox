/**
 * Construye el `CREATE OR REPLACE TABLE <native> AS SELECT ... FROM <external>`
 * que materializa una tabla nativa desde su tabla externa (autodetect sobre el
 * Sheet). Lo dispara el botón "Sincronizar a BigQuery" de /admin/eventos (por
 * pestaña: categoriaEvento / venues).
 *
 * Tipos: por defecto `SELECT *` (lo que autodetecta la externa). Para columnas
 * con tipo registrado en `_tipos` (≠ STRING) se castea SOLO cuando el tipo de
 * ORIGEN (lo que autodetectó BQ) no coincide con el deseado — así garantiza el
 * tipo sin hacer casts ilegales (p.ej. DATE→INT64). Casos:
 *  - presente y ya del tipo correcto → no se toca (queda vía `SELECT *`).
 *  - presente con otro tipo → se castea desde el tipo de origen.
 *  - ausente (columna vacía, autodetect la omite) → `CAST(NULL AS <tipo>)`.
 */
export interface ExternalColumn {
  name: string;
  type: string; // tipo autodetectado por BQ (STRING/INTEGER/FLOAT/DATE/BOOLEAN/NUMERIC…)
}

/** Backtick-quote seguro para un nombre de columna. */
function q(name: string): string {
  if (name.includes("`")) {
    throw new Error(`Nombre de columna inválido: ${name}`);
  }
  return "`" + name + "`";
}

/** Normaliza nombres de tipo del schema REST a los de SQL estándar. */
function normType(t: string): string {
  const u = (t || "").toUpperCase();
  if (u === "BOOLEAN") return "BOOL";
  if (u === "INTEGER") return "INT64";
  if (u === "FLOAT") return "FLOAT64";
  return u; // STRING, DATE, NUMERIC, BIGNUMERIC, TIMESTAMP, ...
}

const NUMERICISH = new Set(["INT64", "FLOAT64", "NUMERIC", "BIGNUMERIC"]);

/**
 * Expresión de cast para una columna PRESENTE, según su tipo de origen.
 * Devuelve null si no hace falta castear (ya es del tipo deseado) o si el cast
 * sería incompatible (se deja como está para no romper).
 */
function presentCastExpr(col: string, target: string, sourceRaw: string): string | null {
  const cc = q(col);
  const source = normType(sourceRaw);
  if (source === target) return null; // ya está bien

  if (target === "DATE") {
    if (source === "STRING") {
      return `SAFE.PARSE_DATE('%Y-%m-%d', ${cc}) AS ${cc}`;
    }
    if (NUMERICISH.has(source)) {
      // Número de serie de Google Sheets (epoch 1899-12-30).
      return `SAFE.DATE_ADD(DATE '1899-12-30', INTERVAL SAFE_CAST(${cc} AS INT64) DAY) AS ${cc}`;
    }
    return `SAFE_CAST(${cc} AS DATE) AS ${cc}`; // TIMESTAMP/DATETIME → DATE
  }
  if (target === "NUMERIC") {
    if (source === "STRING" || NUMERICISH.has(source)) {
      return `SAFE_CAST(${cc} AS NUMERIC) AS ${cc}`;
    }
    return null; // tipo incompatible (ej. DATE→NUMERIC): dejar como está
  }
  if (target === "BOOL") {
    if (source === "STRING" || NUMERICISH.has(source)) {
      return `SAFE_CAST(${cc} AS BOOL) AS ${cc}`;
    }
    return null;
  }
  return null;
}

export function buildSyncSql(
  nativeTable: string,
  externalTable: string,
  castMap: Record<string, string>,
  externalColumns: ExternalColumn[],
): string {
  const TABLE = "`" + nativeTable + "`";
  const EXTERNAL = "`" + externalTable + "`";
  // lower(name) → { name real, type } de la externa.
  const ext: Record<string, ExternalColumn> = {};
  for (const c of externalColumns) ext[c.name.trim().toLowerCase()] = c;

  const exceptCols: string[] = []; // columnas presentes que vamos a reemplazar
  const exprs: string[] = []; // expresiones de reemplazo / NULL tipado

  for (const [rawName, rawType] of Object.entries(castMap)) {
    const target = String(rawType).trim().toUpperCase();
    if (!target || target === "STRING") continue;
    const found = ext[rawName.trim().toLowerCase()];
    if (found) {
      const expr = presentCastExpr(found.name, target, found.type);
      if (expr) {
        exceptCols.push(q(found.name));
        exprs.push(expr);
      }
      // si expr === null, ya es del tipo correcto → no tocar
    } else {
      // ausente/vacía: crearla tipada con NULL.
      exprs.push(`CAST(NULL AS ${target}) AS ${q(rawName.trim())}`);
    }
  }

  if (exprs.length === 0) {
    return `CREATE OR REPLACE TABLE ${TABLE} AS\nSELECT * FROM ${EXTERNAL}`;
  }

  const star = exceptCols.length > 0 ? `* EXCEPT(${exceptCols.join(", ")})` : "*";
  return (
    `CREATE OR REPLACE TABLE ${TABLE} AS\n` +
    `SELECT ${star}, ${exprs.join(", ")}\n` +
    `FROM ${EXTERNAL}`
  );
}
