"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MarcaCliente } from "@/db/schema";
import { createMarcaClienteAction } from "@/app/onepager/marca-actions";
import { formatRut, isValidRut, normalizeRut } from "@/lib/utils/rut";

type Props = {
  clientes: MarcaCliente[];
  value: string | null; // selected cliente.id
  onChange: (id: string | null) => void;
  onClienteCreated?: (c: { id: string; rut: string; nombre: string }) => void;
};

/**
 * Combobox brutalista para seleccionar (o crear inline) un cliente-marca.
 * El estilo sigue el lenguaje del onepager: bordes negros gruesos, acento
 * #FFFF00, font-mono-data. Para crear muestra un mini-form inline con RUT +
 * Nombre — ambos requeridos. Si el RUT ya existe en DB devuelve el cliente
 * existente sin duplicar.
 */
export default function ClienteCombobox({
  clientes,
  value,
  onChange,
  onClienteCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRut, setNewRut] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => clientes.find((c) => c.id === value) ?? null,
    [clientes, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes.slice(0, 200);
    // Normalizamos la query para que "97004000-5" matchee tanto el storage
    // canónico como el display con puntos.
    const qStripped = q.replace(/[.\s-]/g, "");
    return clientes
      .filter((c) => {
        if (c.nombre.toLowerCase().includes(q)) return true;
        const rutStripped = c.rut.replace(/[.\s-]/g, "").toLowerCase();
        return rutStripped.includes(qStripped);
      })
      .slice(0, 200);
  }, [clientes, query]);

  // Preview de cómo se guardará el RUT y si es válido (módulo-11). Da feedback
  // inmediato al usuario antes de hacer click en Guardar.
  const rutPreview = useMemo(() => {
    const trimmed = newRut.trim();
    if (!trimmed) return null;
    const norm = normalizeRut(trimmed);
    if (!norm) return { ok: false as const, message: "Formato inválido" };
    if (!isValidRut(norm)) {
      return { ok: false as const, message: "Dígito verificador no coincide" };
    }
    return { ok: true as const, message: `Se guardará como ${formatRut(norm)}` };
  }, [newRut]);

  // Click-outside + Escape para cerrar
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function startCreate() {
    // Si el usuario tipeó algo, lo usamos como nombre por defecto.
    setNewNombre(query.trim());
    setNewRut("");
    setCreateError(null);
    setCreating(true);
  }

  function handleSave() {
    setCreateError(null);
    startSave(async () => {
      const res = await createMarcaClienteAction({
        rut: newRut,
        nombre: newNombre,
      });
      if (!res.ok || !res.data) {
        setCreateError(res.ok ? "Error desconocido" : res.error);
        return;
      }
      onClienteCreated?.(res.data);
      onChange(res.data.id);
      setOpen(false);
      setCreating(false);
      setQuery("");
    });
  }

  const triggerText = selected
    ? `${selected.nombre} — ${formatRut(selected.rut)}`
    : "Seleccionar cliente…";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center justify-between gap-3 w-full font-mono-data uppercase text-xs px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00] ${
          selected ? "bg-[#FFFF00]" : "bg-white"
        }`}
      >
        <span className="truncate text-left">{triggerText}</span>
        <span aria-hidden className="font-bold leading-none">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 w-full min-w-[280px] bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none"
        >
          {!creating && (
            <>
              <div className="bg-black p-2 border-b-2 border-black">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar nombre o RUT…"
                  autoFocus
                  className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-white bg-white text-black placeholder:text-black/40 outline-none"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="font-mono-data text-xs text-black/50 px-3 py-3">
                    Sin clientes que coincidan.
                  </div>
                ) : (
                  filtered.map((c) => {
                    const active = c.id === value;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        key={c.id}
                        onClick={() => {
                          onChange(c.id);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={`flex flex-col items-start w-full text-left px-3 py-2 border-b border-black/20 last:border-b-0 hover:bg-[#FFFF00] cursor-pointer transition-colors duration-150 ${
                          active ? "bg-[#FFFF00]" : ""
                        }`}
                      >
                        <span className="font-mono-data uppercase text-xs font-bold truncate w-full">
                          {c.nombre}
                        </span>
                        <span className="font-mono-data text-[10px] text-black/60">
                          {formatRut(c.rut)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={startCreate}
                className="w-full text-left px-3 py-2 border-t-2 border-black bg-white hover:bg-[#FFFF00] font-mono-data uppercase text-xs font-bold cursor-pointer transition-colors duration-150"
              >
                + Crear cliente nuevo
              </button>
            </>
          )}

          {creating && (
            <div className="p-3 space-y-2">
              <p className="font-mono-data uppercase text-[10px] text-black/70">
                Nuevo cliente
              </p>
              <div>
                <input
                  type="text"
                  placeholder="RUT (ej. 76.123.456-7)"
                  value={newRut}
                  onChange={(e) => setNewRut(e.target.value)}
                  autoFocus
                  className={`w-full font-mono-data text-xs px-2 py-1.5 border-2 outline-none focus:bg-[#FFFF00]/30 ${
                    rutPreview && !rutPreview.ok
                      ? "border-[#FF0000]"
                      : "border-black"
                  }`}
                />
                {rutPreview && (
                  <p
                    className={`mt-1 font-mono-data text-[10px] ${
                      rutPreview.ok ? "text-black/60" : "text-[#FF0000]"
                    }`}
                  >
                    {rutPreview.message}
                  </p>
                )}
              </div>
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
              />
              {createError && (
                <p className="font-mono-data text-[10px] text-[#FF0000]">
                  {createError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={savePending}
                  className="flex-1 font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-white hover:bg-[#FFFF00] cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    savePending ||
                    !newNombre.trim() ||
                    !rutPreview ||
                    !rutPreview.ok
                  }
                  className="flex-1 font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-black text-[#FFFF00] hover:bg-[#FFFF00] hover:text-black cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {savePending ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
