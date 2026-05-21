import { requireSuperadmin } from "@/lib/access";
import { getAllNegociosAdmin } from "@/lib/queries/unabase";
import CierreTable from "./_components/CierreTable";

export const dynamic = "force-dynamic";

export default async function AdminCierrePage() {
  await requireSuperadmin();
  const rows = await getAllNegociosAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#333333]">
          Gestión de Cierre
        </h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Todos los negocios en <code className="font-mono">unabase.negocios</code>, ordenados por id desc.
        </p>
      </div>

      <CierreTable rows={rows} />
    </div>
  );
}
