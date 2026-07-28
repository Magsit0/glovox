"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { adminAgendaNotas, type AgendaItem } from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface ActorCtx {
  email: string;
  userId: string | null;
}

/**
 * Gate por ROL dentro de la action (defensa en profundidad: las server actions
 * son POSTs invocables aunque el proxy proteja la navegación). Lanza Error
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
const MAX_ITEMS = 200;
const MAX_TEXTO = 2000;

/**
 * Saneo defensivo de la lista (viene del cliente, invocable por POST directo):
 * fuerza el shape {id, texto}, recorta largos, descarta ids duplicados y
 * preserva el ORDEN recibido (= prioridad).
 */
function sanitizeItems(raw: unknown): AgendaItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: AgendaItem[] = [];
  const vistos = new Set<string>();
  for (const it of raw.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== "object") return null;
    const id = (it as { id?: unknown }).id;
    const texto = (it as { texto?: unknown }).texto;
    if (typeof id !== "string" || !id) return null;
    if (typeof texto !== "string") return null;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const clean: AgendaItem = { id, texto: texto.slice(0, MAX_TEXTO) };
    if ((it as { done?: unknown }).done === true) clean.done = true;
    out.push(clean);
  }
  return out;
}

/**
 * Reemplaza la lista completa de ítems de un día (tablero compartido: 1 fila por
 * `fecha`, last-write-wins). El orden del array persiste tal cual.
 */
export async function saveAgendaItemsAction(
  fecha: string,
  items: AgendaItem[],
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
  const clean = sanitizeItems(items);
  if (clean === null) {
    return { ok: false, error: "Lista de tareas inválida" };
  }
  try {
    await withNeonRetry(() =>
      db
        .insert(adminAgendaNotas)
        .values({
          fecha,
          items: clean,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: adminAgendaNotas.fecha,
          set: { items: clean, updatedBy: ctx.userId, updatedAt: new Date() },
        }),
    );
    revalidatePath("/admin/agenda");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al guardar" };
  }
}
