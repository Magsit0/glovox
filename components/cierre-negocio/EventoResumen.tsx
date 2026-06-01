import type { CierreEventoRow } from "@/lib/unabase/types";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  evento: CierreEventoRow;
}

interface Metric {
  label: string;
  value: string;
}

export default function EventoResumen({ evento }: Props) {
  const metrics: Metric[] = [
    {
      label: "Venta tickets",
      value: evento.totalVentaTickets != null ? formatCurrency(evento.totalVentaTickets) : "—",
    },
    {
      label: "Venta FF&BB",
      value: evento.totalVentaFfbb != null ? formatCurrency(evento.totalVentaFfbb) : "—",
    },
    {
      label: "Asistentes",
      value: evento.totalAsistentes != null ? formatNumber(evento.totalAsistentes) : "—",
    },
  ];

  return (
    <section data-pdf-section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
          {evento.nombreGlovox?.trim() || "Evento"}
        </h2>
        {evento.categoriaEvento?.trim() && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
            {evento.categoriaEvento}
          </span>
        )}
      </header>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {metrics.map((m) => (
          <article
            key={m.label}
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-[#F0EFFE] p-6"
          >
            <p className="font-sans text-xs text-[#666666]">{m.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {m.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
