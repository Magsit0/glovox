import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  marcaClientes,
  marcaIngresos,
  type MarcaCliente,
} from "@/db/schema";

export type MarcaClienteRow = MarcaCliente;

export type MarcaIngresoRow = {
  id: string;
  rutCliente: string;
  cliente: string;
  montoNeto: number;
  montoBruto: number;
  createdAt: Date;
};

/**
 * Lista de clientes-marca, ordenada por nombre para alimentar el combobox del
 * form de imputación.
 */
export async function getMarcaClientes(): Promise<MarcaClienteRow[]> {
  return db.select().from(marcaClientes).orderBy(marcaClientes.nombre);
}

/**
 * Ingresos imputados a un evento, ordenados de más reciente a más antiguo.
 * Devuelve snapshot denormalizado (rut/cliente) — no requiere join.
 */
export async function getMarcaIngresosByEvento(
  eventoId: string,
): Promise<MarcaIngresoRow[]> {
  const rows = await db
    .select({
      id: marcaIngresos.id,
      rutCliente: marcaIngresos.rutCliente,
      cliente: marcaIngresos.cliente,
      montoNeto: marcaIngresos.montoNeto,
      montoBruto: marcaIngresos.montoBruto,
      createdAt: marcaIngresos.createdAt,
    })
    .from(marcaIngresos)
    .where(eq(marcaIngresos.eventoId, eventoId))
    .orderBy(desc(marcaIngresos.createdAt));
  return rows;
}

export type MarcaIngresoAgg = {
  ventaNeto: number;
  qtty: number;
};

/**
 * Agregado liviano de ingresos-marca por evento, para sumar al cuadro
 * "Ingresos por Fuente" del one-pager (suma de montos netos + cantidad de
 * imputaciones). Devuelve { ventaNeto: 0, qtty: 0 } si no hay registros.
 */
export async function getMarcaIngresosAggByEvento(
  eventoId: string,
): Promise<MarcaIngresoAgg> {
  const rows = await db
    .select({
      ventaNeto: sql<number>`COALESCE(SUM(${marcaIngresos.montoNeto}), 0)`.as(
        "venta_neto",
      ),
      qtty: sql<number>`COUNT(*)`.as("qtty"),
    })
    .from(marcaIngresos)
    .where(eq(marcaIngresos.eventoId, eventoId));
  const r = rows[0];
  return {
    ventaNeto: Number(r?.ventaNeto ?? 0),
    qtty: Number(r?.qtty ?? 0),
  };
}

/**
 * Mapa eventoId → suma de montos netos, agregado en una sola query.
 * Útil para enriquecer el listado multi-evento del one-pager sin loops.
 */
export async function getMarcaIngresosAggMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      eventoId: marcaIngresos.eventoId,
      ventaNeto: sql<number>`COALESCE(SUM(${marcaIngresos.montoNeto}), 0)`.as(
        "venta_neto",
      ),
    })
    .from(marcaIngresos)
    .groupBy(marcaIngresos.eventoId);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.eventoId, Number(r.ventaNeto) || 0);
  }
  return map;
}

export type MarcaMatrixCell = {
  clienteId: string;
  eventoId: string;
  montoNeto: number;
};

/**
 * Pivot completo de marca_ingresos para alimentar la matriz cliente × evento
 * del editor global. Suma por par (consolida cualquier duplicado histórico
 * a un único valor visible).
 */
export async function getMarcaIngresosMatrix(): Promise<MarcaMatrixCell[]> {
  const rows = await db
    .select({
      clienteId: marcaIngresos.clienteId,
      eventoId: marcaIngresos.eventoId,
      montoNeto: sql<number>`COALESCE(SUM(${marcaIngresos.montoNeto}), 0)`.as(
        "monto_neto",
      ),
    })
    .from(marcaIngresos)
    .groupBy(marcaIngresos.clienteId, marcaIngresos.eventoId);
  return rows.map((r) => ({
    clienteId: r.clienteId,
    eventoId: r.eventoId,
    montoNeto: Number(r.montoNeto) || 0,
  }));
}
