/**
 * Seed `glovox.nombres_genero` desde `data/nombres_genero.csv`.
 *
 * Idempotente: si la tabla existe, la borra y la recrea. Respeta la región del
 * dataset `glovox` (importante: el dataset NO está en US).
 *
 * Uso:
 *   npm run bq:seed-nombres
 *
 * El CSV debe tener encabezado `nombre,genero` con genero in {M, F}.
 * La misma normalización se aplica en `lib/queries/frees.ts` al hacer JOIN.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getBigQueryClient } from "@/lib/bigquery";

const CSV_PATH = path.resolve(process.cwd(), "data/nombres_genero.csv");
const DATASET = "glovox";
const TABLE = "nombres_genero";

function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

type Row = { nombre: string; genero: "M" | "F" };

function parseCsv(text: string): { rows: Row[]; ambiguous: string[]; invalid: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines.shift();
  if (!header || !/^nombre\s*,\s*genero$/i.test(header.trim())) {
    throw new Error(
      `CSV must start with header "nombre,genero". Got: ${header ?? "(empty)"}`,
    );
  }

  const byKey = new Map<string, "M" | "F">();
  const ambiguous: string[] = [];
  const invalid: string[] = [];

  for (const line of lines) {
    const [rawName, rawGen] = line.split(",").map((s) => s.trim());
    const gen = (rawGen || "").toUpperCase();
    const nombre = normalize(rawName || "");
    if (!nombre) {
      invalid.push(line);
      continue;
    }
    if (gen !== "M" && gen !== "F") {
      invalid.push(line);
      continue;
    }
    const existing = byKey.get(nombre);
    if (existing && existing !== gen) {
      ambiguous.push(nombre);
      byKey.delete(nombre);
      continue;
    }
    byKey.set(nombre, gen as "M" | "F");
  }

  const rows: Row[] = Array.from(byKey.entries()).map(([nombre, genero]) => ({
    nombre,
    genero,
  }));
  return { rows, ambiguous, invalid };
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`No existe el CSV en ${CSV_PATH}`);
  }
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const { rows, ambiguous, invalid } = parseCsv(text);

  if (rows.length === 0) {
    throw new Error("CSV no produjo filas válidas; aborto.");
  }

  console.log(`Proyecto: ${process.env.BIGQUERY_PROJECT_ID ?? "(no seteado)"}`);
  console.log(`Dataset.tabla: ${DATASET}.${TABLE}`);
  console.log(`Filas válidas: ${rows.length}`);
  if (ambiguous.length) {
    console.warn(
      `Omitidas ${ambiguous.length} ambiguas (mismo nombre con M y F). Primeras 5: ${ambiguous.slice(0, 5).join(", ")}`,
    );
  }
  if (invalid.length) {
    console.warn(
      `Omitidas ${invalid.length} líneas inválidas. Primeras 5: ${invalid.slice(0, 5).join(" | ")}`,
    );
  }

  const bq = getBigQueryClient();
  const dataset = bq.dataset(DATASET);

  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    throw new Error(
      `Dataset ${DATASET} no existe en el proyecto ${process.env.BIGQUERY_PROJECT_ID}. Crealo primero o revisa BIGQUERY_PROJECT_ID.`,
    );
  }
  const [datasetMeta] = await dataset.getMetadata();
  console.log(`Región del dataset: ${datasetMeta.location}`);

  const table = dataset.table(TABLE);
  const [tableExists] = await table.exists();
  if (tableExists) {
    console.log("Tabla existe, la elimino para recrear…");
    await table.delete();
  }

  console.log("Creando tabla…");
  await dataset.createTable(TABLE, {
    schema: [
      { name: "nombre", type: "STRING", mode: "REQUIRED" },
      { name: "genero", type: "STRING", mode: "REQUIRED" },
    ],
  });

  // Streaming insert es asíncrono; BigQuery puede tardar minutos en hacer
  // visible la data para queries. Para evitar eso usamos un load job
  // sincrónico desde un archivo JSON-NDJSON temporal.
  const tmpPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "nombres-")),
    "nombres.ndjson",
  );
  fs.writeFileSync(
    tmpPath,
    rows.map((r) => JSON.stringify(r)).join("\n"),
    "utf8",
  );
  console.log(`Cargando ${rows.length} filas vía load job…`);
  const [job] = await table.load(tmpPath, {
    sourceFormat: "NEWLINE_DELIMITED_JSON",
    writeDisposition: "WRITE_TRUNCATE",
  });
  const errors = job.status?.errors ?? [];
  if (errors.length) {
    console.error("Load job errores:", JSON.stringify(errors, null, 2));
    throw new Error("Load job falló");
  }
  fs.unlinkSync(tmpPath);
  console.log("Load job completado.");

  const [verify] = await bq.query({
    query: `SELECT genero, COUNT(*) AS n FROM \`${process.env.BIGQUERY_PROJECT_ID}.${DATASET}.${TABLE}\` GROUP BY genero ORDER BY genero`,
    location: datasetMeta.location,
  });
  console.log("Distribución final:");
  for (const r of verify as Array<{ genero: string; n: number | { value: string } }>) {
    const n = typeof r.n === "object" && r.n !== null && "value" in r.n ? r.n.value : r.n;
    console.log(`  ${r.genero}: ${n}`);
  }

  console.log("Listo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
