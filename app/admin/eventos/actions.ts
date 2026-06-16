"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import {
  addColumn,
  appendRow,
  saveCells,
  COLUMN_TYPES,
  type CellEdit,
  type ColumnType,
  type SheetTarget,
} from "@/lib/eventos-sheet-service";
import { runSync } from "@/lib/bigquery-sync";

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
  tipo: string = "STRING",
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
  const bqType = (COLUMN_TYPES as readonly string[]).includes(tipo)
    ? (tipo as ColumnType)
    : "STRING";
  try {
    await addColumn(parseTarget(target), ctx.userId, ctx.email, name, bqType);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Sincroniza el Sheet → BigQuery corriendo el CREATE OR REPLACE de
 * glovox.categoriaEvento. A demanda (botón en /admin/eventos), con el SA escritor
 * (`bqaccess@`) aislado en lib/bigquery-sync.ts.
 */
export async function syncBigQueryAction(
  target: string,
): Promise<ActionResult<{ rows: number }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  let t: SheetTarget;
  try {
    t = parseTarget(target);
  } catch (err) {
    return fail(err);
  }
  try {
    const res = await runSync(t);
    // Auditoría best-effort: no debe tumbar el resultado del sync.
    try {
      await db.insert(auditLog).values({
        actorId: ctx.userId,
        action: `${t}.sync_bq`,
        payload: { email: ctx.email, rows: res.rows },
      });
    } catch {
      /* noop */
    }
    return { ok: true, data: res };
  } catch (err) {
    return fail(err);
  }
}
