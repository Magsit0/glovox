/* Preflight de `db:migrate`.
 *
 * La BD Neon es COMPARTIDA con glovox-operaciones. drizzle-kit crea la tabla de
 * control con `CREATE TABLE IF NOT EXISTS` FUERA de la transacción y luego lee
 * MAX(created_at); si esa tabla existe pero está VACÍA (o no existe), el migrador
 * cree que no hay nada aplicado y RE-EJECUTA TODA la historia contra la base.
 *
 * Este guard aborta migrate salvo que la tabla de control ya esté sembrada
 * (baseline). Para bootstrap deliberado de una BD nueva: ALLOW_MIGRATE_BOOTSTRAP=1.
 *
 * Uso: node db/preflight-migrate.cjs <tabla_de_control>
 */
const table = process.argv[2];
if (!/^__drizzle_migrations_[a-z]+$/.test(table || "")) {
  console.error("preflight: nombre de tabla de control inválido:", table);
  process.exit(1);
}
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("preflight: falta DATABASE_URL / POSTGRES_URL en el entorno");
  process.exit(1);
}
const postgres = require("postgres");
const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5 });

(async () => {
  const reg = (await sql`SELECT to_regclass(${"drizzle." + table}) AS t`)[0].t;
  let rows = null;
  if (reg) rows = (await sql.unsafe(`SELECT count(*)::int AS n FROM "drizzle"."${table}"`))[0].n;
  await sql.end();

  const bootstrap = process.env.ALLOW_MIGRATE_BOOTSTRAP === "1";
  if ((!reg || rows === 0) && !bootstrap) {
    console.error(`\n⛔ preflight abortó db:migrate.`);
    console.error(`   La tabla de control drizzle.${table} ${reg ? "está VACÍA" : "NO existe"}.`);
    console.error(`   Ejecutar migrate ahora usaría una tabla vacía y drizzle-kit`);
    console.error(`   re-ejecutaría TODA la historia contra la BD Neon compartida.`);
    console.error(`   → Siembra primero las tablas de control (baseline).`);
    console.error(`   → Si es una BD nueva a propósito: ALLOW_MIGRATE_BOOTSTRAP=1 npm run db:migrate\n`);
    process.exit(1);
  }
  console.log(`preflight ✓ drizzle.${table}: ${rows} filas registradas — continúa migrate.`);
  process.exit(0);
})().catch((e) => { console.error("preflight error:", e.message); process.exit(1); });
