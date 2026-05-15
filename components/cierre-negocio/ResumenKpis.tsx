import type { NegocioAggregate } from "@/lib/unabase/cierreNegocio";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

interface Props {
  agg: NegocioAggregate;
}

type Tone = "positive" | "negative" | "neutral";

interface Kpi {
  label: string;
  value: string;
  caption?: string;
  deltaTone?: Tone;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const dotColor: Record<Tone, string> = {
  positive: "#B1D750",
  negative: "#ED75A0",
  neutral: "#999999",
};

function marginTone(value: number): Tone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export default function ResumenKpis({ agg }: Props) {
  const { ventas } = agg;
  const hasVentas = ventas.ventaNeta > 0 || ventas.docsVenta > 0;

  const kpis: Kpi[] = [
    {
      label: "Venta libro",
      value: compactCurrency(agg.totalVenta),
      caption: formatCurrency(agg.totalVenta),
    },
    {
      label: "Venta neta facturada",
      value: hasVentas ? compactCurrency(ventas.ventaNeta) : "—",
      caption: hasVentas
        ? `${ventas.docsVenta} doc${ventas.docsVenta === 1 ? "" : "s"} de venta`
        : "Sin documentos facturados",
    },
    {
      label: "Venta total facturada",
      value: hasVentas ? compactCurrency(ventas.ventaBrutaTotal) : "—",
      caption: hasVentas
        ? `Con IVA: ${formatCurrency(ventas.ventaBrutaTotal)}`
        : "Sin ventas",
    },
    {
      label: "Gasto real",
      value: compactCurrency(agg.totalGastoReal),
      caption: formatCurrency(agg.totalGastoReal),
    },
    {
      label: "Margen libro",
      value: compactCurrency(agg.margenLibro),
      caption: pct(agg.margenLibroPct),
      deltaTone: marginTone(agg.margenLibro),
    },
    {
      label: "Margen real facturado",
      value: hasVentas ? compactCurrency(agg.margenRealFacturado) : "—",
      caption: hasVentas ? pct(agg.margenRealFacturadoPct) : "Sin ventas",
      deltaTone: hasVentas ? marginTone(agg.margenRealFacturado) : "neutral",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            <div className="mt-3 flex items-center gap-2">
              {k.deltaTone && (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor[k.deltaTone] }}
                />
              )}
              <span className="truncate font-sans text-xs text-[#666666]">
                {k.caption}
              </span>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
