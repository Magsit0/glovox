"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DrillDayCell } from "@/lib/queries/inversion-medios";
import { deleteCellAction, upsertCellAction } from "../actions";
import { fmtUsd } from "./format";

/**
 * Celda editable del drill por plataforma: plan editable (arriba) + real
 * read-only (abajo), para un (evento, fecha, plataforma). Draft local →
 * blur/Enter guarda. Vacío ≠ $0: vaciar la celda BORRA la fila del plan.
 */
export default function CeldaPlan({
  eventoId,
  plataforma,
  cell,
  parcial,
  canEdit = true,
}: {
  eventoId: string;
  plataforma: string;
  cell: DrillDayCell;
  /** Día de hoy (real parcial) o futuro sin datos aún. */
  parcial: boolean;
  /** false → celda read-only (usuario con grant pero sin rol superadmin). */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const saved = cell.plan;
  const [draft, setDraft] = useState<string | null>(null); // null = sin editar
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const shown = draft ?? (saved != null ? String(saved) : "");

  function commit() {
    if (draft === null) return; // no se tocó
    const raw = draft.trim();

    // Vacío → borrar la celda (si existía). Vacío ≠ $0.
    if (raw === "") {
      if (saved == null) {
        setDraft(null);
        return;
      }
      start(async () => {
        const res = await deleteCellAction({ eventoId, fecha: cell.fecha, plataforma });
        setError(!res.ok);
        if (res.ok) {
          router.refresh();
          setDraft(null);
        }
      });
      return;
    }

    // Solo se tolera formato de moneda ($, espacios) y coma decimal. Basura
    // ("abc") o negativos NO se coercionan a un monto válido: error visible.
    const cleaned = raw.replace(/[$\s]/g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!cleaned || !Number.isFinite(num) || num < 0) {
      setError(true);
      return; // draft se conserva para corregir
    }
    if (saved != null && Math.abs(saved - num) < 0.005) {
      setDraft(null); // sin cambio
      setError(false);
      return;
    }
    start(async () => {
      const res = await upsertCellAction({ eventoId, fecha: cell.fecha, plataforma, montoUsd: num });
      setError(!res.ok);
      if (res.ok) {
        router.refresh();
        setDraft(null);
      }
    });
  }

  return (
    <div className="flex min-w-16 flex-col items-stretch px-0.5 py-1">
      {canEdit ? (
        <input
          value={shown}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(null);
          }}
          disabled={pending}
          inputMode="decimal"
          placeholder="·"
          aria-label={`Plan ${plataforma} ${eventoId} ${cell.fecha}`}
          className={`w-full rounded border bg-transparent px-1 py-0.5 text-center tabular-nums text-xs text-[#333333] transition-colors placeholder:text-[#E5E5E5] focus:border-[#9F99F8] focus:bg-white focus:outline-none ${
            error ? "border-[#ED75A0]" : "border-transparent hover:border-[#E5E5E5]"
          } ${pending ? "opacity-50" : ""}`}
        />
      ) : (
        // Read-only: mismo lugar que el plan, sin input.
        <span className="px-1 py-0.5 text-center tabular-nums text-xs text-[#333333]">
          {saved != null ? fmtUsd(saved, 0) : <span className="text-[#E5E5E5]">·</span>}
        </span>
      )}
      <span
        className="mt-0.5 text-center tabular-nums text-[11px] leading-tight text-[#999999]"
        title={
          cell.real != null
            ? `Real ${fmtUsd(cell.real)}${cell.fxImputado ? " · FX imputado (finde/feriado)" : ""}${parcial ? " · parcial" : ""}`
            : cell.sinFx
              ? "Hay gasto en moneda sin tipo de cambio a USD"
              : ""
        }
      >
        {cell.sinFx ? (
          <>
            {cell.real != null && cell.real > 0 ? `${fmtUsd(cell.real, 0)} ` : ""}
            <span className="font-medium text-[#EF8C34]">+sin FX</span>
          </>
        ) : cell.real != null && cell.real > 0 ? (
          <>
            {fmtUsd(cell.real, 0)}
            {parcial ? "…" : ""}
          </>
        ) : (
          "·"
        )}
      </span>
    </div>
  );
}
