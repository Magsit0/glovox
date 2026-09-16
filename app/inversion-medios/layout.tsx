import { auth } from "@/lib/auth";
import { MARKETING_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";
import ThemeSwitch from "@/components/theme/ThemeSwitch";

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
      <GroupContent group={MARKETING_GROUP}>
        {/* En el layout y no en la page: esta ruta renderiza dos vistas
            distintas (el panel general y el drill de un evento) y el switch
            tiene que estar en las dos. */}
        <div className="mx-auto flex max-w-[1600px] justify-end px-4 pt-6 sm:px-8">
          <ThemeSwitch />
        </div>
        {children}
      </GroupContent>
    </>
  );
}
