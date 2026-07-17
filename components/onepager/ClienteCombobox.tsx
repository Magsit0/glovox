"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MarcaClienteRow } from "@/lib/queries/marca";
import { createMarcaClienteAction } from "@/app/onepager/marca-actions";
import { formatRut, isValidRut, normalizeRut } from "@/lib/utils/rut";

type CreatedCliente = {
  id: string;
  nombre: string;
  facturadorId: string;
  rut: string;
  razonSocial: string;
};

type Props = {
  clientes: MarcaClienteRow[];
  value: string | null; // selected cliente.id
  onChange: (id: string | null) => void;
  onClienteCreated?: (c: CreatedCliente) => void;
};

/**
 * Combobox brutalista para seleccionar (o crear inline) una marca.
 *
 * Mini-form de creación: pide nombre de la marca, RUT del facturador y razón
 * social del facturador. Si el RUT ya existe entre los clientes pasados como
 * prop, auto-detectamos el facturador y la razón social se vuelve read-only
 * (no permitimos crear con razon_social distinta — para cambiarla hay que
 * usar el flujo de editar marca/facturador).
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
  const [newNombre, setNewNombre] = useState("");
  const [newRut, setNewRut] = useState("");
  const [newRazonSocial, setNewRazonSocial] = useState("");
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
    const qStripped = q.replace(/[.\s-]/g, "");
    return clientes
      .filter((c) => {
        if (c.nombre.toLowerCase().includes(q)) return true;
        if (c.razonSocial.toLowerCase().includes(q)) return true;
        const rutStripped = c.rut.replace(/[.\s-]/g, "").toLowerCase();
        return rutStripped.includes(qStripped);
      })
      .slice(0, 200);
  }, [clientes, query]);

  const rutPreview = useMemo(() => {
    const trimmed = newRut.trim();
    if (!trimmed) return null;
    const norm = normalizeRut(trimmed);
    if (!norm) return { ok: false as const, message: "Formato inválido" };
    if (!isValidRut(norm)) {
      return { ok: false as const, message: "Dígito verificador no coincide" };
    }
    return {
      ok: true as const,
      canon: norm,
      message: `Se guardará como ${formatRut(norm)}`,
    };
  }, [newRut]);

  // Si el RUT ya existe entre los clientes, lockeamos razon_social: usamos la
  // del facturador existente. Esto evita inconsistencias accidentales.
  const existingFacturador = useMemo(() => {
    if (!rutPreview || !rutPreview.ok) return null;
    const canon = rutPreview.canon;
    return clientes.find((c) => c.rut === canon) ?? null;
  }, [rutPreview, clientes]);

  const lockedRazonSocial = existingFacturador?.razonSocial ?? null;

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
    setNewNombre(query.trim());
    setNewRut("");
    setNewRazonSocial("");
    setCreateError(null);
    setCreating(true);
  }

  function handleSave() {
    setCreateError(null);
    startSave(async () => {
      const res = await createMarcaClienteAction({
        nombre: newNombre,
        rut: newRut,
        razonSocial: lockedRazonSocial ?? newRazonSocial,
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
    : "Seleccionar marca…";

  const razonSocialValue = lockedRazonSocial ?? newRazonSocial;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center justify-between gap-3 w-full rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm cursor-pointer transition-colors duration-150 hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] ${
          selected ? "bg-[#F0EFFE] text-[#9F99F8]" : "bg-white text-[#333333]"
        }`}
      >
        <span className="truncate text-left">{triggerText}</span>
        <span aria-hidden className="leading-none text-[#999999]">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 w-full min-w-[320px] bg-white border border-[#E5E5E5] shadow-md rounded-lg overflow-hidden"
        >
          {!creating && (
            <>
              <div className="p-2 border-b border-[#E5E5E5]">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar marca, razón social o RUT…"
                  autoFocus
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                />
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="font-sans text-sm text-[#999999] px-3 py-3">
                    Sin marcas que coincidan.
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
                        className={`flex flex-col items-start w-full text-left px-3 py-2 border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150 ${
                          active ? "bg-[#F0EFFE] text-[#9F99F8]" : "text-[#333333]"
                        }`}
                      >
                        <span className="font-sans text-sm font-medium truncate w-full">
                          {c.nombre}
                        </span>
                        <span className="font-sans text-xs text-[#666666] truncate w-full">
                          {c.razonSocial} · {formatRut(c.rut)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={startCreate}
                className="w-full text-left px-3 py-2 border-t border-[#E5E5E5] bg-white hover:bg-[#FAFAFA] font-sans text-sm font-medium text-[#9F99F8] cursor-pointer transition-colors duration-150"
              >
                + Crear marca nueva
              </button>
            </>
          )}

          {creating && (
            <div className="p-3 space-y-2">
              <p className="font-sans text-xs text-[#666666]">
                Nueva marca
              </p>
              <input
                type="text"
                placeholder="Nombre de la marca (Xtreme, Entel...)"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
              <div>
                <input
                  type="text"
                  placeholder="RUT del facturador (ej. 76.123.456-7)"
                  value={newRut}
                  onChange={(e) => setNewRut(e.target.value)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:outline-none focus:ring-1 ${
                    rutPreview && !rutPreview.ok
                      ? "border-[#ED75A0] focus:border-[#ED75A0] focus:ring-[#ED75A0]"
                      : "border-[#E5E5E5] hover:border-[#333333] focus:border-[#9F99F8] focus:ring-[#9F99F8]"
                  }`}
                />
                {rutPreview && (
                  <p
                    className={`mt-1 font-sans text-xs ${
                      rutPreview.ok ? "text-[#666666]" : "text-[#ED75A0]"
                    }`}
                  >
                    {rutPreview.message}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Razón social del facturador"
                  value={razonSocialValue}
                  onChange={(e) =>
                    lockedRazonSocial == null
                      ? setNewRazonSocial(e.target.value)
                      : undefined
                  }
                  readOnly={lockedRazonSocial != null}
                  className={`w-full rounded-lg border border-[#E5E5E5] px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] ${
                    lockedRazonSocial != null ? "bg-[#FAFAFA] cursor-not-allowed" : "bg-white hover:border-[#333333]"
                  }`}
                />
                {lockedRazonSocial != null && (
                  <p className="mt-1 font-sans text-xs text-[#666666]">
                    Facturador existente — se reutilizará.
                  </p>
                )}
              </div>
              {createError && (
                <p className="font-sans text-xs text-[#ED75A0]">
                  {createError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={savePending}
                  className="flex-1 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer disabled:opacity-50 transition-colors"
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
                    !rutPreview.ok ||
                    !razonSocialValue.trim()
                  }
                  className="flex-1 rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer disabled:opacity-50 transition-colors"
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
