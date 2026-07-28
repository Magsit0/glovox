import type { InternoKpis } from "@/lib/queries/interno";
import {
  compactCurrency,
  formatCurrency,
  formatNumber,
  dateLabel,
} from "@/components/proveedor/format";

interface Props {
  kpis: InternoKpis;
  /** Cuando hay una categoría seleccionada, el spotlight se titula distinto. */
  scopeLabel: string;
}

export default function KpiRowInterno({ kpis, scopeLabel }: Props) {
  const periodo =
    kpis.primeraFecha && kpis.ultimaFecha
      ? `${dateLabel(kpis.primeraFecha)} – ${dateLabel(kpis.ultimaFecha)}`
      : "Sin fechas registradas";

  const cards = [
    {
      label: "Documentos",
      value: formatNumber(kpis.documentos),
      caption: periodo,
    },
    {
      label: "Proveedores",
      value: formatNumber(kpis.proveedores),
      caption: `${formatNumber(kpis.categorias)} categorías de gasto`,
    },
    {
      label: "Negocios internos",
      value: formatNumber(kpis.negocios),
      caption: "Contenedores anuales por rubro",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {/* Spotlight: gasto total (máximo uno por vista). */}
      <article className="flex flex-col rounded-xl bg-[#9F99F8] p-8 text-white">
        <p className="font-sans text-xs text-white/80">{scopeLabel}</p>
        <p className="mt-2 font-display text-5xl font-bold leading-none tracking-tight">
          {compactCurrency(kpis.gasto)}
        </p>
        <p className="mt-4 font-sans text-sm text-white/80">
          {formatCurrency(kpis.gasto)}
        </p>
      </article>

      {cards.map((c) => (
        <article
          key={c.label}
          className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
        >
          <p className="font-sans text-xs text-[#666666]">{c.label}</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
            {c.value}
          </p>
          <p className="mt-3 truncate font-sans text-xs text-[#666666]" title={c.caption}>
            {c.caption}
          </p>
        </article>
      ))}
    </section>
  );
}
