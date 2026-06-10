"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Dropdown multi-select brutalista (bordes negros, acento #FFFF00,
 * font-mono-data). Set vacío = "Todos" (sin filtro). Compartido por los
 * paneles del one-pager (evolución horaria, detalle por producto, etc).
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
      <span className="font-mono-data uppercase text-[10px] text-black/70">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center justify-between gap-3 min-w-[180px] font-mono-data uppercase text-xs px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00] ${
          isActive ? "bg-[#FFFF00]" : "bg-white"
        }`}
      >
        <span className="truncate text-left">{triggerText}</span>
        <span aria-hidden className="font-bold leading-none">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute top-full left-0 z-50 mt-1 w-[260px] max-h-72 overflow-y-auto bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none"
        >
          <div className="sticky top-0 z-10 bg-black border-b-2 border-black">
            {/* Buscador */}
            <div className="p-2 border-b-2 border-black/40">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-white bg-white text-black placeholder:text-black/40 outline-none"
              />
            </div>
            {/* Acciones */}
            <div className="flex items-center justify-between gap-2 text-white px-3 py-2">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={filteredOptions.length === 0}
                className="font-mono-data uppercase text-[10px] hover:text-[#FFFF00] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {query.trim() ? "Marcar visibles" : "Marcar todos"}
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={selected.size === 0}
                className="font-mono-data uppercase text-[10px] hover:text-[#FFFF00] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpiar
              </button>
            </div>
          </div>
          {options.length === 0 ? (
            <div className="font-mono-data text-xs text-black/50 px-3 py-2">
              Sin opciones
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="font-mono-data text-xs text-black/50 px-3 py-2">
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
                  className="flex items-center gap-2 w-full text-left px-3 py-2 border-b border-black/20 last:border-b-0 hover:bg-[#FFFF00] cursor-pointer transition-colors duration-150"
                >
                  <span
                    aria-hidden
                    className={`relative inline-block w-4 h-4 border-2 border-black flex-shrink-0 ${
                      checked ? "bg-black" : "bg-white"
                    }`}
                  >
                    {checked && (
                      <span className="absolute inset-0 flex items-center justify-center text-[#FFFF00] text-[10px] font-bold leading-none">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="font-mono-data uppercase text-xs truncate">
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
