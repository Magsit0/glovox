"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  marcaClientes,
  marcaFacturadores,
  marcaIngresos,
} from "@/db/schema";
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

/**
 * Normaliza + valida un RUT. Devuelve forma canónica o un error tipado.
 */
function parseRut(raw: string):
  | { ok: true; rut: string }
  | { ok: false; error: string } {
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

export interface MarcaClienteInput {
  nombre: string;             // nombre de la marca (UNIQUE)
  rut: string;                // RUT del facturador
  razonSocial: string;        // razón social del facturador
}

export interface MarcaClienteCreated {
  id: string;                 // id de la marca
  nombre: string;
  facturadorId: string;
  rut: string;
  razonSocial: string;
}

/**
 * Crea (o reusa si ya existe el nombre) una marca, asociada a un facturador
 * identificado por RUT. Si el facturador ya existe, ignora la razon_social
 * recibida y usa la existente — para cambiarla hay que ir por `updateMarca…`.
 */
export async function createMarcaClienteAction(
  input: Partial<MarcaClienteInput>,
): Promise<ActionResult<MarcaClienteCreated>> {
  let ctx: SessionCtx;
  try {
    ctx = await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const nombre = trimOrEmpty(input.nombre);
  const rawRut = trimOrEmpty(input.rut);
  const razonSocial = trimOrEmpty(input.razonSocial);
  if (!nombre) return { ok: false, error: "El nombre de la marca es obligatorio" };
  if (nombre.length > 160) return { ok: false, error: "Nombre demasiado largo" };
  if (!rawRut) return { ok: false, error: "El RUT del facturador es obligatorio" };

  const r = parseRut(rawRut);
  if (!r.ok) return { ok: false, error: r.error };
  const rut = r.rut;

  try {
    // 1. Upsert del facturador por RUT. Si existe, reutilizamos su razon_social.
    let facturador: { id: string; rut: string; razonSocial: string };
    const [existingFact] = await db
      .select({
        id: marcaFacturadores.id,
        rut: marcaFacturadores.rut,
        razonSocial: marcaFacturadores.razonSocial,
      })
      .from(marcaFacturadores)
      .where(eq(marcaFacturadores.rut, rut))
      .limit(1);

    if (existingFact) {
      facturador = existingFact;
    } else {
      if (!razonSocial) {
        return {
          ok: false,
          error: "El RUT no existe aún — indicá la razón social del facturador",
        };
      }
      if (razonSocial.length > 200) {
        return { ok: false, error: "Razón social demasiado larga" };
      }
      const [created] = await db
        .insert(marcaFacturadores)
        .values({ rut, razonSocial, createdBy: ctx.userId })
        .returning({
          id: marcaFacturadores.id,
          rut: marcaFacturadores.rut,
          razonSocial: marcaFacturadores.razonSocial,
        });
      if (!created) {
        return { ok: false, error: "No se pudo crear el facturador" };
      }
      facturador = created;
    }

    // 2. Insert de la marca (UNIQUE por nombre). Si ya existe, devolvemos esa.
    await db
      .insert(marcaClientes)
      .values({
        nombre,
        facturadorId: facturador.id,
        createdBy: ctx.userId,
      })
      .onConflictDoNothing({ target: marcaClientes.nombre });

    const [marca] = await db
      .select({
        id: marcaClientes.id,
        nombre: marcaClientes.nombre,
        facturadorId: marcaClientes.facturadorId,
      })
      .from(marcaClientes)
      .where(eq(marcaClientes.nombre, nombre))
      .limit(1);

    if (!marca) return { ok: false, error: "No se pudo crear la marca" };

    revalidatePath("/onepager");
    return {
      ok: true,
      data: {
        id: marca.id,
        nombre: marca.nombre,
        facturadorId: marca.facturadorId,
        rut: facturador.rut,
        razonSocial: facturador.razonSocial,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear la marca",
    };
  }
}

// ----------------------------------------- Update cliente (marca + facturador)
//
// Permite cambiar nombre de la marca y/o reasignar a otro facturador (por
// RUT). Si la razón social cambió pero el RUT no, actualiza la razon_social
// del facturador (lo que afecta TODAS las marcas que lo comparten — esto es
// intencional porque razon_social es atributo del facturador, no de la marca).
// Snapshots en marca_ingresos se propagan para mantener listados históricos
// consistentes con la corrección.

export interface MarcaClienteUpdateInput {
  id: string;                 // id de la marca
  nombre: string;
  rut: string;
  razonSocial: string;
}

export async function updateMarcaClienteAction(
  input: Partial<MarcaClienteUpdateInput>,
): Promise<
  ActionResult<{
    id: string;
    nombre: string;
    facturadorId: string;
    rut: string;
    razonSocial: string;
  }>
> {
  try {
    await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const id = trimOrEmpty(input.id);
  const nombre = trimOrEmpty(input.nombre);
  const rawRut = trimOrEmpty(input.rut);
  const razonSocial = trimOrEmpty(input.razonSocial);
  if (!id) return { ok: false, error: "ID de la marca requerido" };
  if (!nombre) return { ok: false, error: "El nombre de la marca es obligatorio" };
  if (nombre.length > 160) return { ok: false, error: "Nombre demasiado largo" };
  if (!rawRut) return { ok: false, error: "El RUT del facturador es obligatorio" };
  if (razonSocial.length > 200) {
    return { ok: false, error: "Razón social demasiado larga" };
  }

  const r = parseRut(rawRut);
  if (!r.ok) return { ok: false, error: r.error };
  const rut = r.rut;

  try {
    // 1. Cargar la marca actual + su facturador.
    const [existing] = await db
      .select({
        id: marcaClientes.id,
        nombre: marcaClientes.nombre,
        facturadorId: marcaClientes.facturadorId,
        rut: marcaFacturadores.rut,
        razonSocial: marcaFacturadores.razonSocial,
      })
      .from(marcaClientes)
      .innerJoin(
        marcaFacturadores,
        eq(marcaClientes.facturadorId, marcaFacturadores.id),
      )
      .where(eq(marcaClientes.id, id))
      .limit(1);
    if (!existing) return { ok: false, error: "Marca no encontrada" };

    // 2. Si el nombre cambió, verificar UNIQUE.
    if (existing.nombre !== nombre) {
      const [collisionNombre] = await db
        .select({ id: marcaClientes.id })
        .from(marcaClientes)
        .where(eq(marcaClientes.nombre, nombre))
        .limit(1);
      if (collisionNombre && collisionNombre.id !== id) {
        return {
          ok: false,
          error: `Ya existe otra marca con el nombre "${nombre}"`,
        };
      }
    }

    // 3. Resolver el facturador destino según el RUT recibido.
    //    a) Mismo RUT → mismo facturador. Si razon_social cambió, lo actualizamos.
    //    b) RUT distinto → buscar facturador existente o crearlo.
    let targetFacturador: { id: string; rut: string; razonSocial: string };

    if (existing.rut === rut) {
      // Mismo facturador. Posiblemente con razon_social distinta.
      targetFacturador = {
        id: existing.facturadorId,
        rut: existing.rut,
        razonSocial:
          razonSocial && razonSocial !== existing.razonSocial
            ? razonSocial
            : existing.razonSocial,
      };
    } else {
      const [other] = await db
        .select({
          id: marcaFacturadores.id,
          rut: marcaFacturadores.rut,
          razonSocial: marcaFacturadores.razonSocial,
        })
        .from(marcaFacturadores)
        .where(eq(marcaFacturadores.rut, rut))
        .limit(1);
      if (other) {
        targetFacturador = other;
      } else {
        if (!razonSocial) {
          return {
            ok: false,
            error:
              "El nuevo RUT no existe — indicá la razón social del facturador",
          };
        }
        targetFacturador = {
          id: "<new>", // marcador; insertamos abajo en la transacción
          rut,
          razonSocial,
        };
      }
    }

    const facturadorIsNew = targetFacturador.id === "<new>";
    const razonSocialChangedOnSameFacturador =
      existing.rut === rut &&
      razonSocial !== "" &&
      razonSocial !== existing.razonSocial;

    // No-op si nada cambió.
    if (
      existing.nombre === nombre &&
      existing.rut === rut &&
      !razonSocialChangedOnSameFacturador
    ) {
      return {
        ok: true,
        data: {
          id,
          nombre: existing.nombre,
          facturadorId: existing.facturadorId,
          rut: existing.rut,
          razonSocial: existing.razonSocial,
        },
      };
    }

    await db.transaction(async (tx) => {
      // 3a. Crear facturador nuevo si hace falta.
      if (facturadorIsNew) {
        const [created] = await tx
          .insert(marcaFacturadores)
          .values({
            rut: targetFacturador.rut,
            razonSocial: targetFacturador.razonSocial,
          })
          .returning({ id: marcaFacturadores.id });
        if (!created) throw new Error("No se pudo crear el facturador");
        targetFacturador.id = created.id;
      } else if (razonSocialChangedOnSameFacturador) {
        // 3b. Actualizar razón social del facturador existente.
        await tx
          .update(marcaFacturadores)
          .set({
            razonSocial: targetFacturador.razonSocial,
            updatedAt: new Date(),
          })
          .where(eq(marcaFacturadores.id, targetFacturador.id));
      }

      // 4. Actualizar la marca: nombre + posible reasignación de facturador.
      await tx
        .update(marcaClientes)
        .set({
          nombre,
          facturadorId: targetFacturador.id,
          updatedAt: new Date(),
        })
        .where(eq(marcaClientes.id, id));

      // 5. Propagar snapshots en marca_ingresos: nombre de cliente + rut_cliente
      //    quedan al día con la corrección.
      await tx
        .update(marcaIngresos)
        .set({
          cliente: nombre,
          rutCliente: targetFacturador.rut,
          updatedAt: new Date(),
        })
        .where(eq(marcaIngresos.clienteId, id));
    });

    revalidatePath("/onepager");
    return {
      ok: true,
      data: {
        id,
        nombre,
        facturadorId: targetFacturador.id,
        rut: targetFacturador.rut,
        razonSocial: targetFacturador.razonSocial,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Error al actualizar la marca",
    };
  }
}

// ---------------------------------------------------------- Ingreso (single)

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
  if (!clienteId) return { ok: false, error: "Marca requerida" };
  if (montoNeto === null) return { ok: false, error: "Monto neto requerido" };
  if (montoNeto <= 0) return { ok: false, error: "El monto neto debe ser positivo" };

  // Snapshot: nombre marca + rut facturador.
  const [view] = await db
    .select({
      id: marcaClientes.id,
      nombre: marcaClientes.nombre,
      rut: marcaFacturadores.rut,
    })
    .from(marcaClientes)
    .innerJoin(
      marcaFacturadores,
      eq(marcaClientes.facturadorId, marcaFacturadores.id),
    )
    .where(eq(marcaClientes.id, clienteId))
    .limit(1);

  if (!view) return { ok: false, error: "Marca no encontrada" };

  const montoBruto = netoToBruto(montoNeto);

  try {
    const [row] = await db
      .insert(marcaIngresos)
      .values({
        eventoId,
        clienteId: view.id,
        rutCliente: view.rut,
        cliente: view.nombre,
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
// Garantiza UNA imputación por (cliente, evento). Delete-then-insert en una
// transacción consolida cualquier dup histórico al primer guardado del par.
// `montoNeto` <= 0 o null → sólo borra (limpiar celda).

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
  if (!clienteId) return { ok: false, error: "Marca requerida" };

  const montoNeto = numOrNull(input.montoNeto);
  const shouldDelete = montoNeto === null || montoNeto <= 0;

  try {
    let view:
      | { id: string; nombre: string; rut: string }
      | undefined;
    if (!shouldDelete) {
      const [row] = await db
        .select({
          id: marcaClientes.id,
          nombre: marcaClientes.nombre,
          rut: marcaFacturadores.rut,
        })
        .from(marcaClientes)
        .innerJoin(
          marcaFacturadores,
          eq(marcaClientes.facturadorId, marcaFacturadores.id),
        )
        .where(eq(marcaClientes.id, clienteId))
        .limit(1);
      if (!row) return { ok: false, error: "Marca no encontrada" };
      view = row;
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
      if (!shouldDelete && view && montoNeto !== null) {
        const montoBruto = netoToBruto(montoNeto);
        await tx.insert(marcaIngresos).values({
          eventoId,
          clienteId: view.id,
          rutCliente: view.rut,
          cliente: view.nombre,
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
