"use client";

import { useMemo, useState } from "react";
import type { DisplayCurrency, EventoRow } from "@/lib/queries/paidMedia";
import {
  compactMoney,
  formatInt,
  formatRatio,
  formatRoas,
  formatUnitCost,
  formatMoney,
} from "@/components/paid-media/format";

interface Props {
  rows: EventoRow[];
  /** Moneda en que se expresan los montos. */
  moneda: DisplayCurrency;
  emptyText?: string;
}

type SortKey =
  | "eventoId"
  | "nombre"
  | "gasto"
  | "gastoMeta"
  | "gastoGoogle"
  | "gastoTiktok"
  | "impresiones"
  | "clics"
  | "ctr"
  | "cpc"
  | "cpm"
  | "conversiones"
  | "roas";

type SortDir = "asc" | "desc";

const SORT_DEFAULT: Record<SortKey, SortDir> = {
  eventoId: "asc",
  nombre: "asc",
  gasto: "desc",
  gastoMeta: "desc",
  gastoGoogle: "desc",
  gastoTiktok: "desc",
  impresiones: "desc",
  clics: "desc",
  ctr: "desc",
  cpc: "asc",
  cpm: "asc",
  conversiones: "desc",
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

export default function OverallTable({
  rows,
  moneda,
  emptyText = "Sin datos en este scope.",
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("gasto");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "eventoId":     av = a.eventoId.toLowerCase(); bv = b.eventoId.toLowerCase(); break;
        case "nombre":       av = a.nombre.toLowerCase();   bv = b.nombre.toLowerCase();   break;
        case "gasto":        av = a.gasto;        bv = b.gasto;        break;
        case "gastoMeta":    av = a.gastoMeta;    bv = b.gastoMeta;    break;
        case "gastoGoogle":  av = a.gastoGoogle;  bv = b.gastoGoogle;  break;
        case "gastoTiktok":  av = a.gastoTiktok;  bv = b.gastoTiktok;  break;
        case "impresiones":  av = a.impresiones;  bv = b.impresiones;  break;
        case "clics":        av = a.clics;        bv = b.clics;        break;
        case "ctr":          av = a.ctr;          bv = b.ctr;          break;
        case "cpc":          av = a.cpc;          bv = b.cpc;          break;
        case "cpm":          av = a.cpm;          bv = b.cpm;          break;
        case "conversiones": av = a.conversiones; bv = b.conversiones; break;
        case "roas":         av = a.roas;         bv = b.roas;         break;
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

  const maxBarGasto = sorted.reduce((m, r) => Math.max(m, r.gasto), 0);
  const multiMoneda = rows.filter((r) => r.monedas.length > 1).length;

  const cols: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "eventoId",     label: "EventoID",     align: "left" },
    { key: "nombre",       label: "Evento",       align: "left" },
    { key: "gasto",        label: `Gasto ${moneda}`, align: "right" },
    { key: "gastoMeta",    label: "Meta",         align: "right" },
    { key: "gastoGoogle",  label: "Google",       align: "right" },
    { key: "gastoTiktok",  label: "TikTok",       align: "right" },
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
          Resumen por evento
        </h2>
        <p className="font-sans text-sm text-[#666666]">
          Una fila por evento, con el gasto consolidado y su
          rendimiento de paid media. El evento sale del EventoID de la campaña y,
          si viene vacío, de los primeros 6 caracteres del nombre de campaña.
          {multiMoneda > 0 && (
            <>
              {" "}
              {multiMoneda === 1
                ? "Un evento suma"
                : `${multiMoneda} eventos suman`}{" "}
              inversión hecha en más de una moneda — antes solo se veía la mitad
              en cada vista.
            </>
          )}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[#999999]">{emptyText}</p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {cols.map((c) => {
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
                const barPct = maxBarGasto > 0 ? (r.gasto / maxBarGasto) * 100 : 0;
                return (
                  <tr
                    key={`${r.eventoId}-${r.nombre}`}
                    className="border-b border-[#E5E5E5] last:border-b-0 transition-colors hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="font-sans text-sm text-[#333333]">
                        {r.eventoId}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className="block max-w-[280px] truncate font-sans text-sm text-[#333333]"
                          title={r.nombre}
                        >
                          {r.nombre}
                        </span>
                        {/* Marca de evento multi-moneda: es exactamente el caso
                            que la consolidación vino a resolver, así que vale la
                            pena poder identificarlo de un vistazo. */}
                        {r.monedas.length > 1 && (
                          <span
                            className="font-sans text-[10px] text-[#666666]"
                            title={`Inversión pagada en ${r.monedas.join(" y ")}`}
                          >
                            {r.monedas.join(" + ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-sans text-sm text-[#333333]">
                          {compactMoney(r.gasto)}
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
                        <span className="font-sans text-[10px] text-[#999999]">
                          {formatMoney(r.gasto, moneda)}
                        </span>
                        {r.filasSinFx > 0 && (
                          <span
                            className="font-sans text-[10px] text-[#EF8C34]"
                            title="Hay gasto de este evento sin tipo de cambio publicado; no está incluido en el monto."
                          >
                            sin FX
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]"
                      title={r.gastoMeta > 0 ? formatMoney(r.gastoMeta, moneda) : undefined}
                    >
                      {r.gastoMeta > 0 ? compactMoney(r.gastoMeta) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]"
                      title={r.gastoGoogle > 0 ? formatMoney(r.gastoGoogle, moneda) : undefined}
                    >
                      {r.gastoGoogle > 0 ? compactMoney(r.gastoGoogle) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]"
                      title={r.gastoTiktok > 0 ? formatMoney(r.gastoTiktok, moneda) : undefined}
                    >
                      {r.gastoTiktok > 0 ? compactMoney(r.gastoTiktok) : "—"}
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
                      {formatUnitCost(r.cpc, moneda)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                      {formatUnitCost(r.cpm, moneda)}
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
    </article>
  );
}
