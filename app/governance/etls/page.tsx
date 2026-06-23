import { getAssetRows } from "@/lib/governance/merge";
import EtlStatusTable from "../_components/EtlStatusTable";

export const dynamic = "force-dynamic";

export default async function GovernanceEtlsPage() {
  const { rows } = await getAssetRows();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-[#333333]">Estado de los ETLs</h1>
        <p className="font-sans text-sm text-[#666666]">
          Por endpoint y área: qué tabla crea, si existe el código, si existe en
          producción y si el job diario está corriendo. El estado del job se
          deriva en vivo de la frescura (cargó hoy → corre; datos viejos →
          detenido; no existe → nunca corrió).
        </p>
      </div>
      <EtlStatusTable rows={rows} />
    </div>
  );
}
