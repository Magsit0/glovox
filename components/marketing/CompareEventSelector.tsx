"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type CompareEventOption = {
  eventoId: string;
  nombre: string;
  fechaEvento: string;
  categoriaEvento: string;
};

type Props = {
  events: CompareEventOption[];
  selected: string[];
  defaultCategory?: string;
};

export default function CompareEventSelector({
  events,
  selected,
  defaultCategory = "",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [catOpen, setCatOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(
    () => [...new Set(events.map((e) => e.categoriaEvento))].sort(),
    [events],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (catRef.current && !catRef.current.contains(target)) {
        setCatOpen(false);
      }
      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function commit(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compare");
    for (const v of next) params.append("compare", v);
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
    const byCat = category
      ? events.filter((e) => e.categoriaEvento === category)
      : events;
    const q = search.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        e.eventoId.toLowerCase().includes(q),
    );
  }, [events, category, search]);

  const triggerLabel =
    selected.length === 0
      ? "Sin comparativos"
      : selected.length === 1
        ? (events.find((e) => e.eventoId === selected[0])?.nombre ?? selected[0])
        : `${selected.length} eventos`;

  const disabled = events.length === 0;

  return (
    <div ref={ref} className="relative mb-3">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`bg-white border-4 border-black rounded-none font-mono-data text-xs px-3 py-1.5 text-black flex items-center gap-2 max-w-full justify-between shadow-[4px_4px_0px_#000] transition-colors duration-150 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-[#FFFF00]"
        }`}
      >
        <span className="truncate max-w-[280px]">
          Comparar: {disabled ? "Sin eventos disponibles" : triggerLabel}
        </span>
        <span className="font-display text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && !disabled && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-white border-4 border-black rounded-none shadow-[4px_4px_0px_#000] min-w-[320px] w-max max-w-[520px]">
          <div className="p-2 border-b-2 border-black">
            <div ref={catRef} className="relative">
              <button
                type="button"
                onClick={() => setCatOpen(!catOpen)}
                className="w-full bg-white border-2 border-black rounded-none font-mono-data text-xs px-2 py-1 text-black flex items-center gap-2 justify-between hover:bg-[#FFFF00] cursor-pointer transition-colors duration-150"
              >
                <span className="truncate">
                  {category || "Todas las categorías"}
                </span>
                <span className="font-display text-xs">
                  {catOpen ? "▲" : "▼"}
                </span>
              </button>
              {catOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_#000] max-h-72 overflow-y-auto">
                  {[
                    { value: "", label: "Todas las categorías" },
                    ...categories.map((c) => ({ value: c, label: c })),
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCategory(opt.value);
                        setCatOpen(false);
                      }}
                      className={`w-full text-left px-2 py-1 font-mono-data text-xs border-b-2 border-black last:border-b-0 transition-colors duration-150 cursor-pointer ${
                        opt.value === category
                          ? "bg-[#FFFF00] text-black font-bold"
                          : "hover:bg-[#FFFF00] text-black"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-2 border-b-2 border-black flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar evento..."
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
              filtered.map((ev) => {
                const isSelected = selected.includes(ev.eventoId);
                return (
                  <button
                    key={ev.eventoId}
                    type="button"
                    onClick={() => toggle(ev.eventoId)}
                    className={`w-full text-left px-3 py-2 font-mono-data text-xs border-b-2 border-black last:border-b-0 transition-colors duration-150 cursor-pointer flex items-start gap-2 ${
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
                    <span className="flex-1">
                      <span className="block">
                        {ev.eventoId} — {ev.nombre}
                      </span>
                      <span className="block text-[10px] opacity-60">
                        {ev.fechaEvento} · {ev.categoriaEvento}
                      </span>
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
