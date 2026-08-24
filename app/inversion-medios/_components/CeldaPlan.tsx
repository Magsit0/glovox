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
 *
 * Código de color de TODO el dashboard: PLAN en morado (#534AB7, el acento de
 * esta ruta) y REAL en tinta (#333333). Sin foco el plan se muestra formateado
 * ($46); al enfocar, el número crudo para editar.
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
  /** false → celda read-only. Hoy siempre true: el grant de lectura habilita editar. */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const saved = cell.plan;
  const [draft, setDraft] = useState<string | null>(null); // null = sin editar
  const [focused, setFocused] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  // En reposo el plan se ve como moneda ($46); con foco, crudo para editar.
  const shown =
    draft ?? (saved != null ? (focused ? String(saved) : fmtUsd(saved, 0)) : "");

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
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraft(null);
          }}
          disabled={pending}
          inputMode="decimal"
          placeholder="·"
          aria-label={`Plan ${plataforma} ${eventoId} ${cell.fecha}`}
          className={`w-full rounded border bg-transparent px-1 py-0.5 text-center tabular-nums text-xs font-medium text-[#534AB7] transition-colors placeholder:text-[#E5E5E5] focus:border-[#9F99F8] focus:bg-white focus:outline-none ${
            error ? "border-[#ED75A0]" : "border-transparent hover:border-[#E5E5E5]"
          } ${pending ? "opacity-50" : ""}`}
        />
      ) : (
        // Read-only: mismo lugar que el plan, sin input.
        <span className="px-1 py-0.5 text-center tabular-nums text-xs font-medium text-[#534AB7]">
          {saved != null ? fmtUsd(saved, 0) : <span className="text-[#E5E5E5]">·</span>}
        </span>
      )}
      <span
        className="mt-0.5 text-center tabular-nums text-[11px] leading-tight text-[#333333]"
        title={
          cell.real != null
            ? `Real ${fmtUsd(cell.real)}${cell.fxImputado ? " · FX imputado (último disponible)" : ""}${parcial ? " · parcial" : ""}`
            : cell.sinFx
              ? "Hay gasto en una moneda sin NINGÚN tipo de cambio conocido (no se pudo convertir ni con el último FX disponible)"
              : ""
        }
      >
        {cell.sinFx ? (
          <>
            {cell.real != null && cell.real > 0 ? `${fmtUsd(cell.real, 0)} ` : ""}
            <span className="font-medium text-[#EF8C34]">+sin FX</span>
          </>
        ) : cell.real != null && cell.real > 0 ? (
          // Sin sufijo "…" para el día parcial: se leía como monto truncado.
          // El aviso "parcial" vive en el tooltip (title de arriba).
          fmtUsd(cell.real, 0)
        ) : (
          <span className="text-[#E5E5E5]">·</span>
        )}
      </span>
    </div>
  );
}
