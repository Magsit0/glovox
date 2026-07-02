"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import type { Country } from "@/db/schema";
import {
  createPresupuesto,
  deletePresupuesto,
  savePresupuesto,
  type PresupuestoHeader,
} from "@/lib/budget-forecast-service";
import {
  coerceDoc,
  emptyDoc,
  type PresupuestoDoc,
} from "@/lib/budget-forecast/config";
import { getEventInfo } from "@/lib/queries/ticketing";
import { getComparableEvents } from "@/lib/queries/pricing";
import {
  getCostShareDefaults,
  getPerCapitaDefaults,
  type CostShareDefaults,
  type PerCapitaDefaults,
} from "@/lib/queries/presupuesto";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ForecastDefaults = {
  perCapita: PerCapitaDefaults;
  costShares: CostShareDefaults;
};

interface SessionCtx {
  email: string;
  userId: string | null;
  role: string;
}

/**
 * Editar presupuestos: requiere acceso a /presupuesto y rol superadmin. Gate por
 * ROL (no por prefijo granular) igual que el planificador de pricing.
 */
async function requirePresupuestoAccess(): Promise<SessionCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  const permissions = session?.user?.permissions ?? [];
  if (!canAccessPath(permissions, "/presupuesto")) {
    throw new Error("No autorizado para presupuesto");
  }
  const role = session?.user?.role ?? "user";
  if (role !== "superadmin") {
    throw new Error("Solo un superadmin puede editar presupuestos");
  }
  return { email, userId: session?.user?.userId ?? null, role };
}

function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function normalizeFecha(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseCountry(v: unknown): Country {
  return v === "PE" ? "PE" : "CL";
}

function sanitizeHeader(raw: Partial<PresupuestoHeader>): PresupuestoHeader | { error: string } {
  const nombre = trimOrNull(raw.nombre);
  if (!nombre) return { error: "El nombre del evento es obligatorio" };
  const fechaEvento = normalizeFecha(raw.fechaEvento);
  if (raw.fechaEvento && !fechaEvento) {
    return { error: `Fecha inválida: "${raw.fechaEvento}"` };
  }
  return { nombre, country: parseCountry(raw.country), fechaEvento };
}

/** Trae los defaults históricos (per-cápitas + % de costo) de un evento. */
async function fetchDefaults(eventoId: string): Promise<ForecastDefaults> {
  const comparables = await getComparableEvents(eventoId);
  const refEventoIds = comparables.map((c) => c.eventoId);
  const [perCapita, costShares] = await Promise.all([
    getPerCapitaDefaults(eventoId, { refEventoIds }),
    getCostShareDefaults({ refEventoIds }),
  ]);
  // getPerCapitaDefaults con refEventoIds no llama a getComparableEvents, así que
  // no llena eventosRef; lo completamos acá con los comparables ya calculados.
  return {
    perCapita: {
      ...perCapita,
      eventosRef: comparables.map((c) => ({ eventoId: c.eventoId, nombre: c.nombre })),
    },
    costShares,
  };
}

/** Arma el doc inicial sembrando los defaults históricos. */
function seedDoc(eventoId: string, defaults: ForecastDefaults): PresupuestoDoc {
  const base = emptyDoc();
  const { perCapita, costShares } = defaults;
  const pctByKey = new Map(costShares.buckets.map((b) => [b.key, b.pct]));
  return {
    ...base,
    eventoId,
    asistentes: perCapita.asistentes,
    ticketPerCapita: perCapita.ticketPerCapita,
    fbPerCapita: perCapita.fbPerCapita,
    // % por categoría: histórico si hay comparables; si no, el default.
    categorias: base.categorias.map((c) =>
      costShares.source === "comparables"
        ? { ...c, pct: pctByKey.get(c.key as never) ?? 0 }
        : c,
    ),
  };
}

// ---------- Actions ----------

export async function createPresupuestoAction(
  eventoId: string,
): Promise<ActionResult<{ id: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requirePresupuestoAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(eventoId);
  if (!clean) return { ok: false, error: "Elegí un evento de categoriaEvento" };
  try {
    const info = await getEventInfo(clean);
    if (!info) {
      return { ok: false, error: `El evento ${clean} no está cargado en glovox.categoriaEvento` };
    }
    const country: Country = info.country === "PE" ? "PE" : "CL";
    const defaults = await fetchDefaults(clean);
    const res = await createPresupuesto(
      ctx.userId,
      { nombre: info.nombre || clean, country, fechaEvento: info.fechaEvento || null },
      clean,
      seedDoc(clean, defaults),
    );
    revalidatePath("/presupuesto");
    return { ok: true, data: res };
  } catch (err) {
    return fail(err);
  }
}

export async function savePresupuestoAction(
  id: string,
  header: Partial<PresupuestoHeader>,
  doc: PresupuestoDoc,
): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requirePresupuestoAccess();
  } catch (err) {
    return fail(err);
  }
  if (!id) return { ok: false, error: "ID de presupuesto requerido" };
  const clean = sanitizeHeader(header);
  if ("error" in clean) return { ok: false, error: clean.error };
  try {
    await savePresupuesto(ctx.userId, id, clean, coerceDoc(doc));
    revalidatePath("/presupuesto");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deletePresupuestoAction(id: string): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requirePresupuestoAccess();
  } catch (err) {
    return fail(err);
  }
  if (!id) return { ok: false, error: "ID de presupuesto requerido" };
  try {
    await deletePresupuesto(ctx.userId, id);
    revalidatePath("/presupuesto");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/** Recalcula los defaults históricos de un evento (botón "usar histórico"). */
export async function getForecastDefaultsAction(
  eventoId: string,
): Promise<ActionResult<ForecastDefaults>> {
  try {
    await requirePresupuestoAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(eventoId);
  if (!clean) return { ok: false, error: "El presupuesto no está ligado a un evento" };
  try {
    return { ok: true, data: await fetchDefaults(clean) };
  } catch (err) {
    return fail(err);
  }
}
