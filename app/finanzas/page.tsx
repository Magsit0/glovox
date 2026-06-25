import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { FINANZAS_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupHub from "@/components/groups/GroupHub";

export const dynamic = "force-dynamic";

/**
 * Hub del grupo FINANZAS. Se llega desde la card FINANZAS de la home (morph del
 * hero) y desde acá se entra a Cierre mensual y Cierre negocio. Solo muestra los
 * dashboards que el usuario puede ver.
 */
export default async function FinanzasHubPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  const members = accessibleMembers(FINANZAS_GROUP, permissions);
  if (members.length === 0) redirect("/?unauthorized=1");

  return <GroupHub group={FINANZAS_GROUP} members={members} />;
}
