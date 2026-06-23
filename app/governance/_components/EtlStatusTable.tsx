"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { AssetRow } from "@/lib/governance/types";
import {
  ALL_AREAS,
  AREA_COLOR,
  AREA_LABEL,
  JOB_META,
  jobStatus,
} from "@/lib/governance/format";
import AreaChips from "./AreaChips";
import FreshnessCell from "./FreshnessCell";

function Bool({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-5 w-5 text-[#7FB52B]" aria-label="sí" />
  ) : (
    <XCircle className="h-5 w-5 text-[#ED75A0]" aria-label="no" />
  );
}

function JobCell({ row }: { row: AssetRow }) {
  const js = jobStatus(row.assetType, row.freshness);
  const m = JOB_META[js];
  if (js === "na") return <span className="font-sans text-sm text-[#999999]">—</span>;
  const color = m.tone === "ok" ? "#7FB52B" : "#ED75A0";
  return (
    <span
      className="inline-flex items-center gap-1.5 font-sans text-sm font-medium"
      style={{ color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {m.label}
    </span>
  );
}

export default function EtlStatusTable({ rows }: { rows: AssetRow[] }) {
  const [area, setArea] = useState<string>("all");

  const groups =
    area === "all"
      ? ALL_AREAS.map((a) => ({ area: a, list: rows.filter((r) => r.area === a) })).filter(
          (g) => g.list.length > 0,
        )
      : [{ area: area as (typeof ALL_AREAS)[number], list: rows.filter((r) => r.area === area) }];

  for (const g of groups) {
    g.list.sort(
      (a, b) =>
        Number(Boolean(b.pipeline)) - Number(Boolean(a.pipeline)) ||
        a.key.localeCompare(b.key, "es"),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AreaChips value={area} onChange={setArea} />

      {groups.map((g) => (
        <section key={g.area} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: AREA_COLOR[g.area] }} />
            <h2 className="font-display text-xl font-bold text-[#333333]">{AREA_LABEL[g.area]}</h2>
            <span className="font-sans text-sm text-[#999999]">{g.list.length} tablas</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
            <table className="min-w-full">
              <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <tr>
                  <th className="w-10 px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Endpoint
                  </th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Tabla cruda
                  </th>
                  <th className="px-4 py-3 text-center font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    En código
                  </th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    En prod (filas · últ. carga)
                  </th>
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Job diario
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((r, i) => (
                  <tr
                    key={r.key}
                    className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 font-sans text-sm text-[#999999] tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-[#333333]">
                        {r.endpointLabel ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-[#333333]">{r.key}</span>
                      {r.assetType === "view" && (
                        <span className="ml-1.5 font-sans text-xs text-[#999999]">(vista)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Bool ok={Boolean(r.pipeline)} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FreshnessCell freshness={r.freshness} assetType={r.assetType} />
                    </td>
                    <td className="px-4 py-3">
                      <JobCell row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
