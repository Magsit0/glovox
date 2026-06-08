"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Option = { tipoTicket: string; tickets: number };

type Props = {
  options: Option[];
  selected: string[];
};

// Multi-select for `TipoTicket` over the union of visible events (main +
// comparators). State is persisted in the URL as `tipoTicket=...` so the
// server component on /marketing/weekly can read it and refetch the chart.
export default function TipoTicketFilter({ options, selected }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function commit(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tipoTicket");
    for (const v of next) params.append("tipoTicket", v);
    router.push(`/marketing/weekly?${params.toString()}`, { scroll: false });
  }

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    commit(next);
  }

  function clearAll() {
    commit([]);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.tipoTicket.toLowerCase().includes(q));
  }, [options, search]);

  const triggerLabel =
    selected.length === 0
      ? "Todos los tipos"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} tipos`;

  return (
    <div ref={ref} className="relative mb-3 inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-white border-4 border-black rounded-none font-mono-data text-xs px-3 py-1.5 text-black cursor-pointer flex items-center gap-2 max-w-full justify-between shadow-[4px_4px_0px_#000] hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <span className="truncate max-w-[280px]">
          Tipo Ticket: {triggerLabel}
        </span>
        <span className="font-display text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-white border-4 border-black rounded-none shadow-[4px_4px_0px_#000] min-w-[320px] w-max max-w-[520px]">
          <div className="p-2 border-b-2 border-black flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tipo ticket..."
              className="flex-1 bg-white border-2 border-black rounded-none font-mono-data text-xs px-2 py-1 text-black placeholder:text-black/40 focus:outline-none focus:bg-[#FFFF00]"
            />
            {selected.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="font-mono-data text-xs px-2 py-1 border-2 border-black bg-white hover:bg-[#FFFF00] cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 font-mono-data text-xs text-black/50">
                Sin resultados.
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.tipoTicket);
                return (
                  <button
                    key={opt.tipoTicket}
                    type="button"
                    onClick={() => toggle(opt.tipoTicket)}
                    className={`w-full text-left px-3 py-2 font-mono-data text-xs border-b-2 border-black last:border-b-0 transition-colors duration-150 cursor-pointer break-all flex items-start gap-2 ${
                      isSelected
                        ? "bg-[#FFFF00] text-black font-bold"
                        : "hover:bg-[#FFFF00] text-black"
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 mt-[1px] border-2 border-black flex-shrink-0 ${
                        isSelected ? "bg-black text-[#FFFF00]" : "bg-white"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                    <span className="flex-1">{opt.tipoTicket}</span>
                    <span className="text-black/50 tabular-nums">
                      {opt.tickets.toLocaleString("es-CL")}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
