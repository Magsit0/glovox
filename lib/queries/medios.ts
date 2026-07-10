import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { marcaClientes, marcaFacturadores, mediosIngresos } from "@/db/schema";
import type { MarcaClienteRow, MarcaMatrixCell } from "@/lib/queries/marca";
import type { IngresoDetalleRow } from "@/lib/unabase/types";

/**
 * MEDIOS reusa el catálogo de marcas (`marca_clientes`). Sólo las marcas con
 * `tiene_plan_medios = true` participan del módulo de plan de medios. Las
 * funciones acá espejan a `lib/queries/marca.ts` pero contra `medios_ingresos`.
 *
 * IMPORTANTE: los agregados (matriz, por-evento, mapa) filtran por
 * `tiene_plan_medios = true` — igual que el sheet, el picker y el gráfico. Así
 * los totales SIEMPRE cuadran entre las cuatro vistas. Si se desmarca una marca
 * que tenía imputaciones, su plata queda dormida (no se cuenta en ningún lado)
 * pero NO se borra: reaparece consistentemente al re-marcarla.
 */

/** Fila del catálogo de marcas con su flag de plan de medios (para el picker). */
export type MarcaClienteTagRow = MarcaClienteRow & {
  tienePlanMedios: boolean;
};

/**
 * Todas las marcas del catálogo con su facturador y el flag `tienePlanMedios`.
 * Alimenta el panel "gestionar plan de medios" (marcar/desmarcar qué marcas
 * participan).
 */
export async function getMarcaClientesConTag(): Promise<MarcaClienteTagRow[]> {
  const rows = await db
    .select({
      id: marcaClientes.id,
      nombre: marcaClientes.nombre,
      facturadorId: marcaClientes.facturadorId,
      rut: marcaFacturadores.rut,
      razonSocial: marcaFacturadores.razonSocial,
      tienePlanMedios: marcaClientes.tienePlanMedios,
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
 * Marcas que participan del plan de medios (filas de la matriz MEDIOS).
 * Mismo shape que `getMarcaClientes` para reusar los componentes.
 */
export async function getMediosClientes(): Promise<MarcaClienteRow[]> {
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
    .where(eq(marcaClientes.tienePlanMedios, true))
    .orderBy(marcaClientes.nombre);
  return rows;
}

export type MediosIngresoRow = {
  id: string;
  rutCliente: string;
  cliente: string;
  montoNeto: number;
  montoBruto: number;
  createdAt: Date;
};

/** Ingresos de medios imputados a un evento, más reciente primero. */
export async function getMediosIngresosByEvento(
  eventoId: string,
): Promise<MediosIngresoRow[]> {
  const rows = await db
    .select({
      id: mediosIngresos.id,
      rutCliente: mediosIngresos.rutCliente,
      cliente: mediosIngresos.cliente,
      montoNeto: mediosIngresos.montoNeto,
      montoBruto: mediosIngresos.montoBruto,
      createdAt: mediosIngresos.createdAt,
    })
    .from(mediosIngresos)
    .where(eq(mediosIngresos.eventoId, eventoId))
    .orderBy(desc(mediosIngresos.createdAt));
  return rows;
}

export type MediosAgg = {
  ventaNeto: number;
  ventaBruto: number;
  qtty: number;
};

/**
 * Agregado por evento para el cuadro "Ingresos por Fuente" del one-pager
 * singular. Espeja `getMarcaIngresosAggByEvento`.
 */
export async function getMediosAggByEvento(
  eventoId: string,
): Promise<MediosAgg> {
  const rows = await db
    .select({
      ventaNeto: sql<number>`COALESCE(SUM(${mediosIngresos.montoNeto}), 0)`.as(
        "venta_neto",
      ),
      ventaBruto: sql<number>`COALESCE(SUM(${mediosIngresos.montoBruto}), 0)`.as(
        "venta_bruto",
      ),
      qtty: sql<number>`COUNT(*)`.as("qtty"),
    })
    .from(mediosIngresos)
    .innerJoin(
      marcaClientes,
      eq(mediosIngresos.clienteId, marcaClientes.id),
    )
    .where(
      and(
        eq(mediosIngresos.eventoId, eventoId),
        eq(marcaClientes.tienePlanMedios, true),
      ),
    );
  const r = rows[0];
  return {
    ventaNeto: Number(r?.ventaNeto ?? 0),
    ventaBruto: Number(r?.ventaBruto ?? 0),
    qtty: Number(r?.qtty ?? 0),
  };
}

/**
 * Detalle NETO por cliente para un evento (tooltip de la card "Medios" del
 * cierre). Filtra por `tiene_plan_medios = true` para cuadrar con el agregado
 * de la card. Agrega por cliente y ordena de mayor a menor.
 */
export async function getMediosDetalleByEvento(
  eventoId: string,
): Promise<IngresoDetalleRow[]> {
  const rows = await db
    .select({
      cliente: mediosIngresos.cliente,
      monto: sql<number>`COALESCE(SUM(${mediosIngresos.montoNeto}), 0)`.as("monto"),
    })
    .from(mediosIngresos)
    .innerJoin(marcaClientes, eq(mediosIngresos.clienteId, marcaClientes.id))
    .where(
      and(
        eq(mediosIngresos.eventoId, eventoId),
        eq(marcaClientes.tienePlanMedios, true),
      ),
    )
    .groupBy(mediosIngresos.cliente)
    .orderBy(desc(sql`COALESCE(SUM(${mediosIngresos.montoNeto}), 0)`));
  return rows.map((r) => ({ cliente: r.cliente, monto: Number(r.monto) || 0 }));
}

/** Mapa eventoId → suma de montos netos de medios (para el listado). */
export async function getMediosAggMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      eventoId: mediosIngresos.eventoId,
      ventaNeto: sql<number>`COALESCE(SUM(${mediosIngresos.montoNeto}), 0)`.as(
        "venta_neto",
      ),
    })
    .from(mediosIngresos)
    .innerJoin(
      marcaClientes,
      eq(mediosIngresos.clienteId, marcaClientes.id),
    )
    .where(eq(marcaClientes.tienePlanMedios, true))
    .groupBy(mediosIngresos.eventoId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.eventoId, Number(r.ventaNeto) || 0);
  return map;
}

/**
 * Pivot completo de medios_ingresos (cliente × evento → neto) para la matriz
 * y el gráfico de evolución. Mismo shape que `getMarcaIngresosMatrix`.
 */
export async function getMediosMatrix(): Promise<MarcaMatrixCell[]> {
  const rows = await db
    .select({
      clienteId: mediosIngresos.clienteId,
      eventoId: mediosIngresos.eventoId,
      montoNeto: sql<number>`COALESCE(SUM(${mediosIngresos.montoNeto}), 0)`.as(
        "monto_neto",
      ),
    })
    .from(mediosIngresos)
    .innerJoin(
      marcaClientes,
      eq(mediosIngresos.clienteId, marcaClientes.id),
    )
    .where(eq(marcaClientes.tienePlanMedios, true))
    .groupBy(mediosIngresos.clienteId, mediosIngresos.eventoId);
  return rows.map((r) => ({
    clienteId: r.clienteId,
    eventoId: r.eventoId,
    montoNeto: Number(r.montoNeto) || 0,
  }));
}
