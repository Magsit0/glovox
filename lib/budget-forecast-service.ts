/**
 * Service layer del constructor de presupuesto de evento (v1, modelo documento).
 *
 * Un presupuesto = una fila en `presupuestos_evento` con cabecera (nombre, país,
 * fecha) + el documento completo en `doc` (jsonb, shape PresupuestoDoc). Cada
 * guardado es un solo UPDATE, envuelto en withNeonRetry como defensa barata.
 * Las server actions (app/presupuesto/actions.ts) validan permisos y sanitizan;
 * acá vive la lógica de negocio + el audit. Gemelo de ticketing-pricing-service.ts.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, presupuestosEvento, type Country } from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";
import { coerceDoc, emptyDoc, type PresupuestoDoc } from "@/lib/budget-forecast/config";

async function logAudit(
  actorId: string | null,
  action: string,
  targetId: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({ actorId, action, targetUserId: targetId, payload });
}

export type PresupuestoHeader = {
  nombre: string;
  country: Country;
  fechaEvento: string | null;
};

/**
 * Crea un presupuesto nuevo ligado a un evento (EventoID de categoriaEvento).
 * El doc nace con `eventoId` fijado + los defaults ya sembrados por la action
 * (per-cápitas y % por categoría). Rechaza si ya existe uno para ese evento.
 */
export async function createPresupuesto(
  actorId: string | null,
  header: PresupuestoHeader,
  eventoId: string,
  seededDoc?: PresupuestoDoc,
): Promise<{ id: string }> {
  return withNeonRetry(async () => {
    const existing = await db
      .select({ id: presupuestosEvento.id })
      .from(presupuestosEvento)
      .where(sql`${presupuestosEvento.doc} ->> 'eventoId' = ${eventoId}`)
      .limit(1);
    if (existing[0]) throw new Error(`Ya existe un presupuesto para el evento ${eventoId}`);
    const doc = coerceDoc(seededDoc ? { ...seededDoc, eventoId } : { ...emptyDoc(), eventoId });
    const [row] = await db
      .insert(presupuestosEvento)
      .values({
        nombre: header.nombre,
        country: header.country,
        fechaEvento: header.fechaEvento,
        doc,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning({ id: presupuestosEvento.id });
    await logAudit(actorId, "presupuesto.create", row.id, { nombre: header.nombre, eventoId });
    return { id: row.id };
  });
}

/** Guarda cabecera + documento completo (un solo UPDATE). */
export async function savePresupuesto(
  actorId: string | null,
  id: string,
  header: PresupuestoHeader,
  doc: PresupuestoDoc,
): Promise<void> {
  await withNeonRetry(() =>
    db
      .update(presupuestosEvento)
      .set({
        nombre: header.nombre,
        country: header.country,
        fechaEvento: header.fechaEvento,
        doc: coerceDoc(doc),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(eq(presupuestosEvento.id, id)),
  );
  await logAudit(actorId, "presupuesto.save", id, {});
}

/** Borra un presupuesto. */
export async function deletePresupuesto(actorId: string | null, id: string): Promise<void> {
  await withNeonRetry(() => db.delete(presupuestosEvento).where(eq(presupuestosEvento.id, id)));
  await logAudit(actorId, "presupuesto.delete", id, {});
}
