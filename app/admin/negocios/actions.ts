"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { auditLog, negocioVariableEnvio } from "@/db/schema";
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
async function requireNegociosAccess(): Promise<ActorCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  if ((session?.user?.role ?? "user") !== "superadmin") {
    throw new Error("Solo un superadmin puede marcar negocios");
  }
  return { email, userId: session?.user?.userId ?? null };
}

// IDs de Unabase: numéricos, como string (mismo shape que NegocioRow.id).
const NEGOCIO_ID_RE = /^\d{1,12}$/;
// Mes del variable: "yyyy-mm".
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Marca o desmarca un negocio como "enviado como variable" (upsert, una fila
 * por negocio, last-write-wins). Al marcar, `periodo` ("yyyy-mm") registra el
 * mes del variable al que corresponde; al desmarcar se limpia. El historial de
 * toggles queda en audit_log.
 */
export async function toggleVariableEnviadoAction(
  negocioId: string,
  enviado: boolean,
  periodo?: string,
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireNegociosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  if (typeof negocioId !== "string" || !NEGOCIO_ID_RE.test(negocioId)) {
    return { ok: false, error: "ID de negocio inválido" };
  }
  if (typeof enviado !== "boolean") {
    return { ok: false, error: "Valor de envío inválido" };
  }
  if (enviado && (typeof periodo !== "string" || !PERIODO_RE.test(periodo))) {
    return { ok: false, error: "Mes del variable inválido (esperado yyyy-mm)" };
  }
  const periodoFinal = enviado ? (periodo as string) : null;
  try {
    await withNeonRetry(() =>
      db
        .insert(negocioVariableEnvio)
        .values({
          negocioId,
          enviado,
          periodo: periodoFinal,
          marcadoPor: ctx.userId,
          marcadoAt: new Date(),
        })
        .onConflictDoUpdate({
          target: negocioVariableEnvio.negocioId,
          set: { enviado, periodo: periodoFinal, marcadoPor: ctx.userId, marcadoAt: new Date() },
        }),
    );
    await withNeonRetry(() =>
      db.insert(auditLog).values({
        actorId: ctx.userId,
        action: "negocio_variable_toggle",
        payload: { negocioId, enviado, periodo: periodoFinal },
      }),
    );
    revalidatePath("/admin/negocios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al guardar" };
  }
}
