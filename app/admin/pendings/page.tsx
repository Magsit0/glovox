import { listAllPendings } from "@/lib/superadminPendings";
import { requireSuperadmin } from "@/lib/access";
import AdminPendingsTable from "./_components/AdminPendingsTable";

export const dynamic = "force-dynamic";

export default async function AdminPendingsPage() {
  await requireSuperadmin();
  const allPendings = await listAllPendings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#333333]">
          Pendientes globales
        </h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Vista de todos los pendientes en todos los dashboards.
        </p>
      </div>

      <AdminPendingsTable data={allPendings} />
    </div>
  );
}
