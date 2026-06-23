/**
 * Calidad de datos v1 — checks BARATOS, en vivo contra BigQuery (solo metadata,
 * sin escanear datos):
 *
 *   existe     ¿la tabla existe en BQ?                     (de __TABLES__)
 *   frescura   ¿cargó dentro del SLA?                       (last_modified)
 *   volumen    ¿tiene filas (no está vacía)?                (row_count)
 *   schema     ¿las columnas/tipos reales coinciden con el  (INFORMATION_SCHEMA.COLUMNS
 *              schema versionado?                             vs schemas/bigquery/*.json)
 *
 * Cada tabla obtiene un score 0-100 = promedio ponderado de sus checks
 * aplicables. Los checks que escanean datos (completitud, unicidad, validez)
 * son v2 y corren como job programado.
 */
import { isStale } from "./format";
import type { AssetRow } from "./types";

export type CheckStatus = "ok" | "warn" | "fail" | "na";

export interface CheckResult {
  status: CheckStatus;
  detail?: string;
}

/** Color + etiqueta (es) de cada resultado de check. Fuente única para la
 *  matriz de Calidad y el glosario. */
export const CHECK_META: Record<CheckStatus, { label: string; color: string }> = {
  ok: { label: "OK", color: "#7FB52B" },
  warn: { label: "Alerta", color: "#EF8C34" },
  fail: { label: "Falla", color: "#ED75A0" },
  na: { label: "n/a", color: "#999999" },
};

export type DimensionKey = "existe" | "frescura" | "volumen" | "schema";

export const DIMENSIONS: { key: DimensionKey; label: string; help: string }[] = [
  { key: "existe", label: "Existe", help: "La tabla existe en BigQuery." },
  { key: "frescura", label: "Frescura", help: "Cargó dentro del SLA (≤48h para tablas diarias)." },
  { key: "volumen", label: "Volumen", help: "La tabla tiene filas (no está vacía)." },
  { key: "schema", label: "Schema", help: "Columnas y tipos reales coinciden con el schema versionado." },
];

export type ScoreLevel = "ok" | "warn" | "bad" | "na";

/** Color + etiqueta (es) de cada nivel de score (≥85 ok · ≥50 warn · <50 bad). */
export const LEVEL_META: Record<ScoreLevel, { label: string; color: string }> = {
  ok: { label: "Sano", color: "#7FB52B" },
  warn: { label: "Con alertas", color: "#EF8C34" },
  bad: { label: "Crítico", color: "#ED75A0" },
  na: { label: "Sin evaluar", color: "#999999" },
};

export interface QualityResult {
  key: string;
  checks: Record<DimensionKey, CheckResult>;
  /** 0-100, o null si ningún check aplica (ej. vistas). */
  score: number | null;
  level: ScoreLevel;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface ColumnsResult {
  byFqn: Record<string, ColumnInfo[]>;
  datasetsOk: Set<string>;
}

/** Normaliza tipos BQ para comparar el schema versionado con el real. */
function normalizeType(t: string): string {
  let s = t.toUpperCase().trim();
  const arr = s.match(/^ARRAY<(.+)>$/); // REPEATED se ve como ARRAY<...>
  if (arr) s = arr[1].trim();
  if (s.startsWith("STRUCT")) return "STRUCT";
  s = s.replace(/\(.*\)$/, ""); // NUMERIC(10,2) → NUMERIC, STRING(50) → STRING
  const synonyms: Record<string, string> = {
    INTEGER: "INT64",
    FLOAT: "FLOAT64",
    BOOLEAN: "BOOL",
    RECORD: "STRUCT",
  };
  return synonyms[s] ?? s;
}

function datasetOf(key: string): string {
  const i = key.indexOf(".");
  return i > 0 ? key.slice(0, i) : key;
}

const isArrayType = (raw: string) => /^ARRAY</i.test(raw.trim());

function schemaCheck(row: AssetRow, columns: ColumnsResult, isView: boolean): CheckResult {
  // Las vistas no validan contra schema versionado en v1.
  if (isView) return { status: "na", detail: "vista" };

  // Sin contrato versionado: para una tabla esto ES un riesgo de calidad
  // (el schema puede driftear sin aviso), no un "no aplica". Penaliza.
  if (row.fields.length === 0) {
    return { status: "warn", detail: "sin contrato versionado" };
  }

  const actual = columns.byFqn[row.key];
  if (!actual) {
    const known = columns.datasetsOk.has(datasetOf(row.key));
    return { status: "na", detail: known ? "tabla sin columnas en BQ" : "dataset no consultado" };
  }
  const actualRaw = new Map(actual.map((c) => [c.name, c.type]));
  const expectedNames = new Set(row.fields.map((f) => f.name));

  const missing: string[] = [];
  const mismatch: string[] = [];
  for (const f of row.fields) {
    const raw = actualRaw.get(f.name);
    if (raw == null) {
      missing.push(f.name);
      continue;
    }
    if (f.type && normalizeType(f.type) !== normalizeType(raw)) {
      mismatch.push(`${f.name} (${normalizeType(f.type)}≠${normalizeType(raw)})`);
    } else if ((f.mode === "REPEATED") !== isArrayType(raw)) {
      mismatch.push(`${f.name} (cardinalidad)`);
    }
  }
  const extra = actual.filter((c) => !expectedNames.has(c.name)).map((c) => c.name);

  if (missing.length || mismatch.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`faltan: ${missing.join(", ")}`);
    if (mismatch.length) parts.push(`tipo: ${mismatch.join(", ")}`);
    return { status: "fail", detail: parts.join(" · ") };
  }
  if (extra.length) {
    return { status: "warn", detail: `${extra.length} columna(s) nueva(s) en BQ: ${extra.join(", ")}` };
  }
  return { status: "ok", detail: `${row.fields.length} columnas coinciden` };
}

export const WEIGHT: Record<DimensionKey, number> = {
  existe: 0.25,
  frescura: 0.3,
  volumen: 0.15,
  schema: 0.3,
};
const VALUE: Record<Exclude<CheckStatus, "na">, number> = { ok: 1, warn: 0.5, fail: 0 };

// Cadencias con ventana de carga esperada → su frescura sí se evalúa.
const SLA_FREQUENCIES = new Set(["daily", "hourly", "weekly", "realtime"]);

export function computeQuality(row: AssetRow, columns: ColumnsResult): QualityResult {
  const f = row.freshness;
  const isView = row.assetType === "view";

  // Tabla sin frescura = BigQuery no respondió para su dataset → no podemos
  // evaluar nada con certeza. No inventamos un score basado solo en schema.
  if (!isView && !f) {
    const na: CheckResult = { status: "na" };
    return {
      key: row.key,
      checks: {
        existe: { status: "na", detail: "BQ no consultado" },
        frescura: na,
        volumen: na,
        schema: na,
      },
      score: null,
      level: "na",
    };
  }

  const existe: CheckResult = isView
    ? { status: "na", detail: "vista" }
    : f!.exists
      ? { status: "ok" }
      : { status: "fail", detail: "no existe en BQ" };

  const hasSla = SLA_FREQUENCIES.has((row.frequency ?? "").toLowerCase());
  const frescura: CheckResult = isView
    ? { status: "na", detail: "vista (en vivo)" }
    : !f!.exists
      ? { status: "fail", detail: "nunca cargó" }
      : !hasSla
        ? { status: "na", detail: "sin SLA de carga declarado" }
        : !f!.lastModified
          ? { status: "na", detail: "sin fecha de carga" }
          : isStale(f)
            ? { status: "warn", detail: "datos desactualizados (>48h)" }
            : { status: "ok" };

  const volumen: CheckResult =
    isView || !f!.exists
      ? { status: "na" }
      : f!.rows == null
        ? { status: "na" }
        : f!.rows === 0
          ? { status: "fail", detail: "tabla vacía" }
          : { status: "ok", detail: `${f!.rows.toLocaleString("es-CL")} filas` };

  const schema = schemaCheck(row, columns, isView);

  const checks: Record<DimensionKey, CheckResult> = { existe, frescura, volumen, schema };

  let wSum = 0;
  let acc = 0;
  for (const dim of Object.keys(WEIGHT) as DimensionKey[]) {
    const st = checks[dim].status;
    if (st === "na") continue;
    wSum += WEIGHT[dim];
    acc += WEIGHT[dim] * VALUE[st];
  }
  const score = wSum === 0 ? null : Math.round((acc / wSum) * 100);
  const level: ScoreLevel =
    score == null ? "na" : score >= 85 ? "ok" : score >= 50 ? "warn" : "bad";

  return { key: row.key, checks, score, level };
}
