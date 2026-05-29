"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { comprasInsumo, insumosCatalogo, proveedores } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";

export interface CompraInput {
  eventoId: string | null;
  insumo: string;
  numeroFactura: string | null;
  proveedor: string | null;
  fechaCompra: string | null; // ISO YYYY-MM-DD
  nPallets: number | null;
  nDisplay: number | null;
  xDisplay: number | null;
  sueltas: number | null;
  recibido: number | null;
  pedido: number | null;
  tipoOperacion: string;
  lugar: string | null;
  obs: string | null;
  costoUnitario: number | null;
  costoNeto: number | null;
  iva: number | null;
  bruto: number | null;
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface SessionCtx {
  email: string;
  userId: string | null;
}

async function requireFfbbAccess(): Promise<SessionCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  const permissions = session?.user?.permissions ?? [];
  if (!canAccessPath(permissions, "/ffbb")) {
    throw new Error("No autorizado para FF&BB");
  }
  return { email, userId: session?.user?.userId ?? null };
}

function trimOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.trunc(n);
}

function normalizeFecha(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  // Acepta YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Acepta DD-MM-YYYY o DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? "20" + yRaw : yRaw;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function sanitize(raw: Partial<CompraInput>): CompraInput | { error: string } {
  const insumo = trimOrNull(raw.insumo);
  if (!insumo) return { error: "El insumo es obligatorio" };

  const tipoOperacion = trimOrNull(raw.tipoOperacion) ?? "ingreso";
  const fechaCompra = normalizeFecha(raw.fechaCompra);
  if (raw.fechaCompra && !fechaCompra) {
    return { error: `Fecha inválida: "${raw.fechaCompra}"` };
  }

  return {
    eventoId: trimOrNull(raw.eventoId),
    insumo,
    numeroFactura: trimOrNull(raw.numeroFactura),
    proveedor: trimOrNull(raw.proveedor),
    fechaCompra,
    nPallets: intOrNull(raw.nPallets),
    nDisplay: intOrNull(raw.nDisplay),
    xDisplay: intOrNull(raw.xDisplay),
    sueltas: intOrNull(raw.sueltas),
    recibido: intOrNull(raw.recibido),
    pedido: intOrNull(raw.pedido),
    tipoOperacion,
    lugar: trimOrNull(raw.lugar),
    obs: trimOrNull(raw.obs),
    costoUnitario: numOrNull(raw.costoUnitario),
    costoNeto: numOrNull(raw.costoNeto),
    iva: numOrNull(raw.iva),
    bruto: numOrNull(raw.bruto),
  };
}

// -------------------------------------------------------------- create one

export async function createCompraAction(
  input: Partial<CompraInput>,
): Promise<ActionResult<{ id: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireFfbbAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const clean = sanitize(input);
  if ("error" in clean) return { ok: false, error: clean.error };

  try {
    const [row] = await db
      .insert(comprasInsumo)
      .values({
        ...clean,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning({ id: comprasInsumo.id });

    if (clean.eventoId) {
      revalidatePath(`/ffbb`);
    }
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear la compra",
    };
  }
}

// ------------------------------------------------------------ bulk create

export async function bulkCreateComprasAction(
  inputs: Partial<CompraInput>[],
): Promise<ActionResult<{ inserted: number }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireFfbbAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: "Sin filas para insertar" };
  }

  const cleaned: CompraInput[] = [];
  const errors: string[] = [];

  inputs.forEach((raw, i) => {
    const clean = sanitize(raw);
    if ("error" in clean) {
      errors.push(`Fila ${i + 1}: ${clean.error}`);
      return;
    }
    cleaned.push(clean);
  });

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Se encontraron ${errors.length} errores: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "…" : ""}`,
    };
  }

  try {
    await db.insert(comprasInsumo).values(
      cleaned.map((c) => ({
        ...c,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })),
    );
    revalidatePath(`/ffbb`);
    return { ok: true, data: { inserted: cleaned.length } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al insertar las compras",
    };
  }
}

// --------------------------------------------------------------- update

export async function updateCompraAction(
  id: string,
  input: Partial<CompraInput>,
): Promise<ActionResult> {
  let ctx: SessionCtx;
  try {
    ctx = await requireFfbbAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  if (!id) return { ok: false, error: "ID requerido" };

  const clean = sanitize(input);
  if ("error" in clean) return { ok: false, error: clean.error };

  try {
    await db
      .update(comprasInsumo)
      .set({
        ...clean,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(comprasInsumo.id, id));
    revalidatePath(`/ffbb`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar la compra",
    };
  }
}

// --------------------------------------------------------------- delete

export async function deleteCompraAction(id: string): Promise<ActionResult> {
  try {
    await requireFfbbAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  if (!id) return { ok: false, error: "ID requerido" };

  try {
    await db.delete(comprasInsumo).where(eq(comprasInsumo.id, id));
    revalidatePath(`/ffbb`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar la compra",
    };
  }
}

// ---------------------------------------------------------- Catálogos

export async function createProveedorAction(
  nombre: string,
): Promise<ActionResult<{ nombre: string }>> {
  try {
    await requireFfbbAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const clean = nombre.trim();
  if (!clean) return { ok: false, error: "El nombre del proveedor no puede estar vacío" };
  if (clean.length > 120) {
    return { ok: false, error: "El nombre es demasiado largo (máx. 120 caracteres)" };
  }

  try {
    await db
      .insert(proveedores)
      .values({ nombre: clean })
      .onConflictDoNothing({ target: proveedores.nombre });
    revalidatePath("/ffbb");
    return { ok: true, data: { nombre: clean } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear el proveedor",
    };
  }
}

export interface InsumoCatalogoInput {
  nombre: string;
  grupo?: string | null;
  ml?: number | null;
  marca?: string | null;
  porCaja?: number | null;
}

export async function createInsumoCatalogoAction(
  input: InsumoCatalogoInput,
): Promise<ActionResult<{ nombre: string }>> {
  try {
    await requireFfbbAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const nombre = input.nombre?.trim() ?? "";
  if (!nombre) return { ok: false, error: "El nombre del insumo no puede estar vacío" };
  if (nombre.length > 120) {
    return { ok: false, error: "El nombre es demasiado largo (máx. 120 caracteres)" };
  }

  try {
    await db
      .insert(insumosCatalogo)
      .values({
        nombre,
        grupo: input.grupo?.trim() || null,
        ml: input.ml ?? null,
        marca: input.marca?.trim() || null,
        porCaja: input.porCaja ?? null,
      })
      .onConflictDoNothing({ target: insumosCatalogo.nombre });
    revalidatePath("/ffbb");
    return { ok: true, data: { nombre } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear el insumo",
    };
  }
}
