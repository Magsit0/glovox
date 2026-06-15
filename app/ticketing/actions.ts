"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import type { Country } from "@/db/schema";
import {
  createPlan,
  deletePlan,
  savePlan,
  type PlanHeader,
} from "@/lib/ticketing-pricing-service";
import {
  createSponsor,
  deleteSponsor,
  renameSponsor,
  setSponsorActivo,
} from "@/lib/ticketing-sponsors-service";
import { coerceDoc, type PlanDoc } from "@/lib/ticketing-pricing/config";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface SessionCtx {
  email: string;
  userId: string | null;
  role: string;
}

/**
 * Editar planes de pricing: requiere acceso a /ticketing y rol superadmin.
 * El gate es por ROL (no por un prefijo /ticketing/pricing) porque
 * canAccessPath matchea por prefijo: cualquiera con /ticketing pasaría un
 * check de /ticketing/pricing. Un permiso granular para price-setters no
 * superadmin se puede añadir luego con una capability independiente.
 */
async function requireTicketingPricingAccess(): Promise<SessionCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  const permissions = session?.user?.permissions ?? [];
  if (!canAccessPath(permissions, "/ticketing")) {
    throw new Error("No autorizado para ticketing");
  }
  const role = session?.user?.role ?? "user";
  if (role !== "superadmin") {
    throw new Error("Solo un superadmin puede editar planes de pricing");
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

function sanitizeHeader(raw: Partial<PlanHeader>): PlanHeader | { error: string } {
  const nombre = trimOrNull(raw.nombre);
  if (!nombre) return { error: "El nombre del evento es obligatorio" };
  const fechaEvento = normalizeFecha(raw.fechaEvento);
  if (raw.fechaEvento && !fechaEvento) {
    return { error: `Fecha inválida: "${raw.fechaEvento}"` };
  }
  return { nombre, country: parseCountry(raw.country), fechaEvento };
}

// ---------- Actions ----------

export async function createPlanAction(
  input: Partial<PlanHeader>,
): Promise<ActionResult<{ id: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const header = sanitizeHeader(input);
  if ("error" in header) return { ok: false, error: header.error };
  try {
    const res = await createPlan(ctx.userId, header);
    revalidatePath("/ticketing");
    return { ok: true, data: res };
  } catch (err) {
    return fail(err);
  }
}

export async function savePlanAction(
  planId: string,
  header: Partial<PlanHeader>,
  doc: PlanDoc,
): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  if (!planId) return { ok: false, error: "ID de plan requerido" };
  const clean = sanitizeHeader(header);
  if ("error" in clean) return { ok: false, error: clean.error };
  try {
    await savePlan(ctx.userId, planId, clean, coerceDoc(doc));
    revalidatePath("/ticketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deletePlanAction(planId: string): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  if (!planId) return { ok: false, error: "ID de plan requerido" };
  try {
    await deletePlan(ctx.userId, planId);
    revalidatePath("/ticketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------- Catálogo de sponsors ----------

export async function createSponsorAction(
  country: unknown,
  nombre: string,
): Promise<ActionResult<{ id: string; nombre: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(nombre);
  if (!clean) return { ok: false, error: "El nombre del sponsor es obligatorio" };
  try {
    const res = await createSponsor(ctx.userId, parseCountry(country), clean);
    revalidatePath("/ticketing");
    return { ok: true, data: res };
  } catch (err) {
    return fail(err);
  }
}

export async function renameSponsorAction(
  id: string,
  nombre: string,
): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  if (!id) return { ok: false, error: "ID de sponsor requerido" };
  const clean = trimOrNull(nombre);
  if (!clean) return { ok: false, error: "El nombre del sponsor es obligatorio" };
  try {
    await renameSponsor(ctx.userId, id, clean);
    revalidatePath("/ticketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setSponsorActivoAction(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  if (!id) return { ok: false, error: "ID de sponsor requerido" };
  try {
    await setSponsorActivo(ctx.userId, id, activo);
    revalidatePath("/ticketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteSponsorAction(id: string): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  if (!id) return { ok: false, error: "ID de sponsor requerido" };
  try {
    await deleteSponsor(ctx.userId, id);
    revalidatePath("/ticketing");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
