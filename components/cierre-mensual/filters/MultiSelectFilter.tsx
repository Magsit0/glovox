"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  name: string;
  label: string;
  options: Option[];
  available: Set<string>;
  selected: Set<string>;
  onChange: (name: string, next: Set<string>) => void;
}

export default function MultiSelectFilter({
  name,
  label,
  options,
  available,
  selected,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const allSelected = options.length > 0 && selected.size === options.length;
  const noneSelected = selected.size === 0;
  const partial = !allSelected && !noneSelected;

  const triggerLabel = (() => {
    if (!options.length) return label;
    if (allSelected) return label;
    if (noneSelected) return `${label} · ninguno`;
    if (selected.size === 1) {
      const one = options.find((o) => selected.has(o.value))?.label;
      return one ?? `${label} · 1`;
    }
    return `${label} · ${selected.size}`;
  })();

  const filtered = options
    .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aSel = selected.has(a.value);
      const bSel = selected.has(b.value);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;
      return 0;
    });

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(name, next);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <span className="font-sans text-xs text-[#666666]">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-w-[200px] items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {partial && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]" />}
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#999999]" />
        </button>

        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-30 flex w-full min-w-[260px] flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-md">
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => onChange(name, new Set(options.map((o) => o.value)))}
                className="font-sans text-xs text-[#666666] transition-colors hover:text-[#333333]"
              >
                Seleccionar todos
              </button>
              <button
                type="button"
                onClick={() => onChange(name, new Set())}
                className="font-sans text-xs text-[#666666] transition-colors hover:text-[#333333]"
              >
                Limpiar
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
              <input
                type="search"
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
            <div className="max-h-[240px] overflow-auto">
              {filtered.length === 0 && (
                <div className="px-3 py-2 font-sans text-sm text-[#999999]">
                  Sin resultados
                </div>
              )}
              {filtered.map((option) => {
                const isAvailable = available.has(option.value);
                const isChecked = selected.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-sm transition-colors ${
                      isChecked
                        ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                        : "text-[#333333] hover:bg-[#FAFAFA]"
                    } ${isAvailable ? "" : "opacity-50"}`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? "border-[#9F99F8] bg-[#9F99F8]"
                          : "border-[#E5E5E5] bg-white"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 truncate" title={option.label}>
                      {option.label}
                    </span>
                    {isChecked && <Check className="h-3.5 w-3.5 shrink-0 text-[#9F99F8]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { X as ClearIcon };
