"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { DrillDayCell } from "@/lib/queries/inversion-medios";
import { deleteCellAction, upsertCellAction } from "../actions";
import { fmtUsd } from "./format";

/**
 * Celda editable del drill por plataforma: plan editable (arriba) + real
 * read-only (abajo), para un (evento, fecha, plataforma). Draft local →
 * blur/Enter guarda. Vacío ≠ $0: vaciar la celda BORRA la fila del plan.
 *
 * Código de color de TODO el dashboard: PLAN en morado (`--plan`, el acento de
 * esta ruta) y REAL en tinta (`--ink`). Sin foco el plan se muestra formateado
 * ($46); al enfocar, el número crudo para editar.
 *
 * `--plan` es token y no hex porque el morado del plan cambia entre temas: en
 * claro es #534AB7 y en oscuro el morado de marca #9F99F8. Con el hex fijo, el
 * monto que se está tecleando quedaba a 2,3:1 sobre la celda oscura.
 */
export default function CeldaPlan({
  eventoId,
  plataforma,
  tipo,
  cell,
  parcial,
  canEdit = true,
  onFill,
}: {
  eventoId: string;
  plataforma: string;
  /** Tipo de campaña del plan ('' = "Sin tipo", el plan histórico). */
  tipo: string;
  cell: DrillDayCell;
  /** Día de hoy (real parcial) o futuro sin datos aún. */
  parcial: boolean;
  /** false → celda read-only. Hoy siempre true: el grant de lectura habilita editar. */
  canEdit?: boolean;
  /** "Copiar hacia adelante": abre el rellenador de rango prellenado con el
   *  monto de ESTA celda. Solo lo pasan las filas de tipo con plan guardado. */
  onFill?: () => void;
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
        const res = await deleteCellAction({ eventoId, fecha: cell.fecha, plataforma, tipo });
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
      const res = await upsertCellAction({ eventoId, fecha: cell.fecha, plataforma, tipo, montoUsd: num });
      setError(!res.ok);
      if (res.ok) {
        router.refresh();
        setDraft(null);
      }
    });
  }

  return (
    <div className="group/celda relative flex min-w-16 flex-col items-stretch px-0.5 py-1">
      {/* Handle "copiar hacia adelante", visible al pasar sobre una celda con
          plan guardado. `onMouseDown` con preventDefault: si el input de al
          lado tiene el foco, el blur (que commitea) no debe robarse el clic.
          Sin z-index propio: la columna sticky (z-10) le sigue pasando por
          encima al scrollear. */}
      {canEdit && onFill && saved != null && draft === null && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onFill}
          title={`Copiar ${fmtUsd(saved, 0)} hacia adelante…`}
          aria-label={`Copiar ${fmtUsd(saved, 0)} hacia adelante`}
          className="absolute -right-0.5 -top-0.5 hidden h-4 w-4 items-center justify-center rounded border border-[var(--divider)] bg-[var(--surface)] text-[var(--plan)] hover:border-[#9F99F8] group-hover/celda:inline-flex"
        >
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      )}
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
          aria-label={`Plan ${plataforma}${tipo ? ` ${tipo}` : " sin tipo"} ${eventoId} ${cell.fecha}`}
          className={`w-full rounded border bg-transparent px-1 py-0.5 text-center tabular-nums text-xs font-medium text-[var(--plan)] transition-colors placeholder:text-[var(--divider)] focus:border-[#9F99F8] focus:bg-[var(--surface)] focus:outline-none ${
            error ? "border-[#ED75A0]" : "border-transparent hover:border-[var(--divider)]"
          } ${pending ? "opacity-50" : ""}`}
        />
      ) : (
        // Read-only: mismo lugar que el plan, sin input.
        <span className="px-1 py-0.5 text-center tabular-nums text-xs font-medium text-[var(--plan)]">
          {saved != null ? fmtUsd(saved, 0) : <span className="text-[var(--divider)]">·</span>}
        </span>
      )}
      <span
        className="mt-0.5 text-center tabular-nums text-[11px] leading-tight text-[var(--ink)]"
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
          <span className="text-[var(--divider)]">·</span>
        )}
      </span>
    </div>
  );
}
