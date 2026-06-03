import type { PaidMediaKpis } from "@/lib/queries/paidMedia";
import {
  compactMoney,
  formatInt,
  formatMoney,
  formatRatio,
  formatRoas,
} from "@/components/paid-media/format";

interface Props {
  kpis: PaidMediaKpis;
  currency: string;
}

interface Card {
  label: string;
  value: string;
  caption: string;
  /** Resalta este KPI como spotlight morado (máximo uno por vista). */
  spotlight?: boolean;
}

export default function KpiRow({ kpis, currency }: Props) {
  const ctrCaption = `${formatInt(kpis.clics)} clics / ${formatInt(kpis.impresiones)} impr.`;
  const roasCaption =
    kpis.valorConversion > 0
      ? `Valor conv. ${formatMoney(kpis.valorConversion, currency)}`
      : kpis.conversiones > 0
        ? `${formatInt(kpis.conversiones)} conversiones`
        : "Sin conversiones reportadas";

  const cards: Card[] = [
    {
      label: "Gasto",
      value: compactMoney(kpis.gasto, currency),
      caption: formatMoney(kpis.gasto, currency),
      spotlight: true,
    },
    {
      label: "Impresiones",
      value: formatInt(kpis.impresiones),
      caption: `${formatInt(kpis.dias)} días con datos`,
    },
    {
      label: "Clics",
      value: formatInt(kpis.clics),
      caption: ctrCaption,
    },
    {
      label: "CTR",
      value: formatRatio(kpis.ctr),
      caption: kpis.impresiones > 0 ? "Clics sobre impresiones" : "Sin impresiones",
    },
    {
      label: "CPC",
      value: kpis.cpc > 0 ? formatMoney(kpis.cpc, currency) : "—",
      caption: "Costo por clic",
    },
    {
      label: "CPM",
      value: kpis.cpm > 0 ? formatMoney(kpis.cpm, currency) : "—",
      caption: "Costo por mil impresiones",
    },
    {
      label: "Conversiones",
      value: formatInt(kpis.conversiones),
      caption: kpis.cpa > 0 ? `CPA ${formatMoney(kpis.cpa, currency)}` : "Sin CPA",
    },
    {
      label: "ROAS",
      value: formatRoas(kpis.roas),
      caption: roasCaption,
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) =>
        c.spotlight ? (
          <article
            key={c.label}
            className="flex flex-col rounded-xl bg-[#9F99F8] p-6 text-white"
          >
            <p className="font-sans text-xs text-white/80">{c.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight">
              {c.value}
            </p>
            <p className="mt-3 truncate font-sans text-xs text-white/80">
              {c.caption}
            </p>
          </article>
        ) : (
          <article
            key={c.label}
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <p className="font-sans text-xs text-[#666666]">{c.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {c.value}
            </p>
            <p className="mt-3 truncate font-sans text-xs text-[#666666]">
              {c.caption}
            </p>
          </article>
        ),
      )}
    </section>
  );
}
