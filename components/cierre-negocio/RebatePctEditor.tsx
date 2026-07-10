"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { upsertRebatePctAction } from "@/app/cierre-negocio/rebate-actions";

interface Props {
  eventoId: string;
  /** % actual en puntos porcentuales (55 = 55%). */
  porcentaje: number;
}

/**
 * Editor inline del % de rebate en la card "Rebate" del cierre de negocio.
 * Muestra "N% del cargo por servicio" con un lápiz para editar; guarda vía
 * server action y refresca la página (el monto de la card se recalcula server-side).
 */
export default function RebatePctEditor({ eventoId, porcentaje }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(porcentaje));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    // Rechazar (no clampear en silencio) valores fuera de rango: escribir 550
    // no debe guardarse como 100 sin que el usuario lo note.
    const pct = Number(String(value).trim().replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Número entre 0 y 100");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertRebatePctAction({ eventoId, porcentaje: pct });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setValue(String(porcentaje));
    setError(null);
    setEditing(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") cancel();
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-sans text-xs font-medium text-[#333333]">
          {porcentaje}% del cargo por servicio
        </span>
        <button
          type="button"
          data-no-print="true"
          onClick={() => {
            setValue(String(porcentaje));
            setEditing(true);
          }}
          aria-label="Editar porcentaje de rebate"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-[#999999] transition-colors hover:bg-white hover:text-[#333333]"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <>
      {/* Si se imprime con el editor abierto, el PDF conserva el % vigente. */}
      <span className="print-only font-sans text-xs font-medium text-[#333333]">
        {porcentaje}% del cargo por servicio
      </span>
      <span className="inline-flex flex-wrap items-center gap-1.5" data-no-print="true">
        <input
        type="number"
        min={0}
        max={100}
        step="any"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        disabled={pending}
        aria-label="Porcentaje de rebate"
        className="w-16 rounded border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-xs text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
      />
      <span className="font-sans text-xs text-[#666666]">% del cargo por servicio</span>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        aria-label="Guardar porcentaje"
        className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#9F99F8] text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        aria-label="Cancelar edición"
        className="inline-flex h-5 w-5 items-center justify-center rounded text-[#666666] transition-colors hover:bg-white hover:text-[#333333] disabled:opacity-60"
      >
        <X className="h-3 w-3" />
      </button>
      {error && <span className="font-sans text-xs text-[#ED75A0]">{error}</span>}
      </span>
    </>
  );
}
