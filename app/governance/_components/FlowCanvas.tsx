"use client";

import { useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { AssetRow, AssetStatus, CatalogSource } from "@/lib/governance/types";
import { STATUS_META } from "@/lib/governance/format";
import AreaChips from "./AreaChips";
import { buildGraph } from "./flow/buildGraph";
import {
  DatasetNode,
  EndpointNode,
  FuenteNode,
  MetricaNode,
  ProyectoNode,
  TablaNode,
} from "./flow/nodes";

const nodeTypes = {
  fuente: FuenteNode,
  endpoint: EndpointNode,
  proyecto: ProyectoNode,
  dataset: DatasetNode,
  tabla: TablaNode,
  metrica: MetricaNode,
};

export default function FlowCanvas({
  rows,
  projectId,
  sources = [],
}: {
  rows: AssetRow[];
  projectId: string;
  sources?: CatalogSource[];
}) {
  const [area, setArea] = useState<string>("marketing");
  const { nodes, edges } = useMemo(
    () => buildGraph(rows, area, projectId, sources),
    [rows, area, projectId, sources],
  );

  return (
    <div className="flex flex-col gap-4">
      <AreaChips value={area} onChange={setArea} />

      {/* Leyenda de estados */}
      <div className="flex flex-wrap items-center gap-4">
        {(Object.keys(STATUS_META) as AssetStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META[s].dot }} />
            {STATUS_META[s].label}
          </span>
        ))}
        <span className="font-sans text-xs text-[#999999]">
          · pasa el cursor sobre una tabla para ver sus campos
        </span>
      </div>

      {/* Canvas */}
      <div className="h-[80vh] w-full overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center font-sans text-sm text-[#999999]">
            No hay activos en esta área.
          </div>
        ) : (
          <ReactFlow
            key={area}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
            minZoom={0.2}
            maxZoom={3}
            nodesDraggable={false}
            nodesConnectable={false}
            // elementsSelectable debe quedar activo: si no, React Flow pone
            // pointer-events:none en los nodos y el hover de la tabla no dispara.
            elementsSelectable
            selectNodesOnDrag={false}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={22} color="#E5E5E5" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n: Node) => {
                const data = n.data as { color?: string };
                return data?.color ?? "#999999";
              }}
              maskColor="rgba(250,250,250,0.6)"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
