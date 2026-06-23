import { AlertTriangle } from "lucide-react";
import { getAssetRows } from "@/lib/governance/merge";
import { formatDate, isStale } from "@/lib/governance/format";
import CatalogTable from "./_components/CatalogTable";
import StatCard from "./_components/StatCard";

// La frescura se consulta en vivo contra BigQuery en cada request.
export const dynamic = "force-dynamic";

export default async function GovernanceCatalogPage() {
  const { rows, catalog, freshnessAvailable } = await getAssetRows();

  const governed = rows.filter((r) => r.status === "governed").length;
  const unconsumed = rows.filter((r) => r.status === "governed_unconsumed").length;
  const legacy = rows.filter((r) => r.status === "legacy_ungoverned").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const stale = rows.filter((r) => isStale(r.freshness)).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-[#333333]">Catálogo de datos</h1>
        <p className="font-sans text-sm text-[#666666]">
          {rows.length} activos · {catalog.sources.length} fuentes
          {catalog.generatedAt && (
            <span className="text-[#999999]">
              {" "}
              · catálogo generado {formatDate(catalog.generatedAt)}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        <StatCard label="Gobernadas en uso" value={governed} accent="#7FB52B" />
        <StatCard
          label="Sin consumir"
          value={unconsumed}
          accent="#D9A400"
          hint="el switch pendiente"
        />
        <StatCard
          label="Legacy sin gobernar"
          value={legacy}
          accent="#ED75A0"
          hint="el riesgo"
        />
        <StatCard label="Pendientes" value={pending} accent="#999999" />
        <StatCard
          label="Desactualizadas"
          value={freshnessAvailable ? stale : "—"}
          accent="#EF8C34"
          hint={freshnessAvailable ? ">48h sin cargar" : "BQ no disponible"}
        />
      </div>

      {!freshnessAvailable && (
        <div className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 font-sans text-sm text-[#666666]">
          <AlertTriangle className="h-4 w-4 text-[#EF8C34]" />
          No se pudo consultar BigQuery — la columna de frescura aparece como
          desconocida. Verifica las credenciales (BIGQUERY_SERVICE_ACCOUNT) y los
          permisos de lectura del service account.
        </div>
      )}

      <CatalogTable rows={rows} />
    </div>
  );
}
