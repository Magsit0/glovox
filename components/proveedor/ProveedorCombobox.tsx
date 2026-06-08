"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import type { ProveedorOption } from "@/lib/queries/proveedor";
import { compactCurrency } from "@/components/proveedor/format";

interface Props {
  options: ProveedorOption[];
  /** Proveedor seleccionado ("" = todos). */
  value: string;
  /** null = "Todos los proveedores". */
  onSelect: (proveedor: string | null) => void;
}

const VISIBLE_WITHOUT_QUERY = 200;

/**
 * Combobox de proveedor: un solo control con búsqueda en vivo y lista filtrada.
 * Reemplaza al patrón input-de-búsqueda + `<select>` nativo, donde filtrar no
 * mostraba nada porque el `<select>` estaba colapsado.
 */
export default function ProveedorCombobox({ options, value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, VISIBLE_WITHOUT_QUERY);
    const qStripped = q.replace(/[.\s-]/g, "");
    return options
      .filter((o) => {
        if (o.proveedor.toLowerCase().includes(q)) return true;
        const rutStripped = o.rut.replace(/[.\s-]/g, "").toLowerCase();
        return qStripped.length > 0 && rutStripped.includes(qStripped);
      })
      .slice(0, VISIBLE_WITHOUT_QUERY);
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

  function choose(proveedor: string | null) {
    onSelect(proveedor);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-[320px] max-w-full items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
      >
        <span className={`truncate ${value ? "text-[#333333]" : "text-[#999999]"}`}>
          {value || "Todos los proveedores"}
        </span>
        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3 flex-shrink-0 text-[#999999]"
          aria-hidden="true"
        >
          <path
            d={open ? "M2 8l4-4 4 4" : "M2 4l4 4 4-4"}
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-[380px] max-w-[90vw] rounded-lg border border-[#E5E5E5] bg-white shadow-md"
        >
          <div className="border-b border-[#E5E5E5] p-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-[#999999]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nombre o RUT…"
                className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-auto py-1">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => choose(null)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-sans text-sm transition-colors hover:bg-[#FAFAFA] ${
                !value ? "bg-[#F0EFFE] font-medium text-[#9F99F8]" : "text-[#333333]"
              }`}
            >
              <span>Todos los proveedores</span>
              {!value && <Check className="h-4 w-4 text-[#9F99F8]" />}
            </button>

            {filtered.length === 0 ? (
              <p className="px-3 py-3 font-sans text-sm text-[#999999]">
                Sin proveedores que coincidan.
              </p>
            ) : (
              filtered.map((o) => {
                const active = o.proveedor === value;
                return (
                  <button
                    key={o.proveedor}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(o.proveedor)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[#FAFAFA] ${
                      active ? "bg-[#F0EFFE]" : ""
                    }`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={`truncate font-sans text-sm ${
                          active ? "font-medium text-[#9F99F8]" : "text-[#333333]"
                        }`}
                      >
                        {o.proveedor}
                      </span>
                      <span className="truncate font-sans text-xs text-[#999999]">
                        {o.rut || "Sin RUT"} · {o.docs} docs
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="font-sans text-xs tabular-nums text-[#666666]">
                        {compactCurrency(o.gasto)}
                      </span>
                      {active && <Check className="h-4 w-4 text-[#9F99F8]" />}
                    </span>
                  </button>
                );
              })
            )}

            {query.trim() === "" && options.length > VISIBLE_WITHOUT_QUERY && (
              <p className="px-3 py-2 font-sans text-xs text-[#999999]">
                Mostrando {VISIBLE_WITHOUT_QUERY} de {options.length}. Escribe
                para buscar entre todos.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
