import type { NegocioAggregate } from "@/lib/unabase/cierreNegocio";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  agg: NegocioAggregate;
}

interface Kpi {
  label: string;
  value: string;
  caption?: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const dotColor = {
  positive: "#B1D750",
  negative: "#ED75A0",
  neutral: "#999999",
} as const;

export default function KpiRow({ agg }: Props) {
  const avancePct = agg.avancePct;
  const avanceTone: Kpi["deltaTone"] =
    avancePct > 1 ? "negative" : avancePct >= 0.85 ? "neutral" : "positive";

  const sinOcTone: Kpi["deltaTone"] = agg.itemsSinOC === 0 ? "positive" : "neutral";

  const kpis: Kpi[] = [
    {
      label: "Presupuesto de gasto",
      value: compactCurrency(agg.totalPresupuestoGasto),
      caption: formatCurrency(agg.totalPresupuestoGasto),
    },
    {
      label: "Gasto real (OCs)",
      value: compactCurrency(agg.totalGastoReal),
      caption: formatCurrency(agg.totalGastoReal),
    },
    {
      label: "Avance vs presupuesto",
      value: pct(avancePct),
      caption:
        avancePct > 1
          ? `Excedido en ${compactCurrency(agg.totalGastoReal - agg.totalPresupuestoGasto)}`
          : `Disponible ${compactCurrency(agg.totalPresupuestoGasto - agg.totalGastoReal)}`,
      deltaTone: avanceTone,
    },
    {
      label: "Items con OC",
      value: `${formatNumber(agg.itemsConOC)} / ${formatNumber(agg.itemsTotales)}`,
      caption:
        agg.itemsSinOC > 0
          ? `${formatNumber(agg.itemsSinOC)} sin OC`
          : "Todos los items con OC",
      deltaTone: sinOcTone,
    },
  ];

  return (
    <section
      data-pdf-grid="kpis-4"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      {kpis.map((k) => (
        <article
          key={k.label}
          className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
        >
          <p className="font-sans text-xs text-[#666666]">{k.label}</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
            {k.value}
          </p>
          {(k.caption || k.delta) && (
            <div className="mt-3 flex items-center gap-2">
              {k.delta && k.deltaTone && (
                <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#333333]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: dotColor[k.deltaTone] }}
                  />
                  {k.delta}
                </span>
              )}
              {k.caption && (
                <span className="truncate font-sans text-xs text-[#666666]">{k.caption}</span>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
