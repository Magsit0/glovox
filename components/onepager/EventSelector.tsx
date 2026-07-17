"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";

type EventOption = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  fechaEvento: string;
};

type EventSelectorProps = {
  events: EventOption[];
  selected: string;
  recentEvents: EventOption[];
};

const BASE_PATH = "/onepager";

function BrutalSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
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

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bg-white border border-[#E5E5E5] rounded-lg font-sans text-sm px-3 py-2 text-[#333333] cursor-pointer flex items-center gap-2 min-w-[200px] justify-between hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] transition-colors duration-150"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="font-sans text-xs text-[#999999]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E5E5E5] rounded-lg shadow-md max-h-80 overflow-y-auto min-w-[300px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 font-sans text-sm border-b border-[#E5E5E5] last:border-b-0 transition-colors duration-150 cursor-pointer ${
                opt.value === value
                  ? "bg-[#F0EFFE] text-[#9F99F8] font-medium"
                  : "hover:bg-[#FAFAFA] text-[#333333]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventSelector({
  events,
  selected,
  recentEvents,
}: EventSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categories = useMemo(() => {
    return [...new Set(events.map((e) => e.categoriaEvento))].sort();
  }, [events]);

  const currentEvent = events.find((e) => e.eventoId === selected);
  const [selectedCategory, setSelectedCategory] = useState(
    currentEvent?.categoriaEvento ?? ""
  );

  const filteredEvents = useMemo(
    () =>
      selectedCategory
        ? events.filter((e) => e.categoriaEvento === selectedCategory)
        : events,
    [events, selectedCategory]
  );

  function handleCategoryChange(cat: string) {
    setSelectedCategory(cat);
    const eventsInCat = events.filter((e) => e.categoriaEvento === cat);
    if (eventsInCat.length > 0 && !eventsInCat.find((e) => e.eventoId === selected)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("event", eventsInCat[0].eventoId);
      router.push(`${BASE_PATH}?${params.toString()}`);
    }
  }

  function handleEventChange(eventoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", eventoId);
    router.push(`${BASE_PATH}?${params.toString()}`);
  }

  function handleRecentEventClick(ev: EventOption) {
    setSelectedCategory(ev.categoriaEvento);
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", ev.eventoId);
    router.push(`${BASE_PATH}?${params.toString()}`);
  }

  const categoryOptions = [
    { value: "", label: "Todas las categorías" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  const eventOptions = filteredEvents.map((ev) => ({
    value: ev.eventoId,
    label: `${ev.eventoId} — ${ev.nombre}`,
  }));

  return (
    <div className="flex items-center gap-4 justify-between bg-white border-b border-[#E5E5E5] px-6 py-4 flex-wrap">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-display font-bold text-xl leading-none text-[#333333]">
          Evento
        </span>
        <BrutalSelect
          value={selectedCategory}
          options={categoryOptions}
          onChange={handleCategoryChange}
        />
        <BrutalSelect
          value={selected}
          options={eventOptions}
          onChange={handleEventChange}
        />
      </div>

      {recentEvents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-sans text-xs text-[#666666] mr-1">
            Últimos Eventos
          </span>
          {recentEvents.map((ev) => (
            <button
              key={ev.eventoId}
              type="button"
              onClick={() => handleRecentEventClick(ev)}
              className={`border rounded-lg font-sans text-xs px-3 py-1.5 cursor-pointer transition-colors duration-150 text-left ${
                ev.eventoId === selected
                  ? "border-[#9F99F8] bg-[#F0EFFE] text-[#9F99F8] font-medium"
                  : "border-[#333333] bg-white text-[#333333] hover:bg-[#FAFAFA]"
              }`}
            >
              <span className="block truncate max-w-[120px]">{ev.nombre}</span>
              <span className="block text-[10px] opacity-60">{ev.fechaEvento}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
