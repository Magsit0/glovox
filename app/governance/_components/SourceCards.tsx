import { Plug, KeyRound } from "lucide-react";
import type { AssetRow, CatalogSource } from "@/lib/governance/types";
import { AREA_LABEL, formatDate } from "@/lib/governance/format";
import StatusBadge from "./StatusBadge";

function freshnessLabel(row: AssetRow): string {
  if (row.assetType === "view") return "vista en vivo";
  if (!row.freshness) return "frescura desconocida";
  if (!row.freshness.exists) return "no existe en BQ";
  return `cargada ${formatDate(row.freshness.lastModified)}`;
}

export default function SourceCards({
  sources,
  rows,
}: {
  sources: CatalogSource[];
  rows: AssetRow[];
}) {
  const bySource = new Map<string, AssetRow[]>();
  for (const r of rows) {
    const list = bySource.get(r.source) ?? [];
    list.push(r);
    bySource.set(r.source, list);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {sources.map((s) => {
        const produced = bySource.get(s.id) ?? [];
        return (
          <article
            key={s.id}
            className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <header className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <h3 className="font-display text-lg font-bold text-[#333333]">{s.label}</h3>
                <span className="font-sans text-xs text-[#999999]">{AREA_LABEL[s.area]}</span>
              </div>
              <span className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-2.5 py-1 font-sans text-xs font-medium text-[#666666]">
                {s.type}
              </span>
            </header>

            {/* Endpoints */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                <Plug className="h-3.5 w-3.5" /> Endpoints
              </div>
              <ul className="flex flex-col gap-1">
                {s.endpoints.map((e, i) => (
                  <li key={i} className="font-sans text-sm text-[#666666]">
                    {e}
                  </li>
                ))}
              </ul>
            </div>

            {/* Credenciales esperadas */}
            {s.envVars.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                  <KeyRound className="h-3.5 w-3.5" /> Variables esperadas
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.envVars.map((v) => (
                    <span
                      key={v}
                      className="rounded border border-[#E5E5E5] bg-[#FAFAFA] px-1.5 py-0.5 font-sans text-xs text-[#666666]"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {s.notes && (
              <p className="font-sans text-xs text-[#999999]">{s.notes}</p>
            )}

            {/* Tablas que produce */}
            <div className="mt-auto flex flex-col gap-2 border-t border-[#E5E5E5] pt-4">
              <div className="font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                Produce {produced.length > 0 ? `(${produced.length})` : ""}
              </div>
              {produced.length === 0 ? (
                <span className="font-sans text-sm text-[#999999]">Sin tablas en el catálogo.</span>
              ) : (
                <ul className="flex flex-col gap-2">
                  {produced.map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-sans text-sm text-[#333333]">{r.key}</span>
                        <span className="font-sans text-xs text-[#999999]">{freshnessLabel(r)}</span>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
