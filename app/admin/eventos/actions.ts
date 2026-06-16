"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  addColumn,
  appendRow,
  saveCells,
  type CellEdit,
  type SheetTarget,
} from "@/lib/eventos-sheet-service";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface ActorCtx {
  email: string;
  userId: string | null;
}

/**
 * Gate por ROL dentro de cada action (defensa en profundidad: las server actions
 * son POSTs invocables aunque el middleware proteja la navegación). Lanza Error
 * en vez de redirect() para devolver un ActionResult limpio.
 */
async function requireEventosAccess(): Promise<ActorCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  if ((session?.user?.role ?? "user") !== "superadmin") {
    throw new Error("Solo un superadmin puede editar la hoja de estandarización");
  }
  return { email, userId: session?.user?.userId ?? null };
}

function parseTarget(t: unknown): SheetTarget {
  if (t === "eventos" || t === "venues") return t;
  throw new Error("Pestaña inválida");
}

function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
}

export async function saveCellsAction(
  target: string,
  edits: CellEdit[],
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (!Array.isArray(edits) || edits.length === 0) {
    return { ok: false, error: "No hay cambios para guardar" };
  }
  try {
    await saveCells(parseTarget(target), ctx.userId, ctx.email, edits);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function appendRowAction(
  target: string,
  values: string[],
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (!Array.isArray(values)) {
    return { ok: false, error: "Fila inválida" };
  }
  try {
    await appendRow(parseTarget(target), ctx.userId, ctx.email, values);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function appendColumnAction(
  target: string,
  name: string,
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "El nombre de la columna es obligatorio" };
  }
  try {
    await addColumn(parseTarget(target), ctx.userId, ctx.email, name);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
