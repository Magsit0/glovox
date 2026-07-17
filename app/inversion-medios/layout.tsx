import { auth } from "@/lib/auth";
import { MARKETING_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";

// Switcher persistente del grupo MARKETING para CONTROL INVERSIÓN PM. El
// control de acceso lo hace la propia page (canAccessPath en page.tsx).
export default async function InversionMediosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  const members = accessibleMembers(MARKETING_GROUP, permissions);

  return (
    <>
      <GroupNav group={MARKETING_GROUP} active="inversion-medios" members={members} />
      <GroupContent group={MARKETING_GROUP}>{children}</GroupContent>
    </>
  );
}
