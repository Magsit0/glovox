import { auth } from "@/lib/auth";
import { FINANZAS_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";

// Switcher persistente del grupo UNABASE para CIERRE MENSUAL. El control de
// acceso lo resuelve el proxy (canAccessPath sobre /cierre-mensual).
export default async function CierreMensualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  const members = accessibleMembers(FINANZAS_GROUP, permissions);

  return (
    <>
      <GroupNav group={FINANZAS_GROUP} active="cierre-mensual" members={members} />
      <GroupContent group={FINANZAS_GROUP}>
        <main id="main-content" className="min-h-screen bg-[#FAFAFA]">
          {children}
        </main>
      </GroupContent>
    </>
  );
}
