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
  upcomingEvents: EventOption[];
};

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
        className="bg-white border-4 border-black rounded-none font-mono-data text-sm px-4 py-2 text-black cursor-pointer flex items-center gap-2 min-w-[200px] justify-between shadow-[4px_4px_0px_#000] hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="font-display text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border-4 border-black rounded-none shadow-[4px_4px_0px_#000] max-h-80 overflow-y-auto min-w-[300px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 font-mono-data text-sm border-b-2 border-black last:border-b-0 transition-colors duration-150 cursor-pointer ${
                opt.value === value
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
  );
}

export default function EventSelector({
  events,
  selected,
  upcomingEvents,
}: EventSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categories = useMemo(() => {
    const cats = [...new Set(events.map((e) => e.categoriaEvento))].sort();
    return cats;
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
      router.push(`/marketing/weekly?${params.toString()}`);
    }
  }

  function handleEventChange(eventoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", eventoId);
    router.push(`/marketing/weekly?${params.toString()}`);
  }

  function handleUpcomingEventClick(ev: EventOption) {
    setSelectedCategory(ev.categoriaEvento);
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", ev.eventoId);
    router.push(`/marketing/weekly?${params.toString()}`);
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
    <div className="flex items-center gap-4 justify-between bg-[#FFFF00] border-b-4 border-black px-6 py-4 flex-wrap">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-display uppercase text-2xl leading-none text-black">
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

      {upcomingEvents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono-data uppercase text-xs text-black mr-1">
            Próximos
          </span>
          {upcomingEvents.map((ev) => (
            <button
              key={ev.eventoId}
              type="button"
              onClick={() => handleUpcomingEventClick(ev)}
              className={`border-2 border-black rounded-none font-mono-data text-xs px-3 py-1.5 cursor-pointer transition-colors duration-150 text-left ${
                ev.eventoId === selected
                  ? "bg-black text-[#FFFF00] font-bold"
                  : "bg-white text-black hover:bg-[#FFFF00]"
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
