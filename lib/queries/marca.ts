import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { marcaClientes, marcaFacturadores, marcaIngresos } from "@/db/schema";

/**
 * Vista plana de un cliente-marca con los datos de su facturador.
 * Es el shape que consumen todos los componentes UI — evita tener que
 * propagar la separación facturador/marca a cada prop.
 */
export type MarcaClienteRow = {
  id: string;
  nombre: string;          // nombre de la marca (UNIQUE)
  facturadorId: string;
  rut: string;             // del facturador
  razonSocial: string;     // del facturador
  createdAt: Date;
  updatedAt: Date;
};

export type MarcaIngresoRow = {
  id: string;
  rutCliente: string;
  cliente: string;
  montoNeto: number;
  montoBruto: number;
  createdAt: Date;
};

/**
 * Lista de clientes-marca con su facturador joined, ordenada por nombre de
 * marca. Alimenta los combobox y la matriz global.
 */
export async function getMarcaClientes(): Promise<MarcaClienteRow[]> {
  const rows = await db
    .select({
      id: marcaClientes.id,
      nombre: marcaClientes.nombre,
      facturadorId: marcaClientes.facturadorId,
      rut: marcaFacturadores.rut,
      razonSocial: marcaFacturadores.razonSocial,
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

/**
 * Lista plana de facturadores (sin marcas asociadas). Útil para selectores
 * de "asignar facturador existente" sin tener que mostrar todas las marcas
 * que ya factura.
 */
export type MarcaFacturadorRow = {
  id: string;
  rut: string;
  razonSocial: string;
};

export async function getMarcaFacturadores(): Promise<MarcaFacturadorRow[]> {
  return db
    .select({
      id: marcaFacturadores.id,
      rut: marcaFacturadores.rut,
      razonSocial: marcaFacturadores.razonSocial,
    })
    .from(marcaFacturadores)
    .orderBy(marcaFacturadores.razonSocial);
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
