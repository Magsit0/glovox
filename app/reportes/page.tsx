import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { REPORTES_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupHub from "@/components/groups/GroupHub";

export const dynamic = "force-dynamic";

/**
 * Hub del grupo REPORTES ESTÁTICOS. Se llega desde la card "Reportes estáticos"
 * de la home (morph del hero) y desde acá se entra a cada reporte puntual (Entel
 * · The Grid, Johnnie Walker · The Grid KI/KI). Solo muestra los reportes que el
 * usuario puede ver; si no puede ver ninguno, vuelve a la home.
 *
 * Los reportes son microsites autocontenidos (chrome propio), por eso NO llevan
 * el switcher persistente de otros grupos: este hub es su índice y punto de
 * regreso. El guard de sesión lo aporta app/reportes/layout.tsx.
 */
export default async function ReportesHubPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  const members = accessibleMembers(REPORTES_GROUP, permissions);
  if (members.length === 0) redirect("/?unauthorized=1");

  return <GroupHub group={REPORTES_GROUP} members={members} />;
}
