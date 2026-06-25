/**
 * Sincroniza el catálogo de dashboards definido en código contra la tabla
 * `dashboards` de Neon. Idempotente: cada llamada hace upsert por `key`.
 *
 * Se ejecuta a lo sumo una vez por proceso (flag en memoria) para que el
 * costo sea despreciable. Si la primera ejecución falla, la próxima request
 * vuelve a intentarlo.
 *
 * Llamar desde rutas donde importa que la DB tenga el catálogo al día:
 * la home (para que `canAccessPath` resuelva contra entries reales) y la
 * vista de admin (para que `listDashboards()` muestre los nuevos como
 * opción de permiso).
 */
import { notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { DASHBOARDS_CATALOG } from "@/lib/dashboards-catalog";

let synced = false;
let inflight: Promise<void> | null = null;

async function runSync(): Promise<void> {
  // Inserta nuevas entradas con los valores del catálogo (seed inicial).
  // En conflicto solo actualiza campos NO editables por el superadmin
  // (`pathPrefix`, `appliesCountryScope`) para no pisar ediciones runtime
  // de `label`, `title`, `description` y `sortOrder`.
  for (const d of DASHBOARDS_CATALOG) {
    await db
      .insert(dashboards)
      .values({
        key: d.key,
        pathPrefix: d.pathPrefix,
        label: d.label,
        appliesCountryScope: d.appliesCountryScope,
        sortOrder: d.sortOrder,
        title: d.title,
        description: d.description,
      })
      .onConflictDoUpdate({
        target: dashboards.key,
        set: {
          pathPrefix: d.pathPrefix,
          appliesCountryScope: d.appliesCountryScope,
          // Seed inicial idempotente: si en DB el campo está vacío (default
          // tras la migración), lo llenamos con el valor del catálogo; si ya
          // tiene contenido (edición del superadmin), lo respetamos.
          title: sql`CASE WHEN ${dashboards.title} = '' THEN ${d.title} ELSE ${dashboards.title} END`,
          description: sql`CASE WHEN ${dashboards.description} = '' THEN ${d.description} ELSE ${dashboards.description} END`,
        },
      });
  }

  // Poda: elimina filas cuyo `key` ya no está en el catálogo (ej. tras
  // renombrar un key, que dejaría la fila vieja huérfana y visible en la home).
  // El catálogo es la fuente de verdad. Las FK a `dashboards.key`
  // (userDashboardAccess, superadminPendings, dashboardAccessLog) tienen
  // onDelete cascade, así que se limpian los grants/pendings/logs huérfanos.
  const catalogKeys = DASHBOARDS_CATALOG.map((d) => d.key);
  await db.delete(dashboards).where(notInArray(dashboards.key, catalogKeys));
}

export async function ensureDashboardsCatalog(): Promise<void> {
  if (synced) return;
  if (inflight) return inflight;
  inflight = runSync()
    .then(() => {
      synced = true;
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[dashboards-catalog] sync failed: ${msg}`);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
