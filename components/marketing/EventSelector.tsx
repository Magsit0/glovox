"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/use-router";
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";

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
  // "YYYY-MM-DD" the page used to split past from upcoming; it dates the
  // "hace N d" of the past cards, so server and client render the same text.
  today: string;
};

// Event strip: a timeline with the last events left of a "today" divider and
// the upcoming ones right of it, in a fixed window of 3 cards that scrolls, so
// the top bar keeps its height. It opens on the next 3 (what the old
// "Próximos" strip showed); ◀ walks back into the past.
//
// The divider lives inside the gap between two cards (negative margins), so
// every card keeps the same step: any marker with a width of its own would
// leave a sliver of a card at the edge of every page that does not touch it.
const CARD_W = 140; // px — must match `w-[140px]` on each card
const GAP = 8; // px — must match `gap-2` on the scroller
const VISIBLE = 3;
const STEP = CARD_W + GAP;
// Past events shown at first, and added by each "+ anteriores".
const PAST_PAGE = 3;
// Older than this, "hace N d" says less than the date itself.
const RELATIVE_MAX_DAYS = 60;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/**
 * Scroll stops of the strip, in px. Cards sit on a uniform grid (past first,
 * then upcoming), so it is all arithmetic: no DOM measuring, and the first
 * render already knows where the window has to sit.
 */
function stripGeometry(pastCount: number, upCount: number) {
  const total = pastCount + upCount;
  const width = Math.min(total, VISIBLE) * STEP - GAP;

  // Past pages end next to today (the 3 newest), then step back 3 by 3; the
  // oldest page starts at 0. Upcoming pages: the next 3, then 3 by 3.
  const stops = new Set<number>([0]);
  for (let k = pastCount - VISIBLE; k > 0; k -= VISIBLE) stops.add(k * STEP);
  for (let j = 0; j < upCount; j += VISIBLE) stops.add((pastCount + j) * STEP);
  const sorted = [...stops].sort((a, b) => a - b);
  const last = sorted[sorted.length - 1];

  // Where the strip opens when the selection is not in it.
  const home = upCount > 0 ? pastCount * STEP : last;
  // The page that contains card number `i`.
  const stopFor = (i: number) => sorted.filter((s) => s <= i * STEP).pop() ?? 0;

  // Trailing room so the last page can line up on its first card (the flex
  // gap already adds GAP before the spacer).
  const missing = last + width - (total * STEP - GAP);
  const spacer = missing > 0 ? Math.max(0, missing - GAP) : null;

  return { width, stops: sorted, last, home, todayLeft: pastCount * STEP, stopFor, spacer };
}

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

function StripCard({
  ev,
  active,
  past,
  today,
  onPick,
}: {
  ev: EventOption;
  active: boolean;
  past: boolean;
  today: string;
  onPick: (ev: EventOption) => void;
}) {
  const dias = past ? daysBetween(ev.fechaEvento, today) : 0;
  const fecha =
    dias > 0 && dias < RELATIVE_MAX_DAYS ? `${ev.fechaEvento} · hace ${dias} d` : ev.fechaEvento;
  // Past cards go without fill (the bar's yellow shows through) so the two
  // sides of HOY read apart; the active one is black on both sides.
  const tone = active
    ? "bg-black text-[#FFFF00] font-bold"
    : past
      ? "bg-transparent text-black hover:bg-white"
      : "bg-white text-black hover:bg-[#FFFF00]";
  return (
    <button
      type="button"
      onClick={() => onPick(ev)}
      title={`${ev.nombre} · ${ev.fechaEvento}`}
      className={`w-[140px] shrink-0 border-2 border-black rounded-none font-mono-data text-xs px-3 py-1.5 cursor-pointer transition-colors duration-150 text-left ${tone}`}
    >
      <span className="block truncate">{ev.nombre}</span>
      <span className="block truncate text-[10px] opacity-60">{fecha}</span>
    </button>
  );
}

function EventStrip({
  past,
  upcoming,
  selected,
  today,
  onPick,
}: {
  past: EventOption[]; // every past event, newest first
  upcoming: EventOption[]; // ascending
  selected: string;
  today: string;
  onPick: (ev: EventOption) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(PAST_PAGE);

  // Oldest on the left, newest next to HOY.
  const pastShown = useMemo(() => past.slice(0, shown).reverse(), [past, shown]);
  const geo = useMemo(
    () => stripGeometry(pastShown.length, upcoming.length),
    [pastShown.length, upcoming.length],
  );

  // Position of a card on the grid (past first, then upcoming), or null.
  const indexOf = (id: string): number | null => {
    const i = pastShown.findIndex((e) => e.eventoId === id);
    if (i >= 0) return i;
    const j = upcoming.findIndex((e) => e.eventoId === id);
    return j >= 0 ? pastShown.length + j : null;
  };

  // Scroll offset as state: label, arrows and "+ anteriores" follow it, so a
  // wheel/trackpad/swipe counts too. It starts where the first layout effect
  // puts the window.
  const [pos, setPos] = useState(() => {
    const i = indexOf(selected);
    return i == null ? geo.home : geo.stopFor(i);
  });

  // Keep the active event inside the window: on mount without animation, and
  // later when the selection came from somewhere else (dropdown, `?event=`).
  // Only a change of selection moves it, never a re-render.
  const lastSelected = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || lastSelected.current === selected) return;
    const first = lastSelected.current === null;
    lastSelected.current = selected;
    if (first) {
      el.scrollLeft = pos;
      return;
    }
    const i = indexOf(selected);
    if (i == null) return;
    const x = i * STEP;
    if (x < el.scrollLeft || x + CARD_W > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: geo.stopFor(i), behavior: "smooth" });
    }
  });

  // "+ anteriores" prepends cards on the left: hold the current view in place,
  // then slide to the ones just added.
  const prevPastCount = useRef(pastShown.length);
  useLayoutEffect(() => {
    const el = scroller.current;
    const added = pastShown.length - prevPastCount.current;
    prevPastCount.current = pastShown.length;
    if (!el || added <= 0) return;
    el.scrollLeft += added * STEP;
    el.scrollTo({ left: 0, behavior: "smooth" });
  }, [pastShown.length]);

  // Page by stops (whole windows on the card grid), so a free trackpad scroll
  // can't leave cards half-cut.
  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const x = el.scrollLeft;
    const target =
      dir > 0 ? geo.stops.find((s) => s > x + 1) : [...geo.stops].reverse().find((s) => s < x - 1);
    if (target != null) el.scrollTo({ left: target, behavior: "smooth" });
  }

  const viendoPasado =
    pastShown.length > 0 && (upcoming.length === 0 || pos < geo.todayLeft - CARD_W / 2);
  const hayMas = shown < past.length;
  const arrowClass =
    "border-2 border-black rounded-none bg-white text-black font-display text-xs leading-none px-2 py-2 cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00] disabled:opacity-30 disabled:cursor-default disabled:hover:bg-white";

  return (
    <div className="flex items-center gap-2">
      <div className="w-[104px] shrink-0 mr-1 flex flex-col items-start">
        <span className="font-mono-data uppercase text-xs text-black">
          {viendoPasado ? `Últimos · ${pastShown.length}` : `Próximos · ${upcoming.length}`}
        </span>
        {viendoPasado && hayMas && (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAST_PAGE)}
            className="font-mono-data text-[10px] text-black opacity-50 hover:opacity-100 hover:underline cursor-pointer leading-tight mt-0.5"
          >
            + anteriores
          </button>
        )}
      </div>
      {geo.stops.length > 1 && (
        <button
          type="button"
          onClick={() => page(-1)}
          disabled={pos <= geo.stops[0] + 1}
          aria-label="Ver eventos anteriores"
          className={arrowClass}
        >
          ◀
        </button>
      )}
      <div
        ref={scroller}
        onScroll={(e) => setPos(e.currentTarget.scrollLeft)}
        className="flex gap-2 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none max-w-full"
        style={{ width: geo.width }}
      >
        {pastShown.map((ev) => (
          <StripCard
            key={ev.eventoId}
            ev={ev}
            active={ev.eventoId === selected}
            past
            today={today}
            onPick={onPick}
          />
        ))}
        {pastShown.length > 0 && upcoming.length > 0 && (
          // 4px bar centered in the 8px gap: -6px on each side cancels its own
          // width plus one flex gap, so it adds no width to the grid.
          <div aria-hidden title="Hoy" className="w-1 -mx-1.5 shrink-0 bg-black" />
        )}
        {upcoming.map((ev) => (
          <StripCard
            key={ev.eventoId}
            ev={ev}
            active={ev.eventoId === selected}
            past={false}
            today={today}
            onPick={onPick}
          />
        ))}
        {geo.spacer != null && (
          <div aria-hidden className="shrink-0" style={{ width: geo.spacer }} />
        )}
      </div>
      {geo.stops.length > 1 && (
        <button
          type="button"
          onClick={() => page(1)}
          disabled={pos >= geo.last - 1}
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
  today,
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

  // Past = every event with a date that is not upcoming (same split as
  // getUpcomingEvents), newest first; ties by id so the order is stable.
  const pastEvents = useMemo(() => {
    const upcomingIds = new Set(upcomingEvents.map((e) => e.eventoId));
    return events
      .filter((e) => e.fechaEvento && !upcomingIds.has(e.eventoId))
      .sort(
        (a, b) =>
          b.fechaEvento.localeCompare(a.fechaEvento) || b.eventoId.localeCompare(a.eventoId),
      );
  }, [events, upcomingEvents]);

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
      params.delete("dia"); // a day belongs to one event
      router.push(`/marketing/weekly?${params.toString()}`);
    }
  }

  function handleEventChange(eventoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", eventoId);
    params.delete("dia"); // a day belongs to one event
    router.push(`/marketing/weekly?${params.toString()}`);
  }

  function handleStripClick(ev: EventOption) {
    setSelectedCategory(ev.categoriaEvento);
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", ev.eventoId);
    params.delete("dia"); // a day belongs to one event
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

      {(upcomingEvents.length > 0 || pastEvents.length > 0) && (
        <EventStrip
          past={pastEvents}
          upcoming={upcomingEvents}
          selected={selected}
          today={today}
          onPick={handleStripClick}
        />
      )}
    </div>
  );
}
