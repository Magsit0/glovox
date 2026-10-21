/**
 * Capacidades con LISTA ACOTADA de editores (tabla `data.editores_capacidad`,
 * una fila por capacidad × persona). Hoy existe una:
 *
 *   `metas-evento` → definir goalTickets y budgetPm de un evento desde el drill
 *   de /inversion-medios. Hasta 2 personas, más los superadmins, que siempre
 *   pueden y no ocupan cupo (puedeEjercer).
 *
 * Los editores se leen SIEMPRE de la base (al cargar la página y otra vez al
 * guardar), nunca del JWT: el token solo se refresca al iniciar sesión, y a
 * quien se saca de la lista tiene que dejar de poder editar al instante. Un
 * usuario revocado no cuenta como editor ni ocupa cupo.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, editoresCapacidad, users } from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";

export const CAPACIDADES = ["metas-evento"] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

/** Tope de editores por capacidad. Lo hace cumplir `setEditores`. */
export const MAX_EDITORES: Record<Capacidad, number> = { "metas-evento": 2 };

/** Rechazo esperado al asignar (tope, usuario inválido): su mensaje es para el admin. */
export class EditoresError extends Error {}

export function esCapacidad(v: unknown): v is Capacidad {
  return typeof v === "string" && (CAPACIDADES as readonly string[]).includes(v);
}

export type EditorAsignado = {
  userId: string;
  email: string;
  asignadoAt: Date;
};

/** Editores vigentes (no revocados) de la capacidad, por email. */
export async function getEditores(capacidad: Capacidad): Promise<EditorAsignado[]> {
  const rows = await withNeonRetry(() =>
    db
      .select({
        userId: editoresCapacidad.userId,
        email: users.email,
        asignadoAt: editoresCapacidad.asignadoAt,
      })
      .from(editoresCapacidad)
      .innerJoin(users, eq(users.id, editoresCapacidad.userId))
      .where(and(eq(editoresCapacidad.capacidad, capacidad), isNull(users.revokedAt))),
  );
  return rows.sort((a, b) => a.email.localeCompare(b.email, "es"));
}

/**
 * ¿`userId` puede ejercer HOY la capacidad? Un superadmin activo siempre puede
 * (sin ocupar cupo de la lista); el resto, si está en la lista. Rol y lista se
 * leen frescos de la base: el rol del JWT solo se refresca al iniciar sesión.
 */
export async function puedeEjercer(capacidad: Capacidad, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const [u] = await withNeonRetry(() =>
    db
      .select({ role: users.role, revokedAt: users.revokedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  );
  if (!u || u.revokedAt) return false;
  if (u.role === "superadmin") return true;
  return esEditor(capacidad, userId);
}

/** ¿`userId` está HOY en la lista de la capacidad? Lectura fresca de la base. */
export async function esEditor(capacidad: Capacidad, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const rows = await withNeonRetry(() =>
    db
      .select({ userId: editoresCapacidad.userId })
      .from(editoresCapacidad)
      .innerJoin(users, eq(users.id, editoresCapacidad.userId))
      .where(
        and(
          eq(editoresCapacidad.capacidad, capacidad),
          eq(editoresCapacidad.userId, userId),
          isNull(users.revokedAt),
        ),
      )
      .limit(1),
  );
  return rows.length > 0;
}

/**
 * Reemplaza la lista completa de editores (vacía = nadie). Valida el tope y que
 * cada persona exista y esté activa; los que siguen en la lista conservan su
 * fecha de asignación. Una sola transacción, así la lista nunca queda a medias,
 * serializada por capacidad con un advisory lock y con el tope verificado sobre
 * el estado FINAL de la tabla: dos guardados simultáneos no pueden sumar más de
 * MAX_EDITORES. El antes y el después quedan en audit_log.
 */
export async function setEditores(
  capacidad: Capacidad,
  userIdsRaw: string[],
  actorId: string | null,
): Promise<void> {
  const userIds = [...new Set(userIdsRaw.filter(Boolean))];
  const max = MAX_EDITORES[capacidad];
  if (userIds.length > max) {
    throw new EditoresError(`Puede haber como máximo ${max} editores`);
  }

  const activos =
    userIds.length === 0
      ? []
      : await withNeonRetry(() =>
          db
            .select({ id: users.id, email: users.email })
            .from(users)
            .where(and(inArray(users.id, userIds), isNull(users.revokedAt))),
        );
  if (activos.length !== userIds.length) {
    throw new EditoresError("Algún usuario elegido no existe o está revocado. Recarga la página.");
  }

  const antes = await getEditores(capacidad);

  await withNeonRetry(() =>
    db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`editores:${capacidad}`}))`);
      const actuales = await tx
        .select({ userId: editoresCapacidad.userId })
        .from(editoresCapacidad)
        .where(eq(editoresCapacidad.capacidad, capacidad));
      const salen = actuales.map((r) => r.userId).filter((id) => !userIds.includes(id));
      if (salen.length > 0) {
        await tx
          .delete(editoresCapacidad)
          .where(and(eq(editoresCapacidad.capacidad, capacidad), inArray(editoresCapacidad.userId, salen)));
      }
      if (userIds.length > 0) {
        await tx
          .insert(editoresCapacidad)
          .values(userIds.map((userId) => ({ capacidad, userId, asignadoPor: actorId })))
          .onConflictDoNothing();
      }
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(editoresCapacidad)
        .where(eq(editoresCapacidad.capacidad, capacidad));
      if (n > max) throw new EditoresError(`Puede haber como máximo ${max} editores`);
    }),
  );

  await withNeonRetry(() =>
    db.insert(auditLog).values({
      actorId,
      action: "editores_capacidad.set",
      payload: {
        capacidad,
        antes: antes.map((e) => e.email),
        despues: activos.map((u) => u.email).sort((a, b) => a.localeCompare(b, "es")),
      },
    }),
  );
}
