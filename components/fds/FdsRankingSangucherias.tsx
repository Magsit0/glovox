"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { FdsRankingData, FdsStand } from "@/lib/fds/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  data: FdsRankingData;
}

const HISTORICO = "historico";

interface Row {
  stand: FdsStand;
  valor: number; // venta de la edición, o promedio por edición en modo histórico
  ordenes: number;
  total: number;
  n: number;
  delta: number | null | "nuevo"; // vs edición anterior (solo modo edición)
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export default function FdsRankingSangucherias({ data }: Props) {
  const { editions } = data;
  const [sel, setSel] = useState<string>(editions[editions.length - 1]?.eventoId ?? HISTORICO);
  const esHistorico = sel === HISTORICO;
  const idx = editions.findIndex((e) => e.eventoId === sel);
  const anterior = idx > 0 ? editions[idx - 1] : null;

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const stand of data.stands) {
      const ventas = Object.values(stand.porEdicion);
      const total = ventas.reduce((a, v) => a + v.venta, 0);
      if (esHistorico) {
        out.push({
          stand,
          valor: total / ventas.length,
          ordenes: ventas.reduce((a, v) => a + v.ordenes, 0),
          total,
          n: ventas.length,
          delta: null,
        });
        continue;
      }
      const actual = stand.porEdicion[sel];
      if (!actual) continue;
      const prev = anterior ? stand.porEdicion[anterior.eventoId] : undefined;
      out.push({
        stand,
        valor: actual.venta,
        ordenes: actual.ordenes,
        total,
        n: ventas.length,
        delta: !anterior ? null : prev ? actual.venta / prev.venta - 1 : "nuevo",
      });
    }
    return out.sort((a, b) => b.valor - a.valor);
  }, [data.stands, esHistorico, sel, anterior]);

  if (editions.length === 0) return null;

  const max = rows[0]?.valor ?? 0;
  const totalVista = rows.reduce((a, r) => a + r.valor, 0);
  const top5 = rows.slice(0, 5).reduce((a, r) => a + r.valor, 0);
  const totalEdicion = editions.find((e) => e.eventoId === sel)?.totalStands ?? 0;
  const ordenesVista = rows.reduce((a, r) => a + r.ordenes, 0);

  const opciones = [
    ...[...editions].reverse().map((e) => ({ key: e.eventoId, label: e.nombre })),
    { key: HISTORICO, label: `Histórico (${editions.length} ediciones)` },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight text-[var(--ink)]">
          Ranking de sangucherías
        </h2>
        <p className="font-sans text-sm text-[var(--ink-muted)]">
          Venta de cada stand de comida en Onfire, por edición. Incluye helados, jugos y postres; excluye
          las barras de tragos y cerveza.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs text-[var(--ink-muted)]">Ranking de:</span>
        <div className="inline-flex flex-wrap rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-0.5">
          {opciones.map((o) => {
            const active = sel === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setSel(o.key)}
                className={`rounded-md px-3 py-1.5 font-sans text-sm transition-colors ${
                  active
                    ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <span className="font-sans text-xs text-[var(--ink-subtle)]">
          {esHistorico
            ? `${rows.length} stands · ${rows.filter((r) => r.n > 1).length} participaron en 2 o más ediciones`
            : `${rows.length} stands · ${compactCurrency(totalEdicion)} venta de stands · top 5 = ${pct(
                totalVista > 0 ? top5 / totalVista : 0,
              )}${ordenesVista > 0 ? ` · ticket promedio ${formatCurrency(totalEdicion / ordenesVista)}` : ""}`}
        </span>
      </div>

      <article className="overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="text-left">
                <Th className="w-12 text-right">#</Th>
                <Th>Sanguchería</Th>
                <Th className="text-right">{esHistorico ? "Promedio por edición" : "Venta"}</Th>
                <Th className="text-right">{esHistorico ? "Total acumulado" : "% de stands"}</Th>
                {esHistorico ? (
                  <Th className="text-right">Ediciones</Th>
                ) : (
                  <>
                    <Th className="text-right">Órdenes</Th>
                    <Th className="text-right">Ticket prom.</Th>
                    {anterior && <Th className="text-right">vs {anterior.nombre}</Th>}
                  </>
                )}
                {editions.map((e) => (
                  <Th
                    key={e.eventoId}
                    className={`text-right ${e.eventoId === sel ? "text-[var(--ink)]" : ""}`}
                    title={`Puesto en ${e.nombre}`}
                  >
                    {e.nombre}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.stand.key}
                  className="border-b border-[var(--divider)] transition-colors duration-150 last:border-0 hover:bg-[var(--surface-alt)]"
                >
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-subtle)]">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink)]">{r.stand.nombre}</td>
                  <td className="px-4 py-3" title={formatCurrency(r.valor)}>
                    <div className="flex items-center justify-end gap-3">
                      <div className="hidden h-1.5 w-24 rounded-full bg-[var(--grid)] sm:block">
                        <div
                          className="h-1.5 rounded-full bg-[#9F99F8]"
                          style={{ width: `${max > 0 ? (r.valor / max) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap font-medium tabular-nums text-[var(--ink)]">
                        {compactCurrency(r.valor)}
                      </span>
                    </div>
                  </td>
                  {esHistorico ? (
                    <>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]"
                        title={formatCurrency(r.total)}
                      >
                        {compactCurrency(r.total)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">
                        {r.n} de {editions.length}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">
                        {pct(totalEdicion > 0 ? r.valor / totalEdicion : 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">
                        {formatNumber(r.ordenes)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">
                        {r.ordenes > 0 ? formatCurrency(r.valor / r.ordenes) : "—"}
                      </td>
                      {anterior && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Delta value={r.delta} />
                        </td>
                      )}
                    </>
                  )}
                  {editions.map((e) => {
                    const v = r.stand.porEdicion[e.eventoId];
                    return (
                      <td
                        key={e.eventoId}
                        className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                          e.eventoId === sel ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"
                        }`}
                        title={v ? `${formatCurrency(v.venta)} · ${formatNumber(v.ordenes)} órdenes` : undefined}
                      >
                        {v ? `#${v.rank}` : <span className="text-[var(--ink-subtle)]">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <div className="flex flex-col gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[var(--ink-muted)]" />
          <span className="font-sans text-xs font-medium uppercase tracking-wide text-[var(--ink-subtle)]">
            Notas del ranking
          </span>
        </div>
        <ul className="flex flex-col gap-1 font-sans text-xs text-[var(--ink-muted)]">
          <li>
            Venta = suma de <span className="text-[var(--ink)]">SubTotal</span> por punto de venta en{" "}
            <span className="text-[var(--ink)]">onfire.soldItems</span>. Las columnas por edición muestran el puesto
            del stand en esa edición (pasa el cursor para ver la venta).
          </li>
          <li>
            Un mismo stand se unifica entre ediciones por nombre (sin tildes ni mayúsculas) y por alias conocidos,
            como Bestias Burger → Bestias o Barra de Pickles / By María → By Maria.
          </li>
          <li>
            El histórico promedia solo las ediciones en que participó cada stand (ver columna Ediciones).
          </li>
          {data.excluidos.length > 0 && (
            <li>Fuera del ranking (barras y puntos internos): {data.excluidos.join(" · ")}.</li>
          )}
          <li>Solo aparecen las ediciones con venta registrada en Onfire.</li>
        </ul>
      </div>
    </section>
  );
}

function Th({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <th
      title={title}
      className={`sticky top-0 z-10 whitespace-nowrap border-b border-[var(--divider)] bg-[var(--surface-alt)] px-4 py-3 text-xs font-medium text-[var(--ink-muted)] ${className}`}
    >
      {children}
    </th>
  );
}

function Delta({ value }: { value: Row["delta"] }) {
  if (value === null) return <span className="text-[var(--ink-subtle)]">—</span>;
  if (value === "nuevo") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2.5 py-1 font-sans text-xs font-medium text-[var(--ink)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
        Nuevo
      </span>
    );
  }
  const sign = value > 0 ? "+" : "";
  return (
    <span
      className={`tabular-nums text-xs font-medium ${
        value >= 0 ? "text-[var(--green-ink)]" : "text-[#ED75A0]"
      }`}
    >
      {sign}
      {(value * 100).toFixed(0)}%
    </span>
  );
}
