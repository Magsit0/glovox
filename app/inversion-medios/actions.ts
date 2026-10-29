"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { db } from "@/db";
import {
  auditLog,
  cargosExtraPm,
  iniciativasPm,
  iniciativasPmCampanas,
  iniciativasPmReglas,
  inversionMediosDiario,
  inversionMediosEtapas,
  PLATAFORMAS_MEDIOS,
  type EtapaCampana,
} from "@/db/schema";
import { METODOS_CARGO } from "@/lib/inversion-medios/cargos";
import { esDiaBloqueado, hoySantiago, MSG_DIA_BLOQUEADO } from "@/lib/inversion-medios/holgura";
import {
  esIniciativaId,
  INICIATIVA_RE,
  limpiarNombreIniciativa,
  NOMBRE_INICIATIVA_MAX,
  NOMBRE_INICIATIVA_MIN,
  siguienteIdIniciativa,
} from "@/lib/inversion-medios/iniciativas";
import { SIN_TIPO, TIPOS_PLAN } from "@/lib/inversion-medios/tipos";
import { withNeonRetry } from "@/lib/neon-retry";
import { getEventInfo } from "@/lib/queries/ticketing";
import { capturasDeIniciativa, reglaDeCampana } from "@/lib/queries/inversion-medios";
import { puedeEjercer } from "@/lib/editores-capacidad";
import { ConflictoHojaError } from "@/lib/eventos-sheet-service";
import { guardarMetaEvento, leerBaseMeta } from "@/lib/eventos-metas-service";
import { metasAbiertas } from "@/lib/inversion-medios/evento";
import { esCampoMeta, MAX_META, parseMeta, type BaseMeta, type CampoMeta } from "@/lib/inversion-medios/metas";

export type ActionResult<T = void> =
  | { ok: true; data?: T; warning?: string }
  | { ok: false; error: string };

interface ActorCtx {
  email: string;
  userId: string | null;
  /** Único perfil que puede corregir el plan de días pasados (ver esDiaBloqueado). */
  isSuperadmin: boolean;
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
  return {
    email,
    userId: session?.user?.userId ?? null,
    isSuperadmin: session?.user?.role === "superadmin",
  };
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
 * Tipo de campaña del plan: debe ser uno de los planificables de esa
 * plataforma (TIPOS_PLAN) o '' = "Sin tipo" (solo para editar/limpiar el plan
 * histórico sin tipo). null = inválido.
 */
function sanitizeTipo(v: unknown, plataforma: string): string | null {
  const t = String(v ?? "").trim();
  if (t === SIN_TIPO) return SIN_TIPO;
  return (TIPOS_PLAN[plataforma] ?? []).includes(t) ? t : null;
}

/**
 * Valida que el evento exista en glovox.categoriaEvento antes de escribir
 * (Neon no tiene FK contra BQ; sin este check una celda con typo crea un
 * evento fantasma que nunca cruza con el gasto real).
 */
async function validarEvento(eventoId: string): Promise<string | null> {
  if (!EVENTO_RE.test(eventoId)) return "EventoID inválido";
  // Las iniciativas (INI001…) comparten la tabla del plan con los eventos,
  // pero su catálogo vive en Neon, no en categoriaEvento.
  if (esIniciativaId(eventoId)) return validarIniciativa(eventoId);
  const info = await getEventInfo(eventoId);
  if (!info) return `El evento ${eventoId} no existe en categoriaEvento`;
  return null;
}

/** La iniciativa existe y está ACTIVA: una archivada no recibe plan ni campañas. */
async function validarIniciativa(iniciativaId: string): Promise<string | null> {
  if (!esIniciativaId(iniciativaId)) return "Iniciativa inválida";
  const rows = await withNeonRetry(() =>
    db
      .select({ activa: iniciativasPm.activa, nombre: iniciativasPm.nombre })
      .from(iniciativasPm)
      .where(eq(iniciativasPm.id, iniciativaId)),
  );
  if (rows.length === 0) return `La iniciativa ${iniciativaId} no existe`;
  if (!rows[0].activa) return `La iniciativa ${rows[0].nombre} está archivada: reactívala para editarla`;
  return null;
}

// ---------- Celdas del plan diario ----------

/** Upsert de una celda (evento, día, plataforma) del plan. Idempotente. */
export async function upsertCellAction(input: {
  eventoId: string;
  fecha: string;
  plataforma: string;
  /** Tipo de campaña ('' = "Sin tipo", el plan histórico). */
  tipo: string;
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
  const tipo = sanitizeTipo(input.tipo, plataforma);
  if (tipo === null) return { ok: false, error: "Tipo de campaña inválido" };
  const monto = sanitizeMonto(input.montoUsd);
  if (monto === null) return { ok: false, error: "Monto inválido (USD ≥ 0)" };
  const nota = sanitizeNota(input.nota);
  if (esDiaBloqueado(fecha, hoySantiago(), ctx.isSuperadmin)) return { ok: false, error: MSG_DIA_BLOQUEADO };

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
          tipo,
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
            inversionMediosDiario.tipo,
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
      tipo,
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
  /** Tipo de campaña ('' = "Sin tipo"). */
  tipo: string;
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
  // Una iniciativa archivada no se edita, ni para borrar: una pestaña abierta
  // desde antes de archivarla todavía muestra el editor.
  if (esIniciativaId(eventoId)) {
    const iniError = await validarIniciativa(eventoId);
    if (iniError) return { ok: false, error: iniError };
  }
  if (!FECHA_RE.test(fecha)) return { ok: false, error: "Fecha inválida" };
  if (!plataforma) return { ok: false, error: "Plataforma inválida" };
  const tipo = sanitizeTipo(input.tipo, plataforma);
  if (tipo === null) return { ok: false, error: "Tipo de campaña inválido" };
  if (esDiaBloqueado(fecha, hoySantiago(), ctx.isSuperadmin)) return { ok: false, error: MSG_DIA_BLOQUEADO };

  try {
    await withNeonRetry(() =>
      db
        .delete(inversionMediosDiario)
        .where(
          and(
            eq(inversionMediosDiario.eventoId, eventoId),
            eq(inversionMediosDiario.fecha, fecha),
            eq(inversionMediosDiario.plataforma, plataforma),
            eq(inversionMediosDiario.tipo, tipo),
          ),
        ),
    );
    await logAudit(ctx.userId, "inversionMedios.deleteCell", { eventoId, fecha, plataforma, tipo });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al borrar" };
  }
}

/**
 * Borra la fila (evento × plataforma × tipo) DE HOY EN ADELANTE. Antes había
 * que vaciar celda por celda (pedido del equipo, 2026-10-08: el plan de TikTok
 * "Sin tipo" de GLO203 eran 176 celdas). Solo toca esa clave de 3 columnas —
 * los otros tipos y plataformas del evento quedan intactos — y el audit guarda
 * las filas borradas completas para poder restaurarlas.
 *
 * Desde 2026-10-09 NUNCA borra días pasados, ni siquiera para superadmin: el
 * plan de un día que ya pasó es la vara del desvío, y borrar la fila entera
 * era la forma más rápida de perderla. Superadmin corrige un día pasado celda
 * por celda.
 */
export async function deleteRowAction(input: {
  eventoId: string;
  plataforma: string;
  /** Tipo de campaña ('' = "Sin tipo"). */
  tipo: string;
}): Promise<ActionResult<{ borradas: number }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const eventoId = String(input.eventoId ?? "").trim().toUpperCase();
  const plataforma = sanitizePlataforma(input.plataforma);
  if (!EVENTO_RE.test(eventoId)) return { ok: false, error: "EventoID inválido" };
  // Una iniciativa archivada no se edita, ni para borrar: una pestaña abierta
  // desde antes de archivarla todavía muestra el editor.
  if (esIniciativaId(eventoId)) {
    const iniError = await validarIniciativa(eventoId);
    if (iniError) return { ok: false, error: iniError };
  }
  if (!plataforma) return { ok: false, error: "Plataforma inválida" };
  const tipo = sanitizeTipo(input.tipo, plataforma);
  if (tipo === null) return { ok: false, error: "Tipo de campaña inválido" };
  const hoy = hoySantiago();

  try {
    const borradas = await withNeonRetry(() =>
      db
        .delete(inversionMediosDiario)
        .where(
          and(
            eq(inversionMediosDiario.eventoId, eventoId),
            eq(inversionMediosDiario.plataforma, plataforma),
            eq(inversionMediosDiario.tipo, tipo),
            gte(inversionMediosDiario.fecha, hoy),
          ),
        )
        .returning({
          fecha: inversionMediosDiario.fecha,
          montoUsd: inversionMediosDiario.montoUsd,
          nota: inversionMediosDiario.nota,
        }),
    );
    await logAudit(ctx.userId, "inversionMedios.deleteRow", {
      eventoId,
      plataforma,
      tipo,
      desde: hoy,
      borradas: borradas.length,
      totalUsd: borradas.reduce((a, r) => a + r.montoUsd, 0),
      filas: borradas,
    });
    revalidatePath("/inversion-medios");
    return { ok: true, data: { borradas: borradas.length } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al borrar la fila" };
  }
}

// ---------- Rellenar rango (por plataforma × TIPO) ----------

// Tope de días por llamada. La ventana de un drill ronda los 120 días; 200 da
// holgura sin dejar el endpoint abierto a payloads arbitrarios.
const MAX_BULK = 200;

/**
 * Escribe el MISMO monto diario en un rango de días de UNA (plataforma, tipo).
 *
 * Es la vuelta del "Rellenar rango" que se eliminó el 2026-08-24, con las
 * cuatro causas del accidente invertidas respecto del `bulkUpsertAction` viejo:
 * - SIN DELETE: puro `onConflictDoUpdate` sobre el único de 4 columnas — no
 *   puede tocar un tipo vecino ni un día fuera de las fechas recibidas, y las
 *   celdas existentes conservan su `nota` y su `created_by/At` (el viejo hacía
 *   delete-then-insert y perdía ambos).
 * - `tipo` SIEMPRE en la clave (el viejo era pre-migración 0029: hoy colapsaría
 *   el desglose entero a "Sin tipo"). "Sin tipo" se RECHAZA: el plan masivo va
 *   en un tipo concreto; '' existe solo para limpiar plan histórico a mano.
 * - El rango lo arma el cliente celda a celda y acá se re-valida fecha por
 *   fecha; no hay "ventana por defecto" que convierta un clic en un borrado.
 * - `soloVacios` se resuelve EN LA BASE (`onConflictDoNothing`), no leyendo y
 *   decidiendo en el cliente: sin carrera contra otra pestaña que edita.
 */
export async function bulkFillPlanAction(input: {
  eventoId: string;
  plataforma: string;
  /** Tipo de campaña planificable (TIPOS_PLAN). '' = "Sin tipo" se rechaza. */
  tipo: string;
  /** USD por día, el mismo para todas las fechas. */
  montoUsd: number;
  fechas: string[];
  /** true → no tocar las celdas que ya tienen plan (solo inserta en vacías). */
  soloVacios?: boolean;
}): Promise<ActionResult<{ escritas: number; omitidas: number }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const eventoId = String(input.eventoId ?? "").trim().toUpperCase();
  const plataforma = sanitizePlataforma(input.plataforma);
  if (!plataforma) return { ok: false, error: "Plataforma inválida" };
  const tipo = sanitizeTipo(input.tipo, plataforma);
  if (tipo === null) return { ok: false, error: "Tipo de campaña inválido" };
  if (tipo === SIN_TIPO) {
    return { ok: false, error: 'El relleno masivo va en un tipo de campaña concreto, no en "Sin tipo"' };
  }
  const monto = sanitizeMonto(input.montoUsd);
  if (monto === null) return { ok: false, error: "Monto inválido (USD ≥ 0)" };

  if (!Array.isArray(input.fechas) || input.fechas.length === 0) {
    return { ok: false, error: "Sin fechas para rellenar" };
  }
  // Dedup obligatorio: dos filas iguales en un mismo INSERT … ON CONFLICT
  // DO UPDATE son un error de Postgres, no un upsert doble.
  const fechas = Array.from(new Set(input.fechas.map((f) => String(f ?? "").trim()))).sort();
  for (const f of fechas) {
    if (!FECHA_RE.test(f)) return { ok: false, error: `Fecha inválida: "${f}"` };
  }
  if (fechas.length > MAX_BULK) {
    return { ok: false, error: `Máximo ${MAX_BULK} días por relleno` };
  }
  const hoy = hoySantiago();
  if (fechas.some((f) => esDiaBloqueado(f, hoy, ctx.isSuperadmin))) {
    return { ok: false, error: `El rango incluye días anteriores a hoy. ${MSG_DIA_BLOQUEADO}` };
  }

  const eventoError = await validarEvento(eventoId);
  if (eventoError) return { ok: false, error: eventoError };

  try {
    const values = fechas.map((fecha) => ({
      eventoId,
      fecha,
      plataforma,
      tipo,
      montoUsd: monto,
      // nota: no se manda — las celdas sobrescritas conservan la suya.
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    }));
    const target = [
      inversionMediosDiario.eventoId,
      inversionMediosDiario.fecha,
      inversionMediosDiario.plataforma,
      inversionMediosDiario.tipo,
    ];
    // Un solo INSERT multi-fila: atómico sin transacción explícita, y
    // `returning` cuenta lo realmente escrito (con DO NOTHING las filas que ya
    // existían no vuelven — esas son las "omitidas" del modo solo-vacíos).
    const escritas = await withNeonRetry(() =>
      input.soloVacios
        ? db.insert(inversionMediosDiario).values(values).onConflictDoNothing({ target }).returning({ fecha: inversionMediosDiario.fecha })
        : db
            .insert(inversionMediosDiario)
            .values(values)
            .onConflictDoUpdate({
              target,
              set: { montoUsd: monto, updatedBy: ctx.userId, updatedAt: sql`now()` },
            })
            .returning({ fecha: inversionMediosDiario.fecha }),
    );
    await logAudit(ctx.userId, "inversionMedios.bulkFill", {
      eventoId,
      plataforma,
      tipo,
      montoUsd: monto,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      dias: fechas.length,
      soloVacios: !!input.soloVacios,
      escritas: escritas.length,
    });
    revalidatePath("/inversion-medios");
    return { ok: true, data: { escritas: escritas.length, omitidas: fechas.length - escritas.length } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al rellenar el rango" };
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

// ---------- Iniciativas: asignar campañas (drag & drop) ----------

/** Asignación actual de una campaña (con el estado de su iniciativa), o null. */
async function asignacionActual(
  plataforma: string,
  campaignId: string,
): Promise<{ iniciativaId: string; nombre: string; activa: boolean } | null> {
  const rows = await withNeonRetry(() =>
    db
      .select({
        iniciativaId: iniciativasPmCampanas.iniciativaId,
        nombre: iniciativasPm.nombre,
        activa: iniciativasPm.activa,
      })
      .from(iniciativasPmCampanas)
      .innerJoin(iniciativasPm, eq(iniciativasPm.id, iniciativasPmCampanas.iniciativaId))
      .where(and(eq(iniciativasPmCampanas.plataforma, plataforma), eq(iniciativasPmCampanas.campaignId, campaignId))),
  );
  return rows[0] ?? null;
}
/** Las campañas de una archivada están congeladas: sacarlas reescribiría su historial. */
function msgOrigenArchivado(nombre: string): string {
  return `La iniciativa ${nombre} está archivada: reactívala para mover sus campañas`;
}

// Plataformas posibles del mart (no solo las planificables: una campaña sin
// evento puede venir de cualquiera). campaign_id es numérico en las tres; el
// fallback "nombre:…" lo arma getSinEventoCampanasDiario si faltara el id.
const PLATAFORMA_CAMPANA_RE = /^[a-z_()]{2,20}$/;
const CAMPAIGN_ID_RE = /^[\w:.\- ]{1,200}$/u;

/**
 * Asigna (o mueve) una campaña SIN evento a una iniciativa. Desde ese momento
 * todo su gasto sin evento cuenta para la iniciativa — incluido el anterior a
 * la asignación: la campaña ES de la iniciativa. Upsert por (plataforma,
 * campaign_id): arrastrarla a otra iniciativa la mueve.
 */
export async function asignarCampanaAction(input: {
  plataforma: string;
  campaignId: string;
  campaignName: string;
  iniciativaId: string;
}): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const plataforma = String(input.plataforma ?? "").trim();
  const campaignId = String(input.campaignId ?? "").trim();
  const campaignName = String(input.campaignName ?? "").trim().slice(0, 300) || null;
  const iniciativaId = String(input.iniciativaId ?? "").trim().toUpperCase();
  if (!PLATAFORMA_CAMPANA_RE.test(plataforma)) return { ok: false, error: "Plataforma inválida" };
  if (!CAMPAIGN_ID_RE.test(campaignId)) return { ok: false, error: "Campaña inválida" };
  const iniError = await validarIniciativa(iniciativaId);
  if (iniError) return { ok: false, error: iniError };

  try {
    const [actual, regla] = await Promise.all([
      asignacionActual(plataforma, campaignId),
      reglaDeCampana(plataforma, campaignId),
    ]);
    if (actual && !actual.activa) return { ok: false, error: msgOrigenArchivado(actual.nombre) };
    if (regla === iniciativaId) {
      // Vuelve a la iniciativa de su regla: basta borrar la asignación a mano
      // para que la regla la recupere (y siga capturándola como suya).
      await withNeonRetry(() =>
        db
          .delete(iniciativasPmCampanas)
          .where(
            and(
              eq(iniciativasPmCampanas.plataforma, plataforma),
              eq(iniciativasPmCampanas.campaignId, campaignId),
            ),
          ),
      );
    } else {
      await withNeonRetry(() =>
        db
          .insert(iniciativasPmCampanas)
          .values({ plataforma, campaignId, campaignName, iniciativaId, createdBy: ctx.userId })
          .onConflictDoUpdate({
            target: [iniciativasPmCampanas.plataforma, iniciativasPmCampanas.campaignId],
            set: { iniciativaId, campaignName, createdBy: ctx.userId, createdAt: sql`now()` },
          }),
      );
    }
    await logAudit(ctx.userId, "inversionMedios.asignarCampana", {
      plataforma,
      campaignId,
      campaignName,
      iniciativaId,
      // Origen real: la asignación a mano o, si no hay, la regla que la tenía.
      desde: actual?.iniciativaId ?? regla ?? null,
      ...(!actual && regla ? { desdeRegla: true } : {}),
      ...(regla === iniciativaId ? { vuelveARegla: true } : {}),
    });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al asignar" };
  }
}

/** Devuelve una campaña a "No atribuido" (borra su asignación). */
export async function desasignarCampanaAction(input: {
  plataforma: string;
  campaignId: string;
}): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const plataforma = String(input.plataforma ?? "").trim();
  const campaignId = String(input.campaignId ?? "").trim();
  if (!PLATAFORMA_CAMPANA_RE.test(plataforma)) return { ok: false, error: "Plataforma inválida" };
  if (!CAMPAIGN_ID_RE.test(campaignId)) return { ok: false, error: "Campaña inválida" };
  try {
    const [actual, regla] = await Promise.all([
      asignacionActual(plataforma, campaignId),
      reglaDeCampana(plataforma, campaignId),
    ]);
    if (actual && !actual.activa) return { ok: false, error: msgOrigenArchivado(actual.nombre) };
    // Una campaña que calza con una regla no puede quedar en "No atribuido": la
    // regla la recapturaría y el usuario la vería saltar sola. La UI no lo ofrece;
    // esto cubre una pestaña desactualizada (y la pone al día).
    if (regla) {
      revalidatePath("/inversion-medios");
      const ini = await withNeonRetry(() =>
        db.select({ nombre: iniciativasPm.nombre }).from(iniciativasPm).where(eq(iniciativasPm.id, regla)),
      );
      return {
        ok: false,
        error: `Esta campaña calza con la regla automática de «${ini[0]?.nombre ?? regla}»: no puede quedar en No atribuido. Muévela a otra iniciativa.`,
      };
    }
    await withNeonRetry(() =>
      db
        .delete(iniciativasPmCampanas)
        .where(
          and(
            eq(iniciativasPmCampanas.plataforma, plataforma),
            eq(iniciativasPmCampanas.campaignId, campaignId),
          ),
        ),
    );
    await logAudit(ctx.userId, "inversionMedios.desasignarCampana", {
      plataforma,
      campaignId,
      desde: actual?.iniciativaId ?? null,
    });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al quitar" };
  }
}

// ---------- Iniciativas: crear, renombrar, archivar ----------

const MSG_NOMBRE_INICIATIVA = `El nombre debe tener entre ${NOMBRE_INICIATIVA_MIN} y ${NOMBRE_INICIATIVA_MAX} caracteres`;

/** ¿El error es la violación del índice único de nombre (carrera entre pestañas)? */
function esNombreDuplicado(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } } | null;
  const c = e?.cause ?? e;
  return c?.code === "23505" && (c.constraint ?? "").includes("iniciativas_pm_nombre_uq");
}

/** ¿Otra iniciativa (activa o archivada) ya usa este nombre? Sin distinguir mayúsculas. */
async function nombreIniciativaTomado(nombre: string, exceptoId?: string): Promise<string | null> {
  const rows = await withNeonRetry(() =>
    db.select({ id: iniciativasPm.id, nombre: iniciativasPm.nombre, activa: iniciativasPm.activa }).from(iniciativasPm),
  );
  const otra = rows.find((r) => r.id !== exceptoId && r.nombre.toLowerCase() === nombre.toLowerCase());
  if (!otra) return null;
  return otra.activa
    ? `Ya existe una iniciativa llamada ${otra.nombre}`
    : `Ya existe una iniciativa archivada llamada ${otra.nombre}: reactívala en vez de crear otra`;
}

/**
 * Crea una iniciativa nueva (Club Glovox, Now Mag…): id correlativo `INI###`
 * (contando las archivadas, nunca se reusa uno) y al final del orden. Si otra
 * pestaña creó una en el mismo instante y tomó el id, reintenta con el siguiente.
 */
export async function crearIniciativaAction(input: { nombre: string }): Promise<ActionResult<{ id: string }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const nombre = limpiarNombreIniciativa(input.nombre);
  if (!nombre) return { ok: false, error: MSG_NOMBRE_INICIATIVA };
  try {
    const tomado = await nombreIniciativaTomado(nombre);
    if (tomado) return { ok: false, error: tomado };
    for (let intento = 0; intento < 3; intento++) {
      const existentes = await withNeonRetry(() =>
        db.select({ id: iniciativasPm.id, orden: iniciativasPm.orden }).from(iniciativasPm),
      );
      const id = siguienteIdIniciativa(existentes.map((e) => e.id));
      if (!INICIATIVA_RE.test(id)) return { ok: false, error: "Se acabaron los ids de iniciativa (INI999)" };
      const orden = existentes.reduce((m, e) => Math.max(m, e.orden), 0) + 1;
      const creada = await withNeonRetry(() =>
        db
          .insert(iniciativasPm)
          .values({ id, nombre, orden })
          .onConflictDoNothing({ target: iniciativasPm.id })
          .returning({ id: iniciativasPm.id }),
      );
      if (creada.length > 0) {
        await logAudit(ctx.userId, "inversionMedios.crearIniciativa", { id, nombre });
        revalidatePath("/inversion-medios");
        return { ok: true, data: { id } };
      }
    }
    return { ok: false, error: "No se pudo crear la iniciativa: intenta de nuevo" };
  } catch (err) {
    if (esNombreDuplicado(err)) return { ok: false, error: (await nombreIniciativaTomado(nombre)) ?? "Ese nombre ya está en uso" };
    return { ok: false, error: err instanceof Error ? err.message : "Error al crear la iniciativa" };
  }
}

/** Cambia el nombre de una iniciativa (activa o archivada). El id no cambia. */
export async function renombrarIniciativaAction(input: { id: string; nombre: string }): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const id = String(input.id ?? "").trim().toUpperCase();
  if (!esIniciativaId(id)) return { ok: false, error: "Iniciativa inválida" };
  const nombre = limpiarNombreIniciativa(input.nombre);
  if (!nombre) return { ok: false, error: MSG_NOMBRE_INICIATIVA };
  try {
    const tomado = await nombreIniciativaTomado(nombre, id);
    if (tomado) return { ok: false, error: tomado };
    const r = await withNeonRetry(() =>
      db.update(iniciativasPm).set({ nombre }).where(eq(iniciativasPm.id, id)).returning({ id: iniciativasPm.id }),
    );
    if (r.length === 0) return { ok: false, error: `La iniciativa ${id} no existe` };
    await logAudit(ctx.userId, "inversionMedios.renombrarIniciativa", { id, nombre });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    if (esNombreDuplicado(err)) return { ok: false, error: (await nombreIniciativaTomado(nombre, id)) ?? "Ese nombre ya está en uso" };
    return { ok: false, error: err instanceof Error ? err.message : "Error al renombrar" };
  }
}

/** Plan cargado desde HOY (Santiago) de una iniciativa: lo que seguiría sumando al presupuesto. */
async function planFuturo(id: string): Promise<{ usd: number; dias: number }> {
  const rows = await withNeonRetry(() =>
    db
      .select({
        usd: sql<string | null>`COALESCE(SUM(${inversionMediosDiario.montoUsd}), 0)::text`,
        dias: sql<string | null>`COUNT(DISTINCT ${inversionMediosDiario.fecha})::text`,
      })
      .from(inversionMediosDiario)
      .where(and(eq(inversionMediosDiario.eventoId, id), gte(inversionMediosDiario.fecha, hoySantiago()))),
  );
  return { usd: Number(rows[0]?.usd ?? 0), dias: Number(rows[0]?.dias ?? 0) };
}

/** Lectura previa al archivado: cuánto plan desde hoy se borraría (para la confirmación). */
export async function planFuturoIniciativaAction(input: { id: string }): Promise<ActionResult<{ usd: number; dias: number }>> {
  try {
    await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const id = String(input.id ?? "").trim().toUpperCase();
  if (!esIniciativaId(id)) return { ok: false, error: "Iniciativa inválida" };
  try {
    return { ok: true, data: await planFuturo(id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al leer el plan" };
  }
}

/**
 * Archiva (`activa: false`) o reactiva una iniciativa. Archivar conserva el
 * historial: el plan PASADO, sus campañas asignadas y su gasto siguen siendo
 * suyos (el gasto no vuelve a "No atribuido"); deja de recibir plan y campañas,
 * y su fila se ve solo cuando tiene datos en el tramo mirado.
 * El plan DESDE HOY sí se borra al archivar (misma transacción): un frente
 * cortado no puede seguir sumando al presupuesto del día y de la semana, y una
 * archivada no se edita. Por eso exige `borrarPlanFuturo: true` cuando lo hay
 * (el cliente lo confirma antes con planFuturoIniciativaAction).
 */
export async function archivarIniciativaAction(input: {
  id: string;
  archivar: boolean;
  borrarPlanFuturo?: boolean;
}): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }
  const id = String(input.id ?? "").trim().toUpperCase();
  if (!esIniciativaId(id)) return { ok: false, error: "Iniciativa inválida" };
  const archivar = input.archivar === true;
  try {
    const hoy = hoySantiago();
    if (archivar) {
      const futuro = await planFuturo(id);
      if (futuro.dias > 0 && input.borrarPlanFuturo !== true) {
        return {
          ok: false,
          error: `Tiene USD ${futuro.usd.toFixed(2)} de plan desde hoy: confirma que se borra para archivarla`,
        };
      }
    }
    // Reglas: al archivar se CONGELA lo que capturan hoy (pasa a asignación a
    // mano, así su historial no se mueve) y se apagan, para que una archivada no
    // siga recibiendo campañas nuevas. Lo de BigQuery va antes de la transacción.
    const congelar = archivar ? await capturasDeIniciativa(id) : [];
    const { existe, borradas } = await withNeonRetry(() =>
      db.transaction(async (tx) => {
        const r = await tx
          .update(iniciativasPm)
          .set({ activa: !archivar })
          .where(eq(iniciativasPm.id, id))
          .returning({ id: iniciativasPm.id });
        if (r.length === 0) return { existe: false, borradas: 0 };
        await tx
          .update(iniciativasPmReglas)
          .set({ activa: !archivar })
          .where(eq(iniciativasPmReglas.iniciativaId, id));
        if (!archivar) return { existe: true, borradas: 0 };
        if (congelar.length > 0) {
          await tx
            .insert(iniciativasPmCampanas)
            .values(
              congelar.map((c) => ({
                plataforma: c.plataforma,
                campaignId: c.campaignId,
                campaignName: c.campaignName.slice(0, 300) || null,
                iniciativaId: id,
                createdBy: ctx.userId,
              })),
            )
            .onConflictDoNothing();
        }
        const del = await tx
          .delete(inversionMediosDiario)
          .where(and(eq(inversionMediosDiario.eventoId, id), gte(inversionMediosDiario.fecha, hoy)))
          .returning({ id: inversionMediosDiario.id });
        return { existe: true, borradas: del.length };
      }),
    );
    if (!existe) return { ok: false, error: `La iniciativa ${id} no existe` };
    // Al reactivar, la regla vuelve a encenderse: las asignaciones que se
    // congelaron y que su regla captura vuelven a ser de la regla.
    let devueltas = 0;
    if (!archivar) {
      const porPlat = new Map<string, string[]>();
      for (const c of await capturasDeIniciativa(id)) {
        porPlat.set(c.plataforma, [...(porPlat.get(c.plataforma) ?? []), c.campaignId]);
      }
      for (const [plat, ids] of porPlat) {
        const del = await withNeonRetry(() =>
          db
            .delete(iniciativasPmCampanas)
            .where(
              and(
                eq(iniciativasPmCampanas.iniciativaId, id),
                eq(iniciativasPmCampanas.plataforma, plat),
                inArray(iniciativasPmCampanas.campaignId, ids),
              ),
            )
            .returning({ id: iniciativasPmCampanas.campaignId }),
        );
        devueltas += del.length;
      }
    }
    await logAudit(ctx.userId, archivar ? "inversionMedios.archivarIniciativa" : "inversionMedios.reactivarIniciativa", {
      id,
      ...(archivar ? { planFuturoBorrado: borradas, desde: hoy, campanasCongeladas: congelar.length } : {}),
      ...(!archivar && devueltas > 0 ? { campanasDevueltasARegla: devueltas } : {}),
    });
    revalidatePath("/inversion-medios");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al archivar" };
  }
}

// ---------- Metas del evento (goalTickets / budgetPm) ----------

// Respuesta única ante cualquier rechazo de permiso: quien no es editor no
// tiene controles en pantalla, así que no hay nada que explicarle.
const NO_GUARDADO = "No se pudo guardar";

/**
 * Puerta común de las dos actions de metas: grant del panel + editor (o superadmin) de
 * `metas-evento` (leído de la base AHORA, no del token) + evento válido y
 * abierto. La fecha sale de getEventInfo, la MISMA fuente con la que la page
 * decide si muestra el lápiz (Fecha del catálogo, o la de tickets si falta).
 */
async function puertaMetas(
  eventoIdRaw: unknown,
  campoRaw: unknown,
): Promise<{ ok: true; ctx: ActorCtx; eventoId: string; campo: CampoMeta } | { ok: false; error: string }> {
  let ctx: ActorCtx;
  try {
    ctx = await requireInversionMediosAccess();
    if (!(await puedeEjercer("metas-evento", ctx.userId))) return { ok: false, error: NO_GUARDADO };
  } catch {
    return { ok: false, error: NO_GUARDADO };
  }
  const eventoId = String(eventoIdRaw ?? "").toUpperCase();
  if (!EVENTO_RE.test(eventoId) || esIniciativaId(eventoId)) return { ok: false, error: "Evento inválido" };
  if (!esCampoMeta(campoRaw)) return { ok: false, error: "Campo inválido" };
  const info = await getEventInfo(eventoId);
  if (!info) return { ok: false, error: `El evento ${eventoId} no existe en categoriaEvento` };
  if (!metasAbiertas(info.fechaEvento, info.dias, hoySantiago())) {
    return { ok: false, error: "El evento ya terminó; su meta y su techo quedan cerrados" };
  }
  return { ok: true, ctx, eventoId, campo: campoRaw };
}

/** Valor actual de la hoja para el campo: la base del input al abrir el editor. */
export async function leerMetaEventoAction(input: {
  eventoId: string;
  campo: string;
}): Promise<ActionResult<{ base: BaseMeta }>> {
  try {
    const p = await puertaMetas(input?.eventoId, input?.campo);
    if (!p.ok) return p;
    const r = await leerBaseMeta(p.eventoId, p.campo);
    return r.ok ? { ok: true, data: { base: r.base } } : r;
  } catch (err) {
    console.error(`[inversion-medios] leerMetaEvento ${String(input?.eventoId)}`, err);
    return { ok: false, error: "No se pudo leer la planilla. Intenta de nuevo." };
  }
}

/**
 * Define la meta de tickets (personas) o el techo de inversión (USD) de un
 * evento. Escribe la celda de ese evento en la hoja CategoriaEvento y la fila de
 * glovox.categoriaEvento (lib/eventos-metas-service.ts). `esperado` es el valor
 * de la HOJA que el editor leyó al abrir el input: si cambió entremedio, no se
 * escribe.
 */
export async function saveMetaEventoAction(input: {
  eventoId: string;
  campo: string;
  esperado: BaseMeta;
  valor: string;
}): Promise<ActionResult> {
  const esperado = input?.esperado;
  const esperadoValido =
    esperado === null ||
    (typeof esperado === "number" && Number.isFinite(esperado)) ||
    (typeof esperado === "string" && esperado.length <= 500);
  if (!esperadoValido) return { ok: false, error: "Datos inválidos" };

  const nuevo = parseMeta(String(input?.valor ?? ""));
  if (nuevo === undefined) return { ok: false, error: "Escribe un número entero, sin decimales" };

  try {
    const p = await puertaMetas(input?.eventoId, input?.campo);
    if (!p.ok) return p;
    const { ctx, eventoId, campo } = p;
    if (nuevo !== null && nuevo > MAX_META[campo]) return { ok: false, error: "El valor es demasiado alto" };
    if (nuevo === esperado) return { ok: true };

    const { bqOk } = await guardarMetaEvento({
      eventoId,
      campo,
      esperado,
      nuevo,
      actorId: ctx.userId,
      email: ctx.email,
    });
    revalidatePath("/inversion-medios");
    return bqOk
      ? { ok: true }
      : {
          ok: true,
          warning: "Quedó guardado en la planilla; los dashboards lo mostrarán tras la próxima sincronización.",
        };
  } catch (err) {
    if (err instanceof ConflictoHojaError) return { ok: false, error: err.message };
    console.error(`[inversion-medios] saveMetaEvento ${String(input?.eventoId)}.${String(input?.campo)}`, err);
    return { ok: false, error: "No se pudo guardar en la planilla. Intenta de nuevo." };
  }
}
