"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BreakdownRow } from "@/lib/queries/paidMedia";
import {
  compactMoney,
  formatInt,
  formatMoney,
  formatRatio,
  formatRoas,
  plataformaLabel,
} from "@/components/paid-media/format";

export interface BreakdownTableProps {
  title: string;
  subtitle: string;
  /** Encabezado de la primera columna (p. ej. "Cuenta"). */
  columnLabel: string;
  /** Encabezado de la segunda columna (p. ej. "Plataforma" o "Cuenta"). */
  extraLabel?: string;
  rows: BreakdownRow[];
  currency: string;
  /** Filtro al que apunta cada fila — convierte la primera columna en link. */
  drillParam?: "account" | "campaign" | "adset" | "plataforma" | "objective";
  /** searchParams base que cada link arrastra. */
  baseSearchParams?: Record<string, string | undefined>;
  /** Si el valor `extra` es una plataforma, lo formatea bonito. */
  extraIsPlataforma?: boolean;
  emptyText?: string;
}

type SortKey =
  | "label"
  | "gasto"
  | "impresiones"
  | "clics"
  | "conversiones"
  | "ctr"
  | "cpc"
  | "cpm"
  | "roas";

type SortDir = "asc" | "desc";

const SORT_DEFAULT: Record<SortKey, SortDir> = {
  label: "asc",
  gasto: "desc",
  impresiones: "desc",
  clics: "desc",
  conversiones: "desc",
  ctr: "desc",
  cpc: "asc",
  cpm: "asc",
  roas: "desc",
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
  columnLabel,
  extraLabel,
  rows,
  currency,
  drillParam,
  baseSearchParams,
  extraIsPlataforma = false,
  emptyText = "Sin datos para los filtros seleccionados.",
}: BreakdownTableProps) {
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
        case "gasto":          av = a.gasto;          bv = b.gasto;          break;
        case "impresiones":    av = a.impresiones;    bv = b.impresiones;    break;
        case "clics":          av = a.clics;          bv = b.clics;          break;
        case "conversiones":   av = a.conversiones;   bv = b.conversiones;   break;
        case "ctr":            av = a.ctr;            bv = b.ctr;            break;
        case "cpc":            av = a.cpc;            bv = b.cpc;            break;
        case "cpm":            av = a.cpm;            bv = b.cpm;            break;
        case "roas":           av = a.roas;           bv = b.roas;           break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
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

  function hrefFor(row: BreakdownRow): string | null {
    if (!drillParam) return null;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseSearchParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set(drillParam, row.key);
    return `/paid-media?${params.toString()}`;
  }

  // Cap visual: mostramos las primeras 50 filas — el query ya limita en 50.
  const maxBarGasto = sorted.reduce((m, r) => Math.max(m, r.gasto), 0);

  const cols: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "label",        label: columnLabel,    align: "left" },
    { key: "gasto",        label: "Gasto",        align: "right" },
    { key: "impresiones",  label: "Impr.",        align: "right" },
    { key: "clics",        label: "Clics",        align: "right" },
    { key: "ctr",          label: "CTR",          align: "right" },
    { key: "cpc",          label: "CPC",          align: "right" },
    { key: "cpm",          label: "CPM",          align: "right" },
    { key: "conversiones", label: "Conv.",        align: "right" },
    { key: "roas",         label: "ROAS",         align: "right" },
  ];

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white">
      <header className="flex flex-col gap-1 px-6 pt-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          {title}
        </h2>
        <p className="font-sans text-sm text-[#666666]">{subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {cols.map((c) => {
                  const isActive = sortKey === c.key;
                  return (
                    <th
                      key={c.key}
                      className={`px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666] ${
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
                const href = hrefFor(r);
                const barPct = maxBarGasto > 0 ? (r.gasto / maxBarGasto) * 100 : 0;
                return (
                  <tr
                    key={r.key}
                    className="border-b border-[#E5E5E5] last:border-b-0 transition-colors hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {href ? (
                          <Link
                            href={href}
                            className="truncate font-sans text-sm text-[#333333] hover:text-[#9F99F8]"
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
                        {r.extra && (
                          <span className="truncate font-sans text-xs text-[#999999]">
                            {extraIsPlataforma ? plataformaLabel(r.extra) : r.extra}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-sans text-sm text-[#333333]">
                          {compactMoney(r.gasto, currency)}
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
                        <span
                          className="font-sans text-[10px] text-[#999999]"
                          title={formatMoney(r.gasto, currency)}
                        >
                          {formatMoney(r.gasto, currency)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatInt(r.impresiones)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatInt(r.clics)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatRatio(r.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {r.cpc > 0 ? formatMoney(r.cpc, currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {r.cpm > 0 ? formatMoney(r.cpm, currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatInt(r.conversiones)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatRoas(r.roas)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {extraLabel && rows.length > 0 && (
        <p className="px-6 pb-4 font-sans text-xs text-[#999999]">
          {extraLabel}
        </p>
      )}
    </article>
  );
}
