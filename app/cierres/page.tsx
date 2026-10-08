import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CIERRES_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupHub from "@/components/groups/GroupHub";

export const dynamic = "force-dynamic";

/**
 * Hub del grupo CIERRES. Se llega desde la card "Cierres" de la home (morph del
 * hero) y desde acá se entra a cada presentación de cierre de evento. Solo
 * muestra las que el usuario puede ver; si no puede ver ninguna, vuelve a la home.
 *
 * Cada presentación es un deck a pantalla completa con su propia barra (volver,
 * lámina, PDF), por eso NO llevan el switcher persistente de otros grupos: este
 * hub es su índice y punto de regreso. El guard de sesión lo aporta
 * app/cierres/layout.tsx.
 */
export default async function CierresHubPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  const members = accessibleMembers(CIERRES_GROUP, permissions);
  if (members.length === 0) redirect("/?unauthorized=1");

  return <GroupHub group={CIERRES_GROUP} members={members} />;
}
