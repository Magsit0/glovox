"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { NegocioResumenRow } from "@/lib/unabase/types";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";

interface Props {
  resumen: NegocioResumenRow | null;
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

function buildKpis(resumen: NegocioResumenRow | null, mode: Mode): Kpi[] {
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
    // Solo en Neto: el Total ingresos de Inputs Externos también es neto, así
    // que ahí es donde la comparación tiene sentido (en Bruto/Impuestos no).
    hint: mode === "neto" ? "Este número debe calzar con el total de INPUTS EXTERNOS" : undefined,
  };

  const docsVenta = resumen?.docsVentaResumen ?? 0;
  let ventaValue = "—";
  let ventaSubLines: string[] | undefined;
  if (mode === "neto") {
    ventaValue = resumen?.ventaFacturada != null ? compactCurrency(resumen.ventaFacturada) : "—";
    ventaSubLines =
      resumen?.ventaNetaDocumentada != null
        ? [`Documentado ${compactCurrency(resumen.ventaNetaDocumentada)} · ${docsVenta} docs`]
        : undefined;
  } else if (mode === "bruto") {
    ventaValue =
      resumen?.ventaBrutaDocumentada != null ? compactCurrency(resumen.ventaBrutaDocumentada) : "—";
    ventaSubLines =
      resumen?.ventaFacturada != null
        ? [`Facturado (neto, maestro) ${compactCurrency(resumen.ventaFacturada)} · ${docsVenta} docs`]
        : undefined;
  } else {
    ventaValue = resumen?.ventaIvaDocumentada != null ? compactCurrency(resumen.ventaIvaDocumentada) : "—";
    ventaSubLines =
      resumen?.ventaNetaDocumentada != null
        ? [`IVA sobre ${compactCurrency(resumen.ventaNetaDocumentada)} neto · ${docsVenta} docs`]
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
  let gastoValue = "—";
  let gastoSubLines: string[] | undefined;
  if (mode === "neto") {
    gastoValue = resumen?.gastoReal != null ? compactCurrency(resumen.gastoReal) : "—";
    gastoSubLines =
      resumen?.gastoNetoDocumentado != null
        ? [`Documentado ${compactCurrency(resumen.gastoNetoDocumentado)} · ${lineasGasto} líneas`]
        : undefined;
  } else if (mode === "bruto") {
    gastoValue =
      resumen?.gastoBrutoDocumentado != null ? compactCurrency(resumen.gastoBrutoDocumentado) : "—";
    gastoSubLines =
      resumen?.gastoReal != null
        ? [`Real (neto, maestro) ${compactCurrency(resumen.gastoReal)} · ${lineasGasto} líneas`]
        : undefined;
  } else {
    const iva = resumen?.gastoIvaDocumentado ?? null;
    const otros = resumen?.gastoOtrosImpuestosDocumentado ?? null;
    const retencion = resumen?.gastoRetencionHonorariosDocumentado ?? null;
    gastoValue =
      iva == null && otros == null && retencion == null
        ? "—"
        : compactCurrency((iva ?? 0) + (otros ?? 0) + (retencion ?? 0));
    gastoSubLines = [
      `IVA ${compactCurrency(iva ?? 0)} · Otros ${compactCurrency(otros ?? 0)} · Retención ${compactCurrency(retencion ?? 0)}`,
    ];
  }
  const gastoRealKpi: Kpi = {
    label: "Gasto real",
    value: gastoValue,
    subLines: gastoSubLines,
    warning: resumen?.flagGastoNoReconcilia ? NO_RECONCILIA : undefined,
    showBadge: true,
  };

  // En impuestos, el margen deja de ser un margen: pasa a ser la posición neta
  // de IVA (débito de venta − crédito de gasto) — por eso cambia también el label.
  let margenLabel = "Margen real facturado";
  let margenValue = "—";
  let margenCaption: string | undefined;
  let margenTone: Tone | undefined;
  let margenSubLines: string[] | undefined;
  if (mode === "neto") {
    margenValue = resumen?.utilidadReal != null ? compactCurrency(resumen.utilidadReal) : "—";
    margenCaption =
      resumen?.utilidadFinal != null ? `Utilidad final ${compactCurrency(resumen.utilidadFinal)}` : undefined;
    margenTone = resumen?.utilidadReal != null ? marginTone(resumen.utilidadReal) : undefined;
    const margenDocNeto =
      resumen?.ventaNetaDocumentada != null && resumen?.gastoNetoDocumentado != null
        ? resumen.ventaNetaDocumentada - resumen.gastoNetoDocumentado
        : null;
    margenSubLines = margenDocNeto != null ? [`Margen documentado ${compactCurrency(margenDocNeto)}`] : undefined;
  } else if (mode === "bruto") {
    const margenDocBruto =
      resumen?.ventaBrutaDocumentada != null && resumen?.gastoBrutoDocumentado != null
        ? resumen.ventaBrutaDocumentada - resumen.gastoBrutoDocumentado
        : null;
    margenValue = margenDocBruto != null ? compactCurrency(margenDocBruto) : "—";
    margenCaption =
      resumen?.utilidadReal != null
        ? `Utilidad real (neto, maestro) ${compactCurrency(resumen.utilidadReal)}`
        : undefined;
    margenTone = margenDocBruto != null ? marginTone(margenDocBruto) : undefined;
    margenSubLines =
      resumen?.utilidadFinal != null ? [`Utilidad final ${compactCurrency(resumen.utilidadFinal)}`] : undefined;
  } else {
    margenLabel = "IVA neto a pagar";
    const ivaNeto =
      resumen?.ventaIvaDocumentada != null && resumen?.gastoIvaDocumentado != null
        ? resumen.ventaIvaDocumentada - resumen.gastoIvaDocumentado
        : null;
    margenValue = ivaNeto != null ? compactCurrency(ivaNeto) : "—";
    margenCaption = "Débito de venta − crédito de gasto";
    const otrosGasto =
      (resumen?.gastoOtrosImpuestosDocumentado ?? 0) + (resumen?.gastoRetencionHonorariosDocumentado ?? 0);
    margenSubLines = [`Otros impuestos y retención de gasto ${compactCurrency(otrosGasto)}`];
  }
  const margenKpi: Kpi = {
    label: margenLabel,
    value: margenValue,
    caption: margenCaption,
    deltaTone: margenTone,
    subLines: margenSubLines,
    showBadge: true,
  };

  return [ventaNeta, ventaFacturadaKpi, gastoRealKpi, margenKpi];
}

export default function ResumenKpis({ resumen }: Props) {
  const [mode, setMode] = useState<Mode>("neto");
  const kpis = buildKpis(resumen, mode);

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
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <div className="flex items-center gap-2">
              <p className="font-sans text-xs text-[#666666]">{k.label}</p>
              {k.showBadge && (
                <span className="rounded-full bg-[#F0EFFE] px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-[#9F99F8]">
                  {MODE_LABEL[mode]}
                </span>
              )}
            </div>
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
              <p className="mt-2 font-sans text-[11px] text-[#7B9E24]">{k.hint}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
