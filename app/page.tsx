import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { DASHBOARDS_CATALOG } from "@/lib/dashboards-catalog";
import { DASHBOARD_GROUPS } from "@/lib/dashboard-groups";
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
    // Defensa: ignora filas de la DB que ya no existen en el catálogo (huérfanas
    // tras renombrar un key). `ensureDashboardsCatalog` ya las poda, pero esto
    // evita renderizarlas si el sync falló en este request.
    .filter((r) => catalogByKey.has(r.key))
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

  // Agrupa dashboards en una sola card para la home (lib/dashboard-groups).
  // El grupo aparece si el usuario puede ver al menos un dashboard miembro.
  const sectionKeys = new Set(sections.map((s) => s.key));
  const groups = DASHBOARD_GROUPS.flatMap((g) => {
    const memberKeys = g.members
      .map((m) => m.key)
      .filter((k) => sectionKeys.has(k));
    if (memberKeys.length === 0) return [];
    return [
      {
        key: g.key,
        title: g.title,
        description: g.description,
        href: g.href,
        icon: g.icon,
        accentClass: g.accentClass,
        accentText: g.accentText,
        vtName: g.heroVt,
        memberKeys,
      },
    ];
  });

  return (
    <div className="relative">
      <UserBar
        email={session?.user?.email}
        isSuperadmin={isSuperadmin}
      />
      <HomeDashboards
        sections={sections}
        groups={groups}
        isSuperadmin={isSuperadmin}
      />
    </div>
  );
}
