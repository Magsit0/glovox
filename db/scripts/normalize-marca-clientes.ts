/**
 * Limpieza de `marca_clientes`:
 *  - Normaliza el campo `rut` al formato canónico `<body>-<dv>` (sin puntos).
 *  - Descarta filas con RUT estructuralmente inválido o con dígito verificador
 *    incorrecto: las imprime para revisión manual y NO las toca.
 *  - Detecta duplicados (mismo RUT canónico): elige como ganador la fila con
 *    `created_at` más reciente, mueve los ingresos del/los perdedor/es al
 *    ganador (manteniendo snapshot rut/cliente actualizado), y elimina las
 *    filas perdedoras.
 *
 * Idempotente — si ya está canónico no hace nada. Corré:
 *
 *   npx dotenv -e .env.local -- tsx db/scripts/normalize-marca-clientes.ts
 *
 * o usá el alias `npm run db:normalize-marcas`.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { marcaClientes, marcaIngresos } from "../schema";
import { isValidRut, normalizeRut } from "../../lib/utils/rut";

type ClienteRow = typeof marcaClientes.$inferSelect;

async function main() {
  const rows = await db.select().from(marcaClientes);
  console.log(`→ ${rows.length} clientes en marca_clientes`);

  const byCanon = new Map<string, ClienteRow[]>();
  const invalid: ClienteRow[] = [];

  for (const r of rows) {
    const norm = normalizeRut(r.rut);
    if (!norm || !isValidRut(norm)) {
      invalid.push(r);
      continue;
    }
    const list = byCanon.get(norm) ?? [];
    list.push(r);
    byCanon.set(norm, list);
  }

  if (invalid.length > 0) {
    console.warn(
      `⚠️  ${invalid.length} cliente(s) con RUT inválido — revisar a mano (no se tocan):`,
    );
    for (const r of invalid) {
      console.warn(`     ${r.id}  rut="${r.rut}"  nombre="${r.nombre}"`);
    }
  }

  let normalized = 0;
  let merged = 0;
  let deleted = 0;

  for (const [canon, group] of byCanon) {
    if (group.length === 1) {
      const r = group[0];
      if (r.rut === canon) {
        console.log(`=  ${canon} (${r.nombre}) ya canónico`);
        continue;
      }
      console.log(`→  ${r.rut}  ⟶  ${canon}  (${r.nombre})`);
      await db.transaction(async (tx) => {
        await tx
          .update(marcaIngresos)
          .set({ rutCliente: canon })
          .where(eq(marcaIngresos.clienteId, r.id));
        await tx
          .update(marcaClientes)
          .set({ rut: canon, updatedAt: new Date() })
          .where(eq(marcaClientes.id, r.id));
      });
      normalized++;
      continue;
    }

    // group.length > 1 → mergear
    const sorted = [...group].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const winner = sorted[0];
    const losers = sorted.slice(1);

    console.log(
      `⤵︎  ${group.length} duplicados de ${canon}: gana "${winner.nombre}" (${winner.id})`,
    );
    for (const l of losers) {
      console.log(`       ↳ descarta "${l.nombre}" (${l.id})`);
    }

    await db.transaction(async (tx) => {
      const loserIds = losers.map((l) => l.id);
      // Reasignar ingresos de los perdedores al ganador con snapshot actualizado
      await tx
        .update(marcaIngresos)
        .set({
          clienteId: winner.id,
          rutCliente: canon,
          cliente: winner.nombre,
          updatedAt: new Date(),
        })
        .where(inArray(marcaIngresos.clienteId, loserIds));
      // Refrescar snapshot de los ingresos ya asociados al ganador
      await tx
        .update(marcaIngresos)
        .set({
          rutCliente: canon,
          cliente: winner.nombre,
          updatedAt: new Date(),
        })
        .where(eq(marcaIngresos.clienteId, winner.id));
      // Borrar perdedores
      await tx
        .delete(marcaClientes)
        .where(inArray(marcaClientes.id, loserIds));
      // Normalizar rut del ganador si difería
      if (winner.rut !== canon) {
        await tx
          .update(marcaClientes)
          .set({ rut: canon, updatedAt: new Date() })
          .where(eq(marcaClientes.id, winner.id));
      }
    });
    merged++;
    deleted += losers.length;
  }

  console.log("");
  console.log(`Resumen:`);
  console.log(`  ${normalized} fila(s) normalizadas`);
  console.log(`  ${merged} grupo(s) mergeados (${deleted} duplicado(s) eliminado(s))`);
  console.log(`  ${invalid.length} fila(s) con RUT inválido ignoradas`);
  console.log(`Done.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("normalize-marca-clientes failed:", err);
    process.exit(1);
  });
