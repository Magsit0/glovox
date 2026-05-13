import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { asc } from "drizzle-orm";
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
  const isSuperadmin = session?.user?.role === "superadmin";

  // Fuente de verdad runtime: DB. El catálogo en código aporta solo el
  // metadata visual (icon/accent) que no es editable desde la UI.
  const rows = await db
    .select()
    .from(dashboards)
    .orderBy(asc(dashboards.sortOrder));

  const catalogByKey = new Map(DASHBOARDS_CATALOG.map((d) => [d.key, d]));

  const sections = rows
    .map((r) => {
      const cat = catalogByKey.get(r.key);
      return {
        key: r.key,
        title: r.title,
        description: r.description,
        href: r.pathPrefix,
        accentClass: cat?.accentClass ?? "bg-black",
        accentText: cat?.accentText ?? "text-white",
        icon: cat?.icon ?? "ticket",
      };
    })
    .filter((s) => canAccessPath(permissions, s.href));

  return (
    <div className="relative">
      <UserBar
        email={session?.user?.email}
        isSuperadmin={isSuperadmin}
      />
      <HomeDashboards sections={sections} isSuperadmin={isSuperadmin} />
    </div>
  );
}
