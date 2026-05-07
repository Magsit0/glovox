import { listDashboards, listUsers } from "@/lib/admin-users-service";
import { requireSuperadmin } from "@/lib/access";
import { UsersMatrix } from "./_components/UsersMatrix";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await requireSuperadmin();
  const [users, catalog] = await Promise.all([listUsers(), listDashboards()]);

  // Strip Date objects → ISO strings so they cross the server/client boundary.
  const userRows = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    country: u.country,
    revokedAt: u.revokedAt ? u.revokedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    dashboardKeys: u.dashboardKeys,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#333333]">
          Usuarios y permisos
        </h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Administra acceso, país y dashboards. Los cambios surten efecto en
          el próximo sign-in del usuario.
        </p>
      </div>

      <UsersMatrix users={userRows} catalog={catalog} myId={me.userId} />
    </div>
  );
}
