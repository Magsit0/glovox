/**
 * Service layer del catálogo de sponsors del constructor de pricing.
 *
 * El catálogo estandariza el NOMBRE de la marca (lo que elige el builder); el %
 * de descuento y el cupo viven en el `doc` de cada plan, no acá. Soft delete vía
 * `activo`. Único por (país, nombre) — el alta es case-insensitive y reactiva la
 * marca si existía inactiva, para no chocar contra el índice único.
 *
 * Las server actions (app/ticketing/actions.ts) validan permisos; acá vive la
 * lógica + el audit.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, ticketingSponsors, type Country } from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";

async function logAudit(
  actorId: string | null,
  action: string,
  targetId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({ actorId, action, targetUserId: targetId, payload });
}

/**
 * Crea (o reusa) una marca en el catálogo de un país. Si ya existe con el mismo
 * nombre (case-insensitive), la devuelve; si estaba inactiva, la reactiva.
 */
export async function createSponsor(
  actorId: string | null,
  country: Country,
  nombreRaw: string,
): Promise<{ id: string; nombre: string }> {
  const nombre = nombreRaw.trim();
  if (!nombre) throw new Error("El nombre del sponsor es obligatorio");
  return withNeonRetry(async () => {
    const [existing] = await db
      .select()
      .from(ticketingSponsors)
      .where(
        and(
          eq(ticketingSponsors.country, country),
          sql`lower(${ticketingSponsors.nombre}) = lower(${nombre})`,
        ),
      )
      .limit(1);
    if (existing) {
      if (!existing.activo) {
        await db
          .update(ticketingSponsors)
          .set({ activo: true, updatedBy: actorId, updatedAt: new Date() })
          .where(eq(ticketingSponsors.id, existing.id));
      }
      return { id: existing.id, nombre: existing.nombre };
    }
    const [row] = await db
      .insert(ticketingSponsors)
      .values({ nombre, country, createdBy: actorId, updatedBy: actorId })
      .returning({ id: ticketingSponsors.id, nombre: ticketingSponsors.nombre });
    await logAudit(actorId, "pricing.sponsor.create", row.id, { nombre, country });
    return row;
  });
}

/** Renombra una marca del catálogo. */
export async function renameSponsor(
  actorId: string | null,
  id: string,
  nombreRaw: string,
): Promise<void> {
  const nombre = nombreRaw.trim();
  if (!nombre) throw new Error("El nombre del sponsor es obligatorio");
  await withNeonRetry(() =>
    db
      .update(ticketingSponsors)
      .set({ nombre, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(ticketingSponsors.id, id)),
  );
  await logAudit(actorId, "pricing.sponsor.rename", id, { nombre });
}

/** Activa/desactiva una marca (soft delete). */
export async function setSponsorActivo(
  actorId: string | null,
  id: string,
  activo: boolean,
): Promise<void> {
  await withNeonRetry(() =>
    db
      .update(ticketingSponsors)
      .set({ activo, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(ticketingSponsors.id, id)),
  );
  await logAudit(actorId, "pricing.sponsor.activo", id, { activo });
}

/**
 * Elimina una marca del catálogo (hard delete). Los planes que la usaban
 * conservan el nombre denormalizado en su `doc`; solo desaparece de la lista
 * para elegir.
 */
export async function deleteSponsor(actorId: string | null, id: string): Promise<void> {
  await withNeonRetry(() => db.delete(ticketingSponsors).where(eq(ticketingSponsors.id, id)));
  await logAudit(actorId, "pricing.sponsor.delete", id, {});
}
