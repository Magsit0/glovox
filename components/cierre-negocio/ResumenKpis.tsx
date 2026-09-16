"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { NegocioResumenRow } from "@/lib/unabase/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

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
//
// OJO: el switch sólo aplica a la fila REAL. La fila ESPERADO se queda siempre
// en neto porque el presupuesto no tiene desglose de impuestos (es neto por
// definición); mezclar bases ahí rompería la resta de la fila.
type Mode = "neto" | "bruto" | "impuestos";
type Tone = "positive" | "negative" | "neutral";

/** Cada utilidad (esperada y real) tiene su propio toggle $ / %. */
type MargenKey = "esperada" | "real";
type MargenView = "utilidad" | "margen";

interface Kpi {
  label: string;
  value: string;
  caption?: string;
  deltaTone?: Tone;
  /** Cifra(s) secundaria(s), chicas y apagadas, bajo el valor principal. */
  subLines?: string[];
  /** Maestro Unabase vs. documentado en BQ no reconcilian (dato de calidad, no depende del modo). */
  warning?: string;
  /** Texto de la insignia: el modo activo en la fila REAL, "Neto" fijo en ESPERADO. */
  badge?: string;
  /** Nota sutil en verde — ej. qué otra cifra del dashboard debería calzar con esta. */
  hint?: string;
  /** Si está, la card muestra el toggle Utilidad ($) / Margen (%) de esa utilidad. */
  margenKey?: MargenKey;
  /** Fórmula del cálculo, en un chip debajo del valor (ej. cómo se arma el margen). */
  formula?: string;
}

interface KpiRow {
  key: string;
  label: string;
  hint: string;
  kpis: Kpi[];
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

const MARGEN_VIEW_OPTIONS: { value: MargenView; label: string; title: string }[] = [
  { value: "utilidad", label: "$", title: "Utilidad (venta − gasto)" },
  { value: "margen", label: "%", title: "Margen (utilidad ÷ venta)" },
];

function pct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Card de utilidad: mismo armado para la esperada y la real. */
function utilidadKpi(args: {
  labelUtilidad: string;
  labelMargen: string;
  margenKey: MargenKey;
  view: MargenView;
  venta: number | null;
  gasto: number | null;
  /** Cómo se describe la resta bajo el número. */
  restaLabel: (venta: string, gasto: string) => string;
  denominador: string;
  extraSubLine?: string;
}): Kpi {
  const { labelUtilidad, labelMargen, margenKey, view, venta, gasto, restaLabel, denominador } = args;
  const utilidad = venta != null && gasto != null ? venta - gasto : null;
  const ratio = utilidad != null && venta != null && venta !== 0 ? utilidad / venta : null;
  const tone: Tone | undefined = utilidad != null ? marginTone(utilidad) : undefined;
  const resta =
    venta != null && gasto != null
      ? restaLabel(compactCurrency(venta), compactCurrency(gasto))
      : undefined;

  if (view === "utilidad") {
    return {
      label: labelUtilidad,
      value: utilidad != null ? compactCurrency(utilidad) : "—",
      caption: ratio != null ? `Margen ${pct(ratio)}` : undefined,
      deltaTone: tone,
      subLines: [resta, args.extraSubLine].filter((l): l is string => Boolean(l)),
      badge: "Neto",
      margenKey,
    };
  }
  return {
    label: labelMargen,
    value: ratio != null ? pct(ratio) : "—",
    caption: utilidad != null ? `Utilidad ${compactCurrency(utilidad)}` : undefined,
    deltaTone: tone,
    subLines: resta ? [resta] : undefined,
    badge: "Neto",
    margenKey,
    formula: ratio != null ? `Utilidad ÷ ${denominador}` : undefined,
  };
}

function buildRows(
  resumen: NegocioResumenRow | null,
  mode: Mode,
  tieneInputsExternos: boolean,
  margenView: Record<MargenKey, MargenView>,
): KpiRow[] {
  // ───────── Fila ESPERADO (siempre neto) ─────────

  // Venta neta = total de la Nota de Venta (maestro). El par neto/bruto del
  // maestro viene limpio (venta_bruta = venta_neta × 1.19), así que el bruto y
  // el IVA se muestran como línea secundaria en vez de tomar el switch.
  const vNeta = resumen?.ventaNeta ?? null;
  const vBruta = resumen?.ventaBruta ?? null;
  const ventaNetaKpi: Kpi = {
    label: "Venta neta",
    value: vNeta != null ? compactCurrency(vNeta) : "—",
    caption: vNeta != null ? formatCurrency(vNeta) : undefined,
    subLines:
      vNeta != null && vBruta != null
        ? [`Bruto ${compactCurrency(vBruta)} · IVA ${compactCurrency(vBruta - vNeta)}`]
        : undefined,
    badge: "Neto",
    hint: tieneInputsExternos
      ? "Este número debe calzar con el total de INPUTS EXTERNOS"
      : undefined,
  };

  const gPresup = resumen?.gastoPresupuestado ?? null;
  const gPresupItems = resumen?.presupuestoGastoItems ?? null;
  const lineasPresup = resumen?.lineasPresupuesto ?? null;
  const gastoPresupuestadoKpi: Kpi = {
    label: "Gasto presupuestado",
    value: gPresup != null ? compactCurrency(gPresup) : "—",
    caption: gPresup != null ? formatCurrency(gPresup) : undefined,
    subLines:
      gPresupItems != null
        ? [
            `Por ítems ${compactCurrency(gPresupItems)}${
              lineasPresup != null ? ` · ${formatNumber(lineasPresup)} líneas` : ""
            }`,
          ]
        : undefined,
    badge: "Neto",
  };

  const utilidadEsperadaKpi = utilidadKpi({
    labelUtilidad: "Utilidad esperada",
    labelMargen: "Margen esperado",
    margenKey: "esperada",
    view: margenView.esperada,
    venta: vNeta,
    gasto: gPresup,
    restaLabel: (v, g) => `Venta neta ${v} − Presupuesto ${g}`,
    denominador: "Venta neta",
    extraSubLine:
      resumen?.utilidadPresupuestada != null
        ? `Según maestro ${compactCurrency(resumen.utilidadPresupuestada)}`
        : undefined,
  });

  // ───────── Fila REAL (sigue el switch Neto/Bruto/Impuestos) ─────────

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
    badge: MODE_LABEL[mode],
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
    label: "Gasto real (OC)",
    value: gastoValue,
    subLines: gastoSubLines,
    warning: resumen?.flagGastoNoReconcilia ? NO_RECONCILIA : undefined,
    badge: MODE_LABEL[mode],
  };

  // La utilidad real es independiente del switch: siempre las cifras netas del
  // maestro, para que venta facturada − gasto real cuadre a la vista.
  const utilidadRealKpi = utilidadKpi({
    labelUtilidad: "Utilidad real facturada",
    labelMargen: "Margen real",
    margenKey: "real",
    view: margenView.real,
    venta: vFact,
    gasto: gReal,
    restaLabel: (v, g) => `Venta fact. ${v} − Gasto ${g}`,
    denominador: "Venta facturada",
    extraSubLine:
      resumen?.utilidadFinal != null
        ? `Utilidad final ${compactCurrency(resumen.utilidadFinal)}`
        : undefined,
  });

  return [
    {
      key: "esperado",
      label: "Esperado",
      hint: "Lo comprometido: Nota de Venta y presupuesto",
      kpis: [ventaNetaKpi, gastoPresupuestadoKpi, utilidadEsperadaKpi],
    },
    {
      key: "real",
      label: "Real",
      hint: "Lo ejecutado: facturación y órdenes de compra",
      kpis: [ventaFacturadaKpi, gastoRealKpi, utilidadRealKpi],
    },
  ];
}

export default function ResumenKpis({ resumen, tieneInputsExternos }: Props) {
  const [mode, setMode] = useState<Mode>("neto");
  const [margenView, setMargenView] = useState<Record<MargenKey, MargenView>>({
    esperada: "utilidad",
    real: "utilidad",
  });
  const rows = buildRows(resumen, mode, tieneInputsExternos, margenView);

  return (
    <section data-pdf-section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            Resultado del negocio
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

      {/* Matriz 2×3: cada fila se lee de izquierda a derecha como la resta
          (venta − gasto = utilidad), y la comparación esperado/real es vertical. */}
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-sans text-sm font-medium text-[#333333]">{row.label}</span>
            <span className="font-sans text-xs text-[#999999]">{row.hint}</span>
          </div>
          <div
            data-pdf-grid="kpis-3"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {row.kpis.map((k) => (
              <KpiCard
                key={k.label}
                k={k}
                view={k.margenKey ? margenView[k.margenKey] : undefined}
                onViewChange={
                  k.margenKey
                    ? (v) => setMargenView((cur) => ({ ...cur, [k.margenKey as MargenKey]: v }))
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function KpiCard({
  k,
  view,
  onViewChange,
}: {
  k: Kpi;
  view?: MargenView;
  onViewChange?: (v: MargenView) => void;
}) {
  return (
    <article
      // min-h fijo: las cards de utilidad cambian de alto al togglear $/% y el
      // grid estira toda la fila a la más alta; con un piso común no hay salto.
      // El label queda de header arriba y el bloque métrica se centra en el
      // espacio restante, para que el aire se reparta parejo (no hueco abajo).
      className="flex min-h-[220px] flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="font-sans text-xs text-[#666666]">{k.label}</p>
          {k.badge && (
            <span className="rounded-full bg-[#F0EFFE] px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-[#9F99F8]">
              {k.badge}
            </span>
          )}
        </div>
        {view && onViewChange && (
          <div
            role="group"
            aria-label="Utilidad o margen"
            data-no-print="true"
            className="inline-flex shrink-0 rounded-lg border border-[#E5E5E5] bg-white p-0.5"
          >
            {MARGEN_VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                aria-pressed={view === opt.value}
                onClick={() => onViewChange(opt.value)}
                className={`rounded-md px-2 py-0.5 font-sans text-[11px] font-medium transition-colors ${
                  view === opt.value
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
        {k.hint && <p className="mt-2 font-sans text-[11px] text-[#B1D750]">{k.hint}</p>}
      </div>
    </article>
  );
}
