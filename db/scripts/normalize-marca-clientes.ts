/**
 * Limpieza de RUTs en `marca_facturadores`:
 *  - Normaliza el campo `rut` al formato canónico `<body>-<dv>` (sin puntos).
 *  - Descarta filas con RUT estructuralmente inválido o con dígito verificador
 *    incorrecto: las imprime para revisión manual y NO las toca.
 *  - Detecta facturadores duplicados (mismo RUT canónico): elige como ganador
 *    al más reciente, redirige las marcas (marca_clientes.facturador_id) y los
 *    snapshots de marca_ingresos.rut_cliente al ganador, y borra los perdedores.
 *
 * Idempotente — si ya está canónico no hace nada. Corré:
 *
 *   npx dotenv -e .env.local -- tsx db/scripts/normalize-marca-clientes.ts
 *
 * o usá el alias `npm run db:normalize-marcas`.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import { marcaClientes, marcaFacturadores, marcaIngresos } from "../schema";
import { isValidRut, normalizeRut } from "../../lib/utils/rut";

type FacturadorRow = typeof marcaFacturadores.$inferSelect;

async function main() {
  const rows = await db.select().from(marcaFacturadores);
  console.log(`→ ${rows.length} facturadores en marca_facturadores`);

  const byCanon = new Map<string, FacturadorRow[]>();
  const invalid: FacturadorRow[] = [];

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
      `⚠️  ${invalid.length} facturador(es) con RUT inválido — revisar a mano (no se tocan):`,
    );
    for (const r of invalid) {
      console.warn(
        `     ${r.id}  rut="${r.rut}"  razon_social="${r.razonSocial}"`,
      );
    }
  }

  let normalized = 0;
  let merged = 0;
  let deleted = 0;

  for (const [canon, group] of byCanon) {
    if (group.length === 1) {
      const r = group[0];
      if (r.rut === canon) {
        console.log(`=  ${canon} (${r.razonSocial}) ya canónico`);
        continue;
      }
      console.log(`→  ${r.rut}  ⟶  ${canon}  (${r.razonSocial})`);
      await db.transaction(async (tx) => {
        // Actualizar snapshot rut_cliente en marca_ingresos (vía join por marca).
        const marcas = await tx
          .select({ id: marcaClientes.id })
          .from(marcaClientes)
          .where(eq(marcaClientes.facturadorId, r.id));
        const marcaIds = marcas.map((m) => m.id);
        if (marcaIds.length > 0) {
          await tx
            .update(marcaIngresos)
            .set({ rutCliente: canon, updatedAt: new Date() })
            .where(inArray(marcaIngresos.clienteId, marcaIds));
        }
        await tx
          .update(marcaFacturadores)
          .set({ rut: canon, updatedAt: new Date() })
          .where(eq(marcaFacturadores.id, r.id));
      });
      normalized++;
      continue;
    }

    // group.length > 1 → mergear duplicados (mismo RUT canónico, distinta forma).
    const sorted = [...group].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const winner = sorted[0];
    const losers = sorted.slice(1);

    console.log(
      `⤵︎  ${group.length} duplicados de ${canon}: gana "${winner.razonSocial}" (${winner.id})`,
    );
    for (const l of losers) {
      console.log(`       ↳ descarta "${l.razonSocial}" (${l.id})`);
    }

    await db.transaction(async (tx) => {
      const loserIds = losers.map((l) => l.id);
      // 1. Reasignar marca_clientes.facturador_id de los perdedores al ganador.
      await tx
        .update(marcaClientes)
        .set({ facturadorId: winner.id, updatedAt: new Date() })
        .where(inArray(marcaClientes.facturadorId, loserIds));
      // 2. Refrescar snapshot rut_cliente en TODAS las marcas que apuntan al ganador.
      const marcasWinner = await tx
        .select({ id: marcaClientes.id })
        .from(marcaClientes)
        .where(eq(marcaClientes.facturadorId, winner.id));
      const marcaIds = marcasWinner.map((m) => m.id);
      if (marcaIds.length > 0) {
        await tx
          .update(marcaIngresos)
          .set({ rutCliente: canon, updatedAt: new Date() })
          .where(inArray(marcaIngresos.clienteId, marcaIds));
      }
      // 3. Borrar facturadores perdedores.
      await tx
        .delete(marcaFacturadores)
        .where(inArray(marcaFacturadores.id, loserIds));
      // 4. Normalizar rut del ganador si difería.
      if (winner.rut !== canon) {
        await tx
          .update(marcaFacturadores)
          .set({ rut: canon, updatedAt: new Date() })
          .where(eq(marcaFacturadores.id, winner.id));
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
