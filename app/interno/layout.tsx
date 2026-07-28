import { auth } from "@/lib/auth";
import { FINANZAS_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";

// Switcher persistente del grupo FINANZAS para GASTO INTERNO. El control de
// acceso lo resuelve el proxy (canAccessPath sobre /interno).
export default async function InternoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  const members = accessibleMembers(FINANZAS_GROUP, permissions);

  return (
    <>
      <GroupNav group={FINANZAS_GROUP} active="interno" members={members} />
      <GroupContent group={FINANZAS_GROUP}>
        <main id="main-content" className="min-h-screen bg-[#FAFAFA]">
          {children}
        </main>
      </GroupContent>
    </>
  );
}
