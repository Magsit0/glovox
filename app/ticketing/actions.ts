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
import { coerceDoc, fiscalForCountry, type PlanDoc } from "@/lib/ticketing-pricing/config";
import {
  buildOptimizerInput,
  optimizeRevenue,
  type OptimizerResult,
} from "@/lib/ticketing-pricing/optimizer";
import {
  getEventTimeseries,
  getEventCampaigns,
  getEventInfo,
  getPaceCurve,
  type EventTimeseriesPoint,
  type EventCampaignRow,
  type PacePoint,
} from "@/lib/queries/ticketing";
import {
  getComparableCandidates,
  getComparableEvents,
  getDemandAnchorsByStage,
  getPlan,
  type ComparableEvent,
} from "@/lib/queries/pricing";

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
  eventoId: string,
): Promise<ActionResult<{ id: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(eventoId);
  if (!clean) return { ok: false, error: "Elegí un evento de categoriaEvento" };
  try {
    // La info general nace del evento; el plan queda ligado al EventoID.
    const info = await getEventInfo(clean);
    if (!info) {
      return { ok: false, error: `El evento ${clean} no está cargado en glovox.categoriaEvento` };
    }
    const country: Country = info.country === "PE" ? "PE" : "CL";
    const res = await createPlan(
      ctx.userId,
      { nombre: info.nombre || clean, country, fechaEvento: info.fechaEvento || null },
      clean,
    );
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

export async function getEventTimeseriesAction(
  eventoId: string,
): Promise<ActionResult<EventTimeseriesPoint[]>> {
  try {
    await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(eventoId);
  if (!clean) return { ok: true, data: [] };
  try {
    return { ok: true, data: await getEventTimeseries(clean) };
  } catch (err) {
    return fail(err);
  }
}

export async function getForecastAction(
  eventoId: string,
  refEventoIds?: string[],
): Promise<ActionResult<{ marca: string; comparables: ComparableEvent[]; pace: PacePoint[] }>> {
  try {
    await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(eventoId);
  if (!clean) return { ok: true, data: { marca: "", comparables: [], pace: [] } };
  try {
    const comparables = await getComparableEvents(clean);
    // refs = los elegidos a mano, o todos los comparables automáticos.
    const refs = refEventoIds && refEventoIds.length ? refEventoIds : comparables.map((c) => c.eventoId);
    const pace = await getPaceCurve(refs);
    return { ok: true, data: { marca: comparables[0]?.marca ?? "", comparables, pace } };
  } catch (err) {
    return fail(err);
  }
}

/** Vista previa de los parámetros con que corre el modelo (lo que ve la UI). */
export type OptimizerPreview = {
  marca: string;
  magnitudTotal: number;
  magnitudFuente: "plan" | "comparables" | "capacidad";
  /** Candidatos de referencia (mismos marca+país); `usado` = entró al cálculo. */
  candidates: {
    eventoId: string;
    nombre: string;
    categoriaEvento: string;
    tickets: number;
    usado: boolean;
  }[];
  /** Parámetros por celda (tipo × etapa) que alimentan el modelo — editables. */
  celdas: {
    tipo: string;
    etapa: string;
    precio: number;
    demanda: number;
    sinHistorico: boolean;
  }[];
  /** Detalle por evento de TODOS los candidatos; el promedio (la referencia) lo
   *  calcula el panel según la selección, para actualizar el listado en vivo. */
  referencia: {
    filas: {
      bucket: string;
      etapaNorm: string;
      etapaOrden: number;
      porEvento: { eventoId: string; nombre: string; tickets: number; precio: number }[];
    }[];
  };
};

export type OptimizeResponse = { result: OptimizerResult; preview: OptimizerPreview };

export async function optimizeRevenueAction(
  planId: string,
  overrides?: {
    celdas?: { tipo: string; etapa: string; precio?: number; demanda?: number }[];
    refEventoIds?: string[];
  },
): Promise<ActionResult<OptimizeResponse>> {
  try {
    await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(planId);
  if (!clean) return { ok: false, error: "ID de plan requerido" };
  try {
    const plan = await getPlan(clean);
    if (!plan) return { ok: false, error: "El plan no existe" };
    const doc = coerceDoc(plan.doc);
    if (!doc.eventoId) return { ok: false, error: "El plan no está ligado a un evento" };

    const info = await getEventInfo(doc.eventoId);
    const capacidad = info?.capacidad ?? doc.venueCapacidad ?? null;
    const ivaPct = fiscalForCountry(info?.country === "PE" ? "PE" : "CL").ivaPct;

    // Candidatos de referencia + preselección por defecto = las 2 temporadas
    // (categorías) más recientes de la marca. El usuario las ajusta a mano.
    const { marca, candidates } = await getComparableCandidates(doc.eventoId);
    const cats = [...new Set(candidates.map((c) => c.categoriaEvento))].sort().reverse();
    const defaultCats = new Set(cats.slice(0, 2));
    const preselectedIds = candidates
      .filter((c) => defaultCats.has(c.categoriaEvento))
      .map((c) => c.eventoId);
    const refs = overrides?.refEventoIds ?? preselectedIds;
    const refSet = new Set(refs);

    // Detalle por evento de TODOS los candidatos (el panel recalcula el promedio
    // en vivo según la selección, sin volver al servidor). Los promedios sobre
    // los SELECCIONADOS son los que alimentan el modelo.
    const allIds = candidates.map((c) => c.eventoId);
    const detalleAnchors = allIds.length
      ? (await getDemandAnchorsByStage(doc.eventoId, { refEventoIds: allIds })).anchors
      : [];
    const anchorByKey = new Map<string, { p0: number; d0: number }>();
    for (const a of detalleAnchors) {
      const sel = a.porEvento.filter((p) => refSet.has(p.eventoId));
      if (!sel.length) continue;
      const conPrecio = sel.filter((p) => p.precio > 0);
      const p0 = conPrecio.length
        ? Math.round(conPrecio.reduce((s, p) => s + p.precio, 0) / conPrecio.length)
        : 0;
      if (p0 <= 0) continue;
      const d0 = Math.round(sel.reduce((s, p) => s + p.tickets, 0) / sel.length);
      anchorByKey.set(`${a.bucket}|${a.etapaNorm}`, { p0, d0 });
    }
    const magnitudSel = [...anchorByKey.values()].reduce((s, v) => s + v.d0, 0);

    // Overrides del usuario por celda (precio/demanda); si no, usa el histórico.
    const priceByCell = new Map<string, number>();
    const demandByCell = new Map<string, number>();
    for (const c of overrides?.celdas ?? []) {
      const key = `${c.tipo}|${c.etapa}`;
      if (c.precio != null) priceByCell.set(key, c.precio);
      if (c.demanda != null) demandByCell.set(key, c.demanda);
    }

    const input = buildOptimizerInput(doc, {
      anchorByKey,
      capacidadTotal: capacidad,
      ivaPct,
      priceByCell,
      demandByCell,
    });
    const result = optimizeRevenue(input);

    const preview: OptimizerPreview = {
      marca,
      magnitudTotal: magnitudSel,
      magnitudFuente: anchorByKey.size ? "comparables" : "capacidad",
      candidates: candidates.map((c) => ({
        eventoId: c.eventoId,
        nombre: c.nombre,
        categoriaEvento: c.categoriaEvento,
        tickets: c.tickets,
        usado: refSet.has(c.eventoId),
      })),
      celdas: input.cells.map((c) => ({
        tipo: c.tipo,
        etapa: c.etapa,
        precio: c.precio,
        demanda: c.demanda,
        sinHistorico: c.sinHistorico,
      })),
      referencia: {
        filas: detalleAnchors.map((a) => ({
          bucket: a.bucket,
          etapaNorm: a.etapaNorm,
          etapaOrden: a.etapaOrden,
          porEvento: a.porEvento,
        })),
      },
    };

    return { ok: true, data: { result, preview } };
  } catch (err) {
    return fail(err);
  }
}

export async function getEventCampaignsAction(
  eventoId: string,
): Promise<ActionResult<EventCampaignRow[]>> {
  try {
    await requireTicketingPricingAccess();
  } catch (err) {
    return fail(err);
  }
  const clean = trimOrNull(eventoId);
  if (!clean) return { ok: true, data: [] };
  try {
    return { ok: true, data: await getEventCampaigns(clean) };
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
