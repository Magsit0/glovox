/**
 * Carga el catálogo de gobernanza declarativo.
 *
 * El JSON lo genera `data-governance/scripts/build_catalog.py` y se versiona en
 * `data/governance-catalog.json`. Para regenerarlo tras editar el manifiesto:
 *   (en data-governance) uv run python scripts/build_catalog.py
 */
import catalogJson from "@/data/governance-catalog.json";
import type { Catalog } from "./types";

export function loadCatalog(): Catalog {
  return catalogJson as unknown as Catalog;
}
