import { requireSuperadmin } from "@/lib/access";
import { getAllNegociosAdmin } from "@/lib/queries/cierreMensual";
import { db } from "@/db";
import { negocioVariableEnvio } from "@/db/schema";
import { withNeonRetry } from "@/lib/neon-retry";
import AdminNegociosTable, { type VariableMarca } from "./_components/AdminNegociosTable";

export const dynamic = "force-dynamic";

export default async function AdminNegociosPage() {
  await requireSuperadmin();
  const [negocios, marcasRows] = await Promise.all([
    getAllNegociosAdmin(),
    withNeonRetry(() => db.select().from(negocioVariableEnvio)),
  ]);

  // Serializado plano para el client component (Date → ISO string).
  const marcas: Record<string, VariableMarca> = {};
  for (const m of marcasRows) {
    marcas[m.negocioId] = {
      enviado: m.enviado,
      periodo: m.periodo,
      marcadoAt: m.marcadoAt.toISOString(),
    };
  }

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

      <AdminNegociosTable rows={negocios} marcas={marcas} />
    </div>
  );
}
