"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CsvButton from "@/components/proveedor/CsvButton";
import { formatCurrency, formatNumber } from "@/components/proveedor/format";

export type BreakdownRow = {
  key: string;
  label: string;
  sublabel?: string;
  gasto: number;
  docs: number;
  /** Texto de la columna extra (p. ej. "3 negocios" o "07 may 2026"). */
  meta?: string;
  /** Valor numérico de la columna extra para ordenar. */
  metaNumeric?: number;
};

interface Props {
  title: string;
  subtitle: string;
  firstColLabel: string;
  metaColLabel?: string;
  rows: BreakdownRow[];
  /** Si se define, la primera columna es link a /proveedor?<drillParam>=<key>. */
  drillParam?: string;
  baseSearchParams?: Record<string, string | undefined>;
  /**
   * Datos para el botón de descarga CSV. Se pasan como datos (no como elemento)
   * y el botón se renderiza acá adentro: pasar un elemento como prop desde un
   * Server Component cruza la frontera RSC y dispara warnings de keys.
   */
  csv?: {
    filename: string;
    headers: string[];
    rows: (string | number | null | undefined)[][];
    label?: string;
  };
  emptyText?: string;
}

type SortKey = "label" | "gasto" | "docs" | "meta";
type SortDir = "asc" | "desc";

const SORT_DEFAULT: Record<SortKey, SortDir> = {
  label: "asc",
  gasto: "desc",
  docs: "desc",
  meta: "desc",
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#999999]" aria-hidden="true">
        <path d="M4 4l2-2 2 2M4 8l2 2 2-2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#333333]" aria-hidden="true">
      {dir === "asc" ? (
        <path d="M3 8l3-4 3 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      ) : (
        <path d="M3 4l3 4 3-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      )}
    </svg>
  );
}

export default function BreakdownTable({
  title,
  subtitle,
  firstColLabel,
  metaColLabel,
  rows,
  drillParam,
  baseSearchParams,
  csv,
  emptyText = "Sin datos para los filtros seleccionados.",
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("gasto");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "label":
          av = a.label.toLowerCase();
          bv = b.label.toLowerCase();
          break;
        case "gasto":
          av = a.gasto;
          bv = b.gasto;
          break;
        case "docs":
          av = a.docs;
          bv = b.docs;
          break;
        case "meta":
          av = a.metaNumeric ?? a.meta ?? "";
          bv = b.metaNumeric ?? b.meta ?? "";
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv, "es") : bv.localeCompare(av, "es");
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(SORT_DEFAULT[k]);
    }
  }

  function hrefFor(key: string): string | null {
    if (!drillParam) return null;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseSearchParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set(drillParam, key);
    return `/proveedor?${params.toString()}`;
  }

  const maxGasto = sorted.reduce((m, r) => Math.max(m, r.gasto), 0);

  const cols: { key: SortKey; label: string; align: "left" | "right"; show: boolean }[] = [
    { key: "label", label: firstColLabel, align: "left", show: true },
    { key: "gasto", label: "Gasto", align: "right", show: true },
    { key: "docs", label: "Docs.", align: "right", show: true },
    { key: "meta", label: metaColLabel ?? "", align: "right", show: Boolean(metaColLabel) },
  ];

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white">
      <header className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            {title}
          </h2>
          <p className="font-sans text-sm text-[#666666]">{subtitle}</p>
        </div>
        {csv && (
          <CsvButton
            filename={csv.filename}
            headers={csv.headers}
            rows={csv.rows}
            label={csv.label}
          />
        )}
      </header>

      {rows.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">{emptyText}</p>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {cols
                  .filter((c) => c.show)
                  .map((c) => {
                    const isActive = sortKey === c.key;
                    return (
                      <th
                        key={c.key}
                        className={`sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666] ${
                          c.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSort(c.key)}
                          className={`inline-flex items-center gap-1 transition-colors hover:text-[#333333] ${
                            c.align === "right" ? "justify-end" : ""
                          }`}
                        >
                          {c.label}
                          <SortIcon active={isActive} dir={sortDir} />
                        </button>
                      </th>
                    );
                  })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const href = hrefFor(r.key);
                const barPct = maxGasto > 0 ? (r.gasto / maxGasto) * 100 : 0;
                return (
                  <tr
                    key={r.key}
                    className="border-b border-[#E5E5E5] transition-colors last:border-b-0 hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {href ? (
                          <Link
                            href={href}
                            className="truncate font-sans text-sm text-[#333333] transition-colors hover:text-[#9F99F8]"
                            title={r.label}
                          >
                            {r.label || r.key}
                          </Link>
                        ) : (
                          <span
                            className="truncate font-sans text-sm text-[#333333]"
                            title={r.label}
                          >
                            {r.label || r.key}
                          </span>
                        )}
                        {r.sublabel && (
                          <span className="truncate font-sans text-xs text-[#999999]">
                            {r.sublabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-sans text-sm text-[#333333]">
                          {formatCurrency(r.gasto)}
                        </span>
                        <span
                          className="h-1 w-24 overflow-hidden rounded-full bg-[#F0F0F0]"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full bg-[#9F99F8]"
                            style={{ width: `${barPct}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatNumber(r.docs)}
                    </td>
                    {metaColLabel && (
                      <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#666666]">
                        {r.meta ?? "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
