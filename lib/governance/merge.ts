/**
 * Une el catálogo declarativo con la frescura viva de BigQuery → filas para la UI.
 *
 * (En v2, también mezclará el estado editable de la tabla Neon
 * `governance_asset_state`: status override, owner, notas, tags.)
 */
import { loadCatalog } from "./catalog";
import { getFreshness } from "./freshness";
import type { AssetRow, Catalog } from "./types";

export interface AssetRowsResult {
  rows: AssetRow[];
  catalog: Catalog;
  /** true si BigQuery respondió en ≥1 dataset. Si es false, la frescura es desconocida. */
  freshnessAvailable: boolean;
}

function datasetOf(key: string): string {
  const dot = key.indexOf(".");
  return dot > 0 ? key.slice(0, dot) : key;
}

export async function getAssetRows(): Promise<AssetRowsResult> {
  const catalog = loadCatalog();
  const { map, datasetsOk } = await getFreshness();
  const freshnessAvailable = datasetsOk.size > 0;

  const rows: AssetRow[] = catalog.assets.map((a) => {
    const hit = map[a.key];
    let freshness: AssetRow["freshness"];
    if (hit) {
      freshness = hit;
    } else if (a.assetType === "table" && datasetsOk.has(datasetOf(a.key))) {
      // Pudimos consultar el dataset y la tabla no estaba → no existe.
      freshness = { exists: false, rows: null, lastModified: null };
    } else {
      // Dataset no consultable o vista → desconocido.
      freshness = null;
    }
    return { ...a, freshness };
  });

  return { rows, catalog, freshnessAvailable };
}
