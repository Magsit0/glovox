"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  auditLog,
  inversionMediosDiario,
  PLATAFORMAS_MEDIOS,
} from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";
import { getEventInfo } from "@/lib/queries/ticketing";

export type ActionResult<T = void> =
  | { ok: true; data?: T; warning?: string }
  | { ok: false; error: string };

interface ActorCtx {
  email: string;
  userId: string | null;
}

/**
 * Gate por ROL dentro de cada action (defensa en profundidad: las server
 * actions son POSTs invocables aunque el layout de /admin proteja la
 * navegación con requireSuperadmin). Lanza Error para devolver ActionResult.
 */
async function requireInversionMediosAccess(): Promise<ActorCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  if ((session?.user?.role ?? "user") !== "superadmin") {
    throw new Error("Solo un superadmin puede editar la inversión en medios");
  }
  return { email, userId: session?.user?.userId ?? null };
}

/**
 * Best-effort: el audit NUNCA convierte una escritura ya commiteada en error
 * hacia el cliente (se loguea y sigue).
 */
async function logAudit(
  actorId: string | null,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await withNeonRetry(() => db.insert(auditLog).values({ actorId, action, payload }));
  } catch (err) {
    console.error(`[inversion-medios] audit log falló (${action})`, err);
  }
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
// EventoID: GLO/GLP/GLX/GLB… + dígitos, O el ID numérico de 5-6 dígitos de los
// eventos Fever (ej. 660905 = Bajo Cero 2026) — ambos existen en categoriaEvento.
const EVENTO_RE = /^([A-Z]{2,4}\d{2,4}|\d{5,6})$/;
const MAX_NOTA = 500;
const MAX_BULK = 5000;

function sanitizeMonto(v: unknown): number | null {
  const num = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(num) || num < 0) return null;
  // 2 decimales — es plata (USD), no ciencia.
  return Math.round(num * 100) / 100;
}

function sanitizeNota(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return null;
  return v.slice(0, MAX_NOTA);
}

function sanitizePlataforma(v: unknown): string | null {
  const p = String(v ?? "").trim().toLowerCase();
  return (PLATAFORMAS_MEDIOS as readonly string[]).includes(p) ? p : null;
}

/**
 * Valida que el evento exista en glovox.categoriaEvento antes de escribir
 * (Neon no tiene FK contra BQ; sin este check una celda con typo crea un
 * evento fantasma que nunca cruza con el gasto real).
 */
async function validarEvento(eventoId: string): Promise<string | null> {
  if (!EVENTO_RE.test(eventoId)) return "EventoID inválido";
  const info = await getEventInfo(eventoId);
  if (!info) return `El evento ${eventoId} no existe en categoriaEvento`;
  return null;
}

// ---------- Celdas del plan diario ----------

/** Upsert de una celda (evento, día, plataforma) del plan. Idempotente. */
export async function upsertCellAction(input: {
  eventoId: string;
  fecha: string;
  plataforma: string;
  montoUsd: number;
  nota?: string;
}): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const eventoId = String(input.eventoId ?? "").trim().toUpperCase();
  const fecha = String(input.fecha ?? "").trim();
  const plataforma = sanitizePlataforma(input.plataforma);
  if (!FECHA_RE.test(fecha)) return { ok: false, error: "Fecha inválida" };
  if (!plataforma) return { ok: false, error: "Plataforma inválida" };
  const monto = sanitizeMonto(input.montoUsd);
  if (monto === null) return { ok: false, error: "Monto inválido (USD ≥ 0)" };
  const nota = sanitizeNota(input.nota);

  const eventoError = await validarEvento(eventoId);
  if (eventoError) return { ok: false, error: eventoError };

  try {
    await withNeonRetry(() =>
      db
        .insert(inversionMediosDiario)
        .values({
          eventoId,
          fecha,
          plataforma,
          montoUsd: monto,
          nota,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: [
            inversionMediosDiario.eventoId,
            inversionMediosDiario.fecha,
            inversionMediosDiario.plataforma,
          ],
          // Si el caller no manda nota, se preserva la existente (editar solo
          // el monto no debe borrar la nota de la celda).
          set: {
            montoUsd: monto,
            ...(input.nota !== undefined ? { nota } : {}),
            updatedBy: ctx.userId,
            updatedAt: sql`now()`,
          },
        }),
    );
    await logAudit(ctx.userId, "inversionMedios.upsertCell", {
      eventoId,
      fecha,
      plataforma,
      montoUsd: monto,
    });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al guardar" };
  }
}

/** Borra una celda del plan (deja esa plataforma-día "sin plan", no $0). */
export async function deleteCellAction(input: {
  eventoId: string;
  fecha: string;
  plataforma: string;
}): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const eventoId = String(input.eventoId ?? "").trim().toUpperCase();
  const fecha = String(input.fecha ?? "").trim();
  const plataforma = sanitizePlataforma(input.plataforma);
  if (!EVENTO_RE.test(eventoId)) return { ok: false, error: "EventoID inválido" };
  if (!FECHA_RE.test(fecha)) return { ok: false, error: "Fecha inválida" };
  if (!plataforma) return { ok: false, error: "Plataforma inválida" };

  try {
    await withNeonRetry(() =>
      db
        .delete(inversionMediosDiario)
        .where(
          and(
            eq(inversionMediosDiario.eventoId, eventoId),
            eq(inversionMediosDiario.fecha, fecha),
            eq(inversionMediosDiario.plataforma, plataforma),
          ),
        ),
    );
    await logAudit(ctx.userId, "inversionMedios.deleteCell", { eventoId, fecha, plataforma });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al borrar" };
  }
}

/**
 * Upsert masivo (pegar un rango, distribuir un monto por semana, o el import
 * one-time de la hoja). Transaccional: todas las celdas o ninguna. Idempotente
 * por el unique (evento_id, fecha) — re-pegar no duplica.
 */
export async function bulkUpsertAction(input: {
  rows: { eventoId: string; fecha: string; plataforma: string; montoUsd: number; nota?: string }[];
}): Promise<ActionResult<{ upserted: number }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, error: "Sin filas para cargar" };
  }
  if (input.rows.length > MAX_BULK) {
    return { ok: false, error: `Máximo ${MAX_BULK} celdas por carga` };
  }

  // Sanitizar todo ANTES de tocar la base.
  const clean: {
    eventoId: string;
    fecha: string;
    plataforma: string;
    montoUsd: number;
    nota: string | null;
  }[] = [];
  const seen = new Set<string>();
  for (const r of input.rows) {
    const eventoId = String(r.eventoId ?? "").trim().toUpperCase();
    const fecha = String(r.fecha ?? "").trim();
    const plataforma = sanitizePlataforma(r.plataforma);
    const monto = sanitizeMonto(r.montoUsd);
    if (!EVENTO_RE.test(eventoId)) return { ok: false, error: `EventoID inválido: "${r.eventoId}"` };
    if (!FECHA_RE.test(fecha)) return { ok: false, error: `Fecha inválida: "${r.fecha}" (${eventoId})` };
    if (!plataforma) return { ok: false, error: `Plataforma inválida: "${r.plataforma}" (${eventoId} ${fecha})` };
    if (monto === null) return { ok: false, error: `Monto inválido en ${eventoId} ${fecha} ${plataforma}` };
    const key = `${eventoId}|${fecha}|${plataforma}`;
    if (seen.has(key)) continue; // dedup defensivo dentro del batch
    seen.add(key);
    clean.push({ eventoId, fecha, plataforma, montoUsd: monto, nota: sanitizeNota(r.nota) });
  }

  // Validar cada evento UNA vez contra categoriaEvento.
  const eventoIds = Array.from(new Set(clean.map((r) => r.eventoId)));
  for (const id of eventoIds) {
    const eventoError = await validarEvento(id);
    if (eventoError) return { ok: false, error: eventoError };
  }

  try {
    await withNeonRetry(() =>
      db.transaction(async (tx) => {
        // delete-then-insert scopeado por (evento, plataforma): re-cargar Meta de
        // un rango reemplaza SOLO Meta, no toca Google/TikTok de esos días.
        const grupos = new Map<string, string[]>(); // "evento|plataforma" → fechas
        for (const r of clean) {
          const g = `${r.eventoId}|${r.plataforma}`;
          if (!grupos.has(g)) grupos.set(g, []);
          grupos.get(g)!.push(r.fecha);
        }
        for (const [g, fechas] of grupos) {
          const [id, plat] = g.split("|");
          await tx
            .delete(inversionMediosDiario)
            .where(
              and(
                eq(inversionMediosDiario.eventoId, id),
                eq(inversionMediosDiario.plataforma, plat),
                inArray(inversionMediosDiario.fecha, fechas),
              ),
            );
        }
        await tx.insert(inversionMediosDiario).values(
          clean.map((r) => ({
            ...r,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })),
        );
      }),
    );
    await logAudit(ctx.userId, "inversionMedios.bulkUpsert", {
      eventos: eventoIds,
      celdas: clean.length,
    });
    revalidatePath("/inversion-medios");
    return { ok: true, data: { upserted: clean.length } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error en la carga masiva" };
  }
}

// NOTA: el techo presupuestario NO se edita acá — es categoriaEvento.budgetPm
// (tabla madre), editable en la hoja de /admin/eventos. Este panel solo lo lee.
