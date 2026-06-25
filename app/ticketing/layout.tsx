import { auth } from "@/lib/auth";
import { MARKETING_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";

// Switcher persistente del grupo MARKETING para TICKETING. El control de
// acceso lo hace la propia page (canAccessPath en app/ticketing/page.tsx).
export default async function TicketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  const members = accessibleMembers(MARKETING_GROUP, permissions);

  return (
    <>
      <GroupNav group={MARKETING_GROUP} active="ticketing" members={members} />
      <GroupContent group={MARKETING_GROUP}>{children}</GroupContent>
    </>
  );
}
