"use client";

import { useQueryWeekly } from "@/components/marketing/WeeklyQueryProvider";

export type DiaOpcion = {
  /** "YYYY-MM-DD" de la jornada: el valor de `?dia=`. */
  dia: string;
  /** "sáb 14 nov". */
  etiqueta: string;
  personas: number;
};

const PARAM = "dia";

/**
 * Filtro "Día" de /marketing/weekly: solo existe en eventos de varias jornadas
 * (la page no lo renderiza si getEventJornadas viene vacío). Una sola jornada o
 * "Todos". Escribe SOLO `dia` y deja el resto de la URL como está. Arma la URL
 * sobre la query vigente de la página (WeeklyQueryProvider), así un clic en
 * otro filtro mientras BigQuery responde no deshace el día recién pedido.
 */
export default function DiaEventoFilter({ opciones }: { opciones: DiaOpcion[] }) {
  const { search, navegar } = useQueryWeekly();
  const pedido = new URLSearchParams(search).get(PARAM);
  // Un `?dia=` que no es de este evento no filtra (la page lo ignora igual).
  const activo = opciones.some((o) => o.dia === pedido) ? pedido : null;

  function elegir(dia: string | null) {
    const qs = new URLSearchParams(search);
    if (dia) qs.set(PARAM, dia);
    else qs.delete(PARAM);
    navegar(qs.toString());
  }

  const boton = (on: boolean) =>
    `font-mono-data text-xs uppercase px-3 py-1.5 border-l-2 border-black first:border-l-0 cursor-pointer transition-colors duration-150 ${
      on ? "bg-black text-[#FFFF00] font-bold" : "bg-white text-black hover:bg-[#FFFF00]"
    }`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono-data font-bold uppercase text-xs text-black">Día</span>
        <div
          role="group"
          aria-label="Día del evento"
          className="flex flex-wrap border-4 border-black shadow-[4px_4px_0px_#000]"
        >
          <button type="button" aria-pressed={activo === null} onClick={() => elegir(null)} className={boton(activo === null)}>
            Todos
          </button>
          {opciones.map((o) => (
            <button
              key={o.dia}
              type="button"
              aria-pressed={activo === o.dia}
              onClick={() => elegir(o.dia)}
              title={`${o.personas.toLocaleString("es-CL")} personas`}
              className={boton(activo === o.dia)}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      </div>
      {activo && (
        <p className="font-mono-data text-[11px] leading-snug text-black/60 max-w-[560px]">
          Filtra personas, venta, comunidad, venta acumulada y origen de venta. CPA, paid
          media, atribución, funnel, campañas y tráfico son del evento completo.
        </p>
      )}
    </div>
  );
}
