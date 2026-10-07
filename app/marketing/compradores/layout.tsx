import { auth } from "@/lib/auth";
import { MARKETING_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";

// Switcher persistente del grupo MARKETING para COMPRADORES. La auth ya la
// resuelve el layout padre (app/marketing/layout.tsx).
export default async function CompradoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  const members = accessibleMembers(MARKETING_GROUP, permissions);

  return (
    <>
      <GroupNav group={MARKETING_GROUP} active="marketing.compradores" members={members} />
      <GroupContent group={MARKETING_GROUP}>{children}</GroupContent>
    </>
  );
}
