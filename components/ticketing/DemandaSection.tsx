import type { Country } from "@/lib/queries/comunidad";
import {
  getDemandaEvolucion,
  getTicketingEventOptions,
  type DemandaGranularidad,
  type DemandaMetrica,
} from "@/lib/queries/ticketing";
import { formatNumber, formatCurrency } from "@/lib/unabase/formatting";
import type { ProyeccionMetodo } from "@/lib/ticketing/demanda-forecast";
import DemandaFilters from "./DemandaFilters";
import DemandaLineChart from "./DemandaLineChart";
import SimuladorIngreso from "./SimuladorIngreso";

interface Props {
  country: Country;
  countryLocked: boolean;
  categoriaEventos: string[];
  categoriaEventos2: string[];
  categoriaEventos3: string[];
  temporadas: string[];
  eventoIds: string[];
  granularidad: DemandaGranularidad;
  metrica: DemandaMetrica;
  proyeccion: ProyeccionMetodo;
}

export default async function DemandaSection({
  country,
  countryLocked,
  categoriaEventos,
  categoriaEventos2,
  categoriaEventos3,
  temporadas,
  eventoIds,
  granularidad,
  metrica,
  proyeccion,
}: Props) {
  const filters = {
    country,
    categoriaEventos:  categoriaEventos.length  ? categoriaEventos  : undefined,
    categoriaEventos2: categoriaEventos2.length ? categoriaEventos2 : undefined,
    categoriaEventos3: categoriaEventos3.length ? categoriaEventos3 : undefined,
    temporadas:        temporadas.length        ? temporadas        : undefined,
    eventoIds:         eventoIds.length         ? eventoIds         : undefined,
    granularidad,
  };

  let events;
  let rows;
  try {
    [events, rows] = await Promise.all([
      getTicketingEventOptions(country),
      getDemandaEvolucion(filters),
    ]);
  } catch (err) {
    return (
      <section className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
        <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
        <p className="flex-1 font-sans text-sm text-[#333333]">
          {err instanceof Error ? err.message : "Error al cargar el análisis de demanda."}
        </p>
      </section>
    );
  }

  // KPIs de resumen
  const totalGeneral    = rows.reduce((s, r) => s + (metrica === "venta" ? r.generalVenta    : r.general),    0);
  const totalVip        = rows.reduce((s, r) => s + (metrica === "venta" ? r.vipVenta        : r.vip),        0);
  const totalEarlyEntry = rows.reduce((s, r) => s + (metrica === "venta" ? r.earlyEntryVenta : r.earlyEntry), 0);
  const totalFree       = rows.reduce((s, r) => s + (metrica === "venta" ? r.freeVenta       : r.free),       0);
  const totalUpgrade    = rows.reduce((s, r) => s + (metrica === "venta" ? r.upgradeVenta    : r.upgrade),    0);
  const totalTickets    = rows.reduce((s, r) => s + (metrica === "venta" ? r.totalVenta      : r.total),      0);
  const fmt = metrica === "venta" ? formatCurrency : formatNumber;

  const granLabel =
    granularidad === "MONTH"     ? "meses" :
    granularidad === "EVENTO"    ? "eventos" :
    granularidad === "CATEGORIA" ? "categorías" :
    "semanas";

  return (
    <section className="flex flex-col gap-6">
      <DemandaFilters
        events={events}
        country={country}
        countryLocked={countryLocked}
        granularidad={granularidad}
        metrica={metrica}
        proyeccion={proyeccion}
      />

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            Evolución de la demanda
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Tickets vendidos por {granLabel} (fecha de compra), desglosados por tipo de producto.
            Devueltos excluidos.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: metrica === "venta" ? "Total recaudado" : "Total tickets", value: totalTickets,    colorClass: "text-[#333333]" },
            { label: "General",             value: totalGeneral,    colorClass: "text-[#9F99F8]" },
            { label: "VIP",                 value: totalVip,        colorClass: "text-[#B1D750]" },
            { label: "Early entry / Happy", value: totalEarlyEntry, colorClass: "text-[#ED75A0]" },
            { label: "Free / Cortesía",     value: totalFree,       colorClass: "text-[#F6C544]" },
            { label: "Upgrade",             value: totalUpgrade,    colorClass: "text-[#60C5BA]" },
          ].map((k) => (
            <article
              key={k.label}
              className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-4"
            >
              <p className="font-sans text-xs text-[#666666]">{k.label}</p>
              <p className={`mt-2 font-display text-3xl font-bold leading-none tracking-tight ${k.colorClass}`}>
                {fmt(k.value)}
              </p>
              {totalTickets > 0 && !k.label.startsWith("Total") && (
                <p className="mt-2 font-sans text-xs text-[#999999]">
                  {((k.value / totalTickets) * 100).toFixed(1)}% del total
                </p>
              )}
            </article>
          ))}
        </div>

        {/* Gráfico de líneas */}
        <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <header className="mb-6">
            <h3 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Tickets vendidos por{" "}
            {granularidad === "MONTH" ? "mes" : granularidad === "EVENTO" ? "evento" : granularidad === "CATEGORIA" ? "categoría" : "semana"}
            </h3>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              {granularidad === "EVENTO"
                ? `${rows.length} eventos · total de tickets vendidos por evento`
                : granularidad === "CATEGORIA"
                  ? `${rows.length} categorías · ordenadas por total de tickets descendente`
                  : `${rows.length} ${granLabel} con datos · eje temporal = fecha de compra (FechaOrden)`}
            </p>
          </header>
          <DemandaLineChart rows={rows} granularidad={granularidad} metrica={metrica} proyeccion={proyeccion} />
        </article>

        {/* Simulador de ingreso: cantidades proyectadas × precio declarado */}
        <SimuladorIngreso rows={rows} proyeccion={proyeccion} />
      </div>
    </section>
  );
}
