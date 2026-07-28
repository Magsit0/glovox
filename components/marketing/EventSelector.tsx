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

// "Próximos" strip: a fixed 3-card window that scrolls to reach the rest, so
// the top bar keeps its height no matter how many upcoming events there are.
const UPCOMING_CARD_W = 140; // px — must match `w-[140px]` on each card
const UPCOMING_GAP = 8; // px — must match `gap-2` on the scroller
const UPCOMING_VISIBLE = 3;
const UPCOMING_STEP = UPCOMING_CARD_W + UPCOMING_GAP;

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

function UpcomingStrip({
  events,
  selected,
  onPick,
}: {
  events: EventOption[];
  selected: string;
  onPick: (ev: EventOption) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  // Arrow state follows the real scroll offset, so wheel/trackpad/swipe count
  // too — not just our own scrollBy calls.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 1);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [events.length]);

  // Keep the active event inside the window when the selection came from
  // somewhere else (dropdown, `?event=` in the URL).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const idx = events.findIndex((e) => e.eventoId === selected);
    if (idx < 0) return;
    const left = idx * UPCOMING_STEP;
    if (
      left < el.scrollLeft ||
      left + UPCOMING_CARD_W > el.scrollLeft + el.clientWidth
    ) {
      el.scrollTo({ left, behavior: "smooth" });
    }
  }, [events, selected]);

  // Page by whole windows, snapping the target back onto the card grid so a
  // free trackpad scroll can't leave cards half-cut. The browser clamps the
  // upper end to scrollWidth - clientWidth.
  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const current = Math.round(el.scrollLeft / UPCOMING_STEP);
    const target = Math.max(0, current + dir * UPCOMING_VISIBLE);
    el.scrollTo({ left: target * UPCOMING_STEP, behavior: "smooth" });
  }

  const scrollable = events.length > UPCOMING_VISIBLE;
  const arrowClass =
    "border-2 border-black rounded-none bg-white text-black font-display text-xs leading-none px-2 py-2 cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-white";

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono-data uppercase text-xs text-black mr-1">
        {scrollable ? `Próximos · ${events.length}` : "Próximos"}
      </span>
      {scrollable && (
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={atStart}
          aria-label="Ver eventos anteriores"
          className={arrowClass}
        >
          ◀
        </button>
      )}
      <div
        ref={scroller}
        className="flex gap-2 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none max-w-full"
        style={{
          width:
            Math.min(events.length, UPCOMING_VISIBLE) * UPCOMING_STEP -
            UPCOMING_GAP,
        }}
      >
        {events.map((ev) => (
          <button
            key={ev.eventoId}
            type="button"
            onClick={() => onPick(ev)}
            className={`w-[140px] shrink-0 border-2 border-black rounded-none font-mono-data text-xs px-3 py-1.5 cursor-pointer transition-colors duration-150 text-left ${
              ev.eventoId === selected
                ? "bg-black text-[#FFFF00] font-bold"
                : "bg-white text-black hover:bg-[#FFFF00]"
            }`}
          >
            <span className="block truncate">{ev.nombre}</span>
            <span className="block text-[10px] opacity-60">
              {ev.fechaEvento}
            </span>
          </button>
        ))}
      </div>
      {scrollable && (
        <button
          type="button"
          onClick={() => page(1)}
          disabled={atEnd}
          aria-label="Ver eventos siguientes"
          className={arrowClass}
        >
          ▶
        </button>
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
        <UpcomingStrip
          events={upcomingEvents}
          selected={selected}
          onPick={handleUpcomingEventClick}
        />
      )}
    </div>
  );
}
