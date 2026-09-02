"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { normalizeRebatePct } from "@/lib/constants/rebate";
import { upsertRebatePorcentaje } from "@/lib/queries/rebate";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Actualiza el % de rebate (cargo por servicio → ingreso Glovox) de un evento.
 * Editable desde la card "Rebate" del cierre de negocio Y del one-pager: ambos
 * leen la misma fila de `rebate_config`, así que el % es uno solo por evento.
 *
 * No invalida el detailCache: el % se lee fresco en cada render de la página
 * (page.tsx → getRebatePorcentaje), así que basta el router.refresh() del editor.
 */
export async function upsertRebatePctAction(input: {
  eventoId: string;
  porcentaje: number;
}): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) return { ok: false, error: "No autorizado" };
  const permissions = session?.user?.permissions ?? [];
  if (
    !canAccessPath(permissions, "/cierre-negocio") &&
    !canAccessPath(permissions, "/onepager")
  ) {
    return { ok: false, error: "No autorizado para editar el rebate" };
  }

  const eventoId = (input.eventoId ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(eventoId)) {
    return { ok: false, error: "EventoID inválido" };
  }
  const pct = normalizeRebatePct(input.porcentaje);
  if (pct === null) {
    return { ok: false, error: "Porcentaje inválido (debe ser un número entre 0 y 100)" };
  }

  try {
    await upsertRebatePorcentaje(eventoId, pct, session?.user?.userId ?? null);
  } catch (err) {
    // No exponer el error del driver (trae el SQL y los parámetros): log
    // server-side y mensaje amigable al usuario.
    console.error("[rebate] error guardando rebate_config", { eventoId, pct }, err);
    return {
      ok: false,
      error: "No se pudo guardar el porcentaje. Intenta de nuevo más tarde.",
    };
  }

  revalidatePath("/cierre-negocio");
  revalidatePath("/onepager");
  return { ok: true };
}
