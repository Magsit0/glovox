"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DisplayCurrency, EventoRow } from "@/lib/queries/paidMedia";
import {
  compactMoney,
  formatDate,
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
  | "fechaEvento"
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
  | "roas"
  | "presupuesto"
  | "ejecucion"
  | "ticketsVendidos"
  | "goalTickets";

type SortDir = "asc" | "desc";

const SORT_DEFAULT: Record<SortKey, SortDir> = {
  eventoId: "asc",
  nombre: "asc",
  fechaEvento: "desc",
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
  presupuesto: "desc",
  ejecucion: "desc",
  ticketsVendidos: "desc",
  goalTickets: "desc",
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 text-[var(--ink-subtle)]" aria-hidden="true">
        <path d="M4 4l2-2 2 2M4 8l2 2 2-2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-[var(--ink)]" aria-hidden="true">
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
  // Por defecto la tabla se lee cronologicamente, del evento mas reciente hacia
  // atras: es el orden con el que se revisa la operacion. Los 4 eventos sin
  // fecha caen al final, no arriba (ver el comparador).
  const [sortKey, setSortKey] = useState<SortKey>("fechaEvento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "eventoId":     av = a.eventoId.toLowerCase(); bv = b.eventoId.toLowerCase(); break;
        case "nombre":       av = a.nombre.toLowerCase();   bv = b.nombre.toLowerCase();   break;
        case "fechaEvento":
          av = a.fechaEvento ? Date.parse(a.fechaEvento) : NaN;
          bv = b.fechaEvento ? Date.parse(b.fechaEvento) : NaN;
          break;
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
        // Nullables: se ordenan aparte, abajo.
        case "presupuesto":  av = a.presupuesto ?? NaN; bv = b.presupuesto ?? NaN; break;
        case "ejecucion":    av = a.ejecucion   ?? NaN; bv = b.ejecucion   ?? NaN; break;
        case "ticketsVendidos": av = a.ticketsVendidos ?? NaN; bv = b.ticketsVendidos ?? NaN; break;
        case "goalTickets":  av = a.goalTickets ?? NaN; bv = b.goalTickets ?? NaN; break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      // Un evento sin dato cargado no compite con los que sí lo tienen: cae al
      // final en las dos direcciones, en vez de colarse arriba como un cero.
      const aVacio = Number.isNaN(an);
      const bVacio = Number.isNaN(bn);
      if (aVacio || bVacio) return aVacio && bVacio ? 0 : aVacio ? 1 : -1;
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
  // Solo tiene sentido mostrar el país por fila cuando la tabla mezcla varios
  // (la pill "Global"). Filtrando por un país sería repetir lo mismo 58 veces.
  const mezclaPaises = new Set(rows.map((r) => r.pais).filter(Boolean)).size > 1;
  // El % de ejecución solo existe donde hay presupuesto cargado. Decir cuántos
  // faltan evita que la columna se lea como "estos eventos no gastaron".
  const sinPresupuesto = rows.filter((r) => r.presupuesto == null).length;

  const cols: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "eventoId",     label: "EventoID",     align: "left" },
    { key: "nombre",       label: "Evento",       align: "left" },
    { key: "fechaEvento",  label: "Fecha",        align: "left" },
    { key: "gasto",        label: `Gasto ${moneda}`, align: "right" },
    { key: "presupuesto",  label: `Presup. ${moneda}`, align: "right" },
    { key: "ejecucion",    label: "% ejec.",      align: "right" },
    { key: "gastoMeta",    label: "Meta",         align: "right" },
    { key: "gastoGoogle",  label: "Google",       align: "right" },
    { key: "gastoTiktok",  label: "TikTok",       align: "right" },
    { key: "ticketsVendidos", label: "Tickets",   align: "right" },
    { key: "goalTickets",  label: "Objetivo",     align: "right" },
    { key: "impresiones",  label: "Impr.",        align: "right" },
    { key: "clics",        label: "Clics",        align: "right" },
    { key: "ctr",          label: "CTR",          align: "right" },
    { key: "cpc",          label: "CPC",          align: "right" },
    { key: "cpm",          label: "CPM",          align: "right" },
    { key: "conversiones", label: "Conv.",        align: "right" },
    { key: "roas",         label: "ROAS",         align: "right" },
  ];

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
      <header className="flex flex-col gap-1 px-6 pt-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">
          Resumen por evento
        </h2>
        <p className="font-sans text-sm text-[var(--ink-muted)]">
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
          {" "}
          Recinto, presupuesto y objetivo de tickets vienen del catálogo de
          eventos y se editan en{" "}
          <Link
            href="/admin/eventos"
            className="underline decoration-[var(--divider)] underline-offset-2 transition-colors hover:text-[#9F99F8] hover:decoration-[#9F99F8]"
          >
            /admin/eventos
          </Link>
          .
          {sinPresupuesto > 0 && (
            <>
              {" "}
              Hoy {sinPresupuesto} de {rows.length}{" "}
              {sinPresupuesto === 1 ? "evento no tiene" : "eventos no tienen"}{" "}
              presupuesto cargado, así que su % de ejecución queda en blanco.
            </>
          )}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="py-8 text-center font-sans text-sm text-[var(--ink-subtle)]">{emptyText}</p>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--divider)] bg-[var(--surface-alt)]">
                {cols.map((c) => {
                  const isActive = sortKey === c.key;
                  return (
                    <th
                      key={c.key}
                      className={`sticky top-0 z-10 bg-[var(--surface-alt)] px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)] ${
                        c.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-[var(--ink)] ${
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
                    className="border-b border-[var(--divider)] last:border-b-0 transition-colors hover:bg-[var(--surface-alt)]"
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="font-sans text-sm text-[var(--ink)]">
                        {r.eventoId}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className="block max-w-[280px] truncate font-sans text-sm text-[var(--ink)]"
                          title={r.nombre}
                        >
                          {r.nombre}
                        </span>
                        {/* Línea secundaria: recinto del catálogo y, si aplica,
                            la marca de evento multi-moneda —el caso que la
                            consolidación vino a resolver y que vale la pena
                            identificar de un vistazo—. Van juntas para no gastar
                            una fila extra por cada una. */}
                        {((mezclaPaises && r.pais) || r.venue || r.monedas.length > 1) && (
                          <span className="flex max-w-[280px] items-center gap-1.5 font-sans text-[10px] text-[var(--ink-muted)]">
                            {mezclaPaises && r.pais && (
                              <span className="flex-shrink-0 font-medium">{r.pais}</span>
                            )}
                            {mezclaPaises && r.pais && (r.venue || r.monedas.length > 1) && (
                              <span className="text-[var(--ink-subtle)]">·</span>
                            )}
                            {r.venue && (
                              <span className="truncate" title={r.venue}>
                                {r.venue}
                              </span>
                            )}
                            {r.venue && r.monedas.length > 1 && (
                              <span className="text-[var(--ink-subtle)]">·</span>
                            )}
                            {r.monedas.length > 1 && (
                              <span
                                className="flex-shrink-0"
                                title={`Inversión pagada en ${r.monedas.join(" y ")}`}
                              >
                                {r.monedas.join(" + ")}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-3 align-top font-sans text-sm text-[var(--ink)]"
                      title={
                        r.fechaEvento == null
                          ? "Sin fecha: el catálogo no la tiene y el evento no registra ventas de las que derivarla"
                          : r.fechaDerivada
                            ? "Fecha derivada de la última venta del evento — el catálogo no la tiene cargada"
                            : "Fecha del catálogo de eventos"
                      }
                    >
                      {r.fechaEvento ? formatDate(r.fechaEvento) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-sans text-sm text-[var(--ink)]">
                          {compactMoney(r.gasto)}
                        </span>
                        <span
                          className="h-1 w-24 overflow-hidden rounded-full bg-[var(--grid)]"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full bg-[#9F99F8]"
                            style={{ width: `${barPct}%` }}
                          />
                        </span>
                        <span className="font-sans text-[10px] text-[var(--ink-subtle)]">
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
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]"
                      title={
                        r.presupuesto != null
                          ? `${formatMoney(r.presupuesto, moneda)}${
                              moneda === "CLP"
                                ? " — el catálogo lo guarda en dólares; se convierte con la tasa efectiva de la inversión de este evento"
                                : ""
                            }`
                          : "Este evento no tiene presupuesto de paid media cargado en el catálogo"
                      }
                    >
                      {r.presupuesto != null ? compactMoney(r.presupuesto) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right align-top tabular-nums">
                      {r.ejecucion != null ? (
                        <span className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--ink)]">
                          {/* Punto de atención cuando se pasó del techo. Es el
                              caso frecuente: de los 26 eventos con presupuesto,
                              la mayoría lo supera. */}
                          {r.ejecucion > 1 && (
                            <span
                              className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#EF8C34]"
                              title="Sobre el presupuesto"
                              aria-label="Sobre el presupuesto"
                            />
                          )}
                          {formatRatio(r.ejecucion, 1)}
                        </span>
                      ) : (
                        <span className="font-sans text-sm text-[var(--ink)]">—</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]"
                      title={r.gastoMeta > 0 ? formatMoney(r.gastoMeta, moneda) : undefined}
                    >
                      {r.gastoMeta > 0 ? compactMoney(r.gastoMeta) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]"
                      title={r.gastoGoogle > 0 ? formatMoney(r.gastoGoogle, moneda) : undefined}
                    >
                      {r.gastoGoogle > 0 ? compactMoney(r.gastoGoogle) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]"
                      title={r.gastoTiktok > 0 ? formatMoney(r.gastoTiktok, moneda) : undefined}
                    >
                      {r.gastoTiktok > 0 ? compactMoney(r.gastoTiktok) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]"
                      title={
                        r.ticketsVendidos != null
                          ? `Tickets vendidos del evento completo, en personas. No se acota al rango de fechas del panel: ese rango filtra la inversión, y la meta es un total.${
                              r.goalTickets
                                ? ` Va en ${formatRatio(r.ticketsVendidos / r.goalTickets, 0)} de la meta.`
                                : ""
                            }`
                          : "Este EventoID no registra ventas en el ticketing"
                      }
                    >
                      {r.ticketsVendidos != null ? formatInt(r.ticketsVendidos) : "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]"
                      title={
                        r.goalTickets != null
                          ? "Meta de tickets del evento, en personas — la misma unidad que la columna Tickets. No es comparable 1:1 con las conversiones, que son compras reportadas por cada plataforma."
                          : "Este evento no tiene meta de tickets cargada en el catálogo"
                      }
                    >
                      {r.goalTickets != null ? formatInt(r.goalTickets) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
                      {formatInt(r.impresiones)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
                      {formatInt(r.clics)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
                      {formatRatio(r.ctr)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
                      {formatUnitCost(r.cpc, moneda)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
                      {formatUnitCost(r.cpm, moneda)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
                      {formatInt(r.conversiones)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[var(--ink)]">
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
