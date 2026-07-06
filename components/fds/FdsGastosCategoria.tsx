"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { FdsGastosData, FdsGastoEdicion } from "@/lib/fds/types";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import FdsBarBreakdown from "./FdsBarBreakdown";

interface Props {
  data: FdsGastosData;
}

type PresetKey = "recientes" | "todas" | "ultima";

interface BaselineRow {
  key: string;
  label: string;
  avgCLP: number;
  pctNorm: number; // share promedio renormalizado a 100%
  n: number;
  minPct: number;
  maxPct: number;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function computeBaseline(editions: FdsGastoEdicion[], data: FdsGastosData): BaselineRow[] {
  const raw = data.bucketKeys.map((key) => {
    const cells = editions
      .map((e) => e.buckets.find((b) => b.key === key))
      .filter((b): b is NonNullable<typeof b> => !!b && b.monto > 0);
    const avgCLP = cells.length ? cells.reduce((a, b) => a + b.monto, 0) / cells.length : 0;
    const avgPct = cells.length ? cells.reduce((a, b) => a + b.pct, 0) / cells.length : 0;
    const pcts = cells.map((c) => c.pct);
    return {
      key,
      label: data.bucketLabels[key],
      avgCLP,
      avgPct,
      n: cells.length,
      minPct: pcts.length ? Math.min(...pcts) : 0,
      maxPct: pcts.length ? Math.max(...pcts) : 0,
    };
  });
  const totalPct = raw.reduce((a, b) => a + b.avgPct, 0);
  return raw
    .filter((r) => r.avgCLP > 0)
    .map((r) => ({
      key: r.key,
      label: r.label,
      avgCLP: r.avgCLP,
      pctNorm: totalPct > 0 ? r.avgPct / totalPct : 0,
      n: r.n,
      minPct: r.minPct,
      maxPct: r.maxPct,
    }))
    .sort((a, b) => b.avgCLP - a.avgCLP);
}

export default function FdsGastosCategoria({ data }: Props) {
  const presets = useMemo(() => {
    const tierA = data.editions.filter((e) => e.tier === "A");
    const recientes = tierA.length ? tierA : data.editions.slice(-2);
    const ultima = data.editions.length ? [data.editions[data.editions.length - 1]] : [];
    return {
      recientes,
      todas: data.editions,
      ultima,
    } as Record<PresetKey, FdsGastoEdicion[]>;
  }, [data.editions]);

  const [preset, setPreset] = useState<PresetKey>("recientes");
  const editions = presets[preset];
  const baseline = useMemo(() => computeBaseline(editions, data), [editions, data]);

  const totalAvg = baseline.reduce((a, b) => a + b.avgCLP, 0);
  const mapeado =
    editions.length > 0
      ? 1 - editions.reduce((a, e) => a + e.otrasPct, 0) / editions.length
      : 0;

  const presetLabels: Record<PresetKey, string> = {
    recientes: "Recientes (bien categorizadas)",
    todas: `Todas con finanzas (${data.editions.length})`,
    ultima: "Última (FDS 25)",
  };

  if (data.editions.length === 0) {
    return (
      <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
        <p className="font-display text-lg font-bold text-[#333333]">Sin datos de gasto</p>
        <p className="mt-2 font-sans text-sm text-[#666666]">
          Ninguna edición de FDS tiene un negocio de finanzas con detalle de gasto.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
          Gasto por categoría · baseline de presupuesto
        </h2>
        <p className="font-sans text-sm text-[#666666]">
          Promedio de gasto real por categoría del catálogo oficial (
          <span className="font-medium text-[#333333]">finanzas.unabase_catalogo</span>), para armar
          el presupuesto de FDS 2026.
        </p>
      </header>

      {/* Selector de ediciones del promedio */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs text-[#666666]">Promediar:</span>
        <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5">
          {(Object.keys(presetLabels) as PresetKey[]).map((k) => {
            const active = preset === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setPreset(k)}
                className={`rounded-md px-3 py-1.5 font-sans text-sm transition-colors ${
                  active ? "bg-[#F0EFFE] font-medium text-[#9F99F8]" : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {presetLabels[k]}
              </button>
            );
          })}
        </div>
        <span className="font-sans text-xs text-[#999999]">
          {editions.map((e) => e.nombre).join(" · ")} · {pct(mapeado)} del gasto mapeado al catálogo
        </span>
      </div>

      {/* Chart: mayores gastos promedio */}
      <FdsBarBreakdown
        title="Promedio de gasto por categoría"
        subtitle={`Gasto real promedio por categoría — ${presetLabels[preset]}. Ordenado por mayor gasto.`}
        rows={baseline.map((b) => ({
          label: b.label,
          value: b.avgCLP,
          sub: `${pct(b.pctNorm)} del total · n=${b.n}`,
        }))}
        colorIndex={5}
      />

      {/* Matriz categoría × edición */}
      <article className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left">
                <th className="px-4 py-3 font-medium text-[#666666]">Categoría</th>
                <th className="px-4 py-3 text-right font-medium text-[#333333]">Promedio</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">% del total</th>
                <th className="px-4 py-3 text-right font-medium text-[#666666]">n</th>
                {editions.map((e) => (
                  <th
                    key={e.eventoId}
                    className={`px-4 py-3 text-right font-medium ${
                      e.tier === "C" ? "text-[#999999]" : "text-[#666666]"
                    }`}
                    title={e.tier === "C" ? "Categorización parcial (mucho en Otras)" : undefined}
                  >
                    {e.nombre}
                    {e.tier === "C" && <span className="ml-1 text-[#ED75A0]">*</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {baseline.map((b) => (
                <tr
                  key={b.key}
                  className="border-b border-[#E5E5E5] transition-colors last:border-0 hover:bg-[#FAFAFA]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[#333333]">{b.label}</td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-[#333333]"
                    title={formatCurrency(b.avgCLP)}
                  >
                    {compactCurrency(b.avgCLP)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#666666]">
                    {pct(b.pctNorm)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#999999]">
                    {b.n}
                  </td>
                  {editions.map((e) => {
                    const cell = e.buckets.find((x) => x.key === b.key);
                    const monto = cell?.monto ?? 0;
                    return (
                      <td
                        key={e.eventoId}
                        className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                          e.tier === "C" ? "text-[#999999]" : "text-[#333333]"
                        }`}
                        title={monto > 0 ? formatCurrency(monto) : undefined}
                      >
                        {monto > 0 ? compactCurrency(monto) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-[#E5E5E5] bg-[#FAFAFA]">
                <td className="px-4 py-3 font-medium text-[#333333]">Total gasto</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-[#333333]" title={formatCurrency(totalAvg)}>
                  {compactCurrency(totalAvg)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[#666666]">100%</td>
                <td className="px-4 py-3" />
                {editions.map((e) => (
                  <td
                    key={e.eventoId}
                    className="px-4 py-3 text-right tabular-nums text-[#666666]"
                    title={formatCurrency(e.totalReal)}
                  >
                    {compactCurrency(e.totalReal)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      {/* Caveats */}
      <div className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-4">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-[#666666]" />
          <span className="font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
            Notas del baseline
          </span>
        </div>
        <ul className="flex flex-col gap-1 font-sans text-xs text-[#666666]">
          <li>
            Categorías = estructura oficial de <span className="text-[#333333]">finanzas.unabase_catalogo</span>.
            Promedio equiponderado por edición sobre el gasto real (item_costo_empresa, sin excluidos).
          </li>
          <li>
            El promedio es <span className="text-[#333333]">present-only</span>: una categoría promedia solo
            las ediciones donde tuvo gasto (ver columna <span className="text-[#333333]">n</span>). Con pocas
            ediciones, tratá el número como referencia, no como verdad exacta.
          </li>
          <li>
            El vocabulario de gasto de FDS se mapeó al catálogo por nombre + un crosswalk curado (ediciones
            viejas usaban etiquetas libres). Categorías como Baños/Barras → Operaciones, Escenario/Audio →
            Producción Técnica. Ediciones con <span className="text-[#ED75A0]">*</span> tienen categorización
            parcial (mucho en “Otras”).
          </li>
          {data.sinMapear.length > 0 && (
            <li>
              Sin mapear (van a “Otras”, mayormente el catch-all histórico “OTROS”):{" "}
              {data.sinMapear
                .slice(0, 4)
                .map((s) => `${s.categoria} (${compactCurrency(s.monto)})`)
                .join(" · ")}
              …
            </li>
          )}
          <li>
            El % del total reparte el presupuesto entre categorías; cuánto debe ser el techo total lo define la
            vía de ingreso (per cápita) en <span className="text-[#333333]">/presupuesto</span>.
          </li>
        </ul>
      </div>
    </section>
  );
}
