// Agrupación de orígenes de venta (campo Referido) en las categorías de la
// tabla "Origen de Venta". Compartido por la tabla y su exportación CSV para
// que ambas agrupen exactamente igual.

export const ORIGIN_CATEGORY_MAP: Record<string, string> = {
  PM_MT: "Paid Media Meta",
  PM_GG: "Paid Media Google",
  EMAIL: "Email",
  ORG_LT: "Linktree",
};

/** Prefijo de categoría de un origen, o null si no pertenece a ninguna. */
export function categorizeOrigin(origin: string): string | null {
  for (const prefix of Object.keys(ORIGIN_CATEGORY_MAP)) {
    if (origin.startsWith(prefix)) return prefix;
  }
  return null;
}
