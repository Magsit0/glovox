"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { LACAVA } from "./theme";
import { type Jornada, fmtDiaLargo } from "./jornadas";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const pctUnDecimal = new Intl.NumberFormat("es-CL", {
  style: "percent",
  maximumFractionDigits: 1,
});

/**
 * "Ver detalle" en la esquina de la card KPI de devoluciones: abre un panel
 * con las devoluciones por jornada. Panel no modal anclado a la card; se
 * cierra con Esc, clic afuera, al salir con Tab o con el botón cerrar (y el
 * foco vuelve al botón si estaba en el panel).
 *
 * Cada barra compara jornadas entre sí (largo ∝ devueltas del día) y va en
 * gris: es venta que se revirtió, no avance. El % es sobre lo que se llegó a
 * vender ese día (vigentes + devueltas), igual que la card.
 */
export default function DetalleDevoluciones({ jornadas }: { jornadas: Jornada[] }) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const tituloId = useId();
  const raizRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;
    cerrarRef.current?.focus();
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // El foco vuelve al botón solo si estaba dentro; si no, Esc en otro
      // control sacaría al usuario de donde está.
      const dentro = raizRef.current?.contains(document.activeElement) ?? false;
      setAbierto(false);
      if (dentro) botonRef.current?.focus();
    };
    const alClic = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("keydown", alTeclado);
    document.addEventListener("mousedown", alClic);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      document.removeEventListener("mousedown", alClic);
    };
  }, [abierto]);

  const total = jornadas.reduce((acc, j) => acc + j.devueltas, 0);
  if (total === 0) return null;

  const max = Math.max(1, ...jornadas.map((j) => j.devueltas));
  const reasignadas = jornadas.reduce((acc, j) => acc + j.devueltasReasignadas, 0);

  return (
    <div
      ref={raizRef}
      className="relative"
      // Se cierra si el foco sale con Tab: abierto, taparía lo que viene abajo.
      onBlur={(e) => {
        const destino = e.relatedTarget as Node | null;
        if (abierto && destino && !e.currentTarget.contains(destino)) setAbierto(false);
      }}
    >
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((a) => !a)}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-sans text-xs font-medium transition-colors hover:underline focus-visible:outline focus-visible:outline-2"
        style={{ color: LACAVA.verdeMedio, outlineColor: LACAVA.verde }}
      >
        Ver detalle
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${abierto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {abierto && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={tituloId}
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-4 shadow-md"
          style={{ borderColor: LACAVA.borde }}
        >
          <div className="flex items-start justify-between gap-3">
            <h3
              id={tituloId}
              className="font-lacava text-base font-bold"
              style={{ color: LACAVA.tinta }}
            >
              Devoluciones por día
            </h3>
            <button
              ref={cerrarRef}
              type="button"
              aria-label="Cerrar detalle de devoluciones"
              onClick={() => {
                setAbierto(false);
                botonRef.current?.focus();
              }}
              className="rounded-md p-0.5 focus-visible:outline focus-visible:outline-2"
              style={{ color: LACAVA.tintaSuave, outlineColor: LACAVA.verde }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ul className="mt-3 flex flex-col gap-3">
            {jornadas.map((j, i) => {
              const vendidoDia = j.vendidas + j.devueltas;
              return (
                <li key={j.dia}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className="flex items-center gap-2 font-sans text-sm"
                      style={{ color: LACAVA.tinta }}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: j.color }}
                      />
                      {fmtDiaLargo(j.dia)}
                    </span>
                    <span
                      className="font-sans text-sm tabular-nums"
                      style={{ color: LACAVA.tintaSuave }}
                    >
                      <span className="font-medium" style={{ color: LACAVA.tinta }}>
                        {entero.format(j.devueltas)}
                      </span>
                      {vendidoDia > 0 && ` · ${pctUnDecimal.format(j.devueltas / vendidoDia)}`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5" aria-hidden="true">
                    {/* Se dibuja al abrir, en cascada por jornada (globals.css). */}
                    <div
                      className="lacava-barra-revela h-full rounded-full"
                      style={{
                        width: `${(j.devueltas / max) * 100}%`,
                        backgroundColor: LACAVA.tintaSutil,
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {reasignadas > 0 && (
            <p className="mt-3 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
              {reasignadas === total
                ? "Todas corresponden"
                : `${entero.format(reasignadas)} corresponden`}{" "}
              a entradas compradas para la fecha original, antes del cambio de fecha.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
