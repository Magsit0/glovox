"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Panel plegable con el look de BrutalChartPanel: el encabezado es el botón y
 * arranca cerrado. El contenido se monta solo al abrir, así sus gráficos se
 * trazan con el ancho real (cerrado no hay nada que medir).
 *
 * Sin `key` en la page, el estado sobrevive a los cambios de URL (día, evento):
 * si está abierto, sigue abierto con los datos nuevos.
 */
export default function BrutalDesplegable({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: ReactNode;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  return (
    <section className={`bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none ${className}`}>
      {/* Accordion pattern: the heading wraps the button (a heading can't go inside one). */}
      <h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={id}
          onClick={() => setAbierto((v) => !v)}
          className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00]"
        >
          <span className="font-display uppercase text-2xl leading-none text-black">{titulo}</span>
          <span className="flex shrink-0 items-center gap-2 font-mono-data text-xs uppercase text-black">
            {abierto ? "Ocultar" : "Ver"}
            <span className="font-display text-sm">{abierto ? "▲" : "▼"}</span>
          </span>
        </button>
      </h3>
      {abierto && (
        <div id={id} className="px-6 pb-6">
          {children}
        </div>
      )}
    </section>
  );
}
