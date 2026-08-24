"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { db } from "@/db";
import {
  auditLog,
  cargosExtraPm,
  inversionMediosDiario,
  inversionMediosEtapas,
  PLATAFORMAS_MEDIOS,
  type EtapaCampana,
} from "@/db/schema";
import { METODOS_CARGO } from "@/lib/inversion-medios/cargos";
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
 * Gate por GRANT del dashboard dentro de cada action (defensa en profundidad:
 * las server actions son POSTs invocables directamente, sin pasar por el proxy
 * ni por page.tsx). Editar exige el MISMO permiso que ver: quien tiene el grant
 * de /inversion-medios puede escribir el plan — no hay perfil de edición
 * aparte. Lanza Error para devolver ActionResult.
 */
async function requireInversionMediosAccess(): Promise<ActorCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  if (!canAccessPath(session?.user?.permissions ?? [], "/inversion-medios")) {
    throw new Error("No tienes acceso a Control inversión PM");
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

// NOTA: el techo presupuestario NO se edita acá — es categoriaEvento.budgetPm
// (tabla madre), editable en la hoja de /admin/eventos. Este panel solo lo lee.

// ---------- Etapas de campaña ----------

const MAX_ETAPAS = 12;
const MAX_ETAPA_NOMBRE = 40;

/** Reemplaza la lista completa de etapas de campaña de un evento. */
export async function saveEtapasAction(input: {
  eventoId: string;
  etapas: { nombre: string; fechaInicio: string }[];
}): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const eventoId = String(input.eventoId ?? "").trim().toUpperCase();
  if (!EVENTO_RE.test(eventoId)) return { ok: false, error: "EventoID inválido" };
  if (!Array.isArray(input.etapas)) return { ok: false, error: "Etapas inválidas" };
  if (input.etapas.length > MAX_ETAPAS) {
    return { ok: false, error: `Máximo ${MAX_ETAPAS} etapas` };
  }

  // Sanear: nombre obligatorio (recortado); fecha "" o YYYY-MM-DD válida.
  const clean: EtapaCampana[] = [];
  for (const e of input.etapas) {
    const nombre = String(e?.nombre ?? "").trim().slice(0, MAX_ETAPA_NOMBRE);
    if (!nombre) continue; // descarta etapas sin nombre
    const fRaw = String(e?.fechaInicio ?? "").trim();
    const fechaInicio = fRaw === "" || FECHA_RE.test(fRaw) ? fRaw : "";
    clean.push({ nombre, fechaInicio });
  }

  const eventoError = await validarEvento(eventoId);
  if (eventoError) return { ok: false, error: eventoError };

  try {
    await withNeonRetry(() =>
      db
        .insert(inversionMediosEtapas)
        .values({ eventoId, etapas: clean, createdBy: ctx.userId, updatedBy: ctx.userId })
        .onConflictDoUpdate({
          target: inversionMediosEtapas.eventoId,
          set: { etapas: clean, updatedBy: ctx.userId, updatedAt: sql`now()` },
        }),
    );
    await logAudit(ctx.userId, "inversionMedios.saveEtapas", { eventoId, n: clean.length });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al guardar etapas" };
  }
}

// ---------- Cargos extra (CARDDA) ----------

const MAX_PROVEEDOR = 80;
const MAX_DETALLE = 300;
const MAX_DIAPAGO = 40;

/** Alta o edición de un cargo extra. Si viene `id`, edita; si no, crea. */
export async function upsertCargoAction(input: {
  id?: string;
  proveedor: string;
  detalle?: string;
  metodo: string;
  montoUsd: number;
  diaPago?: string;
}): Promise<ActionResult<{ id: string }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const proveedor = String(input.proveedor ?? "").trim().slice(0, MAX_PROVEEDOR);
  if (!proveedor) return { ok: false, error: "El proveedor es obligatorio" };
  const metodo = String(input.metodo ?? "").trim().toLowerCase();
  if (!(METODOS_CARGO as readonly string[]).includes(metodo)) {
    return { ok: false, error: "Método de pago inválido" };
  }
  const monto = sanitizeMonto(input.montoUsd);
  if (monto === null || monto <= 0) return { ok: false, error: "Monto inválido (USD > 0)" };
  const detalle = input.detalle ? String(input.detalle).trim().slice(0, MAX_DETALLE) || null : null;
  const diaPago = input.diaPago ? String(input.diaPago).trim().slice(0, MAX_DIAPAGO) || null : null;

  try {
    let id = input.id;
    if (id) {
      await withNeonRetry(() =>
        db
          .update(cargosExtraPm)
          .set({ proveedor, detalle, metodo, montoUsd: monto, diaPago, updatedBy: ctx.userId, updatedAt: sql`now()` })
          .where(eq(cargosExtraPm.id, id!)),
      );
    } else {
      const [row] = await withNeonRetry(() =>
        db
          .insert(cargosExtraPm)
          .values({ proveedor, detalle, metodo, montoUsd: monto, diaPago, createdBy: ctx.userId, updatedBy: ctx.userId })
          .returning({ id: cargosExtraPm.id }),
      );
      id = row.id;
    }
    await logAudit(ctx.userId, "inversionMedios.upsertCargo", { id, proveedor, metodo, montoUsd: monto });
    revalidatePath("/inversion-medios");
    return { ok: true, data: { id: id! } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al guardar el cargo" };
  }
}

/** Baja (soft-delete) de un cargo extra. */
export async function deleteCargoAction(input: { id: string }): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const id = String(input.id ?? "").trim();
  if (!id) return { ok: false, error: "Cargo inválido" };
  try {
    await withNeonRetry(() =>
      db
        .update(cargosExtraPm)
        .set({ activo: false, updatedBy: ctx.userId, updatedAt: sql`now()` })
        .where(eq(cargosExtraPm.id, id)),
    );
    await logAudit(ctx.userId, "inversionMedios.deleteCargo", { id });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al borrar el cargo" };
  }
}
