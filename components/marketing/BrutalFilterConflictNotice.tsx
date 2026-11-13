"use client";

import { useQueryWeekly } from "@/components/marketing/WeeklyQueryProvider";
import { reemplazarSeleccion } from "@/lib/filters/url";

/**
 * Aviso de filtro sin resultados en /marketing/weekly. Es la misma pieza que
 * components/filters/FilterConflictNotice.tsx (regla 3 de lib/filters/), con el
 * look brutalista de esa pantalla: la selección se conserva y el aviso explica
 * por qué el panel quedó vacío, con un "Limpiar <filtro>" por filtro.
 *
 * `key` es el param de URL del filtro: limpiar borra SOLO ese param y deja los
 * demás (evento, comparativos, otros filtros) exactamente como estaban. Vive en
 * el cliente para que la page (servidor) lo pueda poner donde iba el gráfico.
 * Arma el cambio sobre la query vigente de la página (WeeklyQueryProvider), así
 * no deshace un cambio de otro filtro que el servidor todavía no confirma.
 */
export default function BrutalFilterConflictNotice({
  mensaje,
  conflicts,
}: {
  mensaje: string;
  conflicts: { key: string; label: string }[];
}) {
  const { search, navegar } = useQueryWeekly();
  if (conflicts.length === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-4 border-black bg-[#FFFF00] px-3 py-2 shadow-[4px_4px_0px_#000]"
    >
      <span className="font-mono-data text-xs text-black">{mensaje}</span>
      {conflicts.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => navegar(reemplazarSeleccion(search, c.key, []))}
          className="font-mono-data text-xs px-2 py-1 border-2 border-black bg-white text-black hover:bg-black hover:text-[#FFFF00] cursor-pointer transition-colors duration-150"
        >
          Limpiar {c.label}
        </button>
      ))}
    </div>
  );
}
