import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import HomeDashboards from "@/components/HomeDashboards";
import { UserBar } from "@/app/_components/user-bar";

const ALL_SECTIONS = [
  {
    title: "CLUB GLOVOX",
    description:
      "Ventas de la comunidad, análisis de vendedores, rendimiento de eventos y paneles de ganancias.",
    href: "/club",
    accentClass: "bg-[#0000FF]",
    accentText: "text-white",
    icon: "users",
  },
  {
    title: "MARKETING",
    description:
      "Resumen semanal de marketing: paid media, origen de ventas, referidos del club y rendimiento de campañas.",
    href: "/marketing/weekly",
    accentClass: "bg-[#FFFF00]",
    accentText: "text-black",
    icon: "megaphone",
  },
  {
    title: "UNABASE",
    description: "Cierres mensuales por negocio y área de negocios",
    href: "/unabase/cierre-mensual",
    accentClass: "bg-[#FF0000]",
    accentText: "text-white",
    icon: "database",
  },
  {
    title: "DONACIONES",
    description: "Resumen de donaciones de Mercado Pago, cortesías y Yoga.",
    href: "/donations",
    accentClass: "bg-black",
    accentText: "text-[#FFFF00]",
    icon: "heart",
  },
  {
    title: "ONEPAGER",
    description: "Resumen de ventas de tickets y AA&BB.",
    href: "/onepager",
    accentClass: "bg-[#FF0000]",
    accentText: "text-[#FFFF00]",
    icon: "ticket",
  },
  {
    title: "CORTESIAS",
    description: "Resumen de cortesías entregadas.",
    href: "/frees",
    accentClass: "bg-[#00FF00]",
    accentText: "text-black",
    icon: "gift",
  },
  {
    title: "FF&BB",
    description: "Resultados de operación alimentos y bebidas.",
    href: "/ffbb",
    accentClass: "bg-[#722F37]",
    accentText: "text-white",
    icon: "bottle-wine",
  },
  {
    title: "CIERRE NEGOCIO",
    description:
      "Informe de cierre por negocio: presupuesto vs gasto real, top proveedores y estado de las OCs.",
    href: "/cierre-negocio",
    accentClass: "bg-[#9F99F8]",
    accentText: "text-white",
    icon: "briefcase",
  },
];

export default async function HomePage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  const visibleSections = ALL_SECTIONS.filter((s) =>
    canAccessPath(permissions, s.href),
  );

  return (
    <div className="relative">
      <UserBar
        email={session?.user?.email}
        isSuperadmin={session?.user?.role === "superadmin"}
      />
      <HomeDashboards sections={visibleSections} />
    </div>
  );
}
