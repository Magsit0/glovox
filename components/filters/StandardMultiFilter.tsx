"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type StandardFilterOption = {
  value: string;
  label: string;
  meta?: string;
  disabled?: boolean;
};

type Props = {
  label: string;
  options: StandardFilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  allLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
};

export default function StandardMultiFilter({
  label,
  options,
  selected,
  onChange,
  allLabel = "Todos",
  searchPlaceholder = "Buscar...",
  disabled = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [close, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.value} ${o.meta ?? ""}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  const triggerText = useMemo(() => {
    if (selected.size === 0) return allLabel;
    if (selected.size === 1) {
      const value = Array.from(selected)[0];
      return options.find((o) => o.value === value)?.label ?? value;
    }
    return `${selected.size} seleccionados`;
  }, [allLabel, options, selected]);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  function selectVisible() {
    const next = new Set(selected);
    for (const opt of filteredOptions) {
      if (!opt.disabled) next.add(opt.value);
    }
    onChange(next);
  }

  function clear() {
    onChange(new Set());
  }

  return (
    <div ref={ref} className={`flex flex-col gap-1.5 ${className}`}>
      <span className="font-sans text-xs text-[#666666]">
        {label}
        {selected.size > 0 && (
          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8] align-middle" />
        )}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            if (open) close();
            else setOpen(true);
          }}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full min-w-[200px] items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="truncate">{triggerText}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#999999]" />
        </button>

        {open && !disabled && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-40 flex w-[280px] max-w-[90vw] flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-md">
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={selectVisible}
                disabled={filteredOptions.every((o) => o.disabled)}
                className="font-sans text-xs text-[#666666] transition-colors hover:text-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {query.trim() ? "Seleccionar visibles" : "Seleccionar todos"}
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={selected.size === 0}
                className="font-sans text-xs text-[#666666] transition-colors hover:text-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpiar
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
            <div role="listbox" aria-multiselectable className="max-h-[260px] overflow-auto">
              {options.length === 0 ? (
                <div className="px-3 py-2 font-sans text-sm text-[#999999]">
                  Sin opciones
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-2 font-sans text-sm text-[#999999]">
                  Sin coincidencias
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = selected.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      disabled={opt.disabled}
                      onClick={() => toggle(opt.value)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-sm transition-colors ${
                        checked
                          ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                          : "text-[#333333] hover:bg-[#FAFAFA]"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          checked
                            ? "border-[#9F99F8] bg-[#9F99F8]"
                            : "border-[#E5E5E5] bg-white"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={opt.label}>
                        {opt.label}
                      </span>
                      {opt.meta && (
                        <span className="shrink-0 font-sans text-xs text-[#999999]">
                          {opt.meta}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
