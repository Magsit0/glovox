"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { CategoriaBreakdown as Row } from "@/lib/unabase/cierreNegocio";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

interface Props {
  rows: Row[];
  // Mapa de categoría → items con OC. Lo calculamos en el server desde items+gastos.
  itemsConOcByCategoria: Record<string, number>;
}

type Filter = "all" | "over" | "under";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "over", label: "Con sobre-ejec." },
  { key: "under", label: "Sub-ejec." },
];

interface CardData extends Row {
  avance: number; // gastoReal / presupuesto (Infinity si presup=0 y gasto>0)
  itemsConOC: number;
  excedente: number; // gastoReal - presupuesto, sólo si > 0
}

function buildCards(rows: Row[], itemsConOcByCategoria: Record<string, number>): CardData[] {
  return rows.map((r) => {
    const avance =
      r.presupuesto > 0
        ? r.gastoReal / r.presupuesto
        : r.gastoReal > 0
        ? Infinity
        : 0;
    const excedente = Math.max(0, r.gastoReal - r.presupuesto);
    return {
      ...r,
      avance,
      excedente,
      itemsConOC: itemsConOcByCategoria[r.categoria] ?? 0,
    };
  });
}

function applyFilter(cards: CardData[], filter: Filter): CardData[] {
  if (filter === "all") return cards;
  if (filter === "over") return cards.filter((c) => c.avance > 1);
  // under: tiene presupuesto y todavía no se ejecutó por completo
  return cards.filter((c) => c.presupuesto > 0 && c.gastoReal <= c.presupuesto);
}

function pctLabel(avance: number): string {
  if (!Number.isFinite(avance)) return "S/Presup";
  return `${Math.round(avance * 100)}%`;
}

export default function CategoriaBreakdown({ rows, itemsConOcByCategoria }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const cards = useMemo(() => buildCards(rows, itemsConOcByCategoria), [rows, itemsConOcByCategoria]);
  const filtered = useMemo(() => applyFilter(cards, filter), [cards, filter]);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Avance por categoría
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Gasto real contra lo presupuestado en cada categoría.
          </p>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E5E5E5] p-0.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#F0EFFE] text-[#9F99F8]"
                    : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </header>

      {filtered.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          No hay categorías que cumplan el filtro.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CategoryCard key={c.categoria} data={c} />
          ))}
        </div>
      )}
    </article>
  );
}

function CategoryCard({ data }: { data: CardData }) {
  const { categoria, gastoReal, presupuesto, avance, excedente, itemsCount, itemsConOC } = data;
  const overrun = avance > 1;
  const empty = presupuesto === 0 && gastoReal === 0;

  // Track / fill colors
  const trackBg = "bg-[#F0F0F0]";
  const fillBg = overrun ? "bg-[#ED75A0]" : "bg-[#B1D750]";

  // Width: 0% si vacío; 100% si overrun; sino el avance
  const widthPct = empty
    ? 0
    : overrun
    ? 100
    : Math.min(100, Math.max(0, avance * 100));

  // Color del % a la derecha
  const pctColor = overrun ? "text-[#ED75A0]" : empty ? "text-[#999999]" : "text-[#333333]";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-sans text-sm font-medium uppercase tracking-wide text-[#333333]">
          {categoria}
        </h3>
        <span className={`font-sans text-sm font-semibold tabular-nums ${pctColor}`}>
          {pctLabel(avance)}
        </span>
      </div>

      <p className="font-sans text-xs tabular-nums text-[#666666]">
        <span className="text-[#333333]">{compactCurrency(gastoReal)}</span>
        <span className="text-[#999999]"> / {compactCurrency(presupuesto)}</span>
      </p>

      <div className={`relative mt-1 h-1.5 w-full rounded-full ${trackBg} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${fillBg}`}
          style={{ width: `${widthPct}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-sans text-xs text-[#666666] tabular-nums">
          {itemsConOC}/{itemsCount} items con OC
        </span>
        {overrun && excedente > 0 && (
          <span
            className="inline-flex items-center gap-1 font-sans text-xs font-medium text-[#ED75A0]"
            title="Excedente sobre presupuesto"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            +{formatCurrency(excedente)}
          </span>
        )}
      </div>
    </div>
  );
}
