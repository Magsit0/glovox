import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comprasInsumo, type CompraInsumo } from "@/db/schema";

export type CompraInsumoRow = CompraInsumo;

/**
 * Compras imputadas para un evento (o null = stock general sin asignar).
 * Ordenadas por fecha de compra desc, fallback a created_at.
 */
export async function getComprasByEvento(
  eventoId: string,
): Promise<CompraInsumoRow[]> {
  return db
    .select()
    .from(comprasInsumo)
    .where(eq(comprasInsumo.eventoId, eventoId))
    .orderBy(desc(comprasInsumo.fechaCompra), desc(comprasInsumo.createdAt));
}

/**
 * Agregado por insumo para un evento: suma de `recibido` filtrando por
 * tipo_operacion = 'ingreso'. El frontend joinea contra el consumo (BigQuery).
 *
 * Devuelve un Map para join O(1) en el server.
 */
export async function getCompradoPorInsumo(
  eventoId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      insumo: comprasInsumo.insumo,
      comprado: sql<number>`COALESCE(SUM(${comprasInsumo.recibido}), 0)`.as("comprado"),
    })
    .from(comprasInsumo)
    .where(
      and(
        eq(comprasInsumo.eventoId, eventoId),
        eq(comprasInsumo.tipoOperacion, "ingreso"),
      ),
    )
    .groupBy(comprasInsumo.insumo);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.insumo, Number(r.comprado) || 0);
  }
  return map;
}

/**
 * Compras sin evento asignado (stock general).
 */
export async function getComprasSinEvento(): Promise<CompraInsumoRow[]> {
  return db
    .select()
    .from(comprasInsumo)
    .where(isNull(comprasInsumo.eventoId))
    .orderBy(desc(comprasInsumo.fechaCompra), desc(comprasInsumo.createdAt));
}
