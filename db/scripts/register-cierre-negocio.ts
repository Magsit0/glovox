/**
 * Upsertea el dashboard `cierre-negocio` en la tabla `dashboards`.
 * No toca usuarios ni `userDashboardAccess`. Idempotente.
 *
 * Acceso resultante: solo superadmin (porque superadmin obtiene
 * `permissions: "all"` automáticamente; no hay grants explícitos).
 */
import { db } from "../index";
import { dashboards } from "../schema";

const ENTRY = {
  key: "cierre-negocio",
  pathPrefix: "/cierre-negocio",
  label: "Cierre negocio",
  appliesCountryScope: false,
  sortOrder: 80,
} as const;

async function main() {
  await db
    .insert(dashboards)
    .values(ENTRY)
    .onConflictDoUpdate({
      target: dashboards.key,
      set: {
        pathPrefix: ENTRY.pathPrefix,
        label: ENTRY.label,
        appliesCountryScope: ENTRY.appliesCountryScope,
        sortOrder: ENTRY.sortOrder,
      },
    });

  console.log(`✓ dashboard '${ENTRY.key}' registrado (${ENTRY.pathPrefix})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Falló el registro:", err);
    process.exit(1);
  });
