"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { marcaClientes, marcaFacturadores, mediosIngresos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { netoToBruto } from "@/lib/constants/tax";

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

// -------------------------------------------------- Tag "tiene plan de medios"
//
// MEDIOS no crea marcas nuevas: reusa el catálogo de `marca_clientes`. Este
// action marca/desmarca qué marcas participan del plan de medios. Sólo las
// marcadas aparecen como filas en la matriz de MEDIOS.

export async function setPlanMediosAction(input: {
  clienteId?: string;
  tienePlanMedios?: boolean;
}): Promise<ActionResult<{ clienteId: string; tienePlanMedios: boolean }>> {
  try {
    await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const clienteId = trimOrEmpty(input.clienteId);
  const tienePlanMedios = input.tienePlanMedios === true;
  if (!clienteId) return { ok: false, error: "Marca requerida" };

  try {
    const [row] = await db
      .update(marcaClientes)
      .set({ tienePlanMedios, updatedAt: new Date() })
      .where(eq(marcaClientes.id, clienteId))
      .returning({ id: marcaClientes.id });
    if (!row) return { ok: false, error: "Marca no encontrada" };
    revalidatePath("/onepager");
    return { ok: true, data: { clienteId, tienePlanMedios } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar el flag",
    };
  }
}

// ----------------------------------------------------- Upsert (matriz global)
//
// Garantiza UNA imputación de medios por (cliente, evento). Delete-then-insert
// en transacción. `montoNeto` <= 0 o null → sólo borra (limpiar celda).

export interface MediosIngresoUpsertInput {
  eventoId: string;
  clienteId: string;
  montoNeto: number | null;
}

export async function upsertMediosIngresoAction(
  input: Partial<MediosIngresoUpsertInput>,
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
    let view: { id: string; nombre: string; rut: string } | undefined;
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
        .delete(mediosIngresos)
        .where(
          and(
            eq(mediosIngresos.eventoId, eventoId),
            eq(mediosIngresos.clienteId, clienteId),
          ),
        );
      if (!shouldDelete && view && montoNeto !== null) {
        const montoBruto = netoToBruto(montoNeto);
        await tx.insert(mediosIngresos).values({
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

    if (shouldDelete || montoNeto === null) return { ok: true, data: null };
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
