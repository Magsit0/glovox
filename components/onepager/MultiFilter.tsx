"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Dropdown multi-select con el estilo Glovox (docs/STYLE_DASHBOARD.md §
 * FILTER CONTROLS): superficie clara, hairlines #E5E5E5, acento #9F99F8.
 * Set vacío = "Todos" (sin filtro). Compartido por los paneles del one-pager
 * (evolución horaria, detalle por producto, etc).
 *
 * ESTÁNDAR de filtros del dashboard — todo filtro debe tener:
 *   1. Buscador      → input que filtra las opciones por texto.
 *   2. Multiselector  → checkboxes; cada opción se marca/desmarca.
 *   3. Limpiador      → botón "Limpiar" que vacía la selección.
 * (ver README.md › "Estándar de filtros")
 */
export default function MultiFilter({
  label,
  selected,
  onChange,
  options,
  searchPlaceholder = "Buscar…",
}: {
  label: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  options: string[];
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Reset + foco del buscador al abrir/cerrar (render-phase guard).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setQuery("");
  }
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const isActive = selected.size > 0;
  const triggerText =
    selected.size === 0
      ? "Todos"
      : selected.size === 1
        ? Array.from(selected)[0]
        : `${selected.size} seleccionados`;

  function toggle(opt: string) {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  }

  // Marca todas las opciones VISIBLES (respeta el buscador), sin perder lo ya
  // seleccionado fuera del filtro actual.
  function selectAllVisible() {
    const next = new Set(selected);
    for (const o of filteredOptions) next.add(o);
    onChange(next);
  }

  function clear() {
    onChange(new Set());
  }

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      <span className="font-sans text-xs text-[#666666]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center justify-between gap-3 min-w-[180px] rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] cursor-pointer transition-colors duration-150 hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
      >
        <span className="flex items-center gap-2 min-w-0">
          {isActive && (
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]"
            />
          )}
          <span className="truncate text-left">{triggerText}</span>
        </span>
        <span aria-hidden className="text-[#999999] leading-none">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute top-full left-0 z-50 mt-1 w-[260px] max-h-72 overflow-y-auto bg-white border border-[#E5E5E5] rounded-lg shadow-md"
        >
          <div className="sticky top-0 z-10 bg-[#FAFAFA] border-b border-[#E5E5E5]">
            {/* Buscador */}
            <div className="p-2 border-b border-[#E5E5E5]">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
            {/* Acciones */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={filteredOptions.length === 0}
                className="font-sans text-xs text-[#666666] hover:text-[#333333] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {query.trim() ? "Marcar visibles" : "Marcar todos"}
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={selected.size === 0}
                className="font-sans text-xs text-[#666666] hover:text-[#333333] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpiar
              </button>
            </div>
          </div>
          {options.length === 0 ? (
            <div className="font-sans text-sm text-[#999999] px-3 py-2">
              Sin opciones
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="font-sans text-sm text-[#999999] px-3 py-2">
              Sin coincidencias
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const checked = selected.has(opt);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
                >
                  <span
                    aria-hidden
                    className={`relative inline-block w-4 h-4 rounded border flex-shrink-0 ${
                      checked ? "bg-[#9F99F8] border-[#9F99F8]" : "bg-white border-[#E5E5E5]"
                    }`}
                  >
                    {checked && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold leading-none">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="font-sans text-sm text-[#333333] truncate">
                    {opt}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
