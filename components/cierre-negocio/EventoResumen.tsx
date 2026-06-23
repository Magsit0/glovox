import type { CierreEventoRow } from "@/lib/unabase/types";
import { compactCurrency } from "@/lib/unabase/formatting";

interface Props {
  evento: CierreEventoRow;
  marcaIngresoNeto: number | null;
  marcaIngresoBruto: number | null;
}

// Los inputs externos se muestran NETOS como número principal, con el IVA y el
// total c/IVA debajo. Tickets, cargo y FF&BB vienen brutos (IVA incluido) →
// neto = bruto/(1+IVA). Producción de eventos propios = Chile (19%).
const IVA_PCT = 0.19;
const netoDe = (bruto: number): number => bruto / (1 + IVA_PCT);

interface Metric {
  label: string;
  /** Monto neto — número principal de la tarjeta. */
  neto: string;
  /** IVA del monto (debajo, junto al total). */
  iva?: string;
  /** Total con IVA (debajo, junto al IVA). */
  total?: string;
  source: string;
}

// Métrica a partir de un monto BRUTO (tickets, cargo, FF&BB): el neto se deriva
// ÷(1+IVA) y el IVA es la diferencia.
function brutoMetric(label: string, bruto: number | null, source: string): Metric {
  if (bruto == null) return { label, neto: "—", source };
  const neto = netoDe(bruto);
  return {
    label,
    neto: compactCurrency(neto),
    iva: compactCurrency(bruto - neto),
    total: compactCurrency(bruto),
    source,
  };
}

export default function EventoResumen({ evento, marcaIngresoNeto, marcaIngresoBruto }: Props) {
  const tBruto = evento.totalVentaTickets;
  const fBruto = evento.totalVentaFfbb;

  // Total ingresos = tickets + FF&BB + marcas (el cargo por servicio va aparte).
  const totalNeto =
    (tBruto != null ? netoDe(tBruto) : 0) +
    (fBruto != null ? netoDe(fBruto) : 0) +
    (marcaIngresoNeto ?? 0);
  const totalBruto = (tBruto ?? 0) + (fBruto ?? 0) + (marcaIngresoBruto ?? 0);

  const metrics: Metric[] = [
    brutoMetric("Venta tickets", tBruto, "desde Punto Ticket"),
    brutoMetric("Cargo por servicio", evento.totalCargoServicio, "desde Punto Ticket"),
    brutoMetric("Venta FF&BB", fBruto, "desde OnFire"),
    // Marcas viene neto desde ONEPAGER; el bruto también está guardado, así que
    // el IVA es exacto (bruto − neto), no derivado.
    {
      label: "Ingresos marcas",
      neto: marcaIngresoNeto != null ? compactCurrency(marcaIngresoNeto) : "—",
      iva:
        marcaIngresoBruto != null && marcaIngresoNeto != null
          ? compactCurrency(marcaIngresoBruto - marcaIngresoNeto)
          : undefined,
      total: marcaIngresoBruto != null ? compactCurrency(marcaIngresoBruto) : undefined,
      source: "desde ONEPAGER",
    },
    {
      label: "Total ingresos",
      neto: compactCurrency(totalNeto),
      iva: compactCurrency(totalBruto - totalNeto),
      total: compactCurrency(totalBruto),
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
        data-pdf-grid="kpis-5"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5"
      >
        {metrics.map((m) => (
          <article
            key={m.label}
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-[#F0EFFE] p-6"
          >
            <p className="font-sans text-xs text-[#666666]">{m.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {m.neto}
            </p>
            {(m.iva || m.total) && (
              <p className="mt-3 font-sans text-xs text-[#666666]">
                {m.iva && (
                  <>
                    <span className="text-[#999999]">IVA</span> {m.iva}
                  </>
                )}
                {m.iva && m.total && <span className="text-[#999999]">{"  ·  "}</span>}
                {m.total && (
                  <>
                    <span className="text-[#999999]">Total</span> {m.total}
                  </>
                )}
              </p>
            )}
            <p className="mt-3 font-sans text-xs text-[#999999]">{m.source}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
