"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import type { CategoriaBreakdownRow } from "@/lib/queries/interno";
import { compactCurrency } from "@/components/proveedor/format";

interface Props {
  options: CategoriaBreakdownRow[];
  /** Categoría seleccionada ("" = todas). */
  value: string;
  /** null = "Todas las categorías". */
  onSelect: (categoria: string | null) => void;
}

/**
 * Combobox de categoría oficial: un solo control con búsqueda en vivo y lista
 * filtrada (mismo patrón que ProveedorCombobox de /proveedor, con menos
 * opciones: las ~17 categorías oficiales + SIN CLASIFICAR).
 */
export default function CategoriaCombobox({ options, value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.categoria.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function pick(categoria: string | null) {
    onSelect(categoria);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-56 items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value || "Todas las categorías"}</span>
        <svg viewBox="0 0 12 12" className="h-3 w-3 flex-shrink-0 text-[#999999]" aria-hidden="true">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-lg border border-[#E5E5E5] bg-white py-1 shadow-md">
          <div className="relative mx-2 my-1 flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-[#999999]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar categoría…"
              className="w-full rounded-lg border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              aria-label="Buscar categoría"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-auto">
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left font-sans text-sm transition-colors hover:bg-[#FAFAFA] ${
                  !value ? "bg-[#F0EFFE] font-medium text-[#9F99F8]" : "text-[#333333]"
                }`}
              >
                Todas las categorías
                {!value && <Check className="h-4 w-4 text-[#9F99F8]" />}
              </button>
            </li>
            {filtered.map((o) => {
              const isActive = value === o.categoria;
              return (
                <li key={o.categoria}>
                  <button
                    type="button"
                    onClick={() => pick(o.categoria)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-sans text-sm transition-colors hover:bg-[#FAFAFA] ${
                      isActive
                        ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                        : "text-[#333333]"
                    }`}
                  >
                    <span className="truncate">{o.categoria}</span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="font-sans text-xs tabular-nums text-[#999999]">
                        {compactCurrency(o.gasto)}
                      </span>
                      {isActive && <Check className="h-4 w-4 text-[#9F99F8]" />}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center font-sans text-sm text-[#999999]">
                Sin categorías para esa búsqueda.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
