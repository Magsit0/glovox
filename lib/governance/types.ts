/**
 * Tipos del módulo de gobierno de datos (`/governance`).
 *
 * El catálogo declarativo vive en `data/governance-catalog.json`, generado por
 * `data-governance/scripts/build_catalog.py` desde `catalog/manifest.yaml` +
 * los schemas reales. La frescura se resuelve en vivo contra BigQuery.
 */

export type Area =
  | "marketing"
  | "finanzas"
  | "tickets"
  | "comunidad"
  | "ffbb"
  | "email";

/**
 *  governed            pipeline versionado + tabla destino, EN USO por ≥1 dashboard.
 *  governed_unconsumed pipeline versionado pero ningún dashboard la consume (el "switch").
 *  legacy_ungoverned   consumida por dashboards pero SIN productor versionado (el riesgo).
 *  pending             fuente identificada, sin pipeline aún.
 */
export type AssetStatus =
  | "governed"
  | "governed_unconsumed"
  | "legacy_ungoverned"
  | "pending";

export type AssetType = "table" | "view";

export interface SchemaField {
  name: string;
  type: string;
  mode?: string | null;
  description?: string;
}

export interface CatalogAsset {
  /** FQN de la tabla/vista, ej. "metricool.followers_daily". */
  key: string;
  area: Area;
  /** id de la fuente lógica (cruza con CatalogSource.id). */
  source: string;
  endpoint?: string | null;
  /** etiqueta corta del endpoint (ej. "GET /negocios"); fallback a endpoint. */
  endpointLabel?: string | null;
  /** ruta del pipeline/DDL en data-governance, o null si es legacy. */
  pipeline?: string | null;
  /** nombre base del schema JSON, o null. */
  schema?: string | null;
  assetType: AssetType;
  status: AssetStatus;
  loadPattern?: string;
  frequency?: string;
  owner?: string | null;
  /** tabla legacy que reemplaza, si aplica. */
  replaces?: string | null;
  /** FQNs de tablas de entrada (aristas de linaje aguas arriba). */
  upstream: string[];
  /** rutas de dashboards (o consumidores) que la leen. */
  consumers: string[];
  notes?: string;
  fields: SchemaField[];
  /** métricas principales que se extraen de la tabla (sola o acompañada). */
  metrics: string[];
}

export interface CatalogSource {
  id: string;
  label: string;
  type: string;
  area: Area;
  endpoints: string[];
  envVars: string[];
  notes?: string;
}

export interface Catalog {
  generatedAt: string | null;
  sources: CatalogSource[];
  assets: CatalogAsset[];
}

/** Realidad viva de una tabla en BigQuery. */
export interface Freshness {
  exists: boolean;
  rows: number | null;
  /** ISO timestamp de la última modificación de almacenamiento, o null. */
  lastModified: string | null;
}

/** Mapa por FQN "dataset.table" → frescura. */
export type FreshnessMap = Record<string, Freshness>;

/** Fila lista para la UI: activo del manifiesto + su realidad en BQ. */
export interface AssetRow extends CatalogAsset {
  freshness: Freshness | null;
}
