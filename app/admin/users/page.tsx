import { listDashboards, listUsers } from "@/lib/admin-users-service";
import { requireSuperadmin } from "@/lib/access";
import { ensureDashboardsCatalog } from "@/lib/ensureDashboardsCatalog";
import { UsersMatrix } from "./_components/UsersMatrix";
import { EditorMetasCard } from "./_components/EditorMetasCard";
import { getEditores, MAX_EDITORES } from "@/lib/editores-capacidad";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await requireSuperadmin();
  // Asegura que cualquier dashboard nuevo agregado al catálogo en código
  // aparezca como opción asignable antes de listar.
  await ensureDashboardsCatalog();
  const [users, catalog, editoresMetas] = await Promise.all([
    listUsers(),
    listDashboards(),
    getEditores("metas-evento"),
  ]);
  // Candidatos a editor de metas: quien puede abrir Control inversión PM. Los
  // superadmins no entran: siempre pueden editar sin ocupar cupo.
  const candidatosMetas = users
    .filter((u) => !u.revokedAt && u.role !== "superadmin" && u.dashboardKeys.includes("inversion-medios"))
    .map((u) => ({ id: u.id, email: u.email }))
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

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

      <EditorMetasCard
        // Remonta la card (y su selección local) cuando cambia la lista guardada:
        // tras guardar, revocar o restaurar a alguien desde la matriz de abajo.
        key={editoresMetas.map((e) => e.userId).sort().join()}
        editores={editoresMetas.map((e) => ({
          userId: e.userId,
          email: e.email,
          asignadoAt: e.asignadoAt.toISOString(),
        }))}
        candidatos={candidatosMetas}
        max={MAX_EDITORES["metas-evento"]}
      />

      <UsersMatrix users={userRows} catalog={catalog} myId={me.userId} />
    </div>
  );
}
