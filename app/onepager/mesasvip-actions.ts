"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { mesasVipClientes, mesasVipIngresos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { isValidRut, normalizeRut } from "@/lib/utils/rut";
import { normalizeEstadoPago, type EstadoPago } from "@/lib/constants/mesasVip";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface SessionCtx {
  email: string;
  userId: string | null;
}

async function requireOnepagerAccess(): Promise<SessionCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  const permissions = session?.user?.permissions ?? [];
  if (!canAccessPath(permissions, "/onepager")) {
    throw new Error("No autorizado para el one-pager");
  }
  return { email, userId: session?.user?.userId ?? null };
}

function trimOrEmpty(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

type TipoCliente = "empresa" | "natural";

function normTipo(v: unknown): TipoCliente {
  return v === "natural" ? "natural" : "empresa";
}

/**
 * Normaliza + valida un RUT opcional. Vacío → { ok:true, rut:null } (el RUT no
 * es obligatorio: los datos vienen de un canal informal sin factura).
 */
function parseOptionalRut(raw: string):
  | { ok: true; rut: string | null }
  | { ok: false; error: string } {
  if (!raw) return { ok: true, rut: null };
  const norm = normalizeRut(raw);
  if (!norm) return { ok: false, error: `RUT con formato inválido: "${raw}"` };
  if (!isValidRut(norm)) {
    return {
      ok: false,
      error: `RUT inválido (dígito verificador no coincide): "${raw}"`,
    };
  }
  return { ok: true, rut: norm };
}

// ---------------------------------------------------------- Catálogo cliente

export interface MesasVipClienteInput {
  nombre: string;             // nombre del cliente VIP (UNIQUE, identificador)
  rut: string;                // opcional
  razonSocial: string;        // opcional
  tipoCliente: TipoCliente;
}

export interface MesasVipClienteCreated {
  id: string;
  nombre: string;
  rut: string | null;
  razonSocial: string | null;
  tipoCliente: TipoCliente;
}

/**
 * Crea (o reusa si ya existe el nombre) un cliente VIP. El identificador es el
 * nombre (UNIQUE); RUT y razón social son opcionales.
 */
export async function createMesasVipClienteAction(
  input: Partial<MesasVipClienteInput>,
): Promise<ActionResult<MesasVipClienteCreated>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const nombre = trimOrEmpty(input.nombre);
  const rawRut = trimOrEmpty(input.rut);
  const razonSocial = trimOrEmpty(input.razonSocial);
  const tipoCliente = normTipo(input.tipoCliente);
  if (!nombre) return { ok: false, error: "El nombre del cliente es obligatorio" };
  if (nombre.length > 160) return { ok: false, error: "Nombre demasiado largo" };
  if (razonSocial.length > 200) {
    return { ok: false, error: "Razón social demasiado larga" };
  }

  const r = parseOptionalRut(rawRut);
  if (!r.ok) return { ok: false, error: r.error };
  const rut = r.rut;

  try {
    await db
      .insert(mesasVipClientes)
      .values({
        nombre,
        rut,
        razonSocial: razonSocial || null,
        tipoCliente,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing({ target: mesasVipClientes.nombre });

    const [cliente] = await db
      .select({
        id: mesasVipClientes.id,
        nombre: mesasVipClientes.nombre,
        rut: mesasVipClientes.rut,
        razonSocial: mesasVipClientes.razonSocial,
        tipoCliente: mesasVipClientes.tipoCliente,
      })
      .from(mesasVipClientes)
      .where(eq(mesasVipClientes.nombre, nombre))
      .limit(1);

    if (!cliente) return { ok: false, error: "No se pudo crear el cliente" };

    revalidatePath("/onepager");
    return {
      ok: true,
      data: {
        id: cliente.id,
        nombre: cliente.nombre,
        rut: cliente.rut,
        razonSocial: cliente.razonSocial,
        tipoCliente: normTipo(cliente.tipoCliente),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear el cliente",
    };
  }
}

// -------------------------------------------------------------- Update cliente

export interface MesasVipClienteUpdateInput {
  id: string;
  nombre: string;
  rut: string;
  razonSocial: string;
  tipoCliente: TipoCliente;
}

export async function updateMesasVipClienteAction(
  input: Partial<MesasVipClienteUpdateInput>,
): Promise<ActionResult<MesasVipClienteCreated>> {
  try {
    await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const id = trimOrEmpty(input.id);
  const nombre = trimOrEmpty(input.nombre);
  const rawRut = trimOrEmpty(input.rut);
  const razonSocial = trimOrEmpty(input.razonSocial);
  const tipoCliente = normTipo(input.tipoCliente);
  if (!id) return { ok: false, error: "ID del cliente requerido" };
  if (!nombre) return { ok: false, error: "El nombre del cliente es obligatorio" };
  if (nombre.length > 160) return { ok: false, error: "Nombre demasiado largo" };
  if (razonSocial.length > 200) {
    return { ok: false, error: "Razón social demasiado larga" };
  }

  const r = parseOptionalRut(rawRut);
  if (!r.ok) return { ok: false, error: r.error };
  const rut = r.rut;

  try {
    const [existing] = await db
      .select({ id: mesasVipClientes.id })
      .from(mesasVipClientes)
      .where(eq(mesasVipClientes.id, id))
      .limit(1);
    if (!existing) return { ok: false, error: "Cliente no encontrado" };

    // Colisión de nombre con OTRO cliente (nombre es el identificador único).
    const [collisionNombre] = await db
      .select({ id: mesasVipClientes.id })
      .from(mesasVipClientes)
      .where(and(eq(mesasVipClientes.nombre, nombre), ne(mesasVipClientes.id, id)))
      .limit(1);
    if (collisionNombre) {
      return { ok: false, error: `Ya existe otro cliente con el nombre "${nombre}"` };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(mesasVipClientes)
        .set({
          nombre,
          rut,
          razonSocial: razonSocial || null,
          tipoCliente,
          updatedAt: new Date(),
        })
        .where(eq(mesasVipClientes.id, id));

      // Propagar snapshots (cliente + rut_cliente) a los ingresos históricos.
      await tx
        .update(mesasVipIngresos)
        .set({ cliente: nombre, rutCliente: rut, updatedAt: new Date() })
        .where(eq(mesasVipIngresos.clienteId, id));
    });

    revalidatePath("/onepager");
    return {
      ok: true,
      data: { id, nombre, rut, razonSocial: razonSocial || null, tipoCliente },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar el cliente",
    };
  }
}

// ----------------------------------------------------- Upsert (matriz global)
//
// Garantiza UNA venta por (cliente, evento). Delete-then-insert consolida dups
// históricos. `precio` <= 0 o null → sólo borra (limpiar celda). `precio` es el
// monto BRUTO (IVA incluido); neto/IVA/consumo se derivan en lectura.

export interface MesasVipIngresoUpsertInput {
  eventoId: string;
  clienteId: string;
  precio: number | null;
  estadoPago: EstadoPago;
}

export async function upsertMesasVipIngresoAction(
  input: Partial<MesasVipIngresoUpsertInput>,
): Promise<ActionResult<{ precio: number; estadoPago: EstadoPago } | null>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const eventoId = trimOrEmpty(input.eventoId);
  const clienteId = trimOrEmpty(input.clienteId);
  if (!eventoId) return { ok: false, error: "Evento requerido" };
  if (!clienteId) return { ok: false, error: "Cliente requerido" };

  const precio = numOrNull(input.precio);
  const estadoPago = normalizeEstadoPago(input.estadoPago);
  const shouldDelete = precio === null || precio <= 0;

  try {
    let view: { id: string; nombre: string; rut: string | null } | undefined;
    if (!shouldDelete) {
      const [row] = await db
        .select({
          id: mesasVipClientes.id,
          nombre: mesasVipClientes.nombre,
          rut: mesasVipClientes.rut,
        })
        .from(mesasVipClientes)
        .where(eq(mesasVipClientes.id, clienteId))
        .limit(1);
      if (!row) return { ok: false, error: "Cliente no encontrado" };
      view = row;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(mesasVipIngresos)
        .where(
          and(
            eq(mesasVipIngresos.eventoId, eventoId),
            eq(mesasVipIngresos.clienteId, clienteId),
          ),
        );
      if (!shouldDelete && view && precio !== null) {
        await tx.insert(mesasVipIngresos).values({
          eventoId,
          clienteId: view.id,
          rutCliente: view.rut,
          cliente: view.nombre,
          precio,
          estadoPago,
          createdBy: ctx.userId,
        });
      }
    });

    revalidatePath("/onepager");

    if (shouldDelete || precio === null) {
      return { ok: true, data: null };
    }
    return { ok: true, data: { precio, estadoPago } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar la venta",
    };
  }
}

// ---------------------------------------------------------- Delete

export async function deleteMesasVipIngresoAction(
  id: string,
): Promise<ActionResult> {
  try {
    await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  if (!id) return { ok: false, error: "ID requerido" };

  try {
    await db.delete(mesasVipIngresos).where(eq(mesasVipIngresos.id, id));
    revalidatePath("/onepager");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar la venta",
    };
  }
}
