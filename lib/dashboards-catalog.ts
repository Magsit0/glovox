/**
 * Single source of truth para todos los dashboards del proyecto.
 *
 * Cada entrada combina:
 *  - Metadata persistida en la tabla `dashboards` de Neon (key, pathPrefix,
 *    label, appliesCountryScope, sortOrder).
 *  - Metadata UI para la home (icon, accentClass, accentText, title,
 *    description).
 *
 * Para sumar un dashboard nuevo:
 *  1. Crear la ruta en `app/<path>/page.tsx`.
 *  2. Agregar una entrada aquí.
 *
 * El catálogo se sincroniza automáticamente a la base en tiempo de request
 * (ver `lib/ensureDashboardsCatalog.ts`). Por default un dashboard nuevo
 * queda visible solo para los superadmin (porque su rol mapea a "all" en
 * `lib/permissions.ts`); el resto de usuarios necesita un grant explícito
 * desde el admin.
 */

export interface DashboardCatalogEntry {
  // Persisted to DB
  key: string;
  pathPrefix: string;
  label: string;
  appliesCountryScope: boolean;
  sortOrder: number;
  // UI metadata (no se persiste)
  title: string;
  description: string;
  icon: string;
  accentClass: string;
  accentText: string;
}

export const DASHBOARDS_CATALOG: readonly DashboardCatalogEntry[] = [
  {
    key: "club",
    pathPrefix: "/club",
    label: "Club Glovox",
    appliesCountryScope: true,
    sortOrder: 10,
    title: "CLUB GLOVOX",
    description:
      "Ventas de la comunidad, análisis de vendedores, rendimiento de eventos y paneles de ganancias.",
    icon: "users",
    accentClass: "bg-[#0000FF]",
    accentText: "text-white",
  },
  {
    key: "marketing.weekly",
    pathPrefix: "/marketing/weekly",
    label: "Marketing semanal",
    appliesCountryScope: true,
    sortOrder: 20,
    title: "MARKETING",
    description:
      "Resumen semanal de marketing: paid media, origen de ventas, referidos del club y rendimiento de campañas.",
    icon: "megaphone",
    accentClass: "bg-[#FFFF00]",
    accentText: "text-black",
  },
  {
    key: "unabase.cierre-mensual",
    pathPrefix: "/unabase/cierre-mensual",
    label: "Unabase — cierre mensual",
    appliesCountryScope: false,
    sortOrder: 30,
    title: "UNABASE",
    description: "Cierres mensuales por negocio y área de negocios",
    icon: "database",
    accentClass: "bg-[#FF0000]",
    accentText: "text-white",
  },
  {
    key: "donations",
    pathPrefix: "/donations",
    label: "Donaciones",
    appliesCountryScope: true,
    sortOrder: 40,
    title: "DONACIONES",
    description: "Resumen de donaciones de Mercado Pago, cortesías y Yoga.",
    icon: "heart",
    accentClass: "bg-black",
    accentText: "text-[#FFFF00]",
  },
  {
    key: "onepager",
    pathPrefix: "/onepager",
    label: "Onepager",
    appliesCountryScope: true,
    sortOrder: 50,
    title: "ONEPAGER",
    description: "Resumen de ventas de tickets y AA&BB.",
    icon: "ticket",
    accentClass: "bg-[#FF0000]",
    accentText: "text-[#FFFF00]",
  },
  {
    key: "frees",
    pathPrefix: "/frees",
    label: "Cortesías",
    appliesCountryScope: true,
    sortOrder: 60,
    title: "CORTESIAS",
    description: "Resumen de cortesías entregadas.",
    icon: "gift",
    accentClass: "bg-[#00FF00]",
    accentText: "text-black",
  },
  {
    key: "ffbb",
    pathPrefix: "/ffbb",
    label: "Alimentos y bebidas",
    appliesCountryScope: true,
    sortOrder: 70,
    title: "FF&BB",
    description: "Resultados de operación alimentos y bebidas.",
    icon: "BottleWine",
    accentClass: "bg-[#722F37]",
    accentText: "text-white",
  },
  {
    key: "cierre-negocio",
    pathPrefix: "/cierre-negocio",
    label: "Cierre negocio",
    appliesCountryScope: false,
    sortOrder: 80,
    title: "CIERRE NEGOCIO",
    description:
      "Informe de cierre por negocio: presupuesto vs gasto real, top proveedores y estado de las OCs.",
    icon: "briefcase",
    accentClass: "bg-[#9F99F8]",
    accentText: "text-white",
  },
  {
    key: "cierre-trimestral",
    pathPrefix: "/cierre-trimestral",
    label: "Cierre trimestral",
    appliesCountryScope: false,
    sortOrder: 90,
    title: "CIERRE TRIMESTRAL",
    description:
      "Cierre de eventos agregado por trimestre: ventas, asistentes, per cápita y desglose por categoría.",
    icon: "calendar-range",
    accentClass: "bg-[#87DACD]",
    accentText: "text-black",
  },
  {
    key: "reportes.entel.the-grid",
    pathPrefix: "/reportes/entel-the-grid",
    label: "Entel · The Grid",
    appliesCountryScope: false,
    sortOrder: 100,
    title: "ENTEL · THE GRID",
    description:
      "Reporte de activación Entel en The Grid · kiki — 9 mayo 2026 (Espacio Riesco).",
    icon: "megaphone",
    accentClass: "bg-[#0033CC]",
    accentText: "text-white",
  },
] as const;

export type DashboardKey = (typeof DASHBOARDS_CATALOG)[number]["key"];

export const ALL_DASHBOARD_KEYS: readonly string[] = DASHBOARDS_CATALOG.map(
  (d) => d.key,
);

/**
 * Resuelve un pathname a la `key` del dashboard al que pertenece.
 * Compara contra `pathPrefix` y devuelve el match más largo (para casos
 * donde un prefix es subcadena de otro, ej. `/club` vs `/club/earnings`).
 */
export function matchDashboardKey(pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const d of DASHBOARDS_CATALOG) {
    if (
      pathname === d.pathPrefix ||
      pathname.startsWith(`${d.pathPrefix}/`)
    ) {
      if (!best || d.pathPrefix.length > best.len) {
        best = { key: d.key, len: d.pathPrefix.length };
      }
    }
  }
  return best?.key ?? null;
}
