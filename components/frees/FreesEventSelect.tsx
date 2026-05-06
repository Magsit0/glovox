"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";

import type { FreesEventOption } from "@/lib/queries/frees";

const numberFormatter = new Intl.NumberFormat("es-CL");

type Props = {
  events: FreesEventOption[];
  selected: string;
};

export function FreesEventSelect({ events, selected }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const selectedEvent = useMemo(
    () => events.find((e) => e.eventoId === selected),
    [events, selected],
  );

  const triggerLabel = selectedEvent
    ? `${selectedEvent.eventoId} — ${selectedEvent.nombre}`
    : "Todos los eventos";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.eventoId.toLowerCase().includes(q) ||
        e.nombre.toLowerCase().includes(q),
    );
  }, [events, search]);

  function pushEvent(eventoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (eventoId) params.set("event", eventoId);
    else params.delete("event");
    const qs = params.toString();
    router.push(qs ? `/frees?${qs}` : "/frees");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <span className="font-sans text-xs text-[#666666]">Evento</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-w-[260px] items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        >
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selectedEvent && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]" />
            )}
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#999999]" />
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+4px)] z-30 flex w-[320px] flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-md">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
              <input
                type="search"
                placeholder="Buscar evento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
            <div className="max-h-[280px] overflow-auto">
              <button
                type="button"
                onClick={() => pushEvent("")}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-sm transition-colors ${
                  !selected
                    ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                    : "text-[#333333] hover:bg-[#FAFAFA]"
                }`}
              >
                <span className="flex-1 truncate">Todos los eventos</span>
                {!selected && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#9F99F8]" />
                )}
              </button>
              {filtered.length === 0 && (
                <div className="px-3 py-2 font-sans text-sm text-[#999999]">
                  Sin resultados
                </div>
              )}
              {filtered.map((ev) => {
                const isChecked = ev.eventoId === selected;
                return (
                  <button
                    key={ev.eventoId}
                    type="button"
                    onClick={() => pushEvent(ev.eventoId)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-sm transition-colors ${
                      isChecked
                        ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                        : "text-[#333333] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate" title={`${ev.eventoId} — ${ev.nombre}`}>
                        {ev.eventoId} — {ev.nombre}
                      </span>
                      <span className="font-sans text-xs text-[#999999]">
                        {numberFormatter.format(ev.totalCortesias)} cortesías
                      </span>
                    </span>
                    {isChecked && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#9F99F8]" />
                    )}
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
