"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Users } from "lucide-react";
import type { CierreEventoRow, IngresoDetalleRow } from "@/lib/unabase/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import { REBATE_PCT_DEFAULT, rebateFrom } from "@/lib/constants/rebate";
import RebatePctEditor from "@/components/cierre-negocio/RebatePctEditor";
import TotalIngresosDonut from "@/components/cierre-negocio/TotalIngresosDonut";

interface Props {
  evento: CierreEventoRow;
  /** EventoID (6 chars) — llave del % de rebate editable. */
  eventoId: string | null;
  marcaIngresoNeto: number | null;
  marcaIngresoBruto: number | null;
  mesasVipNeto: number | null;
  mesasVipBruto: number | null;
  mediosNeto: number | null;
  mediosBruto: number | null;
  /** % de rebate en puntos porcentuales (55 = 55%). */
  rebatePorcentaje: number | null;
  marcaDetalle: IngresoDetalleRow[];
  mesasVipDetalle: IngresoDetalleRow[];
  mediosDetalle: IngresoDetalleRow[];
}

// Los inputs externos se muestran NETOS como número principal, con el IVA y el
// total c/IVA debajo. Tickets, cargo y FF&BB vienen brutos (IVA incluido) →
// neto = bruto/(1+IVA). Producción de eventos propios = Chile (19%).
const IVA_PCT = 0.19;
const netoDe = (bruto: number): number => bruto / (1 + IVA_PCT);

// Switch Total/Percápita: divide todos los montos de Inputs Externos por los
// asistentes del evento. Se aplica ANTES de derivar neto/IVA/total, así que
// esa derivación (netoDe, rebateFrom) queda igual — solo cambia la escala de
// los montos de entrada.
type ValorMode = "total" | "percapita";

const VALOR_MODE_OPTIONS: { value: ValorMode; label: string }[] = [
  { value: "total", label: "Total" },
  { value: "percapita", label: "Percápita" },
];

interface Metric {
  label: string;
  /** Monto neto — número principal de la tarjeta. */
  neto: string;
  /** IVA del monto (debajo, junto al total). */
  iva?: string;
  /** Total con IVA (debajo, junto al IVA). */
  total?: string;
  source: string;
  /** Contenido extra entre el monto y la fuente (ej: editor de % del rebate). */
  extra?: React.ReactNode;
  /** Detalle por cliente (neto) — muestra una nube en hover si tiene filas. */
  detalle?: IngresoDetalleRow[];
}

// Métrica a partir de un monto BRUTO (tickets, FF&BB): el neto se deriva
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

// Métrica desde ONEPAGER (marcas, mesas VIP, medios): neto y bruto vienen
// guardados, así que el IVA es exacto (bruto − neto), no derivado.
function onepagerMetric(
  label: string,
  neto: number | null,
  bruto: number | null,
  source: string,
  detalle?: IngresoDetalleRow[],
): Metric {
  return {
    label,
    neto: neto != null ? compactCurrency(neto) : "—",
    iva: bruto != null && neto != null ? compactCurrency(bruto - neto) : undefined,
    total: bruto != null ? compactCurrency(bruto) : undefined,
    source,
    detalle,
  };
}

const DETALLE_MAX_ROWS = 12;

function DetalleTooltip({ detalle }: { detalle: IngresoDetalleRow[] }) {
  const visibles = detalle.slice(0, DETALLE_MAX_ROWS);
  const resto = detalle.length - visibles.length;
  return (
    <div
      role="tooltip"
      data-no-print="true"
      // pointer-events-auto (no "-none"): el botón de abajo debe ser clickeable.
      // Sigue funcionando el group-hover porque este div es descendiente del
      // article.group — pasar el mouse sobre la nube mantiene el hover del padre.
      className="absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-[#E5E5E5] bg-white p-3 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
    >
      <p className="mb-1.5 font-sans text-xs font-medium text-[#666666]">
        Detalle por cliente
      </p>
      <ul className="flex flex-col gap-1">
        {visibles.map((d) => (
          <li key={d.cliente} className="flex items-center justify-between gap-3">
            <span className="truncate font-sans text-xs text-[#333333]">{d.cliente}</span>
            <span className="shrink-0 font-sans text-xs tabular-nums text-[#333333]">
              {formatCurrency(d.monto)}
            </span>
          </li>
        ))}
      </ul>
      {resto > 0 && (
        <p className="mt-1.5 font-sans text-xs text-[#999999]">
          + {resto} cliente{resto === 1 ? "" : "s"} más
        </p>
      )}
      <Link
        href="/onepager"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-1.5 border-t border-[#E5E5E5] pt-2 font-sans text-xs font-medium text-[#9F99F8] transition-colors hover:text-[#8780F0]"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Editar en ONEPAGER
      </Link>
    </div>
  );
}

function MetricCard({ m }: { m: Metric }) {
  const hasDetalle = !!m.detalle && m.detalle.length > 0;
  return (
    <article
      className={`relative flex h-full min-h-[220px] flex-col self-stretch rounded-lg border border-[#E5E5E5] bg-[#F0EFFE] p-6 ${
        hasDetalle ? "group cursor-help" : ""
      }`}
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
      {m.extra && <div className="mt-3">{m.extra}</div>}
      {/* mt-auto: el source siempre queda al pie, así todas las cards se leen
          alineadas abajo aunque su contenido intermedio (ej. Rebate) sea más largo. */}
      <p className="mt-auto pt-3 font-sans text-xs text-[#999999]">{m.source}</p>
      {hasDetalle && <DetalleTooltip detalle={m.detalle!} />}
    </article>
  );
}

export default function EventoResumen({
  evento,
  eventoId,
  marcaIngresoNeto,
  marcaIngresoBruto,
  mesasVipNeto,
  mesasVipBruto,
  mediosNeto,
  mediosBruto,
  rebatePorcentaje,
  marcaDetalle,
  mesasVipDetalle,
  mediosDetalle,
}: Props) {
  const [valorMode, setValorMode] = useState<ValorMode>("total");
  const asistentes = evento.totalAsistentes;
  const hasAsistentes = asistentes != null && asistentes > 0;

  // Divide por asistentes ANTES de derivar neto/IVA/rebate — matemáticamente
  // equivalente a calcular todo en total y dividir al final (misma proporción
  // neto/bruto/IVA), pero así el resto del código no necesita distinguir modo.
  function scale(value: number | null): number | null {
    if (value == null) return null;
    if (valorMode === "total") return value;
    if (!hasAsistentes) return null;
    return value / asistentes!;
  }

  const tBruto = scale(evento.totalVentaTickets);
  const fBruto = scale(evento.totalVentaFfbb);
  const cargoBruto = scale(evento.totalCargoServicio);
  const marcaNeto = scale(marcaIngresoNeto);
  const marcaBruto = scale(marcaIngresoBruto);
  const mesasVipNetoEsc = scale(mesasVipNeto);
  const mesasVipBrutoEsc = scale(mesasVipBruto);
  const mediosNetoEsc = scale(mediosNeto);
  const mediosBrutoEsc = scale(mediosBruto);
  const pct = rebatePorcentaje ?? REBATE_PCT_DEFAULT;

  // Rebate: solo el pct% del cargo por servicio es ingreso Glovox. Se aplica
  // sobre bruto y neto por igual (la proporción es lineal respecto del IVA).
  const rebateBruto = cargoBruto != null ? rebateFrom(cargoBruto, pct) : null;
  const rebateNeto = rebateBruto != null ? netoDe(rebateBruto) : null;

  // Total ingresos = las 6 fuentes de la izquierda (el cargo entra solo como rebate).
  const totalNeto =
    (tBruto != null ? netoDe(tBruto) : 0) +
    (rebateNeto ?? 0) +
    (fBruto != null ? netoDe(fBruto) : 0) +
    (marcaNeto ?? 0) +
    (mesasVipNetoEsc ?? 0) +
    (mediosNetoEsc ?? 0);
  const totalBruto =
    (tBruto ?? 0) +
    (rebateBruto ?? 0) +
    (fBruto ?? 0) +
    (marcaBruto ?? 0) +
    (mesasVipBrutoEsc ?? 0) +
    (mediosBrutoEsc ?? 0);

  const donutSlices = [
    { label: "Tickets", value: tBruto != null ? netoDe(tBruto) : 0 },
    { label: "Rebate", value: rebateNeto ?? 0 },
    { label: "FF&BB", value: fBruto != null ? netoDe(fBruto) : 0 },
    { label: "Marcas", value: marcaNeto ?? 0 },
    { label: "Mesas VIP", value: mesasVipNetoEsc ?? 0 },
    { label: "Medios", value: mediosNetoEsc ?? 0 },
  ];

  const rebateMetric: Metric = {
    label: "Rebate",
    neto: rebateNeto != null ? compactCurrency(rebateNeto) : "—",
    iva: rebateBruto != null && rebateNeto != null
      ? compactCurrency(rebateBruto - rebateNeto)
      : undefined,
    total: rebateBruto != null ? compactCurrency(rebateBruto) : undefined,
    source: "desde Punto Ticket",
    extra: (
      <div className="flex flex-col gap-1">
        {eventoId ? (
          <RebatePctEditor eventoId={eventoId} porcentaje={pct} />
        ) : (
          <span className="font-sans text-xs font-medium text-[#333333]">
            {pct}% del cargo por servicio
          </span>
        )}
        {cargoBruto != null && (
          <span className="font-sans text-xs text-[#999999]">
            Cargo por servicio {compactCurrency(netoDe(cargoBruto))} neto ·{" "}
            {compactCurrency(cargoBruto)} total
          </span>
        )}
      </div>
    ),
  };

  const ingresos: Metric[] = [
    brutoMetric("Venta tickets", tBruto, "desde Punto Ticket"),
    rebateMetric,
    brutoMetric("Venta FF&BB", fBruto, "desde OnFire"),
    onepagerMetric("Ingresos marcas", marcaNeto, marcaBruto, "desde ONEPAGER", marcaDetalle),
    onepagerMetric("Mesas VIP", mesasVipNetoEsc, mesasVipBrutoEsc, "desde ONEPAGER", mesasVipDetalle),
    onepagerMetric("Medios", mediosNetoEsc, mediosBrutoEsc, "desde ONEPAGER", mediosDetalle),
  ];

  return (
    <section data-pdf-section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit self-center items-center gap-2 rounded-full bg-[#9F99F8] px-4 py-1.5 font-sans text-sm font-semibold uppercase tracking-wide text-white">
          <span className="inline-block h-2 w-2 rounded-full bg-white" />
          Inputs externos
        </span>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
              {evento.nombreGlovox?.trim() || "Evento"}
            </h2>
            {evento.totalAsistentes != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
                <Users className="h-3.5 w-3.5 text-[#9F99F8]" />
                {formatNumber(evento.totalAsistentes)} asistentes
              </span>
            )}
            {evento.categoriaEvento?.trim() && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
                {evento.categoriaEvento}
              </span>
            )}
          </div>
          {hasAsistentes && (
            <label className="flex flex-col gap-1" data-no-print="true">
              <span className="font-sans text-xs text-[#666666]">Valores</span>
              <div
                role="group"
                aria-label="Total o percápita"
                className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5"
              >
                {VALOR_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={valorMode === opt.value}
                    onClick={() => setValorMode(opt.value)}
                    className={`rounded-md px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                      valorMode === opt.value
                        ? "bg-[#F0EFFE] text-[#9F99F8]"
                        : "text-[#666666] hover:text-[#333333]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </label>
          )}
        </div>
      </header>

      {/* 6 ingresos a la izquierda (3×2) → confluyen al total, exclusivo a la derecha. */}
      <div
        data-pdf-grid="side-by-side"
        className="grid grid-cols-1 gap-6 lg:grid-cols-4"
      >
        <div
          data-pdf-grid="kpis-6"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3"
        >
          {ingresos.map((m) => (
            <MetricCard key={m.label} m={m} />
          ))}
        </div>

        {/* Spotlight KPI (docs/STYLE_DASHBOARD.md): única card con relleno de
            marca sólido en esta vista, para que el total destaque del resto. */}
        <article className="flex h-full flex-col justify-center rounded-xl bg-[#9F99F8] p-8 lg:col-span-1">
          <p className="font-sans text-xs text-white/80">Total ingresos</p>
          <p className="mt-2 font-display text-5xl font-bold leading-none tracking-tight text-white">
            {compactCurrency(totalNeto)}
          </p>
          <p className="mt-4 font-sans text-sm text-white/80">
            IVA {compactCurrency(totalBruto - totalNeto)}
            {"  ·  "}
            Total {compactCurrency(totalBruto)}
          </p>
          <p className="mt-4 font-sans text-xs text-white/80">
            Tickets + Rebate + FF&BB + Marcas + Mesas VIP + Medios
          </p>
          {totalNeto > 0 && (
            <div className="mt-6 border-t border-white/20 pt-6">
              <p className="mb-3 font-sans text-xs text-white/80">
                Distribución por fuente
              </p>
              <TotalIngresosDonut slices={donutSlices} />
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
