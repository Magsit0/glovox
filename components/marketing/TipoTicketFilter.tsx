"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryWeekly } from "@/components/marketing/WeeklyQueryProvider";
import { opcionesVisibles } from "@/lib/filters/facetas";
import {
  leerSeleccion,
  normalizarSeleccion,
  reemplazarSeleccion,
} from "@/lib/filters/url";

type Option = { tipoTicket: string; tickets: number };

type Props = {
  /** Tipos de los eventos del gráfico (principal + comparativos). */
  options: Option[];
};

const PARAM = "tipoTicket";

// Multi-select for `TipoTicket` over the union of visible events (main +
// comparators). State is persisted in the URL as `tipoTicket=...` so the
// server component on /marketing/weekly can read it and refetch the chart.
//
// Keeps the page's brutalist look (StandardMultiFilter would clash with it) but
// follows the project's filter rule (lib/filters/): empty = all types; changing
// or clearing it writes ONLY `tipoTicket`; switching events never drops the
// selection. A selected type the visible events don't have stays listed,
// dimmed and pinned on top, so it can be unchecked on its own. When nothing is
// left, the page shows BrutalFilterConflictNotice instead of the chart.
export default function TipoTicketFilter({ options }: Props) {
  // Query vigente de la página (WeeklyQueryProvider): el último cambio pedido
  // aunque el servidor no haya respondido, compartido con Landing y el aviso,
  // para que clics seguidos en cualquiera de ellos se sumen.
  const { search, navegar } = useQueryWeekly();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Lo que estaba seleccionado al abrir sube al principio (incluido lo que no
  // está en estos eventos). Se fija al abrir para que las filas no salten.
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
  const tickets = useMemo(
    () => new Map(options.map((o) => [o.tipoTicket, o.tickets])),
    [options],
  );
  // Tipos que existen en los eventos del gráfico; lo demás se ve atenuado.
  const available = useMemo(() => new Set(tickets.keys()), [tickets]);
  // Opciones del evento (por volumen) + lo ya seleccionado aunque no esté.
  const visibles = useMemo(
    () => opcionesVisibles(options.map((o) => o.tipoTicket), available, selected),
    [options, available, selected],
  );

  // Escribe SOLO `tipoTicket`. Marcar todos los tipos de los eventos del
  // gráfico es la venta completa: se guarda como "Todos" (normalizarSeleccion).
  // Solo si no queda elegido un tipo que estos eventos no tienen: ese universo
  // depende del evento, y normalizar borraría de la URL un tipo incompatible
  // que nadie desmarcó (al volver al evento original ya no estaría).
  function commit(next: Iterable<string>) {
    const lista = [...next];
    navegar(
      reemplazarSeleccion(
        search,
        PARAM,
        lista.every((v) => available.has(v))
          ? normalizarSeleccion(lista, available)
          : lista,
      ),
    );
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
      ? visibles.filter((v) => v.toLowerCase().includes(q))
      : visibles;
    if (pinned.size === 0) return matches;
    return [
      ...matches.filter((v) => pinned.has(v)),
      ...matches.filter((v) => !pinned.has(v)),
    ];
  }, [visibles, query, pinned]);

  const triggerLabel =
    selected.size === 0
      ? "Todos los tipos"
      : selected.size === 1
        ? Array.from(selected)[0]
        : `${selected.size} tipos`;

  return (
    <div ref={ref} className="relative mb-3 inline-block">
      <button
        type="button"
        onClick={() => {
          if (!open) setPinned(new Set(selected));
          setOpen(!open);
        }}
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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tipo ticket..."
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
              filtered.map((tipo) => {
                const isSelected = selected.has(tipo);
                const unavailable = !available.has(tipo);
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => toggle(tipo)}
                    aria-pressed={isSelected}
                    title={
                      unavailable
                        ? "No está en los eventos del gráfico"
                        : undefined
                    }
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
                    <span className="flex-1">{tipo}</span>
                    <span className="text-black/50 tabular-nums">
                      {unavailable
                        ? "sin datos"
                        : (tickets.get(tipo) ?? 0).toLocaleString("es-CL")}
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
