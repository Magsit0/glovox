import type { Country } from "@/lib/queries/comunidad";
import {
  getGlobalEventos,
  getGlobalPrecioMatriz,
  getTicketingEventOptions,
  type GlobalEventoRow,
  type GlobalPrecioMatriz,
  type TicketingEventOption,
} from "@/lib/queries/ticketing";
import GlobalFilters from "./GlobalFilters";
import GlobalEventosTable from "./GlobalEventosTable";
import GlobalPrecioMatrizTable from "./GlobalPrecioMatrizTable";

interface Props {
  country: Country;
  countryLocked: boolean;
  categoriaEventos: string[];
  eventoIds: string[];
  productos: string[];
}

export default async function GlobalAnalysisSection({
  country,
  countryLocked,
  categoriaEventos,
  eventoIds,
  productos,
}: Props) {
  const filters = {
    country,
    categoriaEventos: categoriaEventos.length ? categoriaEventos : undefined,
    eventoIds: eventoIds.length ? eventoIds : undefined,
    productos: productos.length ? productos : undefined,
  };

  // Fetch separado del JSX para no construir JSX dentro de try/catch.
  let events: TicketingEventOption[];
  let eventos: GlobalEventoRow[];
  let matriz: GlobalPrecioMatriz;
  try {
    [events, eventos, matriz] = await Promise.all([
      getTicketingEventOptions(country),
      getGlobalEventos(filters),
      getGlobalPrecioMatriz(filters),
    ]);
  } catch (err) {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
        <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
        <p className="flex-1 font-sans text-sm text-[#333333]">
          {err instanceof Error ? err.message : "Error al cargar el análisis global."}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <GlobalFilters events={events} country={country} countryLocked={countryLocked} />

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            Análisis global
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Vista general de todos los eventos. Inicio de venta = primera orden registrada
            (MIN de FechaOrden). Clic en cada columna para ordenar; por defecto, fecha de evento
            descendente.
          </p>
        </div>

        <GlobalEventosTable eventos={eventos} />
      </div>

      <GlobalPrecioMatrizTable matriz={matriz} />
    </section>
  );
}
