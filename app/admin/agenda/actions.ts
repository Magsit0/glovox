"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { adminAgendaNotas } from "@/db/schema";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface ActorCtx {
  email: string;
  userId: string | null;
}

/**
 * Gate por ROL dentro de la action (defensa en profundidad: las server actions
 * son POSTs invocables aunque el middleware proteja la navegación). Lanza Error
 * en vez de redirect() para devolver un ActionResult limpio.
 */
async function requireAgendaAccess(): Promise<ActorCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  if ((session?.user?.role ?? "user") !== "superadmin") {
    throw new Error("Solo un superadmin puede editar la agenda");
  }
  return { email, userId: session?.user?.userId ?? null };
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LEN = 10_000;

/**
 * Upsert de la nota de un día. Tablero compartido: 1 fila por `fecha` (la PK),
 * last-write-wins. Deja rastro del último editor en `updatedBy`.
 */
export async function saveAgendaNotaAction(
  fecha: string,
  contenido: string,
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireAgendaAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  if (typeof fecha !== "string" || !FECHA_RE.test(fecha)) {
    return { ok: false, error: "Fecha inválida" };
  }
  if (typeof contenido !== "string") {
    return { ok: false, error: "Contenido inválido" };
  }
  const texto = contenido.slice(0, MAX_LEN);
  try {
    await db
      .insert(adminAgendaNotas)
      .values({
        fecha,
        contenido: texto,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: adminAgendaNotas.fecha,
        set: { contenido: texto, updatedBy: ctx.userId, updatedAt: new Date() },
      });
    revalidatePath("/admin/agenda");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al guardar" };
  }
}
