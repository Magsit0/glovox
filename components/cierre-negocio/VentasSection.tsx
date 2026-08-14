import type { NegocioAggregate } from "@/lib/unabase/cierreNegocio";
import type { VentaNegocioRow } from "@/lib/unabase/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import VentasDocumentsTable from "@/components/cierre-negocio/VentasDocumentsTable";
import VentasItemsBar from "@/components/cierre-negocio/VentasItemsBar";

interface Props {
  agg: NegocioAggregate;
  ventas: VentaNegocioRow[];
}

type Tone = "positive" | "negative" | "neutral";

const dotColor: Record<Tone, string> = {
  positive: "#B1D750",
  negative: "#ED75A0",
  neutral: "#999999",
};

function MiniCard({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: Tone;
}) {
  return (
    <article className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold leading-none tracking-tight text-[#333333]">
        {value}
      </p>
      {caption && (
        <div className="mt-3 flex items-center gap-2">
          {tone && (
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor[tone] }}
            />
          )}
          <span className="truncate font-sans text-xs text-[#666666]">{caption}</span>
        </div>
      )}
    </article>
  );
}

export default function VentasSection({ agg, ventas }: Props) {
  const { ventas: v } = agg;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
          Ventas
        </h2>
        <span className="font-sans text-xs text-[#666666]">
          Documentos facturados al negocio (excluye anulados)
        </span>
      </header>

      <div
        data-pdf-grid="mini-4"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MiniCard
          label="Venta neta"
          value={compactCurrency(v.ventaNeta)}
          caption={formatCurrency(v.ventaNeta)}
        />
        <MiniCard
          label="IVA"
          value={compactCurrency(v.ivaTotal)}
          caption={formatCurrency(v.ivaTotal)}
        />
        <MiniCard
          label="Venta total c/IVA"
          value={compactCurrency(v.ventaBrutaTotal)}
          caption={formatCurrency(v.ventaBrutaTotal)}
        />
        <MiniCard
          label="Documentos"
          value={formatNumber(v.docsVenta)}
          caption={`doc${v.docsVenta === 1 ? "" : "s"} atribuido${v.docsVenta === 1 ? "" : "s"}`}
        />
      </div>

      {v.topClientes.length >= 2 ? (
        <div
          data-pdf-grid="side-by-side"
          className="grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          <article className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6 lg:col-span-2">
            <header>
              <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
                Top clientes
              </h3>
              <p className="mt-1 font-sans text-xs text-[#666666]">
                Por venta neta atribuida al negocio.
              </p>
            </header>
            <div className="flex items-center gap-3 border-b border-[#E5E5E5] pb-2 font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
              <span className="block max-w-[420px] truncate">Cliente</span>
              <span>RUT</span>
              <span className="ml-auto">Venta neta</span>
              <span className="w-12 text-right">%</span>
              <span className="w-16 text-right">Docs</span>
            </div>
            <ul className="flex max-h-[294px] flex-col gap-2 overflow-auto print:max-h-none print:overflow-visible">
              {v.topClientes.map((c) => {
                const pct = v.ventaNeta > 0 ? c.total / v.ventaNeta : 0;
                return (
                  <li
                    key={`${c.rut || c.cliente}`}
                    className="flex items-center gap-3 border-b border-[#F0F0F0] py-1.5 last:border-b-0"
                  >
                    <span className="block max-w-[420px] truncate font-sans text-sm text-[#333333]">
                      {c.cliente}
                    </span>
                    <span className="font-sans text-xs text-[#999999]">{c.rut || ""}</span>
                    <span className="ml-auto font-sans text-sm tabular-nums text-[#333333]">
                      {formatCurrency(c.total)}
                    </span>
                    <span className="w-12 text-right font-sans text-xs tabular-nums text-[#999999]">
                      {(pct * 100).toFixed(0)}%
                    </span>
                    <span className="w-16 text-right font-sans text-xs tabular-nums text-[#999999]">
                      {formatNumber(c.nDocs)} doc
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>

          <VentasItemsBar rows={v.itemsDescripcion} />
        </div>
      ) : (
        <VentasItemsBar rows={v.itemsDescripcion} />
      )}

      <VentasDocumentsTable ventas={ventas} />
    </section>
  );
}
