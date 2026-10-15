"use client";

import { useId, useMemo, useState } from "react";
import { buildRangos, DIAS_RANGO, type DiaSubtotal } from "@/lib/inversion-medios/rango";
import SubtotalPeriodoCard from "./SubtotalPeriodoCard";

const OPCIONES = [
  { label: "Semana completa", inicio: 0, fin: 6 },
  { label: "Lunes a viernes", inicio: 0, fin: 4 },
  { label: "Viernes a martes", inicio: 4, fin: 1 },
];
const control = "min-h-11 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 font-sans text-sm text-[var(--ink)] transition-colors hover:bg-[var(--surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--plan)]";

export default function SubtotalRango({
  dias, realMaxFecha, view, rangoLabel, lunesDestacados,
  conCargos, onConCargos, cargosBloqueados, cargosSinDia,
}: {
  dias: DiaSubtotal[];
  realMaxFecha: string;
  view: { a: number; b: number };
  rangoLabel: string;
  lunesDestacados: { actual: string; siguiente: string; subsiguiente: string };
  /** Toggle "sumar cargos extra": por defecto las semanas son solo campañas. */
  conCargos: boolean;
  onConCargos: (v: boolean) => void;
  /** Con un país elegido no se suman (los cargos son de compañía, sin país). */
  cargosBloqueados: boolean;
  /** Proveedores cuyo día de pago no se reconoce: no se pueden ubicar ni sumar. */
  cargosSinDia: string[];
}) {
  const id = useId();
  const [seleccion, setSeleccion] = useState({ inicio: 0, fin: 6 });
  const [personalizado, setPersonalizado] = useState(false);
  const semanaCompleta = seleccion.inicio === 0 && seleccion.fin === 6;
  const rangos = useMemo(
    () => buildRangos(dias, seleccion.inicio, seleccion.fin, realMaxFecha),
    [dias, seleccion.inicio, seleccion.fin, realMaxFecha],
  );
  const visibles = useMemo(
    () => rangos.filter((r) => r.idxMaxData >= view.a && r.idxMinData <= view.b),
    [rangos, view.a, view.b],
  );

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 id={`${id}-titulo`} className="font-display text-lg font-bold text-[var(--ink)]">Subtotal por semana</h2>
        <span className="font-sans text-xs text-[var(--ink-subtle)]">
          {semanaCompleta ? "semanas" : "rangos"} del tramo visible ({rangoLabel}) · {semanaCompleta ? "monto de la semana completa" : "monto del rango completo"}
          {conCargos && !cargosBloqueados ? " · campañas + cargos extra" : " · solo campañas"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Días del rango recurrente">
        {OPCIONES.map((opcion) => (
          <button key={opcion.label} type="button"
            aria-pressed={!personalizado && seleccion.inicio === opcion.inicio && seleccion.fin === opcion.fin}
            className={`${control} aria-pressed:border-[var(--plan)] aria-pressed:bg-[var(--purple-tint)] aria-pressed:text-[var(--plan)]`}
            onClick={() => { setSeleccion({ inicio: opcion.inicio, fin: opcion.fin }); setPersonalizado(false); }}>
            {opcion.label}
          </button>
        ))}
        <button type="button" aria-pressed={personalizado}
          className={`${control} aria-pressed:border-[var(--plan)] aria-pressed:bg-[var(--purple-tint)] aria-pressed:text-[var(--plan)]`}
          onClick={() => setPersonalizado(true)}>Personalizado</button>
        {personalizado && (
          <div className="flex flex-wrap items-center gap-2 font-sans text-sm text-[var(--ink-muted)]">
            <label className="flex items-center gap-2">De
              <select className={control} aria-label="Día de inicio" value={seleccion.inicio}
                onChange={(e) => setSeleccion({ ...seleccion, inicio: Number(e.target.value) })}>
                {DIAS_RANGO.map((dia, i) => <option key={dia} value={i}>{dia}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">a
              <select className={control} aria-label="Día de fin" value={seleccion.fin}
                onChange={(e) => setSeleccion({ ...seleccion, fin: Number(e.target.value) })}>
                {DIAS_RANGO.map((dia, i) => <option key={dia} value={i}>{dia}</option>)}
              </select>
            </label>
          </div>
        )}
        <span className="font-sans text-xs text-[var(--ink-subtle)]">
          {seleccion.inicio === seleccion.fin ? "Un día por semana" : "Ambos días incluidos"}
          {seleccion.fin < seleccion.inicio ? " · termina la semana siguiente" : ""}
        </span>
        {/* Cargos extra (Adobe, DRIP…) en su día de pago. Afecta también al
            "Total día" del calendario, que es de donde salen estas semanas. */}
        <button type="button" role="switch" aria-checked={conCargos && !cargosBloqueados}
          disabled={cargosBloqueados}
          title={cargosBloqueados ? "Los cargos extra son de compañía: no se suman al filtrar por país" : "Suma los cargos extra en su día de pago al total del día y de la semana"}
          className={`${control} ml-auto inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
          onClick={() => onConCargos(!conCargos)}>
          <span aria-hidden className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${conCargos && !cargosBloqueados ? "bg-[#9F99F8]" : "bg-[var(--divider)]"}`}>
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[var(--surface)] transition-[left] ${conCargos && !cargosBloqueados ? "left-3.5" : "left-0.5"}`} />
          </span>
          Sumar cargos extra
        </button>
      </div>
      {conCargos && !cargosBloqueados && cargosSinDia.length > 0 && (
        <p className="flex items-start gap-2 font-sans text-xs text-[var(--ink-muted)]">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F6C544]" />
          Sin día de pago reconocible, no se suman: {cargosSinDia.join(", ")}. Ponles el día (ej. &ldquo;15&rdquo; o &ldquo;30&rdquo;) en Cargos extra CARDDA.
        </p>
      )}
      {visibles.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((r) => (
            <SubtotalPeriodoCard key={r.inicio} w={r} periodo={semanaCompleta ? "Semana" : "Rango"}
              destacada={r.semana === lunesDestacados.actual ? "actual"
                : r.semana === lunesDestacados.siguiente ? "siguiente"
                  : r.semana === lunesDestacados.subsiguiente ? "subsiguiente" : null} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4 font-sans text-sm text-[var(--ink-subtle)]">
          No hay plan ni gasto para estos días en el tramo visible.
        </p>
      )}
    </section>
  );
}
