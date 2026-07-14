"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";
import type { NegocioOption } from "@/lib/unabase/types";
import type { MontoMode } from "@/components/montoMode";

interface Props {
  options: NegocioOption[];
  selectedId?: string;
  /** URL del listado de origen — se preserva al cambiar de negocio. */
  from?: string;
  /** Modo de montos — se preserva al cambiar de negocio (default neto). */
  monto?: MontoMode;
}

function asStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function matches(option: NegocioOption, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    asStr(option.external_id).toLowerCase().includes(q) ||
    asStr(option.referencia).toLowerCase().includes(q) ||
    asStr(option.area_negocio).toLowerCase().includes(q)
  );
}

export default function NegocioSelector({ options, selectedId, from, monto }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.external_id === selectedId) ?? null,
    [options, selectedId],
  );

  const filtered = useMemo(
    () => options.filter((o) => matches(o, query)).slice(0, 200),
    [options, query],
  );

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function handleSelect(id: string) {
    setOpen(false);
    setQuery("");
    const params = new URLSearchParams();
    params.set("id", id);
    if (monto === "bruto") params.set("monto", monto);
    if (from) params.set("from", from);
    router.push(`/cierre-negocio?${params.toString()}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? (
            <>
              <span className="font-medium text-[#333333]">{selected.external_id}</span>
              <span className="ml-2 text-[#666666]">{selected.referencia}</span>
            </>
          ) : (
            <span className="text-[#999999]">Buscar y seleccionar negocio</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#999999]" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-md">
          <div className="border-b border-[#E5E5E5] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por id, nombre o área…"
                className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
          </div>
          <ul className="max-h-64 overflow-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center font-sans text-sm text-[#999999]">
                Sin resultados
              </li>
            )}
            {filtered.map((opt) => {
              const isActive = opt.external_id === selectedId;
              return (
                <li key={opt.external_id} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.external_id)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left font-sans text-sm transition-colors ${
                      isActive
                        ? "bg-[#F0EFFE] text-[#9F99F8]"
                        : "text-[#333333] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <span className="w-14 shrink-0 font-medium tabular-nums">
                      {opt.external_id}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {opt.referencia || "Sin referencia"}
                      {opt.area_negocio && (
                        <span className="ml-2 text-xs text-[#999999]">{opt.area_negocio}</span>
                      )}
                    </span>
                    {isActive && <Check className="h-4 w-4 shrink-0 text-[#9F99F8]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
