import type { TrimestreAggregate } from "@/lib/unabase/cierreTrimestral";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  agg: TrimestreAggregate;
}

interface Kpi {
  label: string;
  value: string;
  caption?: string;
}

export default function KpiRow({ agg }: Props) {
  const kpis: Kpi[] = [
    {
      label: "Total eventos",
      value: formatNumber(agg.totalEventos),
      caption: `${formatNumber(agg.totalAsistentes)} asistentes`,
    },
    {
      label: "Venta tickets",
      value: compactCurrency(agg.totalVentaTickets),
      caption: formatCurrency(agg.totalVentaTickets),
    },
    {
      label: "Venta FF&BB",
      value: compactCurrency(agg.totalVentaFFBB),
      caption: formatCurrency(agg.totalVentaFFBB),
    },
    {
      label: "Per cápita tickets",
      value: formatCurrency(agg.perCapitaTicketsPromedio),
      caption: `FF&BB ${formatCurrency(agg.perCapitaFFBBPromedio)}`,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <article
          key={k.label}
          className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
        >
          <p className="font-sans text-xs text-[#666666]">{k.label}</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
            {k.value}
          </p>
          {k.caption && (
            <p className="mt-3 truncate font-sans text-xs text-[#666666]">{k.caption}</p>
          )}
        </article>
      ))}
    </section>
  );
}
