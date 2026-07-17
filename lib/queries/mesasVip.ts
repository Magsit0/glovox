import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mesasVipClientes, mesasVipIngresos } from "@/db/schema";
import { brutoToNeto } from "@/lib/constants/tax";
import { normalizeEstadoPago, type EstadoPago } from "@/lib/constants/mesasVip";
import type { IngresoDetalleRow } from "@/lib/unabase/types";

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
  precio: number;          // lo que paga el cliente
  exento: boolean;         // true → sin IVA (neto = precio)
  estadoPago: EstadoPago;
};

/**
 * Pivot completo de mesas_vip_ingresos para alimentar la matriz cliente ×
 * evento. El upsert garantiza una fila por par (cliente, evento), así que se
 * devuelve directo — sin agregar.
 */
export async function getMesasVipMatrix(): Promise<MesasVipMatrixCell[]> {
  const rows = await db
    .select({
      clienteId: mesasVipIngresos.clienteId,
      eventoId: mesasVipIngresos.eventoId,
      precio: mesasVipIngresos.precio,
      exento: mesasVipIngresos.exento,
      estadoPago: mesasVipIngresos.estadoPago,
    })
    .from(mesasVipIngresos);
  return rows.map((r) => ({
    clienteId: r.clienteId,
    eventoId: r.eventoId,
    precio: Number(r.precio) || 0,
    exento: r.exento !== false,
    estadoPago: normalizeEstadoPago(r.estadoPago),
  }));
}

// Suma exenta + neto de la parte afecta. `precio` de una venta exenta es el
// neto (no hay IVA); el de una afecta es bruto → neto = ÷1,19.
const SUM_EXENTO = sql<number>`COALESCE(SUM(${mesasVipIngresos.precio}) FILTER (WHERE ${mesasVipIngresos.exento}), 0)`;
const SUM_AFECTO = sql<number>`COALESCE(SUM(${mesasVipIngresos.precio}) FILTER (WHERE NOT ${mesasVipIngresos.exento}), 0)`;

function netoFromSplit(sumExento: number, sumAfecto: number): number {
  return Math.round(sumExento) + brutoToNeto(sumAfecto);
}

/**
 * Detalle NETO por cliente para un evento (tooltip de la card "Mesas VIP" del
 * cierre). Las ventas exentas aportan su monto completo; las afectas, el neto
 * (÷1,19). Agrega por cliente y ordena de mayor a menor.
 */
export async function getMesasVipDetalleByEvento(
  eventoId: string,
): Promise<IngresoDetalleRow[]> {
  const rows = await db
    .select({
      cliente: mesasVipIngresos.cliente,
      sumExento: SUM_EXENTO.as("sum_exento"),
      sumAfecto: SUM_AFECTO.as("sum_afecto"),
    })
    .from(mesasVipIngresos)
    .where(eq(mesasVipIngresos.eventoId, eventoId))
    .groupBy(mesasVipIngresos.cliente)
    .orderBy(desc(sql`COALESCE(SUM(${mesasVipIngresos.precio}), 0)`));
  return rows.map((r) => ({
    cliente: r.cliente,
    monto: netoFromSplit(Number(r.sumExento) || 0, Number(r.sumAfecto) || 0),
  }));
}

export type MesasVipAgg = {
  ventaNeto: number;
  ventaBruto: number;
  qtty: number;
};

/**
 * Agregado liviano por evento para el cuadro "Ingresos por Fuente" del
 * one-pager singular. `ventaBruto` = lo cobrado (Σ precio); `ventaNeto` deriva
 * IVA solo de la parte afecta (las exentas aportan completo). Cuando todo es
 * exento, ventaNeto == ventaBruto. Espeja `getMarcaIngresosAggByEvento`.
 */
export async function getMesasVipAggByEvento(
  eventoId: string,
): Promise<MesasVipAgg> {
  const rows = await db
    .select({
      sumExento: SUM_EXENTO.as("sum_exento"),
      sumAfecto: SUM_AFECTO.as("sum_afecto"),
      qtty: sql<number>`COUNT(*)`.as("qtty"),
    })
    .from(mesasVipIngresos)
    .where(eq(mesasVipIngresos.eventoId, eventoId));
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
 * Mapa eventoId → venta NETA, agregado en una sola query. Reservado para una
 * futura columna "Mesas VIP" en el listado multi-evento.
 */
export async function getMesasVipAggMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      eventoId: mesasVipIngresos.eventoId,
      sumExento: SUM_EXENTO.as("sum_exento"),
      sumAfecto: SUM_AFECTO.as("sum_afecto"),
    })
    .from(mesasVipIngresos)
    .groupBy(mesasVipIngresos.eventoId);
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.eventoId, netoFromSplit(Number(r.sumExento) || 0, Number(r.sumAfecto) || 0));
  }
  return map;
}
