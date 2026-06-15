/**
 * Seed del catálogo de sponsors (ticketing_sponsors) con las marcas usadas por
 * los planes históricos cargados. Idempotente: el índice único (país, nombre)
 * + ON CONFLICT DO NOTHING evita duplicados al re-correr.
 *
 * Uso:  node scripts/seed-sponsors.mjs
 */
import { readFileSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const SPONSORS = [
  { nombre: "ENTEL + BANCO", country: "CL" },
  { nombre: "Club Sundeck Prime", country: "CL" },
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
});

try {
  for (const s of SPONSORS) {
    await pool.query(
      `INSERT INTO ticketing_sponsors (nombre, country)
       VALUES ($1, $2)
       ON CONFLICT (country, nombre) DO NOTHING`,
      [s.nombre, s.country],
    );
  }
  const r = await pool.query(
    "SELECT nombre, country, activo FROM ticketing_sponsors ORDER BY country, nombre",
  );
  console.log(`Catálogo de sponsors (${r.rows.length}):`);
  for (const row of r.rows) {
    console.log(`  - ${row.country} · ${row.nombre}${row.activo ? "" : " (inactivo)"}`);
  }
} finally {
  await pool.end();
}
