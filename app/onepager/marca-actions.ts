"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { marcaClientes, marcaIngresos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { netoToBruto } from "@/lib/constants/tax";
import { isValidRut, normalizeRut } from "@/lib/utils/rut";

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

// ---------------------------------------------------------- Catálogo cliente

export interface MarcaClienteInput {
  rut: string;
  nombre: string;
}

export async function createMarcaClienteAction(
  input: MarcaClienteInput,
): Promise<ActionResult<{ id: string; rut: string; nombre: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const rawRut = trimOrEmpty(input.rut);
  const nombre = trimOrEmpty(input.nombre);
  if (!rawRut) return { ok: false, error: "El RUT es obligatorio" };
  if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
  if (nombre.length > 160) return { ok: false, error: "Nombre demasiado largo" };

  // Normalización estricta: un RUT, un formato. Rechazamos cualquier cosa que
  // no parse o cuyo dígito verificador no cuadre (módulo-11).
  const rut = normalizeRut(rawRut);
  if (!rut) {
    return { ok: false, error: `RUT con formato inválido: "${rawRut}"` };
  }
  if (!isValidRut(rut)) {
    return {
      ok: false,
      error: `RUT inválido (dígito verificador no coincide): "${rawRut}"`,
    };
  }

  try {
    // Insert con conflict-do-nothing por RUT; luego select para devolver el id
    // (sea recién creado o existente). Si existía con otro nombre se respeta el
    // original — el usuario verá que ya existía un cliente con ese RUT.
    await db
      .insert(marcaClientes)
      .values({ rut, nombre, createdBy: ctx.userId })
      .onConflictDoNothing({ target: marcaClientes.rut });

    const [existing] = await db
      .select({
        id: marcaClientes.id,
        rut: marcaClientes.rut,
        nombre: marcaClientes.nombre,
      })
      .from(marcaClientes)
      .where(eq(marcaClientes.rut, rut))
      .limit(1);

    if (!existing) {
      return { ok: false, error: "No se pudo crear el cliente" };
    }

    revalidatePath("/onepager");
    return { ok: true, data: existing };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear el cliente",
    };
  }
}

// ---------------------------------------------------------- Ingreso

export interface MarcaIngresoInput {
  eventoId: string;
  clienteId: string;
  montoNeto: number;
}

export async function createMarcaIngresoAction(
  input: Partial<MarcaIngresoInput>,
): Promise<ActionResult<{ id: string }>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const eventoId = trimOrEmpty(input.eventoId);
  const clienteId = trimOrEmpty(input.clienteId);
  const montoNeto = numOrNull(input.montoNeto);

  if (!eventoId) return { ok: false, error: "Evento requerido" };
  if (!clienteId) return { ok: false, error: "Cliente requerido" };
  if (montoNeto === null) return { ok: false, error: "Monto neto requerido" };
  if (montoNeto <= 0) return { ok: false, error: "El monto neto debe ser positivo" };

  // Snapshot del cliente para denormalizar rut/nombre en la fila.
  const [cliente] = await db
    .select({
      id: marcaClientes.id,
      rut: marcaClientes.rut,
      nombre: marcaClientes.nombre,
    })
    .from(marcaClientes)
    .where(eq(marcaClientes.id, clienteId))
    .limit(1);

  if (!cliente) return { ok: false, error: "Cliente no encontrado" };

  const montoBruto = netoToBruto(montoNeto);

  try {
    const [row] = await db
      .insert(marcaIngresos)
      .values({
        eventoId,
        clienteId: cliente.id,
        rutCliente: cliente.rut,
        cliente: cliente.nombre,
        montoNeto,
        montoBruto,
        createdBy: ctx.userId,
      })
      .returning({ id: marcaIngresos.id });

    revalidatePath("/onepager");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al imputar el ingreso",
    };
  }
}

// ----------------------------------------------------- Upsert (matriz global)
//
// La matriz cliente × evento del editor global garantiza UNA imputación por
// par. Implementamos delete-then-insert dentro de una transacción para
// consolidar cualquier duplicado histórico al primer guardado del par.
// Si `montoNeto` es 0 o nulo, sólo borramos (limpiar la celda).

export interface MarcaIngresoUpsertInput {
  eventoId: string;
  clienteId: string;
  montoNeto: number | null;
}

export async function upsertMarcaIngresoAction(
  input: Partial<MarcaIngresoUpsertInput>,
): Promise<ActionResult<{ montoNeto: number; montoBruto: number } | null>> {
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

  const montoNeto = numOrNull(input.montoNeto);
  // 0/null/negativo → limpieza
  const shouldDelete = montoNeto === null || montoNeto <= 0;

  try {
    // Snapshot del cliente (sólo si vamos a insertar).
    let cliente: { id: string; rut: string; nombre: string } | undefined;
    if (!shouldDelete) {
      const [row] = await db
        .select({
          id: marcaClientes.id,
          rut: marcaClientes.rut,
          nombre: marcaClientes.nombre,
        })
        .from(marcaClientes)
        .where(eq(marcaClientes.id, clienteId))
        .limit(1);
      if (!row) return { ok: false, error: "Cliente no encontrado" };
      cliente = row;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(marcaIngresos)
        .where(
          and(
            eq(marcaIngresos.eventoId, eventoId),
            eq(marcaIngresos.clienteId, clienteId),
          ),
        );
      if (!shouldDelete && cliente && montoNeto !== null) {
        const montoBruto = netoToBruto(montoNeto);
        await tx.insert(marcaIngresos).values({
          eventoId,
          clienteId: cliente.id,
          rutCliente: cliente.rut,
          cliente: cliente.nombre,
          montoNeto,
          montoBruto,
          createdBy: ctx.userId,
        });
      }
    });

    revalidatePath("/onepager");

    if (shouldDelete || montoNeto === null) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: { montoNeto, montoBruto: netoToBruto(montoNeto) },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar el ingreso",
    };
  }
}

// ---------------------------------------------------------- Delete

export async function deleteMarcaIngresoAction(
  id: string,
): Promise<ActionResult> {
  try {
    await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  if (!id) return { ok: false, error: "ID requerido" };

  try {
    await db.delete(marcaIngresos).where(eq(marcaIngresos.id, id));
    revalidatePath("/onepager");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar el ingreso",
    };
  }
}
