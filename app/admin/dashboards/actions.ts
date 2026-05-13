"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { requireSuperadmin } from "@/lib/access";

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 240;

export interface DashboardEditPayload {
  updates: { key: string; title: string; description: string }[];
  order: string[];
}

export async function saveDashboardEditsAction(
  payload: DashboardEditPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperadmin();

  const { updates, order } = payload;

  if (!Array.isArray(updates) || !Array.isArray(order)) {
    return { ok: false, error: "Payload inválido" };
  }

  const existing = await db
    .select({ key: dashboards.key })
    .from(dashboards)
    .where(
      inArray(dashboards.key, [
        ...new Set([...updates.map((u) => u.key), ...order]),
      ]),
    );
  const knownKeys = new Set(existing.map((r) => r.key));

  for (const u of updates) {
    if (!knownKeys.has(u.key)) {
      return { ok: false, error: `Dashboard desconocido: ${u.key}` };
    }
    const title = (u.title ?? "").trim();
    const description = (u.description ?? "").trim();
    if (title.length === 0 || title.length > TITLE_MAX) {
      return {
        ok: false,
        error: `Título inválido (1-${TITLE_MAX} caracteres)`,
      };
    }
    if (description.length > DESCRIPTION_MAX) {
      return {
        ok: false,
        error: `Descripción demasiado larga (máx ${DESCRIPTION_MAX})`,
      };
    }
  }

  for (const k of order) {
    if (!knownKeys.has(k)) {
      return { ok: false, error: `Dashboard desconocido en orden: ${k}` };
    }
  }

  await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx
        .update(dashboards)
        .set({
          title: u.title.trim(),
          description: u.description.trim(),
        })
        .where(eq(dashboards.key, u.key));
    }
    // sortOrder = índice * 10 para dejar huecos por si en el futuro se inserta
    // algo entremedio sin reordenar todo.
    for (let i = 0; i < order.length; i++) {
      await tx
        .update(dashboards)
        .set({ sortOrder: (i + 1) * 10 })
        .where(eq(dashboards.key, order[i]));
    }
  });

  revalidatePath("/");
  return { ok: true };
}
