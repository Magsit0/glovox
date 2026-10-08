import { auth } from "@/lib/auth";
import { MARKETING_GROUP, accessibleMembers } from "@/lib/dashboard-groups";
import GroupNav from "@/components/groups/GroupNav";
import GroupContent from "@/components/groups/GroupContent";
import ThemeSwitch from "@/components/theme/ThemeSwitch";

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
      <GroupContent group={MARKETING_GROUP}>
        {/* En el layout y no en la page (igual que /inversion-medios): la page
            tiene varios returns (sin eventos, vista normal) y el switch tiene
            que estar en todos, porque es el que aplica el tema guardado. */}
        <div className="mx-auto flex max-w-[1600px] justify-end px-4 pt-6 sm:px-8">
          <ThemeSwitch />
        </div>
        {children}
      </GroupContent>
    </>
  );
}
