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
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { DASHBOARDS_CATALOG } from "@/lib/dashboards-catalog";

let synced = false;
let inflight: Promise<void> | null = null;

async function runSync(): Promise<void> {
  for (const d of DASHBOARDS_CATALOG) {
    await db
      .insert(dashboards)
      .values({
        key: d.key,
        pathPrefix: d.pathPrefix,
        label: d.label,
        appliesCountryScope: d.appliesCountryScope,
        sortOrder: d.sortOrder,
      })
      .onConflictDoUpdate({
        target: dashboards.key,
        set: {
          pathPrefix: d.pathPrefix,
          label: d.label,
          appliesCountryScope: d.appliesCountryScope,
          sortOrder: d.sortOrder,
        },
      });
  }
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
