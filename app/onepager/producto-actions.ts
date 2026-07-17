"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { marcaClientes, marcaFacturadores, productoIngresos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";

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

// ------------------------------------------------ Tag "tiene plan de producto"
//
// PRODUCTO no crea marcas nuevas: reusa el catálogo de `marca_clientes`. Este
// action marca/desmarca qué marcas pagan producto. Sólo las marcadas aparecen
// como filas en la matriz de PRODUCTO. Flag independiente de `tiene_plan_medios`.

export async function setPlanProductoAction(input: {
  clienteId?: string;
  tienePlanProducto?: boolean;
}): Promise<ActionResult<{ clienteId: string; tienePlanProducto: boolean }>> {
  try {
    await requireOnepagerAccess();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No autorizado" };
  }

  const clienteId = trimOrEmpty(input.clienteId);
  const tienePlanProducto = input.tienePlanProducto === true;
  if (!clienteId) return { ok: false, error: "Marca requerida" };

  try {
    const [row] = await db
      .update(marcaClientes)
      .set({ tienePlanProducto, updatedAt: new Date() })
      .where(eq(marcaClientes.id, clienteId))
      .returning({ id: marcaClientes.id });
    if (!row) return { ok: false, error: "Marca no encontrada" };
    revalidatePath("/onepager");
    return { ok: true, data: { clienteId, tienePlanProducto } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar el flag",
    };
  }
}

// ----------------------------------------------------- Upsert (matriz global)
//
// Garantiza UNA imputación de producto por (cliente, evento). Delete-then-insert
// en transacción. `precio` <= 0 o null → sólo borra (limpiar celda). `precio` es
// el monto que paga la marca; `exento` decide el IVA (default exento):
//   exento → neto = precio (sin IVA);  afecto → precio es bruto, neto = ÷1,19.
// El neto/IVA se deriva en lectura (lib/queries/producto.ts).

export interface ProductoIngresoUpsertInput {
  eventoId: string;
  clienteId: string;
  precio: number | null;
  exento: boolean;
}

export async function upsertProductoIngresoAction(
  input: Partial<ProductoIngresoUpsertInput>,
): Promise<ActionResult<{ precio: number; exento: boolean } | null>> {
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

  const precio = numOrNull(input.precio);
  const exento = input.exento !== false; // default exento
  const shouldDelete = precio === null || precio <= 0;

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
        .delete(productoIngresos)
        .where(
          and(
            eq(productoIngresos.eventoId, eventoId),
            eq(productoIngresos.clienteId, clienteId),
          ),
        );
      if (!shouldDelete && view && precio !== null) {
        await tx.insert(productoIngresos).values({
          eventoId,
          clienteId: view.id,
          rutCliente: view.rut,
          cliente: view.nombre,
          precio,
          exento,
          createdBy: ctx.userId,
        });
      }
    });

    revalidatePath("/onepager");

    if (shouldDelete || precio === null) return { ok: true, data: null };
    return { ok: true, data: { precio, exento } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar el ingreso",
    };
  }
}
