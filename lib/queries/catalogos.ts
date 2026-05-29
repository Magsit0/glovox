import { asc } from "drizzle-orm";
import { db } from "@/db";
import { insumosCatalogo, proveedores } from "@/db/schema";

/**
 * Lectura del catálogo de proveedores FF&BB. Lista chica (<100 filas),
 * sin cache: SELECT directo en cada request.
 */
export async function getProveedoresList(): Promise<string[]> {
  const rows = await db
    .select({ nombre: proveedores.nombre })
    .from(proveedores)
    .orderBy(asc(proveedores.nombre));
  return rows.map((r) => r.nombre);
}

/**
 * Lectura del catálogo de insumos FF&BB. Lista chica (<500 filas),
 * sin cache: SELECT directo en cada request.
 */
export async function getInsumosCatalogoList(): Promise<string[]> {
  const rows = await db
    .select({ nombre: insumosCatalogo.nombre })
    .from(insumosCatalogo)
    .orderBy(asc(insumosCatalogo.nombre));
  return rows.map((r) => r.nombre);
}
