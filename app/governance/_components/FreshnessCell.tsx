import type { AssetType, Freshness } from "@/lib/governance/types";
import {
  formatDate,
  formatNumber,
  formatRelative,
  isStale,
} from "@/lib/governance/format";

/**
 * Celda de frescura. Distingue cuatro casos:
 *  - vista        → "En vivo" (no tiene almacenamiento propio)
 *  - desconocido  → "—" (BigQuery no respondió)
 *  - no existe    → rojo (BQ respondió y la tabla no estaba)
 *  - existe       → fecha de última carga + filas (ámbar si está desactualizada)
 */
export default function FreshnessCell({
  freshness,
  assetType,
}: {
  freshness: Freshness | null;
  assetType: AssetType;
}) {
  if (assetType === "view") {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-sm text-[#666666]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#87DACD]" />
        En vivo
      </span>
    );
  }

  if (!freshness) {
    return (
      <span className="font-sans text-sm text-[#999999]" title="BigQuery no disponible">
        —
      </span>
    );
  }

  if (!freshness.exists) {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-[#ED75A0]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ED75A0]" />
        No existe
      </span>
    );
  }

  const stale = isStale(freshness);
  return (
    <span className="flex flex-col leading-tight">
      <span
        className={`font-sans text-sm ${stale ? "font-medium text-[#EF8C34]" : "text-[#333333]"}`}
      >
        {formatDate(freshness.lastModified)}
      </span>
      <span className="font-sans text-xs text-[#999999]">
        {formatRelative(freshness.lastModified)}
        {freshness.rows != null ? ` · ${formatNumber(freshness.rows)} filas` : ""}
      </span>
    </span>
  );
}
