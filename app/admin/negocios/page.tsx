import { requireSuperadmin } from "@/lib/access";
import { getAllNegociosAdmin } from "@/lib/queries/cierreMensual";
import AdminNegociosTable from "./_components/AdminNegociosTable";

export const dynamic = "force-dynamic";

export default async function AdminNegociosPage() {
  await requireSuperadmin();
  const negocios = await getAllNegociosAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#333333]">
          Negocios
        </h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Listado de todos los negocios, sin segmentar por área. Para el cierre
          financiero de uno en particular, ir a /cierre-negocio.
        </p>
      </div>

      <AdminNegociosTable rows={negocios} />
    </div>
  );
}
