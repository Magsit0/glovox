/**
 * Service layer del constructor de planes de pricing (MVP, modelo documento).
 *
 * Un plan = una fila en `ticketing_planes` con cabecera (nombre, país, fecha) +
 * el documento completo en `doc` (jsonb, shape PlanDoc). Sin tabla de filas,
 * sin transacciones, sin máquina de estados: cada guardado es un solo UPDATE.
 * Con el driver serverless de Neon esto ya no sufre CONNECTION_CLOSED; igual
 * envolvemos en withNeonRetry como defensa barata.
 *
 * Las server actions (app/ticketing/actions.ts) validan permisos y sanitizan;
 * acá vive la lógica de negocio + el audit.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, ticketingPlanes, type Country } from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";
import { coerceDoc, emptyDoc, type PlanDoc } from "@/lib/ticketing-pricing/config";

async function logAudit(
  actorId: string | null,
  action: string,
  targetId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({ actorId, action, targetUserId: targetId, payload });
}

export type PlanHeader = {
  nombre: string;
  country: Country;
  fechaEvento: string | null;
};

/** Crea un plan nuevo (documento inicial: tipos por defecto, sin etapas). */
export async function createPlan(
  actorId: string | null,
  header: PlanHeader,
): Promise<{ id: string }> {
  return withNeonRetry(async () => {
    const [row] = await db
      .insert(ticketingPlanes)
      .values({
        nombre: header.nombre,
        country: header.country,
        fechaEvento: header.fechaEvento,
        doc: emptyDoc(),
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: ticketingPlanes.id });
    await logAudit(actorId, "pricing.plan.create", row.id, { nombre: header.nombre });
    return { id: row.id };
  });
}

/** Guarda cabecera + documento completo de un plan (un solo UPDATE). */
export async function savePlan(
  actorId: string | null,
  planId: string,
  header: PlanHeader,
  doc: PlanDoc,
): Promise<void> {
  await withNeonRetry(() =>
    db
      .update(ticketingPlanes)
      .set({
        nombre: header.nombre,
        country: header.country,
        fechaEvento: header.fechaEvento,
        doc: coerceDoc(doc),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(ticketingPlanes.id, planId)),
  );
  await logAudit(actorId, "pricing.plan.save", planId, {});
}

/** Borra un plan. */
export async function deletePlan(actorId: string | null, planId: string): Promise<void> {
  await withNeonRetry(() => db.delete(ticketingPlanes).where(eq(ticketingPlanes.id, planId)));
  await logAudit(actorId, "pricing.plan.delete", planId, {});
}
