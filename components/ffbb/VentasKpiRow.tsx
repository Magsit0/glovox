import type { FfbbKpis } from "@/lib/ffbb/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  kpis: FfbbKpis;
}

interface Kpi {
  label: string;
  value: string;
  caption?: string;
}

export default function VentasKpiRow({ kpis }: Props) {
  const items: Kpi[] = [
    {
      label: "Ventas totales",
      value: compactCurrency(kpis.ventas),
      caption: formatCurrency(kpis.ventas),
    },
    {
      label: "Unidades vendidas",
      value: formatNumber(kpis.unidades),
      caption: `${formatNumber(kpis.productosUnicos)} productos únicos`,
    },
    {
      label: "Transacciones",
      value: formatNumber(kpis.transacciones),
      caption: kpis.transacciones === 1 ? "1 orden" : `${formatNumber(kpis.transacciones)} órdenes`,
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(kpis.ticketPromedio),
      caption: kpis.transacciones > 0 ? "por orden" : "sin órdenes",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k) => (
        <article
          key={k.label}
          className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
        >
          <span className="font-sans text-xs text-[#666666]">{k.label}</span>
          <span className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
            {k.value}
          </span>
          {k.caption && (
            <span className="mt-3 font-sans text-xs text-[#999999]">{k.caption}</span>
          )}
        </article>
      ))}
    </div>
  );
}
