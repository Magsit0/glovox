"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { NegocioResumenRow } from "@/lib/unabase/types";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

interface Props {
  resumen: NegocioResumenRow | null;
  /** true solo para "producción de eventos propios" — únicas áreas con sección Inputs Externos. */
  tieneInputsExternos: boolean;
}

// Base de cálculo del bloque "Admin y Finanzas: Unabase". Estado local al
// componente a propósito: los 3 modos ya vienen resueltos en `resumen` (una
// sola query), así que el switch es puramente visual — no toca la URL ni
// dispara refetch, y por diseño no interfiere con el toggle Neto/Bruto de
// más abajo (ese sí refetchea Gastos con otra columna en BigQuery).
type Mode = "neto" | "bruto" | "impuestos";
type Tone = "positive" | "negative" | "neutral";

interface Kpi {
  label: string;
  value: string;
  caption?: string;
  deltaTone?: Tone;
  /** Cifra(s) secundaria(s), chicas y apagadas, bajo el valor principal. */
  subLines?: string[];
  /** Maestro Unabase vs. documentado en BQ no reconcilian (dato de calidad, no depende del modo). */
  warning?: string;
  /** Insignia con el modo activo — se omite en cards que no participan del switch. */
  showBadge?: boolean;
  /** Nota sutil en verde — ej. qué otra cifra del dashboard debería calzar con esta. */
  hint?: string;
  /** 4ª card: muestra el toggle Utilidad ($) / Margen bruto (%) en su cabecera. */
  hasMargenToggle?: boolean;
  /** Fórmula del cálculo, en un chip debajo del valor (ej. cómo se arma el margen). */
  formula?: string;
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

const NO_RECONCILIA = "No reconcilia con lo documentado";

const MODE_OPTIONS: { value: Mode; label: string; title: string }[] = [
  { value: "neto", label: "Neto", title: "Montos netos, sin impuestos" },
  { value: "bruto", label: "Bruto", title: "Montos con impuestos incluidos" },
  { value: "impuestos", label: "Impuestos", title: "Solo IVA, otros impuestos y retenciones" },
];

const MODE_LABEL: Record<Mode, string> = { neto: "Neto", bruto: "Bruto", impuestos: "Impuestos" };

// 4ª card: alterna entre el monto de utilidad ($) y el margen bruto (%).
type MargenView = "utilidad" | "margen";

const MARGEN_VIEW_OPTIONS: { value: MargenView; label: string; title: string }[] = [
  { value: "utilidad", label: "$", title: "Utilidad (venta − gasto)" },
  { value: "margen", label: "%", title: "Margen bruto (utilidad ÷ venta)" },
];

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function buildKpis(
  resumen: NegocioResumenRow | null,
  mode: Mode,
  tieneInputsExternos: boolean,
  margenView: MargenView,
): Kpi[] {
  // Venta neta: par maestro venta_neta/venta_bruta (total_neto/total_nv de
  // Unabase) — total de la Nota de Venta. A diferencia de las otras 2 cards,
  // el par neto/bruto ya viene limpio del maestro (no depende del rollup
  // documentado en BQ): confirmado empíricamente que venta_bruta = venta_neta
  // × 1.19 en el 100% de los negocios, sin importar descuentos aplicados.
  const ventaNetaValue = resumen?.ventaNeta;
  const ventaBrutaValue = resumen?.ventaBruta;
  let ventaNetaKpiValue = "—";
  let ventaNetaCaption: string | undefined;
  if (mode === "neto") {
    ventaNetaKpiValue = ventaNetaValue != null ? compactCurrency(ventaNetaValue) : "—";
    ventaNetaCaption = ventaNetaValue != null ? formatCurrency(ventaNetaValue) : undefined;
  } else if (mode === "bruto") {
    ventaNetaKpiValue = ventaBrutaValue != null ? compactCurrency(ventaBrutaValue) : "—";
    ventaNetaCaption = ventaBrutaValue != null ? formatCurrency(ventaBrutaValue) : undefined;
  } else {
    const iva = ventaNetaValue != null && ventaBrutaValue != null ? ventaBrutaValue - ventaNetaValue : null;
    ventaNetaKpiValue = iva != null ? compactCurrency(iva) : "—";
    ventaNetaCaption = "IVA de la Nota de Venta (19%)";
  }
  const ventaNeta: Kpi = {
    label: "Venta neta",
    value: ventaNetaKpiValue,
    caption: ventaNetaCaption,
    showBadge: true,
    // Solo en Neto y solo si el negocio tiene sección Inputs Externos (áreas
    // fuera de "producción de eventos propios" no la tienen, nada que calzar).
    hint:
      mode === "neto" && tieneInputsExternos
        ? "Este número debe calzar con el total de INPUTS EXTERNOS"
        : undefined,
  };

  const docsVenta = resumen?.docsVentaResumen ?? 0;
  // Base coherente: el neto es el maestro (ventaFacturada) y el bruto se arma
  // SUMÁNDOLE el IVA documentado (bruto = neto + IVA), no saltando a la cifra
  // documentada. Así el bruto nunca queda por debajo del neto y neto+IVA=bruto.
  const vFact = resumen?.ventaFacturada ?? null;
  const vIva = resumen?.ventaIvaDocumentada ?? null;
  let ventaValue = "—";
  let ventaSubLines: string[] | undefined;
  if (mode === "neto") {
    ventaValue = vFact != null ? compactCurrency(vFact) : "—";
    ventaSubLines =
      resumen?.ventaNetaDocumentada != null
        ? [`Documentado ${compactCurrency(resumen.ventaNetaDocumentada)} · ${docsVenta} docs`]
        : undefined;
  } else if (mode === "bruto") {
    ventaValue = vFact != null && vIva != null ? compactCurrency(vFact + vIva) : "—";
    ventaSubLines =
      vFact != null && vIva != null
        ? [`Neto ${compactCurrency(vFact)} + IVA ${compactCurrency(vIva)}`]
        : undefined;
  } else {
    ventaValue = vIva != null ? compactCurrency(vIva) : "—";
    ventaSubLines =
      vFact != null && vIva != null
        ? [`Neto ${compactCurrency(vFact)} · Bruto ${compactCurrency(vFact + vIva)}`]
        : undefined;
  }
  const ventaFacturadaKpi: Kpi = {
    label: "Venta facturada",
    value: ventaValue,
    subLines: ventaSubLines,
    warning: resumen?.flagVentaNoReconcilia ? NO_RECONCILIA : undefined,
    showBadge: true,
  };

  const lineasGasto = resumen?.lineasGasto ?? 0;
  // Mismo criterio que Venta: neto = maestro (gastoReal); impuestos = delta
  // documentado (bruto_doc − neto_doc = IVA + otros + retención); bruto = neto +
  // impuestos. Coherente: bruto ≥ neto y neto + impuestos = bruto.
  const gReal = resumen?.gastoReal ?? null;
  const gNetoDoc = resumen?.gastoNetoDocumentado ?? null;
  const gBrutoDoc = resumen?.gastoBrutoDocumentado ?? null;
  const gImpuestos = gNetoDoc != null && gBrutoDoc != null ? gBrutoDoc - gNetoDoc : null;
  let gastoValue = "—";
  let gastoSubLines: string[] | undefined;
  if (mode === "neto") {
    gastoValue = gReal != null ? compactCurrency(gReal) : "—";
    gastoSubLines =
      gNetoDoc != null
        ? [`Documentado ${compactCurrency(gNetoDoc)} · ${lineasGasto} líneas`]
        : undefined;
  } else if (mode === "bruto") {
    gastoValue = gReal != null && gImpuestos != null ? compactCurrency(gReal + gImpuestos) : "—";
    gastoSubLines =
      gReal != null && gImpuestos != null
        ? [`Neto ${compactCurrency(gReal)} + impuestos ${compactCurrency(gImpuestos)}`]
        : undefined;
  } else {
    gastoValue = gImpuestos != null ? compactCurrency(gImpuestos) : "—";
    gastoSubLines =
      gImpuestos != null
        ? [
            `IVA ${compactCurrency(resumen?.gastoIvaDocumentado ?? 0)} · Otros ${compactCurrency(
              resumen?.gastoOtrosImpuestosDocumentado ?? 0,
            )} · Retención ${compactCurrency(resumen?.gastoRetencionHonorariosDocumentado ?? 0)}`,
          ]
        : undefined;
  }
  const gastoRealKpi: Kpi = {
    label: "Gasto real",
    value: gastoValue,
    subLines: gastoSubLines,
    warning: resumen?.flagGastoNoReconcilia ? NO_RECONCILIA : undefined,
    showBadge: true,
  };

  // 4ª card — INDEPENDIENTE del switch Neto/Bruto/Impuestos (decisión del usuario):
  // solo alterna entre Utilidad ($) y Margen bruto (%). Usa las cifras reales del
  // maestro (netas): venta_facturada − gasto_real, los mismos montos de las cards
  // 2 y 3, así se puede verificar a ojo que card2 − card3 = esta utilidad.
  const ventaReal = resumen?.ventaFacturada ?? null;
  const gastoRealVal = resumen?.gastoReal ?? null;
  const utilidad = ventaReal != null && gastoRealVal != null ? ventaReal - gastoRealVal : null;
  const margenRatio =
    utilidad != null && ventaReal != null && ventaReal !== 0 ? utilidad / ventaReal : null;
  const utilidadTone: Tone | undefined = utilidad != null ? marginTone(utilidad) : undefined;
  const ventaGastoLine =
    ventaReal != null && gastoRealVal != null
      ? `Venta fact. ${compactCurrency(ventaReal)} − Gasto ${compactCurrency(gastoRealVal)}`
      : undefined;

  const margenKpi: Kpi =
    margenView === "utilidad"
      ? {
          label: "Utilidad real facturada",
          value: utilidad != null ? compactCurrency(utilidad) : "—",
          caption: margenRatio != null ? `Margen bruto ${pct(margenRatio)}` : undefined,
          deltaTone: utilidadTone,
          subLines: [
            ventaGastoLine,
            resumen?.utilidadFinal != null
              ? `Utilidad final ${compactCurrency(resumen.utilidadFinal)}`
              : undefined,
          ].filter((l): l is string => Boolean(l)),
          hasMargenToggle: true,
        }
      : {
          label: "Margen bruto",
          value: margenRatio != null ? pct(margenRatio) : "—",
          caption: utilidad != null ? `Utilidad ${compactCurrency(utilidad)}` : undefined,
          deltaTone: utilidadTone,
          subLines: ventaGastoLine ? [ventaGastoLine] : undefined,
          hasMargenToggle: true,
          formula: margenRatio != null ? "Utilidad ÷ Venta facturada" : undefined,
        };

  return [ventaNeta, ventaFacturadaKpi, gastoRealKpi, margenKpi];
}

export default function ResumenKpis({ resumen, tieneInputsExternos }: Props) {
  const [mode, setMode] = useState<Mode>("neto");
  const [margenView, setMargenView] = useState<MargenView>("utilidad");
  const kpis = buildKpis(resumen, mode, tieneInputsExternos, margenView);

  return (
    <section data-pdf-section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            Resumen
          </h2>
          <span className="font-sans text-xs text-[#666666]">
            Montos totales extraídos de Unabase
          </span>
        </div>
        <label className="flex flex-col gap-1" data-no-print="true">
          <span className="font-sans text-xs text-[#666666]">Base de cálculo</span>
          <div
            role="group"
            aria-label="Base de cálculo de Admin y Finanzas"
            className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5"
          >
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                aria-pressed={mode === opt.value}
                onClick={() => setMode(opt.value)}
                className={`rounded-md px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                  mode === opt.value
                    ? "bg-[#F0EFFE] text-[#9F99F8]"
                    : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>
      </header>
      <div
        data-pdf-grid="kpis-4"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {kpis.map((k) => (
          <article
            key={k.label}
            // min-h fijo: la 4ª card cambia de alto al togglear $/% y el grid
            // estira toda la fila a la más alta; con un piso común no hay salto.
            // El label queda de header arriba y el bloque métrica se centra en el
            // espacio restante, para que el aire se reparta parejo (no hueco abajo).
            className="flex min-h-[220px] flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-sans text-xs text-[#666666]">{k.label}</p>
                {k.showBadge && (
                  <span className="rounded-full bg-[#F0EFFE] px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-[#9F99F8]">
                    {MODE_LABEL[mode]}
                  </span>
                )}
              </div>
              {k.hasMargenToggle && (
                <div
                  role="group"
                  aria-label="Utilidad o margen bruto"
                  data-no-print="true"
                  className="inline-flex shrink-0 rounded-lg border border-[#E5E5E5] bg-white p-0.5"
                >
                  {MARGEN_VIEW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.title}
                      aria-pressed={margenView === opt.value}
                      onClick={() => setMargenView(opt.value)}
                      className={`rounded-md px-2 py-0.5 font-sans text-[11px] font-medium transition-colors ${
                        margenView === opt.value
                          ? "bg-[#F0EFFE] text-[#9F99F8]"
                          : "text-[#666666] hover:text-[#333333]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center">
            <p className="font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {k.value}
            </p>
            {k.formula && (
              <span className="mt-2 inline-flex w-fit items-center rounded-md bg-[#FAFAFA] px-2 py-1 font-sans text-[11px] text-[#666666]">
                {k.formula}
              </span>
            )}
            {k.caption && (
              <div className="mt-3 flex items-center gap-2">
                {k.deltaTone && (
                  <span
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor[k.deltaTone] }}
                  />
                )}
                <span className="truncate font-sans text-xs text-[#666666]">{k.caption}</span>
              </div>
            )}
            {k.subLines && k.subLines.length > 0 && (
              <div className="mt-2 flex flex-col gap-0.5">
                {k.subLines.map((line) => (
                  <span key={line} className="truncate font-sans text-[11px] text-[#999999]">
                    {line}
                  </span>
                ))}
              </div>
            )}
            {k.warning && (
              <div className="mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#ED75A0]" />
                <span className="font-sans text-[11px] font-medium text-[#ED75A0]">{k.warning}</span>
              </div>
            )}
            {k.hint && (
              <p className="mt-2 font-sans text-[11px] text-[#B1D750]">{k.hint}</p>
            )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
