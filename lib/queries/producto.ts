import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { marcaClientes, marcaFacturadores, productoIngresos } from "@/db/schema";
import type { MarcaClienteRow } from "@/lib/queries/marca";
import { brutoToNeto } from "@/lib/constants/tax";
import type { IngresoDetalleRow } from "@/lib/unabase/types";

/**
 * PRODUCTO reusa el catálogo de marcas (`marca_clientes`) — igual que MEDIOS.
 * Sólo las marcas con `tiene_plan_producto = true` participan del módulo.
 *
 * A diferencia de MEDIOS (que imputa NETO y deriva el bruto hacia arriba), el
 * tratamiento de IVA es como MESAS VIP: se imputa `precio` + `exento`. Si es
 * exento, `precio` es el neto (sin IVA); si es afecto, `precio` es el bruto (IVA
 * incluido) → neto = ÷1,19.
 *
 * IMPORTANTE: los agregados filtran por `tiene_plan_producto = true` — igual que
 * el sheet, el picker y el gráfico. Así los totales SIEMPRE cuadran entre las
 * cuatro vistas. Si se desmarca una marca con imputaciones, su plata queda
 * dormida (no se cuenta) pero NO se borra: reaparece al re-marcarla.
 */

/** Fila del catálogo de marcas con su flag de producto (para el picker). */
export type MarcaClienteProductoTagRow = MarcaClienteRow & {
  tienePlanProducto: boolean;
};

/**
 * Todas las marcas del catálogo con su facturador y el flag `tienePlanProducto`.
 * Alimenta el panel "gestionar plan de producto" (marcar/desmarcar qué marcas
 * participan).
 */
export async function getMarcaClientesConTagProducto(): Promise<
  MarcaClienteProductoTagRow[]
> {
  const rows = await db
    .select({
      id: marcaClientes.id,
      nombre: marcaClientes.nombre,
      facturadorId: marcaClientes.facturadorId,
      rut: marcaFacturadores.rut,
      razonSocial: marcaFacturadores.razonSocial,
      tienePlanProducto: marcaClientes.tienePlanProducto,
      createdAt: marcaClientes.createdAt,
      updatedAt: marcaClientes.updatedAt,
    })
    .from(marcaClientes)
    .innerJoin(
      marcaFacturadores,
      eq(marcaClientes.facturadorId, marcaFacturadores.id),
    )
    .orderBy(marcaClientes.nombre);
  return rows;
}

// Suma exenta + neto de la parte afecta. `precio` de una venta exenta ES el
// neto (no hay IVA); el de una afecta es bruto → neto = ÷1,19.
const SUM_EXENTO = sql<number>`COALESCE(SUM(${productoIngresos.precio}) FILTER (WHERE ${productoIngresos.exento}), 0)`;
const SUM_AFECTO = sql<number>`COALESCE(SUM(${productoIngresos.precio}) FILTER (WHERE NOT ${productoIngresos.exento}), 0)`;

function netoFromSplit(sumExento: number, sumAfecto: number): number {
  return Math.round(sumExento) + brutoToNeto(sumAfecto);
}

/**
 * Celda de la matriz PRODUCTO (cliente × evento). El upsert garantiza una fila
 * por par (cliente, evento), así que se devuelve directo — sin agregar. Filtra
 * por `tiene_plan_producto = true` para cuadrar con el resto de las vistas.
 */
export type ProductoMatrixCell = {
  clienteId: string;
  eventoId: string;
  precio: number;
  exento: boolean;
};

export async function getProductoMatrix(): Promise<ProductoMatrixCell[]> {
  const rows = await db
    .select({
      clienteId: productoIngresos.clienteId,
      eventoId: productoIngresos.eventoId,
      precio: productoIngresos.precio,
      exento: productoIngresos.exento,
    })
    .from(productoIngresos)
    .innerJoin(marcaClientes, eq(productoIngresos.clienteId, marcaClientes.id))
    .where(eq(marcaClientes.tienePlanProducto, true));
  return rows.map((r) => ({
    clienteId: r.clienteId,
    eventoId: r.eventoId,
    precio: Number(r.precio) || 0,
    exento: r.exento !== false,
  }));
}

export type ProductoAgg = {
  ventaNeto: number;
  ventaBruto: number;
  qtty: number;
};

/**
 * Agregado por evento para el cuadro "Ingresos por Fuente" del one-pager y la
 * card "Producto" del cierre. `ventaBruto` = lo cobrado (Σ precio); `ventaNeto`
 * deriva IVA sólo de la parte afecta (las exentas aportan completo). Cuando todo
 * es exento, ventaNeto == ventaBruto. Filtra por `tiene_plan_producto = true`.
 */
export async function getProductoAggByEvento(
  eventoId: string,
): Promise<ProductoAgg> {
  const rows = await db
    .select({
      sumExento: SUM_EXENTO.as("sum_exento"),
      sumAfecto: SUM_AFECTO.as("sum_afecto"),
      qtty: sql<number>`COUNT(*)`.as("qtty"),
    })
    .from(productoIngresos)
    .innerJoin(marcaClientes, eq(productoIngresos.clienteId, marcaClientes.id))
    .where(
      and(
        eq(productoIngresos.eventoId, eventoId),
        eq(marcaClientes.tienePlanProducto, true),
      ),
    );
  const r = rows[0];
  const sumExento = Number(r?.sumExento ?? 0);
  const sumAfecto = Number(r?.sumAfecto ?? 0);
  return {
    ventaNeto: netoFromSplit(sumExento, sumAfecto),
    ventaBruto: Math.round(sumExento + sumAfecto),
    qtty: Number(r?.qtty ?? 0),
  };
}

/**
 * Detalle NETO por cliente para un evento (tooltip de la card "Producto" del
 * cierre). Las ventas exentas aportan su monto completo; las afectas, el neto
 * (÷1,19). Filtra por `tiene_plan_producto = true` para cuadrar con el agregado.
 */
export async function getProductoDetalleByEvento(
  eventoId: string,
): Promise<IngresoDetalleRow[]> {
  const rows = await db
    .select({
      cliente: productoIngresos.cliente,
      sumExento: SUM_EXENTO.as("sum_exento"),
      sumAfecto: SUM_AFECTO.as("sum_afecto"),
    })
    .from(productoIngresos)
    .innerJoin(marcaClientes, eq(productoIngresos.clienteId, marcaClientes.id))
    .where(
      and(
        eq(productoIngresos.eventoId, eventoId),
        eq(marcaClientes.tienePlanProducto, true),
      ),
    )
    .groupBy(productoIngresos.cliente)
    .orderBy(desc(sql`COALESCE(SUM(${productoIngresos.precio}), 0)`));
  return rows.map((r) => ({
    cliente: r.cliente,
    monto: netoFromSplit(Number(r.sumExento) || 0, Number(r.sumAfecto) || 0),
  }));
}
