"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";
import type { FdsEventOption } from "@/lib/fds/types";

interface Props {
  options: FdsEventOption[];
  selectedId?: string;
}

function matches(option: FdsEventOption, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    option.eventoId.toLowerCase().includes(needle) ||
    option.nombre.toLowerCase().includes(needle) ||
    option.temporada.toLowerCase().includes(needle)
  );
}

function formatFecha(fecha: string | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FdsEventSelector({ options, selectedId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.eventoId === selectedId) ?? null,
    [options, selectedId],
  );

  const filtered = useMemo(
    () => options.filter((o) => matches(o, query)),
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
    router.push(`/fds?id=${encodeURIComponent(id)}`);
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
              <span className="font-medium text-[#333333]">{selected.nombre}</span>
              <span className="ml-2 text-[#666666]">{selected.eventoId}</span>
              {selected.fechaEvento && (
                <span className="ml-2 text-[#999999]">· {formatFecha(selected.fechaEvento)}</span>
              )}
            </>
          ) : (
            <span className="text-[#999999]">Buscar y seleccionar edición</span>
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
                placeholder="Buscar por nombre, id o temporada…"
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
              const isActive = opt.eventoId === selectedId;
              return (
                <li key={opt.eventoId} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt.eventoId)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left font-sans text-sm transition-colors ${
                      isActive ? "bg-[#F0EFFE] text-[#9F99F8]" : "text-[#333333] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{opt.nombre || "Sin nombre"}</span>
                      <span className="ml-2 text-xs text-[#999999]">{opt.eventoId}</span>
                    </span>
                    {opt.fechaEvento && (
                      <span className="shrink-0 text-xs text-[#999999]">{formatFecha(opt.fechaEvento)}</span>
                    )}
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
