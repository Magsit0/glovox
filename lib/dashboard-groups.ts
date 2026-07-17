/**
 * Agrupación de dashboards para la home.
 *
 * Un "grupo" colapsa varios dashboards del catálogo (`lib/dashboards-catalog.ts`)
 * en una sola card en la home. Al abrirla se llega a un hub (`href`) desde donde
 * se entra a cada dashboard miembro; dentro de cada uno hay un switcher
 * persistente para saltar entre ellos.
 *
 * Esto es puramente de PRESENTACIÓN y navegación: los permisos, rutas y el
 * panel de admin siguen operando sobre las entradas individuales del catálogo
 * (cada `member.path` se chequea con `canAccessPath`). No toca la DB.
 *
 * Los `view-transition-name` declarados acá conectan los elementos compartidos
 * entre rutas para el morph fluido (card de la home ↔ hero del hub ↔ tab activa
 * del switcher).
 */
import { canAccessPath, type DashboardPermissions } from "@/lib/permissions";

export interface GroupMember {
  /** key del dashboard en el catálogo / DB */
  key: string;
  /** Etiqueta visible en el hub y el switcher */
  label: string;
  /** Ruta del dashboard (se chequea con canAccessPath) */
  path: string;
  /** Descripción para la sub-card del hub */
  description: string;
  /** key del ICON_MAP (ver components/HomeDashboards.tsx) */
  icon: string;
  /** Color del icono en la sub-card del hub (estilo brutalista de la home) */
  accentClass: string;
  accentText: string;
}

export interface DashboardGroup {
  /** key sintética del grupo (no es un dashboard de la DB) */
  key: string;
  title: string;
  description: string;
  icon: string;
  accentClass: string;
  accentText: string;
  /** Estilo visual de la barra switcher (GroupNav): "brutalist" (home/marketing)
   *  o "glovox" (manual de marca: blanco, hairlines #E5E5E5, acento púrpura,
   *  font-sans, subrayado sutil). Solo afecta la barra, no el hub ni la home. */
  theme: "brutalist" | "glovox";
  /** Ruta del hub del grupo */
  href: string;
  /** view-transition-name del hero (card de la home ↔ hero del hub). Único por
   *  grupo: dos heroVt iguales en la home romperían la transición. */
  heroVt: string;
  /** view-transition-name de la barra persistente (switcher) en los layouts
   *  de los dashboards miembros. Queda anclada durante el slide del contenido. */
  navVt: string;
  /** view-transition-name del contenedor de contenido (hace el slide
   *  direccional al saltar entre hub y dashboards, y entre hermanos). */
  contentVt: string;
  members: GroupMember[];
}

export const MARKETING_GROUP: DashboardGroup = {
  key: "marketing",
  title: "MARKETING",
  description:
    "Venta diaria de eventos, paid media y ticketing — todo el marketing en un solo lugar.",
  icon: "megaphone",
  accentClass: "bg-[#FFFF00]",
  accentText: "text-black",
  theme: "brutalist",
  href: "/marketing",
  heroVt: "marketing-hero",
  navVt: "marketing-nav",
  contentVt: "marketing-content",
  members: [
    {
      key: "marketing.weekly",
      label: "VENTA DIARIA",
      path: "/marketing/weekly",
      description:
        "Venta diaria del próximo evento: KPIs, ritmo de ventas, origen y embudo de campañas.",
      icon: "megaphone",
      accentClass: "bg-[#FFFF00]",
      accentText: "text-black",
    },
    {
      key: "paid-media",
      label: "PAID MEDIA",
      path: "/paid-media",
      description:
        "Rendimiento de social media ads: gasto, alcance, CTR, CPC, CPM, conversiones y ROAS por plataforma, campaña y adset.",
      icon: "target",
      accentClass: "bg-[#4267B2]",
      accentText: "text-white",
    },
    {
      key: "inversion-medios",
      label: "CONTROL INVERSIÓN PM",
      path: "/inversion-medios",
      description:
        "Presupuesto diario de paid media (plan por plataforma) vs gasto real por evento, en calendario libre.",
      icon: "briefcase",
      accentClass: "bg-[#534AB7]",
      accentText: "text-white",
    },
    {
      key: "ticketing",
      label: "TICKETING",
      path: "/ticketing",
      description:
        "Análisis histórico del producto de ticketing: tipos y categorías de ticket, cantidad y venta por evento.",
      icon: "ticket",
      accentClass: "bg-[#E0218A]",
      accentText: "text-white",
    },
  ],
};

export const FINANZAS_GROUP: DashboardGroup = {
  key: "finanzas",
  title: "FINANZAS",
  description:
    "Cierres del negocio y resumen por evento: cierre mensual por área, cierre por negocio y onepager.",
  icon: "database",
  accentClass: "bg-[#FF0000]",
  accentText: "text-white",
  theme: "glovox",
  href: "/finanzas",
  heroVt: "finanzas-hero",
  navVt: "finanzas-nav",
  contentVt: "finanzas-content",
  members: [
    {
      key: "cierre-mensual",
      label: "Cierre mensual",
      path: "/cierre-mensual",
      description:
        "Cierres mensuales por negocio y área: resultado, ingresos, gastos y evolución mes a mes.",
      icon: "database",
      accentClass: "bg-[#FF0000]",
      accentText: "text-white",
    },
    {
      key: "cierre-negocio",
      label: "Cierre negocio",
      path: "/cierre-negocio",
      description:
        "Informe de cierre por negocio: presupuesto vs gasto real, top proveedores y estado de las OCs.",
      icon: "wallet",
      accentClass: "bg-[#9F99F8]",
      accentText: "text-white",
    },
    {
      key: "onepager",
      label: "Onepager",
      path: "/onepager",
      description: "Resumen por evento de ventas de tickets y AA&BB.",
      icon: "file-text",
      accentClass: "bg-[#FF7A00]",
      accentText: "text-black",
    },
  ],
};

export const REPORTES_GROUP: DashboardGroup = {
  key: "reportes",
  title: "REPORTES ESTÁTICOS",
  description:
    "Reportes puntuales de activaciones y experimentos por evento — archivo consultable.",
  icon: "folder",
  accentClass: "bg-[#9F99F8]",
  accentText: "text-white",
  theme: "glovox",
  href: "/reportes",
  heroVt: "reportes-hero",
  navVt: "reportes-nav",
  contentVt: "reportes-content",
  members: [
    {
      key: "reportes.entel.the-grid",
      label: "Entel · The Grid",
      path: "/reportes/entel-the-grid",
      description:
        "Reporte de activación Entel en The Grid · kiki — 9 mayo 2026 (Espacio Riesco).",
      icon: "zap",
      accentClass: "bg-[#00BCD4]",
      accentText: "text-black",
    },
    {
      key: "reportes.grid-kiki-jw",
      label: "Johnnie Walker · The Grid KI/KI",
      path: "/reportes/grid-kiki-jw",
      description:
        "Experimento de promo flash por WhatsApp: efecto en el consumo de Johnnie Walker — The Grid System · KI/KI, 9 mayo 2026.",
      icon: "megaphone",
      accentClass: "bg-[#B1D750]",
      accentText: "text-black",
    },
  ],
};

export const DASHBOARD_GROUPS: readonly DashboardGroup[] = [
  MARKETING_GROUP,
  FINANZAS_GROUP,
  REPORTES_GROUP,
];

/** Todas las keys de dashboards que pertenecen a algún grupo. */
export const GROUPED_MEMBER_KEYS: ReadonlySet<string> = new Set(
  DASHBOARD_GROUPS.flatMap((g) => g.members.map((m) => m.key)),
);

/** Devuelve el grupo al que pertenece una key de dashboard, o null. */
export function getGroupForMemberKey(key: string): DashboardGroup | null {
  return (
    DASHBOARD_GROUPS.find((g) => g.members.some((m) => m.key === key)) ?? null
  );
}

/** Miembros de un grupo accesibles con los permisos dados, en orden declarado. */
export function accessibleMembers(
  group: DashboardGroup,
  permissions: DashboardPermissions,
): GroupMember[] {
  return group.members.filter((m) => canAccessPath(permissions, m.path));
}

/**
 * Tipos de transición (dirección del slide) compartidos por todos los grupos.
 * Los view-transition-name concretos viven en cada `DashboardGroup`
 * (`heroVt`, `navVt`, `contentVt`).
 */
export const NAV_FORWARD = "nav-forward";
export const NAV_BACK = "nav-back";
