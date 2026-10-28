"use client";

import { useState } from "react";
import type { LaCavaBeneficioRow, LaCavaMedioRow } from "@/lib/queries/lacava";
import BeneficiosCard from "./BeneficiosCard";
import MediosPagoCard from "./MediosPagoCard";
import { LACAVA } from "./theme";

type Vista = "tipos" | "medios";

const VISTAS: { key: Vista; label: string; titulo: string; subtitulo: string }[] = [
  {
    key: "tipos",
    label: "Tipos de ticket",
    titulo: "Tipos de ticket",
    subtitulo:
      "Entradas pagadas según el beneficio usado: Normal, Jumbo Prime, Tarjeta Cencosud o ambos.",
  },
  {
    key: "medios",
    label: "Medios de pago",
    titulo: "Medios de pago",
    subtitulo: "Venta neta por medio de pago (solo ventas pagadas).",
  },
];

/**
 * Tipos de ticket (beneficio) y medios de pago en una sola card, con un
 * toggle en el encabezado. Solo se monta la vista activa: al cambiar, su
 * torta se traza de nuevo.
 */
export default function TiposYMediosCard({
  beneficios,
  medios,
}: {
  beneficios: LaCavaBeneficioRow[];
  medios: LaCavaMedioRow[];
}) {
  const [vista, setVista] = useState<Vista>("tipos");
  const activa = VISTAS.find((v) => v.key === vista) ?? VISTAS[0];

  return (
    <article
      className="overflow-hidden rounded-lg border bg-white p-6 shadow-sm"
      style={{ borderColor: LACAVA.borde }}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-lacava text-xl font-bold" style={{ color: LACAVA.tinta }}>
            {activa.titulo}
          </h2>
          <p className="mt-1 font-sans text-sm" style={{ color: LACAVA.tintaSuave }}>
            {activa.subtitulo}
          </p>
        </div>
        <div
          role="group"
          aria-label="Elegir desglose"
          className="flex items-center gap-1 rounded-lg border bg-white p-1"
          style={{ borderColor: LACAVA.borde }}
        >
          {VISTAS.map((v) => {
            const on = v.key === vista;
            return (
              <button
                key={v.key}
                type="button"
                aria-pressed={on}
                onClick={() => setVista(v.key)}
                // En alto contraste (Windows) se ignora el fondo: la opción
                // activa se marca con borde y subrayado.
                className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 ${
                  on ? "forced-colors:border-2 forced-colors:underline" : ""
                }`}
                style={
                  on
                    ? { backgroundColor: LACAVA.verde, color: LACAVA.marfil, outlineColor: LACAVA.verde }
                    : { color: LACAVA.tintaSuave, outlineColor: LACAVA.verde }
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </header>

      {vista === "tipos" ? (
        <BeneficiosCard filas={beneficios} />
      ) : (
        <MediosPagoCard medios={medios} />
      )}
    </article>
  );
}
