"use client";

import { X } from "lucide-react";

/**
 * Aviso de filtros que chocan entre sí (lib/filters/facetas.ts › `enConflicto`).
 *
 * Los filtros no se modifican unos a otros: si una combinación no deja ningún
 * resultado, la selección se conserva y este aviso dice cuáles chocan y ofrece
 * limpiar cada uno. No renderiza nada cuando no hay conflicto.
 */
export default function FilterConflictNotice({
  conflicts,
  onClear,
}: {
  conflicts: { key: string; label: string }[];
  onClear: (key: string) => void;
}) {
  if (conflicts.length === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2"
    >
      <span className="inline-flex items-center gap-2 font-sans text-sm text-[var(--ink)]">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF8C34]" />
        Ningún resultado: estos filtros no calzan entre sí.
      </span>
      {conflicts.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onClear(c.key)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar {c.label}
        </button>
      ))}
    </div>
  );
}
