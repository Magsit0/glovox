import type { CierreEventoRow } from "@/lib/unabase/types";
import { compactCurrency } from "@/lib/unabase/formatting";

interface Props {
  evento: CierreEventoRow;
  marcaIngresoNeto: number | null;
}

interface Metric {
  label: string;
  value: string;
  source: string;
}

export default function EventoResumen({ evento, marcaIngresoNeto }: Props) {
  const totalIngresos =
    (evento.totalVentaTickets ?? 0) + (evento.totalVentaFfbb ?? 0) + (marcaIngresoNeto ?? 0);

  const metrics: Metric[] = [
    {
      label: "Venta tickets",
      value: evento.totalVentaTickets != null ? compactCurrency(evento.totalVentaTickets) : "—",
      source: "desde Punto Ticket",
    },
    {
      label: "Venta FF&BB",
      value: evento.totalVentaFfbb != null ? compactCurrency(evento.totalVentaFfbb) : "—",
      source: "desde OnFire",
    },
    {
      label: "Ingresos marcas",
      value: marcaIngresoNeto != null ? compactCurrency(marcaIngresoNeto) : "—",
      source: "desde ONEPAGER",
    },
    {
      label: "Total ingresos",
      value: compactCurrency(totalIngresos),
      source: "Tickets + FF&BB + Marcas",
    },
  ];

  return (
    <section data-pdf-section className="flex flex-col gap-4">
      <header className="flex flex-col gap-2">
        <span className="font-sans text-xs uppercase tracking-wide text-[#9F99F8]">
          Inputs externos
        </span>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            {evento.nombreGlovox?.trim() || "Evento"}
          </h2>
          {evento.categoriaEvento?.trim() && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
              {evento.categoriaEvento}
            </span>
          )}
        </div>
      </header>
      <div
        data-pdf-grid="kpis-4"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {metrics.map((m) => (
          <article
            key={m.label}
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-[#F0EFFE] p-6"
          >
            <p className="font-sans text-xs text-[#666666]">{m.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {m.value}
            </p>
            <p className="mt-3 font-sans text-xs text-[#999999]">{m.source}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
