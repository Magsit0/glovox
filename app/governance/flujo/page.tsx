import { getAssetRows } from "@/lib/governance/merge";
import FlowCanvas from "../_components/FlowCanvas";

export const dynamic = "force-dynamic";

const PROJECT = process.env.BIGQUERY_PROJECT_ID ?? "root-emissary-313321";

export default async function GovernanceFlujoPage() {
  const { rows, catalog } = await getAssetRows();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-[#333333]">Flujo de datos</h1>
        <p className="font-sans text-sm text-[#666666]">
          Cómo fluye el dato por área, desde la fuente hasta las métricas:
          fuente → endpoint → BigQuery → dataset → tabla → métricas. Cada endpoint
          muestra qué tabla crea; el borde de cada tabla marca su estado de gobernanza.
        </p>
      </div>
      <FlowCanvas rows={rows} projectId={PROJECT} sources={catalog.sources} />
    </div>
  );
}
