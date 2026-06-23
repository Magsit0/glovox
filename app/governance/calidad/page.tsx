import { AlertTriangle } from "lucide-react";
import { getAssetRows } from "@/lib/governance/merge";
import { getColumns } from "@/lib/governance/columns";
import { computeQuality } from "@/lib/governance/quality";
import type { QualityResult } from "@/lib/governance/quality";
import QualityMatrix from "../_components/QualityMatrix";

export const dynamic = "force-dynamic";

export default async function GovernanceCalidadPage() {
  const [{ rows, freshnessAvailable }, columns] = await Promise.all([
    getAssetRows(),
    getColumns(),
  ]);

  const quality: Record<string, QualityResult> = {};
  for (const r of rows) {
    quality[r.key] = computeQuality(r, columns);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-[#333333]">Calidad de datos</h1>
        <p className="font-sans text-sm text-[#666666]">
          Score por tabla y área, con checks en vivo contra BigQuery (solo
          metadata, sin escanear datos): existencia, frescura, volumen y
          conformidad de schema vs el contrato versionado.
        </p>
      </div>

      {!freshnessAvailable && (
        <div className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 font-sans text-sm text-[#666666]">
          <AlertTriangle className="h-4 w-4 text-[#EF8C34]" />
          No se pudo consultar BigQuery — los scores aparecen como desconocidos
          (n/a) por indisponibilidad, no por mala calidad. Verifica las
          credenciales del service account.
        </div>
      )}

      <QualityMatrix rows={rows} quality={quality} />
    </div>
  );
}
