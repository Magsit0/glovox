import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { DASHBOARDS_CATALOG } from "@/lib/dashboards-catalog";
import { ensureDashboardsCatalog } from "@/lib/ensureDashboardsCatalog";
import HomeDashboards from "@/components/HomeDashboards";
import { UserBar } from "@/app/_components/user-bar";

export default async function HomePage() {
  // Mantiene la tabla `dashboards` en Neon sincronizada con el catálogo en
  // código. Idempotente y a lo sumo una vez por proceso.
  await ensureDashboardsCatalog();

  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  const sections = DASHBOARDS_CATALOG.map((d) => ({
    title: d.title,
    description: d.description,
    href: d.pathPrefix,
    accentClass: d.accentClass,
    accentText: d.accentText,
    icon: d.icon,
  })).filter((s) => canAccessPath(permissions, s.href));

  return (
    <div className="relative">
      <UserBar
        email={session?.user?.email}
        isSuperadmin={session?.user?.role === "superadmin"}
      />
      <HomeDashboards sections={sections} />
    </div>
  );
}
