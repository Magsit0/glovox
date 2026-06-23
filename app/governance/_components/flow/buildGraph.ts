/**
 * Construye los nodos y aristas de React Flow a partir de los activos del
 * catálogo, para una área dada. Función pura (sin React).
 *
 * Etapas (columnas, izquierda → derecha):
 *   Fuente (API) → Endpoint → Proyecto (BigQuery) → Dataset → Tabla → Métricas
 *
 * Los endpoints se agrupan: un mismo endpoint puede crear varias tablas
 * (ej. /documentos-venta crea la cabecera y el desagrupado). El proyecto es un
 * hub único. La posición vertical se alinea al promedio de las tablas.
 */
import { type Edge, type Node } from "@xyflow/react";
import type { Area, AssetRow, CatalogSource } from "@/lib/governance/types";
import { AREA_COLOR } from "@/lib/governance/format";

const X = {
  fuente: 0,
  endpoint: 250,
  proyecto: 640,
  dataset: 920,
  tabla: 1230,
  metrica: 1600,
} as const;

const GAP_Y = 150;

export interface FuenteData {
  label: string;
  area: Area;
  color: string;
  sourceType?: string;
}
export interface EndpointData {
  endpoint: string | null;
  tables: string[];
  color: string;
}
export interface ProyectoData {
  label: string;
}
export interface DatasetData {
  label: string;
  area: Area;
  color: string;
}
export interface TablaData {
  row: AssetRow;
  color: string;
}
export interface MetricaData {
  metrics: string[];
  consumers: string[];
  color: string;
}

function datasetOf(key: string): string {
  const i = key.indexOf(".");
  return i > 0 ? key.slice(0, i) : key;
}

function pushTo<T>(map: Map<string, T[]>, k: string, v: T) {
  const list = map.get(k);
  if (list) list.push(v);
  else map.set(k, [v]);
}

const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

function edge(source: string, target: string, color: string): Edge {
  return {
    id: `e:${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    animated: true,
    style: { stroke: color, strokeWidth: 2 },
  };
}

export function buildGraph(
  rows: AssetRow[],
  area: string,
  projectId: string,
  sources: CatalogSource[] = [],
): { nodes: Node[]; edges: Edge[] } {
  const sourceMeta = new Map(sources.map((s) => [s.id, s]));
  const items = area === "all" ? rows : rows.filter((r) => r.area === area);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (items.length === 0) return { nodes, edges };

  const sorted = [...items].sort(
    (a, b) =>
      datasetOf(a.key).localeCompare(datasetOf(b.key), "es") ||
      a.key.localeCompare(b.key, "es"),
  );
  const tableY = new Map<string, number>();
  sorted.forEach((r, i) => tableY.set(r.key, i * GAP_Y));

  const dsToTables = new Map<string, AssetRow[]>();
  const srcToTables = new Map<string, AssetRow[]>();
  for (const r of sorted) {
    pushTo(dsToTables, datasetOf(r.key), r);
    pushTo(srcToTables, r.source, r);
  }

  // Endpoints agrupados por (fuente + label). Un endpoint puede crear N tablas.
  type EpGroup = {
    endpoint: string | null;
    source: string;
    area: Area;
    tables: AssetRow[];
  };
  const epGroups = new Map<string, EpGroup>();
  for (const r of sorted) {
    const label = r.endpointLabel ?? r.endpoint ?? null;
    const gkey = `${r.source}::${label ?? "__none__"}`;
    const g = epGroups.get(gkey) ?? {
      endpoint: label,
      source: r.source,
      area: r.area,
      tables: [],
    };
    g.tables.push(r);
    epGroups.set(gkey, g);
  }

  // Tablas + métricas
  for (const r of sorted) {
    const color = AREA_COLOR[r.area];
    const y = tableY.get(r.key)!;
    nodes.push({
      id: `tbl:${r.key}`,
      type: "tabla",
      position: { x: X.tabla, y },
      zIndex: 10,
      data: { row: r, color } as unknown as Record<string, unknown>,
    });
    if (r.metrics.length > 0) {
      nodes.push({
        id: `met:${r.key}`,
        type: "metrica",
        position: { x: X.metrica, y },
        data: {
          metrics: r.metrics,
          consumers: r.consumers,
          color,
        } as unknown as Record<string, unknown>,
      });
      edges.push(edge(`tbl:${r.key}`, `met:${r.key}`, color));
    }
  }

  // Endpoints
  for (const [gkey, g] of epGroups) {
    const color = AREA_COLOR[g.area];
    const epId = `ep:${gkey}`;
    nodes.push({
      id: epId,
      type: "endpoint",
      position: { x: X.endpoint, y: avg(g.tables.map((t) => tableY.get(t.key)!)) },
      data: {
        endpoint: g.endpoint,
        tables: g.tables.map((t) => t.key),
        color,
      } as unknown as Record<string, unknown>,
    });
    edges.push(edge(`src:${g.source}`, epId, color));
    edges.push(edge(epId, "proj", color));
  }

  // Datasets
  for (const [d, tbls] of dsToTables) {
    const color = AREA_COLOR[tbls[0].area];
    nodes.push({
      id: `ds:${d}`,
      type: "dataset",
      position: { x: X.dataset, y: avg(tbls.map((t) => tableY.get(t.key)!)) },
      data: { label: d, area: tbls[0].area, color } as unknown as Record<string, unknown>,
    });
    for (const t of tbls) {
      edges.push(edge(`ds:${d}`, `tbl:${t.key}`, AREA_COLOR[t.area]));
    }
  }

  // Proyecto (hub central)
  nodes.push({
    id: "proj",
    type: "proyecto",
    position: { x: X.proyecto, y: avg([...tableY.values()]) },
    data: { label: projectId } as unknown as Record<string, unknown>,
  });
  for (const [d, tbls] of dsToTables) {
    edges.push(edge("proj", `ds:${d}`, AREA_COLOR[tbls[0].area]));
  }

  // Fuentes
  for (const [sid, tbls] of srcToTables) {
    const color = AREA_COLOR[tbls[0].area];
    const meta = sourceMeta.get(sid);
    nodes.push({
      id: `src:${sid}`,
      type: "fuente",
      position: { x: X.fuente, y: avg(tbls.map((t) => tableY.get(t.key)!)) },
      data: {
        label: meta?.label ?? sid,
        area: tbls[0].area,
        color,
        sourceType: meta?.type,
      } as unknown as Record<string, unknown>,
    });
  }

  return { nodes, edges };
}
