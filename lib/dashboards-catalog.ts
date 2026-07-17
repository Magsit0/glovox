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
 *  3. REGLA DE COLOR: el `accentClass` (color del icono en la home) debe ser
 *     único, distinto a TODOS los dashboards existentes. No reutilices un color
 *     ya tomado ni un tono casi idéntico. La verificación al final de este
 *     archivo falla en dev si se repite un color.
 *  4. El `icon` debería representar el contexto del dashboard lo más fielmente
 *     posible (ver `ICON_MAP` en `components/HomeDashboards.tsx`).
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
    label: "Venta diaria",
    appliesCountryScope: true,
    sortOrder: 20,
    title: "VENTA DIARIA",
    description:
      "Venta diaria del próximo evento: KPIs, ritmo de ventas, origen y embudo de campañas.",
    icon: "megaphone",
    accentClass: "bg-[#FFFF00]",
    accentText: "text-black",
  },
  {
    key: "cierre-mensual",
    pathPrefix: "/cierre-mensual",
    label: "Cierre mensual",
    appliesCountryScope: false,
    sortOrder: 30,
    title: "CIERRE MENSUAL",
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
    icon: "file-text",
    accentClass: "bg-[#FF7A00]",
    accentText: "text-black",
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
    icon: "utensils-crossed",
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
    icon: "wallet",
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
    key: "ticketing",
    pathPrefix: "/ticketing",
    label: "Ticketing",
    appliesCountryScope: true,
    sortOrder: 55,
    title: "TICKETING",
    description:
      "Análisis histórico del producto de ticketing: tipos y categorías de ticket, cantidad y venta por evento.",
    icon: "ticket",
    accentClass: "bg-[#E0218A]",
    accentText: "text-white",
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
    icon: "zap",
    accentClass: "bg-[#00BCD4]",
    accentText: "text-black",
  },
  {
    key: "reportes.grid-kiki-jw",
    pathPrefix: "/reportes/grid-kiki-jw",
    label: "JW · The Grid KI/KI",
    appliesCountryScope: false,
    sortOrder: 101,
    title: "JOHNNIE WALKER · THE GRID KI/KI",
    description:
      "Experimento de promo flash por WhatsApp: efecto en el consumo de Johnnie Walker — The Grid System · KI/KI, 9 mayo 2026.",
    icon: "megaphone",
    accentClass: "bg-[#B1D750]",
    accentText: "text-black",
  },
  {
    key: "paid-media",
    pathPrefix: "/paid-media",
    label: "Paid media",
    appliesCountryScope: false,
    sortOrder: 25,
    title: "PAID MEDIA",
    description:
      "Rendimiento de social media ads: gasto, alcance, CTR, CPC, CPM, conversiones y ROAS por plataforma, cuenta, campaña y adset.",
    icon: "target",
    accentClass: "bg-[#4267B2]",
    accentText: "text-white",
  },
  {
    key: "inversion-medios",
    pathPrefix: "/inversion-medios",
    label: "Control inversión PM",
    appliesCountryScope: false,
    sortOrder: 26,
    title: "CONTROL INVERSIÓN PM",
    description:
      "Presupuesto diario de paid media (plan por plataforma) vs gasto real por evento, en calendario libre. Techo por evento y ejecución.",
    icon: "briefcase",
    accentClass: "bg-[#534AB7]",
    accentText: "text-white",
  },
  {
    key: "proveedor",
    pathPrefix: "/proveedor",
    label: "Proveedor",
    appliesCountryScope: false,
    sortOrder: 85,
    title: "PROVEEDOR",
    description:
      "Gasto por proveedor: total, evolución en el tiempo y desglose por negocio, con detalle descargable. Excluye negocios de área GLOVOX.",
    icon: "truck",
    accentClass: "bg-[#6D4C41]",
    accentText: "text-white",
  },
  {
    key: "presupuesto",
    pathPrefix: "/presupuesto",
    label: "Presupuesto",
    appliesCountryScope: true,
    sortOrder: 95,
    title: "PRESUPUESTO",
    description:
      "Constructor de presupuesto de evento: proyección de ingresos por asistentes, techo por margen objetivo y cascada de costos por categoría.",
    icon: "calculator",
    accentClass: "bg-[#2FA37C]",
    accentText: "text-white",
  },
  {
    key: "fds",
    pathPrefix: "/fds",
    label: "Feria del Sanguche",
    appliesCountryScope: false,
    sortOrder: 75,
    title: "FERIA DEL SANGUCHE",
    description:
      "Comparación histórica entre ediciones de FDS: ingresos, asistentes y gasto real por categoría del catálogo oficial. Baseline para presupuestar la próxima edición.",
    icon: "sandwich",
    accentClass: "bg-[#C1440E]",
    accentText: "text-white",
  },
] as const;

/**
 * Regla de color: cada dashboard debe usar un `accentClass` único en la home.
 * Esta verificación corre solo fuera de producción y falla ruidosamente si se
 * agrega un dashboard con un color ya tomado, para forzar elegir uno nuevo.
 */
if (process.env.NODE_ENV !== "production") {
  const seenColor = new Map<string, string>();
  for (const d of DASHBOARDS_CATALOG) {
    const prev = seenColor.get(d.accentClass);
    if (prev) {
      throw new Error(
        `[dashboards-catalog] color repetido "${d.accentClass}" en "${prev}" y "${d.key}". ` +
          "Cada dashboard debe tener un color de icono único — elige uno distinto a los existentes.",
      );
    }
    seenColor.set(d.accentClass, d.key);
  }
}

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
