"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Search, Table2 } from "lucide-react";
import type { AssetRow, AssetStatus } from "@/lib/governance/types";
import {
  ALL_AREAS,
  ALL_STATUSES,
  AREA_LABEL,
  STATUS_META,
} from "@/lib/governance/format";
import StatusBadge from "./StatusBadge";
import FreshnessCell from "./FreshnessCell";

type SortKey = "key" | "area" | "source" | "status" | "rows" | "consumers";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<AssetStatus, number> = {
  legacy_ungoverned: 0,
  pending: 1,
  governed_unconsumed: 2,
  governed: 3,
};

function sortValue(row: AssetRow, key: SortKey): string | number {
  switch (key) {
    case "key":
      return row.key;
    case "area":
      return row.area;
    case "source":
      return row.source;
    case "status":
      return STATUS_ORDER[row.status];
    case "rows":
      return row.freshness?.rows ?? -1;
    case "consumers":
      return row.consumers.length;
  }
}

const selectClass =
  "rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] transition-colors";

export default function CatalogTable({ rows }: { rows: AssetRow[] }) {
  const [area, setArea] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (area !== "all" && r.area !== area) return false;
      if (status !== "all" && r.status !== status) return false;
      if (needle) {
        const hay = `${r.key} ${r.source} ${r.endpoint ?? ""} ${r.consumers.join(" ")} ${r.owner ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, area, status, q, sortKey, sortDir]);

  const header = (label: string, key: SortKey, align: "left" | "right" = "left") => {
    const active = sortKey === key;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        onClick={() => toggleSort(key)}
        className={`cursor-pointer select-none px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666] hover:text-[#333333] ${align === "right" ? "text-right" : "text-left"}`}
      >
        <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
          {label}
          <Icon className="h-3 w-3 text-[#999999]" />
        </span>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tabla, fuente, consumidor…"
            className="w-72 rounded-lg border border-[#E5E5E5] bg-white py-2 pl-9 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          />
        </div>

        <select value={area} onChange={(e) => setArea(e.target.value)} className={selectClass}>
          <option value="all">Todas las áreas</option>
          {ALL_AREAS.map((a) => (
            <option key={a} value={a}>
              {AREA_LABEL[a]}
            </option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="all">Todos los estados</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>

        <span className="ml-auto font-sans text-sm text-[#666666]">
          {filtered.length} de {rows.length} activos
        </span>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
        <table className="min-w-full">
          <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <tr>
              {header("Activo", "key")}
              {header("Área", "area")}
              {header("Fuente", "source")}
              {header("Estado", "status")}
              <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                Frescura BQ
              </th>
              {header("Consumidores", "consumers", "right")}
              <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                Owner
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center font-sans text-sm text-[#999999]">
                  No hay activos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.key}
                  className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 hover:bg-[#FAFAFA]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.assetType === "view" ? (
                        <Eye className="h-4 w-4 shrink-0 text-[#999999]" />
                      ) : (
                        <Table2 className="h-4 w-4 shrink-0 text-[#999999]" />
                      )}
                      <div className="flex flex-col leading-tight">
                        <span className="font-sans text-sm font-medium text-[#333333]">{r.key}</span>
                        {r.replaces && (
                          <span className="font-sans text-xs text-[#999999]">reemplaza a {r.replaces}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-sans text-sm text-[#666666]">{AREA_LABEL[r.area]}</td>
                  <td className="px-4 py-3 font-sans text-sm text-[#666666]">{r.source}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <FreshnessCell freshness={r.freshness} assetType={r.assetType} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.consumers.length === 0 ? (
                      <span className="font-sans text-sm text-[#999999]">—</span>
                    ) : (
                      <span
                        title={r.consumers.join(", ")}
                        className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-xs font-medium text-[#333333] tabular-nums"
                      >
                        {r.consumers.length}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-sans text-sm text-[#666666]">{r.owner ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
