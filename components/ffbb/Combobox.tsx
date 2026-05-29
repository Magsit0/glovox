"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react";

interface Props {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /**
   * Si se define, habilita "+ Agregar <query>" cuando no hay match.
   * Debe persistir el nuevo valor y devolverlo (o null si falló).
   */
  onCreate?: (query: string) => Promise<string | null>;
  createLabel?: (query: string) => string;
  /**
   * Si el `value` no está en `options` ni en `newlyCreated`, mostrar este badge
   * dentro del trigger (ej. "no listado"). Útil para marcar valores legacy
   * que vienen de la DB pero no están en el catálogo actual.
   */
  unknownBadge?: string;
  id?: string;
  ariaLabel?: string;
}

const MAX_DROPDOWN_HEIGHT = 320;
const GAP = 4;

export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  onCreate,
  createLabel,
  unknownBadge,
  id,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newlyCreated, setNewlyCreated] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    placement: "below" | "above";
  } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mergeamos `options` con `newlyCreated` para que recién creados aparezcan
  // hasta que el padre refresque y los traiga vía props.
  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const opt of [...options, ...newlyCreated]) {
      const key = opt.trim();
      if (!key || seen.has(key.toLowerCase())) continue;
      seen.add(key.toLowerCase());
      out.push(opt);
    }
    return out;
  }, [options, newlyCreated]);

  const isUnknownValue = !!unknownBadge && value.length > 0 && !allOptions.includes(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions.slice(0, 500);
    return allOptions.filter((o) => o.toLowerCase().includes(q)).slice(0, 500);
  }, [allOptions, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return allOptions.some((o) => o.toLowerCase() === q);
  }, [allOptions, query]);

  // Reset del error al abrir (render-phase update).
  const [prevOpenForError, setPrevOpenForError] = useState(open);
  if (prevOpenForError !== open) {
    setPrevOpenForError(open);
    if (open) setCreateError(null);
  }

  // Calcular posición fixed del dropdown a partir del trigger.
  const updatePosition = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const r = trig.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - r.bottom - 8;
    const spaceAbove = r.top - 8;
    // Si no entra debajo y arriba hay más espacio, abrir hacia arriba.
    const placement: "below" | "above" =
      spaceBelow >= Math.min(MAX_DROPDOWN_HEIGHT, 240) || spaceBelow >= spaceAbove
        ? "below"
        : "above";
    setPosition({
      top: placement === "below" ? r.bottom + GAP : r.top - GAP,
      left: r.left,
      width: r.width,
      placement,
    });
  }, []);

  // Reset de la posición cuando se cierra (render-phase).
  const [prevOpenForPos, setPrevOpenForPos] = useState(open);
  if (prevOpenForPos !== open) {
    setPrevOpenForPos(open);
    if (!open) setPosition(null);
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function onScroll() {
      updatePosition();
    }
    function onResize() {
      updatePosition();
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  // Click fuera + Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
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

  function handleSelect(next: string) {
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  function handleCreate() {
    const next = query.trim();
    if (!onCreate || !next) return;
    setCreateError(null);
    startCreate(async () => {
      const created = await onCreate(next);
      if (!created) {
        setCreateError("No se pudo crear");
        return;
      }
      setNewlyCreated((prev) => (prev.includes(created) ? prev : [...prev, created]));
      onChange(created);
      setQuery("");
      setOpen(false);
    });
  }

  const dropdown =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            style={{
              position: "fixed",
              top: position.placement === "below" ? position.top : undefined,
              bottom:
                position.placement === "above"
                  ? window.innerHeight - position.top
                  : undefined,
              left: position.left,
              width: position.width,
              maxHeight: MAX_DROPDOWN_HEIGHT,
              zIndex: 100,
            }}
            className="flex flex-col overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-md"
          >
            <div className="shrink-0 border-b border-[#E5E5E5] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCreateError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filtered.length === 1) {
                        handleSelect(filtered[0]);
                      } else if (!exactMatch && onCreate && query.trim()) {
                        handleCreate();
                      }
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                />
              </div>
            </div>
            <ul className="flex-1 overflow-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-3 text-center">
                  {onCreate && query.trim() ? (
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating}
                      className="inline-flex items-center gap-1.5 font-sans text-sm text-[#9F99F8] hover:underline disabled:opacity-50"
                    >
                      {creating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      {createLabel ? createLabel(query.trim()) : `Agregar "${query.trim()}"`}
                    </button>
                  ) : (
                    <span className="font-sans text-sm text-[#999999]">Sin resultados</span>
                  )}
                </li>
              ) : (
                filtered.map((opt) => {
                  const isActive = opt === value;
                  return (
                    <li key={opt} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => handleSelect(opt)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm transition-colors ${
                          isActive
                            ? "bg-[#F0EFFE] text-[#9F99F8]"
                            : "text-[#333333] hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{opt}</span>
                        {isActive && <Check className="h-4 w-4 shrink-0 text-[#9F99F8]" />}
                      </button>
                    </li>
                  );
                })
              )}
              {filtered.length > 0 && onCreate && query.trim() && !exactMatch && (
                <li className="border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm text-[#9F99F8] transition-colors hover:bg-[#F0EFFE] disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {createLabel ? createLabel(query.trim()) : `Agregar "${query.trim()}"`}
                  </button>
                </li>
              )}
            </ul>
            {createError && (
              <div className="shrink-0 border-t border-[#E5E5E5] px-3 py-2 font-sans text-xs text-[#A8336B]">
                {createError}
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left font-sans text-sm transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] ${
          isUnknownValue ? "border-[#F6C544]" : "border-[#E5E5E5]"
        } ${value ? "text-[#333333]" : "text-[#999999]"}`}
      >
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
        {isUnknownValue && unknownBadge && (
          <span
            className="shrink-0 rounded-full bg-[#FFF7DD] px-2 py-0.5 font-sans text-[10px] font-medium text-[#7A5C00]"
            title="No coincide con el catálogo actual"
          >
            {unknownBadge}
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-[#999999]" aria-hidden="true" />
      </button>
      {dropdown}
    </div>
  );
}
