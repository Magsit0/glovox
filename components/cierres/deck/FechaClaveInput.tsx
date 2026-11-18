"use client";

import { useRef, useState, useTransition } from "react";
import { anotarFechaClaveAction } from "@/app/cierres/actions";
import { FECHA_ISO_RE } from "@/lib/cierres/hitos";

/**
 * Campo para anotar desde la lámina la fecha real de una fecha clave del
 * evento. Escribe en la carta Gantt (glovox-produccion) y la page se vuelve a
 * renderizar con el dato nuevo (revalidatePath en la action): el texto de la
 * fila lo arma el servidor, aquí solo va el campo. Solo lo recibe quien puede
 * editar; no sale en el PDF.
 */
export function FechaClaveInput({
  slug,
  fechaClaveId,
  fecha,
  max,
  label,
}: {
  /** Slug del evento en EVENTOS_CIERRE. */
  slug: string;
  fechaClaveId: string;
  /** Fecha guardada (ISO) o null. */
  fecha: string | null;
  /** Último día válido: el del evento (ISO). */
  max: string;
  /** Nombre accesible del campo. */
  label: string;
}) {
  const [valor, setValor] = useState(fecha ?? "");
  const [error, setError] = useState(false);
  const [listo, setListo] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    setValor(v);
    setError(false);
    setListo(false);
    if (timer.current) clearTimeout(timer.current);
    // El campo de fecha avisa cada vez que se completa un segmento (al tipear
    // el año pasa por 0002, 0020…): se guarda solo una fecha válida y quieta.
    if (!FECHA_ISO_RE.test(v) || v < "2020-01-01" || v > max || v === fecha) return;
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const r = await anotarFechaClaveAction(slug, fechaClaveId, v);
        if (r.ok) setListo(true);
        else {
          setValor(fecha ?? "");
          setError(true);
        }
      });
    }, 600);
  };

  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-2 print:hidden" data-no-print="true">
      <input
        type="date"
        aria-label={label}
        value={valor}
        min="2020-01-01"
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)] transition-colors hover:border-[var(--ink)] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
      />
      <span aria-live="polite" className="text-xs text-[var(--ink-subtle)]">
        {pending ? "Guardando en la carta Gantt…" : error ? "No se pudo guardar" : listo ? "Guardado en la carta Gantt" : ""}
      </span>
    </span>
  );
}
