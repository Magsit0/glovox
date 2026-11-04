/**
 * Migración ÚNICA (2026-11-04): el plan de /inversion-medios pasa de guardarse
 * por EventoID de la ticketera (GLO213) a guardarse por el ID de la hoja
 * CategoriaEvento (1240-CL-FDS). Ver lib/eventos-id.ts.
 *
 * Toca `data.inversion_medios_diario` y `data.inversion_medios_etapas`, en UNA
 * transacción:
 *   1. Respaldo: tablas `*_bak_20261104` en Neon (CREATE TABLE AS) y un JSON en
 *      out/backups/. Para volver atrás: restaurar desde esas tablas.
 *   2. Cada llave vieja (EventoID) se traduce a su ID con la misma regla que el
 *      dashboard (mapaEventoIdTicketera). Si una celda ya existe con las dos
 *      llaves (alguien editó entre el deploy y esta migración), gana la
 *      editada más recientemente (`updated_at`).
 *   3. Las llaves que no existen en la hoja se borran SOLO si están en
 *      `HUERFANAS_OK` (GLO444 y GLO000: el usuario las borró de la hoja). Cualquier
 *      otra llave sin traducción aborta todo.
 *   4. Verifica que el monto por evento (ya traducido) sea el mismo antes y
 *      después, y deja una fila en audit_log.
 *
 * Idempotente: una segunda corrida no encuentra llaves viejas y no cambia nada.
 *
 * Uso:  npx tsx --env-file=.env.local scripts/migrar-plan-a-id-hoja.ts            (en seco: ROLLBACK)
 *       npx tsx --env-file=.env.local scripts/migrar-plan-a-id-hoja.ts --aplicar
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ID_HOJA_RE } from "@/lib/eventos-id";
import { esIniciativaId } from "@/lib/inversion-medios/iniciativas";
import { getCatalogoEventos, mapaEventoIdTicketera } from "@/lib/queries/inversion-medios";

const APLICAR = process.argv.includes("--aplicar");
const HUERFANAS_OK = new Set(["GLO444", "GLO000"]);
const SUFIJO = "bak_20261104";

type Fila = Record<string, unknown>;
const filas = (r: unknown): Fila[] => ((r as { rows?: Fila[] }).rows ?? (r as Fila[]));

class Abortar extends Error {}

async function main() {
  const catalogo = await getCatalogoEventos();
  const ids = new Set(catalogo.map((e) => e.id));
  const deTicketera = mapaEventoIdTicketera(catalogo);
  const destino = (k: string) => (ids.has(k) || esIniciativaId(k) ? k : (deTicketera.get(k) ?? null));

  const [plan, etapas] = await Promise.all([
    db.execute(sql`SELECT * FROM data.inversion_medios_diario`).then(filas),
    db.execute(sql`SELECT * FROM data.inversion_medios_etapas`).then(filas),
  ]);
  mkdirSync("out/backups", { recursive: true });
  const archivo = `out/backups/inversion-medios-${SUFIJO}.json`;
  writeFileSync(archivo, JSON.stringify({ plan, etapas }, null, 1));
  console.log(`respaldo JSON: ${archivo} (${plan.length} filas de plan, ${etapas.length} de etapas)`);

  const llaves = new Set([...plan, ...etapas].map((f) => String(f.evento_id)));
  const mapa = new Map<string, string>(); // llave vieja → ID
  const huerfanas: string[] = [];
  const sinTraduccion: string[] = [];
  for (const k of llaves) {
    const d = destino(k);
    if (d === k) continue;
    if (d) mapa.set(k, d);
    else if (HUERFANAS_OK.has(k)) huerfanas.push(k);
    else sinTraduccion.push(k);
  }
  console.log("llaves a traducir:", Object.fromEntries(mapa));
  console.log("huérfanas a borrar:", huerfanas);
  if (sinTraduccion.length > 0) throw new Abortar(`llaves sin traducción (no se toca nada): ${sinTraduccion.join(", ")}`);

  // Monto esperado por llave final (sin las huérfanas).
  const esperado = new Map<string, number>();
  for (const f of plan) {
    const k = String(f.evento_id);
    if (huerfanas.includes(k)) continue;
    const d = mapa.get(k) ?? k;
    esperado.set(d, (esperado.get(d) ?? 0) + Number(f.monto_usd));
  }

  const pares = [...mapa.entries()].map(([v, n]) => sql`(${v}, ${n})`);
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`DROP TABLE IF EXISTS data.inversion_medios_diario_${SUFIJO}`));
      await tx.execute(sql.raw(`DROP TABLE IF EXISTS data.inversion_medios_etapas_${SUFIJO}`));
      await tx.execute(sql.raw(`CREATE TABLE data.inversion_medios_diario_${SUFIJO} AS SELECT * FROM data.inversion_medios_diario`));
      await tx.execute(sql.raw(`CREATE TABLE data.inversion_medios_etapas_${SUFIJO} AS SELECT * FROM data.inversion_medios_etapas`));

      if (huerfanas.length > 0) {
        const lista = sql.join(huerfanas.map((h) => sql`${h}`), sql`, `);
        const p = filas(await tx.execute(sql`DELETE FROM data.inversion_medios_diario WHERE evento_id IN (${lista}) RETURNING id`));
        const e = filas(await tx.execute(sql`DELETE FROM data.inversion_medios_etapas WHERE evento_id IN (${lista}) RETURNING evento_id`));
        console.log(`huérfanas borradas: ${p.length} filas de plan, ${e.length} de etapas`);
      }

      if (pares.length > 0) {
        const m = sql`(VALUES ${sql.join(pares, sql`, `)}) AS m(vieja, nueva)`;
        // Celda con las dos llaves: se borra la editada antes.
        const choque = filas(
          await tx.execute(sql`
            DELETE FROM data.inversion_medios_diario d
            USING ${m}, data.inversion_medios_diario o
            WHERE (
                (d.evento_id = m.vieja AND o.evento_id = m.nueva AND o.updated_at >= d.updated_at)
             OR (d.evento_id = m.nueva AND o.evento_id = m.vieja AND o.updated_at >  d.updated_at)
              )
              AND o.fecha = d.fecha AND o.plataforma = d.plataforma AND o.tipo = d.tipo
            RETURNING d.evento_id, d.fecha, d.plataforma, d.tipo`),
        );
        if (choque.length > 0) console.log("celdas con las dos llaves (gana la más reciente):", choque);
        const up = filas(
          await tx.execute(sql`
            UPDATE data.inversion_medios_diario d SET evento_id = m.nueva
            FROM ${m} WHERE d.evento_id = m.vieja RETURNING d.id`),
        );
        console.log(`plan traducido: ${up.length} filas`);

        const choqueEt = filas(
          await tx.execute(sql`
            DELETE FROM data.inversion_medios_etapas d
            USING ${m}, data.inversion_medios_etapas o
            WHERE (
                (d.evento_id = m.vieja AND o.evento_id = m.nueva AND o.updated_at >= d.updated_at)
             OR (d.evento_id = m.nueva AND o.evento_id = m.vieja AND o.updated_at >  d.updated_at)
              )
            RETURNING d.evento_id`),
        );
        if (choqueEt.length > 0) console.log("etapas con las dos llaves (gana la más reciente):", choqueEt);
        const upEt = filas(
          await tx.execute(sql`
            UPDATE data.inversion_medios_etapas d SET evento_id = m.nueva
            FROM ${m} WHERE d.evento_id = m.vieja RETURNING d.evento_id`),
        );
        console.log(`etapas traducidas: ${upEt.length}`);
      }

      // Verificación dentro de la transacción: si algo no cuadra, ROLLBACK.
      const despues = filas(
        await tx.execute(sql`SELECT evento_id, SUM(monto_usd) AS usd FROM data.inversion_medios_diario GROUP BY 1`),
      );
      const restantes = filas(
        await tx.execute(sql`SELECT DISTINCT evento_id FROM data.inversion_medios_diario UNION SELECT evento_id FROM data.inversion_medios_etapas`),
      )
        .map((f) => String(f.evento_id))
        .filter((k) => !ID_HOJA_RE.test(k) && !esIniciativaId(k));
      if (restantes.length > 0) throw new Abortar(`quedaron llaves viejas: ${restantes.join(", ")}`);
      const descuadres: string[] = [];
      const vistos = new Set<string>();
      for (const f of despues) {
        const k = String(f.evento_id);
        vistos.add(k);
        const antes = esperado.get(k) ?? 0;
        // Tolerancia de 1 centavo por redondeo; las celdas en choque cambian el total a propósito.
        if (Math.abs(antes - Number(f.usd)) > 0.01) descuadres.push(`${k}: ${antes.toFixed(2)} → ${Number(f.usd).toFixed(2)}`);
      }
      for (const k of esperado.keys()) if (!vistos.has(k)) descuadres.push(`${k}: desapareció`);
      if (descuadres.length > 0) console.log("⚠️ montos distintos (revisar):", descuadres);
      else console.log(`montos por evento: iguales antes y después (${esperado.size} llaves)`);
      if (descuadres.length > 0 && !process.argv.includes("--aceptar-descuadres")) {
        throw new Abortar("hay descuadres: no se aplica (corre con --aceptar-descuadres si son las celdas en choque)");
      }

      await tx.execute(sql`
        INSERT INTO data.audit_log (action, payload)
        VALUES ('inversionMedios.migrarClaveHoja', ${JSON.stringify({
          traducidas: Object.fromEntries(mapa),
          huerfanasBorradas: huerfanas,
          respaldo: [`data.inversion_medios_diario_${SUFIJO}`, `data.inversion_medios_etapas_${SUFIJO}`, archivo],
        })}::jsonb)`);

      if (!APLICAR) throw new Abortar("en seco: todo cuadra, ROLLBACK (corre con --aplicar)");
    });
    console.log("✅ aplicado");
  } catch (err) {
    if (err instanceof Abortar) console.log(`↩︎ ${err.message}`);
    else throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
