import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rebateConfig } from "@/db/schema";
import { REBATE_PCT_DEFAULT, normalizeRebatePct } from "@/lib/constants/rebate";

/**
 * % de rebate del evento (puntos porcentuales, 55 = 55%). Si el evento no
 * tiene fila en `rebate_config` — o la tabla aún no existe / Neon no responde —
 * cae al default 55% para no romper el cierre de negocio (fail-soft: el rebate
 * es un derivado visual, no un dato crítico de carga).
 */
export async function getRebatePorcentaje(eventoId: string): Promise<number> {
  try {
    const rows = await db
      .select({ porcentaje: rebateConfig.porcentaje })
      .from(rebateConfig)
      .where(eq(rebateConfig.eventoId, eventoId))
      .limit(1);
    const pct = normalizeRebatePct(rows[0]?.porcentaje);
    return pct ?? REBATE_PCT_DEFAULT;
  } catch (err) {
    // Sin fila → default silencioso (arriba). Query fallida → default TAMBIÉN,
    // pero logueado: si el evento tenía un % configurado distinto, el reporte
    // estaría mostrando 55% por caída de Neon y hay que poder detectarlo.
    console.error("[rebate] fallo leyendo rebate_config, usando default", { eventoId }, err);
    return REBATE_PCT_DEFAULT;
  }
}

/**
 * Upsert del % de rebate de un evento (una fila por EventoID). `porcentaje`
 * ya viene validado/acotado por el server action.
 */
export async function upsertRebatePorcentaje(
  eventoId: string,
  porcentaje: number,
  userId: string | null,
): Promise<void> {
  await db
    .insert(rebateConfig)
    .values({ eventoId, porcentaje, createdBy: userId, updatedBy: userId })
    .onConflictDoUpdate({
      target: rebateConfig.eventoId,
      set: { porcentaje, updatedBy: userId, updatedAt: sql`now()` },
    });
}
