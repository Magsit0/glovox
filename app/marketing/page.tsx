import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MARKETING_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupHub from "@/components/groups/GroupHub";

export const dynamic = "force-dynamic";

/**
 * Hub del grupo MARKETING. Se llega desde la card MARKETING de la home (morph
 * del hero) y desde acá se entra a cada dashboard del grupo. Solo muestra los
 * dashboards que el usuario puede ver.
 */
export default async function MarketingHubPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  const members = accessibleMembers(MARKETING_GROUP, permissions);
  if (members.length === 0) redirect("/?unauthorized=1");

  return <GroupHub group={MARKETING_GROUP} members={members} />;
}
