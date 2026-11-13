"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryWeekly } from "@/components/marketing/WeeklyQueryProvider";
import { opcionesVisibles } from "@/lib/filters/facetas";
import { leerSeleccion, reemplazarSeleccion } from "@/lib/filters/url";

type Props = {
  /** Landing pages de la propiedad GA4 del evento. */
  landingPages: string[];
};

const PARAM = "landingPage";

// Landing-page filter of the Funnel panel. Keeps the page's brutalist look
// (StandardMultiFilter would clash with it) but follows the project's filter
// rule (lib/filters/): empty = the event's landings; changing or clearing it
// writes ONLY `landingPage`; switching events never drops the selection (Piknic
// reuses its slug across editions). A selected landing the new event doesn't
// have stays listed, dimmed and pinned on top, so it can be unchecked on its
// own. When the funnel comes back empty, the page shows BrutalFilterConflictNotice.
export default function FunnelLandingPageFilter({ landingPages }: Props) {
  // Query vigente de la página (WeeklyQueryProvider): el último cambio pedido
  // aunque el servidor no haya respondido, compartido con Tipo Ticket y el
  // aviso, para que clics seguidos en cualquiera de ellos se sumen.
  const { search, navegar } = useQueryWeekly();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Lo que estaba seleccionado al abrir sube al principio (incluido lo que no
  // está en este evento). Se fija al abrir para que las filas no salten.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(() => new Set());
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

  const selected = useMemo(
    () => leerSeleccion(new URLSearchParams(search), PARAM),
    [search],
  );
  // Landings del evento; lo seleccionado que no está se ve atenuado.
  const available = useMemo(() => new Set(landingPages), [landingPages]);
  const visibles = useMemo(
    () => opcionesVisibles(landingPages, available, selected),
    [landingPages, available, selected],
  );

  // Escribe SOLO `landingPage`. Sin normalizarSeleccion a propósito: "Todas"
  // son las landings del evento (mapa + links con su código) y marcar todas
  // las de la propiedad GA4 incluye las de otros eventos, así que no es lo
  // mismo y se guarda tal cual.
  function commit(next: Iterable<string>) {
    navegar(reemplazarSeleccion(search, PARAM, next));
  }

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    commit(next);
  }

  function clearAll() {
    commit([]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? visibles.filter((lp) => lp.toLowerCase().includes(q))
      : visibles;
    if (pinned.size === 0) return matches;
    return [
      ...matches.filter((lp) => pinned.has(lp)),
      ...matches.filter((lp) => !pinned.has(lp)),
    ];
  }, [visibles, query, pinned]);

  const triggerLabel =
    selected.size === 0
      ? "Todas las landing pages"
      : selected.size === 1
        ? Array.from(selected)[0]
        : `${selected.size} landing pages`;

  return (
    <div ref={ref} className="relative mb-3">
      <button
        type="button"
        onClick={() => {
          if (!open) setPinned(new Set(selected));
          setOpen(!open);
        }}
        className="bg-white border-4 border-black rounded-none font-mono-data text-xs px-3 py-1.5 text-black cursor-pointer flex items-center gap-2 max-w-full justify-between shadow-[4px_4px_0px_#000] hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <span className="truncate max-w-[280px]">
          Landing: {triggerLabel}
        </span>
        <span className="font-display text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-40 bg-white border-4 border-black rounded-none shadow-[4px_4px_0px_#000] min-w-[320px] w-max max-w-[520px]">
          <div className="p-2 border-b-2 border-black flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar landing page..."
              className="flex-1 bg-white border-2 border-black rounded-none font-mono-data text-xs px-2 py-1 text-black placeholder:text-black/40 focus:outline-none focus:bg-[#FFFF00]"
            />
            {selected.size > 0 && (
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
              filtered.map((lp) => {
                const isSelected = selected.has(lp);
                const unavailable = !available.has(lp);
                return (
                  <button
                    key={lp}
                    type="button"
                    onClick={() => toggle(lp)}
                    aria-pressed={isSelected}
                    title={unavailable ? "No está en este evento" : undefined}
                    className={`w-full text-left px-3 py-2 font-mono-data text-xs border-b-2 border-black last:border-b-0 transition-colors duration-150 cursor-pointer break-all flex items-start gap-2 ${
                      isSelected
                        ? "bg-[#FFFF00] text-black font-bold"
                        : "hover:bg-[#FFFF00] text-black"
                    } ${unavailable ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-flex items-center justify-center w-4 h-4 mt-[1px] border-2 border-black flex-shrink-0 ${
                        isSelected ? "bg-black text-[#FFFF00]" : "bg-white"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                    <span className="flex-1">{lp}</span>
                    {unavailable && (
                      <span className="text-black/50">sin datos</span>
                    )}
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
