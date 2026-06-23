"use client";

import { useState } from "react";
import type { AssetRow } from "@/lib/governance/types";
import { ALL_AREAS, AREA_COLOR, AREA_LABEL } from "@/lib/governance/format";
import {
  CHECK_META,
  DIMENSIONS,
  LEVEL_META,
  type CheckStatus,
  type DimensionKey,
  type QualityResult,
} from "@/lib/governance/quality";
import AreaChips from "./AreaChips";
import StatCard from "./StatCard";

function Dot({
  status,
  detail,
  dimension,
}: {
  status: CheckStatus;
  detail?: string;
  dimension: string;
}) {
  return (
    <span
      title={`${dimension}: ${detail ?? CHECK_META[status].label}`}
      className="inline-block h-3 w-3 rounded-full"
      style={{ backgroundColor: CHECK_META[status].color }}
    />
  );
}

export default function QualityMatrix({
  rows,
  quality,
}: {
  rows: AssetRow[];
  quality: Record<string, QualityResult>;
}) {
  const [area, setArea] = useState<string>("all");

  const visible = (area === "all" ? rows : rows.filter((r) => r.area === area)).filter(
    (r) => quality[r.key],
  );

  const scored = visible.map((r) => quality[r.key]).filter((q) => q.score != null);
  const avg =
    scored.length > 0
      ? Math.round(scored.reduce((s, q) => s + (q.score ?? 0), 0) / scored.length)
      : null;
  const nOk = visible.filter((r) => quality[r.key].level === "ok").length;
  const nWarn = visible.filter((r) => quality[r.key].level === "warn").length;
  const nBad = visible.filter((r) => quality[r.key].level === "bad").length;

  const groups =
    area === "all"
      ? ALL_AREAS.map((a) => ({ area: a, list: visible.filter((r) => r.area === a) })).filter(
          (g) => g.list.length > 0,
        )
      : [{ area: area as (typeof ALL_AREAS)[number], list: visible }];

  for (const g of groups) {
    g.list.sort((a, b) => (quality[a.key].score ?? 999) - (quality[b.key].score ?? 999));
  }

  return (
    <div className="flex flex-col gap-6">
      <AreaChips value={area} onChange={setArea} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <StatCard
          label="Score promedio"
          value={avg == null ? "—" : `${avg}`}
          accent={avg == null ? undefined : LEVEL_META[avg >= 85 ? "ok" : avg >= 50 ? "warn" : "bad"].color}
          hint="sobre 100"
        />
        <StatCard label="Tablas OK" value={nOk} accent="#7FB52B" hint="score ≥ 85" />
        <StatCard label="Con alertas" value={nWarn} accent="#EF8C34" />
        <StatCard label="Críticas" value={nBad} accent="#ED75A0" hint="score < 50" />
      </div>

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
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Tabla
                  </th>
                  {DIMENSIONS.map((d) => (
                    <th
                      key={d.key}
                      title={d.help}
                      className="px-3 py-3 text-center font-sans text-xs font-medium uppercase tracking-wide text-[#666666]"
                    >
                      {d.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((r) => {
                  const q = quality[r.key];
                  return (
                    <tr
                      key={r.key}
                      className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 hover:bg-[#FAFAFA]"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-[#333333]">{r.key}</span>
                        {r.assetType === "view" && (
                          <span className="ml-1.5 font-sans text-xs text-[#999999]">(vista)</span>
                        )}
                      </td>
                      {DIMENSIONS.map((d) => (
                        <td key={d.key} className="px-3 py-3 text-center">
                          <Dot
                            status={q.checks[d.key as DimensionKey].status}
                            detail={q.checks[d.key as DimensionKey].detail}
                            dimension={d.label}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {q.score == null ? (
                            <span className="font-sans text-sm text-[#999999]">—</span>
                          ) : (
                            <>
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#F0F0F0]">
                                <div
                                  className="h-full"
                                  style={{ width: `${q.score}%`, backgroundColor: LEVEL_META[q.level].color }}
                                />
                              </div>
                              <span className="min-w-[26px] text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                                {q.score}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 font-sans text-xs text-[#666666]">
        {(["ok", "warn", "fail", "na"] as CheckStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHECK_META[s].color }} />
            {CHECK_META[s].label}
          </span>
        ))}
        <span className="text-[#999999]">
          · pasa el cursor sobre un punto para ver el detalle · completitud, unicidad y validez llegan
          en v2 (checks programados)
        </span>
      </div>
    </div>
  );
}
