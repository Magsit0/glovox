import type {
  CurrencyBreakdown,
  DisplayCurrency,
  PaidMediaKpis,
} from "@/lib/queries/paidMedia";
import {
  compactMoney,
  formatFxRate,
  formatInt,
  formatLocalMoney,
  formatMoney,
  formatRatio,
  formatRoas,
  formatUnitCost,
} from "@/components/paid-media/format";

interface Props {
  kpis: PaidMediaKpis;
  /** Gasto por moneda de origen — cuelga del KPI de gasto para poder cuadrar
   *  contra la factura de cada plataforma, que llega en la moneda nativa. */
  porMoneda: CurrencyBreakdown[];
  /** Moneda en que se expresan los montos consolidados. */
  moneda: DisplayCurrency;
}

interface Card {
  label: string;
  value: string;
  caption: string;
}

export default function KpiRow({ kpis, porMoneda, moneda }: Props) {
  const ctrCaption = `${formatInt(kpis.clics)} clics / ${formatInt(kpis.impresiones)} impr.`;

  // Cuando hay filas sin conversión, el denominador de CPC/CPM no es el mismo
  // que el número que muestra la tarjeta de Clics. Decirlo evita un descuadre
  // invisible entre dos tarjetas que el lector asume consistentes.
  const cpcCaption =
    kpis.clicsConvertidos !== kpis.clics
      ? `Sobre ${formatInt(kpis.clicsConvertidos)} clics convertidos`
      : "Costo por clic";
  const cpmCaption =
    kpis.impresionesConvertidas !== kpis.impresiones
      ? `Sobre ${formatInt(kpis.impresionesConvertidas)} impr. convertidas`
      : "Costo por mil impresiones";

  const roasCaption =
    kpis.valorConversion > 0
      ? `Valor conv. ${formatMoney(kpis.valorConversion, moneda)}`
      : kpis.conversiones > 0
        ? `${formatInt(kpis.conversiones)} conversiones`
        : "Sin conversiones reportadas";

  const cards: Card[] = [
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
      value: formatUnitCost(kpis.cpc, moneda),
      caption: cpcCaption,
    },
    {
      label: "CPM",
      value: formatUnitCost(kpis.cpm, moneda),
      caption: cpmCaption,
    },
    {
      label: "Conversiones",
      value: formatInt(kpis.conversiones),
      caption: kpis.cpa > 0 ? `CPA ${formatUnitCost(kpis.cpa, moneda)}` : "Sin CPA",
    },
    {
      label: "ROAS",
      value: formatRoas(kpis.roas),
      caption: roasCaption,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      {kpis.gap.filas > 0 && <FxGapNotice gap={kpis.gap} />}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Spotlight: el consolidado es el titular, y debajo el gasto en cada
            moneda de origen para poder reconciliarlo contra la factura. */}
        <article className="flex flex-col rounded-xl bg-[#9F99F8] p-6 text-white sm:col-span-2 lg:col-span-1">
          <p className="font-sans text-xs text-white/80">Gasto ({moneda})</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight">
            {compactMoney(kpis.gasto)}
          </p>
          <p className="mt-3 font-sans text-xs text-white/80">
            {formatMoney(kpis.gasto, moneda)}
          </p>

          {porMoneda.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-white/20 pt-3">
              {porMoneda.map((c) => (
                <li key={c.currency} className="flex flex-col">
                  <span className="flex items-baseline justify-between gap-2 font-sans text-xs text-white">
                    <span className="truncate">
                      {formatLocalMoney(c.gastoLocal, c.currency)}
                    </span>
                    <span className="flex-shrink-0 text-white/80">
                      {formatMoney(c.gastoConvertido, moneda)}
                    </span>
                  </span>
                  {/* La tasa solo informa cuando hay conversión de verdad: si la
                      moneda de origen es la misma que la de despliegue, es 1. */}
                  {c.currency !== moneda && c.fxEfectivo > 0 && (
                    <span className="font-sans text-[10px] text-white/60">
                      1 {moneda} = {formatFxRate(c.fxEfectivo, c.currency)} {c.currency}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
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
            <p className="mt-3 truncate font-sans text-xs text-[#666666]">
              {c.caption}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Aviso de gasto sin convertir. Informa el MONTO por moneda, no el número de
 * filas: saber que "faltan 28 filas" no permite decidir nada, saber que faltan
 * $11.514 CLP sí. Ocurre cuando `referencia.tipo_cambio` todavía no publicó la
 * tasa del día — el pipeline corre una vez al día y el gasto del día en curso
 * puede adelantársele.
 */
function FxGapNotice({ gap }: { gap: PaidMediaKpis["gap"] }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#F6C544] bg-white p-4">
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#F6C544]"
        aria-hidden="true"
      />
      <p className="font-sans text-sm text-[#333333]">
        Hay gasto sin convertir porque todavía no se publica el tipo de cambio
        de esas fechas:{" "}
        <span className="font-medium">
          {gap.porMoneda
            .map((m) => formatLocalMoney(m.gastoLocal, m.currency))
            .join(" · ")}
        </span>
        . Queda fuera de los totales y se suma solo cuando la tasa esté
        disponible.
      </p>
    </div>
  );
}
