import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mesasVipClientes, mesasVipIngresos } from "@/db/schema";
import { brutoToNeto } from "@/lib/constants/tax";
import { normalizeEstadoPago, type EstadoPago } from "@/lib/constants/mesasVip";

/**
 * Vista plana de un cliente VIP. RUT y razón social son opcionales (el dato
 * viene de un canal informal sin factura); el identificador es `nombre`.
 */
export type MesasVipClienteRow = {
  id: string;
  nombre: string;              // UNIQUE — identificador
  rut: string | null;
  razonSocial: string | null;
  tipoCliente: string;         // "empresa" | "natural"
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lista de clientes VIP, ordenada por nombre. Alimenta la matriz global y el
 * gráfico de evolución.
 */
export async function getMesasVipClientes(): Promise<MesasVipClienteRow[]> {
  const rows = await db
    .select({
      id: mesasVipClientes.id,
      nombre: mesasVipClientes.nombre,
      rut: mesasVipClientes.rut,
      razonSocial: mesasVipClientes.razonSocial,
      tipoCliente: mesasVipClientes.tipoCliente,
      createdAt: mesasVipClientes.createdAt,
      updatedAt: mesasVipClientes.updatedAt,
    })
    .from(mesasVipClientes)
    .orderBy(mesasVipClientes.nombre);
  return rows;
}

export type MesasVipMatrixCell = {
  clienteId: string;
  eventoId: string;
  precio: number;          // BRUTO (IVA incluido)
  estadoPago: EstadoPago;
};

/**
 * Pivot completo de mesas_vip_ingresos para alimentar la matriz cliente ×
 * evento. El upsert garantiza una fila por par (cliente, evento), así que se
 * devuelve directo — sin agregar. `precio` es el monto bruto.
 */
export async function getMesasVipMatrix(): Promise<MesasVipMatrixCell[]> {
  const rows = await db
    .select({
      clienteId: mesasVipIngresos.clienteId,
      eventoId: mesasVipIngresos.eventoId,
      precio: mesasVipIngresos.precio,
      estadoPago: mesasVipIngresos.estadoPago,
    })
    .from(mesasVipIngresos);
  return rows.map((r) => ({
    clienteId: r.clienteId,
    eventoId: r.eventoId,
    precio: Number(r.precio) || 0,
    estadoPago: normalizeEstadoPago(r.estadoPago),
  }));
}

export type MesasVipAgg = {
  ventaNeto: number;
  ventaBruto: number;
  qtty: number;
};

/**
 * Agregado liviano por evento para el cuadro "Ingresos por Fuente" del
 * one-pager singular. `precio` es bruto; el neto se deriva (÷1,19) para que la
 * fila sea comparable con las otras fuentes (que se muestran netas).
 * Espeja `getMarcaIngresosAggByEvento`.
 */
export async function getMesasVipAggByEvento(
  eventoId: string,
): Promise<MesasVipAgg> {
  const rows = await db
    .select({
      ventaBruto: sql<number>`COALESCE(SUM(${mesasVipIngresos.precio}), 0)`.as(
        "venta_bruto",
      ),
      qtty: sql<number>`COUNT(*)`.as("qtty"),
    })
    .from(mesasVipIngresos)
    .where(eq(mesasVipIngresos.eventoId, eventoId));
  const r = rows[0];
  const ventaBruto = Number(r?.ventaBruto ?? 0);
  return {
    ventaNeto: brutoToNeto(ventaBruto),
    ventaBruto,
    qtty: Number(r?.qtty ?? 0),
  };
}

/**
 * Mapa eventoId → venta NETA (derivada del bruto), agregado en una sola query.
 * Reservado para una futura columna "Mesas VIP" en el listado multi-evento.
 */
export async function getMesasVipAggMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      eventoId: mesasVipIngresos.eventoId,
      ventaBruto: sql<number>`COALESCE(SUM(${mesasVipIngresos.precio}), 0)`.as(
        "venta_bruto",
      ),
    })
    .from(mesasVipIngresos)
    .groupBy(mesasVipIngresos.eventoId);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.eventoId, brutoToNeto(Number(r.ventaBruto) || 0));
  }
  return map;
}
