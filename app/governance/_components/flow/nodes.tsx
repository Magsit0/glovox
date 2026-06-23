"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BarChart3, Database, Eye, Plug, Table2, Webhook } from "lucide-react";
import { STATUS_META } from "@/lib/governance/format";
import FreshnessCell from "../FreshnessCell";
import type {
  DatasetData,
  EndpointData,
  FuenteData,
  MetricaData,
  ProyectoData,
  TablaData,
} from "./buildGraph";

const handleStyle = { width: 8, height: 8, border: "none" };

export function FuenteNode({ data }: NodeProps) {
  const d = data as unknown as FuenteData;
  return (
    <div
      className="flex w-[210px] items-center gap-2 rounded-2xl border-2 bg-white px-3 py-2 shadow-sm"
      style={{ borderColor: d.color }}
    >
      <Plug className="h-4 w-4 shrink-0" style={{ color: d.color }} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-sm font-medium text-[#333333]" title={d.label}>
          {d.label}
        </div>
        {d.sourceType && (
          <div className="font-sans text-[10px] uppercase tracking-wide text-[#999999]">
            {d.sourceType}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: d.color }} />
    </div>
  );
}

export function EndpointNode({ data }: NodeProps) {
  const d = data as unknown as EndpointData;
  const label = d.endpoint || "— sin endpoint (derivada / legacy)";
  return (
    <div
      className="w-[280px] rounded-lg border bg-white px-3 py-2 shadow-sm"
      style={{ borderColor: d.color, borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: d.color }} />
      <div className="mb-1 flex items-center gap-1.5">
        <Webhook className="h-3.5 w-3.5 shrink-0" style={{ color: d.color }} />
        <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-[#999999]">
          Endpoint
        </span>
      </div>
      <p
        className="break-words font-mono text-xs leading-snug text-[#333333]"
        title={label}
      >
        {label}
      </p>
      <div className="mt-1.5 border-t border-[#F0F0F0] pt-1.5">
        <span className="font-sans text-[10px] uppercase tracking-wide text-[#BBBBBB]">
          crea
        </span>
        <div className="mt-0.5 flex flex-col gap-0.5">
          {d.tables.map((t) => (
            <span key={t} className="truncate font-sans text-xs text-[#666666]" title={t}>
              → {t}
            </span>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: d.color }} />
    </div>
  );
}

export function ProyectoNode({ data }: NodeProps) {
  const d = data as unknown as ProyectoData;
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border-2 border-[#333333] bg-[#333333] px-4 py-3 shadow-md">
      <Database className="h-5 w-5 text-white" />
      <span className="font-sans text-xs font-medium text-white/70">BigQuery</span>
      <span className="max-w-[150px] truncate font-sans text-sm font-semibold text-white">
        {d.label}
      </span>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: "#fff" }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: "#fff" }} />
    </div>
  );
}

export function DatasetNode({ data }: NodeProps) {
  const d = data as unknown as DatasetData;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm"
      style={{ borderColor: d.color, borderLeftWidth: 4 }}
    >
      <span className="font-sans text-sm font-medium text-[#333333]">{d.label}</span>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: d.color }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: d.color }} />
    </div>
  );
}

export function TablaNode({ data }: NodeProps) {
  const d = data as unknown as TablaData;
  const { row } = d;
  const [open, setOpen] = useState(false);
  const dot = STATUS_META[row.status].dot;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: dot }} />
      <div
        className="w-[230px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm transition-shadow hover:shadow-md"
        style={{ borderColor: dot }}
      >
        <div className="flex items-center gap-2">
          {row.assetType === "view" ? (
            <Eye className="h-4 w-4 shrink-0 text-[#999999]" />
          ) : (
            <Table2 className="h-4 w-4 shrink-0 text-[#999999]" />
          )}
          <span className="truncate font-sans text-sm font-medium text-[#333333]">
            {row.key}
          </span>
        </div>
        {row.endpoint && (
          <div
            className="mt-1 flex items-center gap-1 font-mono text-[10px] leading-tight text-[#999999]"
            title={row.endpoint}
          >
            <Plug className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{row.endpoint}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 font-sans text-xs"
            style={{ color: "#666666" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
            {STATUS_META[row.status].label}
          </span>
          <FreshnessCell freshness={row.freshness} assetType={row.assetType} />
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ ...handleStyle, background: dot }} />

      {/* Popover de campos + consumidores */}
      {open && (
        <div className="absolute left-[240px] top-0 z-50 w-[280px] rounded-lg border border-[#E5E5E5] bg-white p-3 shadow-md">
          <div className="mb-2 font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
            Campos {row.fields.length > 0 ? `(${row.fields.length})` : ""}
          </div>
          {row.fields.length === 0 ? (
            <p className="font-sans text-xs text-[#999999]">
              Sin schema versionado (tabla legacy).
            </p>
          ) : (
            <ul className="max-h-56 overflow-auto">
              {row.fields.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center justify-between gap-2 border-b border-[#F0F0F0] py-1 last:border-0"
                >
                  <span className="truncate font-sans text-xs text-[#333333]">{f.name}</span>
                  <span className="shrink-0 font-sans text-xs text-[#999999]">{f.type}</span>
                </li>
              ))}
            </ul>
          )}
          {row.consumers.length > 0 && (
            <div className="mt-2 border-t border-[#E5E5E5] pt-2">
              <div className="mb-1 font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                Consumidores
              </div>
              <div className="flex flex-wrap gap-1">
                {row.consumers.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-1.5 py-0.5 font-sans text-xs text-[#666666]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MetricaNode({ data }: NodeProps) {
  const d = data as unknown as MetricaData;
  return (
    <div
      className="w-[250px] rounded-lg border bg-white px-3 py-2 shadow-sm"
      style={{ borderColor: d.color, borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, background: d.color }} />
      <div className="mb-1.5 flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4" style={{ color: d.color }} />
        <span className="font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
          Métricas
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {d.metrics.map((m, i) => (
          <li key={i} className="font-sans text-xs leading-snug text-[#333333]">
            • {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
