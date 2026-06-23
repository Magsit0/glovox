import { getAssetRows } from "@/lib/governance/merge";
import SourceCards from "../_components/SourceCards";

export const dynamic = "force-dynamic";

export default async function GovernanceFuentesPage() {
  const { rows, catalog } = await getAssetRows();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-[#333333]">Fuentes y conexiones</h1>
        <p className="font-sans text-sm text-[#666666]">
          Qué ofrece cada endpoint por área, las credenciales que espera y las
          tablas que produce.
        </p>
      </div>
      <SourceCards sources={catalog.sources} rows={rows} />
    </div>
  );
}
