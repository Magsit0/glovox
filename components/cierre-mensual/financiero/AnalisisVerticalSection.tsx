"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import Panel from "@/components/cierre-mensual/financiero/Panel";
import type { FinBusiness } from "@/components/cierre-mensual/financiero/FinancieroTab";
import { heatmapScale } from "@/lib/chart-colors";
import {
  periodKeyFromMonth,
  periodKeyFromTs,
  periodLabel,
  type PeriodGrain,
} from "@/lib/unabase/dates";
import type { EstructuraMensualRow, ExpenseRow } from "@/lib/unabase/types";

interface EstructuraState {
  rows: EstructuraMensualRow[];
  loading: boolean;
  error: string | null;
}

interface Props {
  finRows: FinBusiness[];
  expenseRows: ExpenseRow[];
  estructura: EstructuraState;
  grain: PeriodGrain;
}

type Cut = "periodo" | "area";

const TOP_CATEGORIAS = 8;
const OTRAS = "Otras categorías";

const ymFromTs = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function AnalisisVerticalSection({
  finRows,
  expenseRows,
  estructura,
  grain,
}: Props) {
  const [cut, setCut] = useState<Cut>("periodo");
  const estructuraOk = !estructura.loading && !estructura.error;
  const showEstructura = cut === "periodo" && estructuraOk;

  const data = useMemo(() => {
    if (!finRows.length) return null;

    // Columna de cada negocio según el corte. Las líneas de gasto heredan la
    // columna de SU negocio (misma imputación de fecha financiera que el resto
    // de la pestaña, resuelta una sola vez a nivel negocio).
    const colOf = new Map<string, string>();
    let minYM = "9999-99";
    let maxYM = "0000-00";
    finRows.forEach(({ b, ts }) => {
      colOf.set(b.key, cut === "periodo" ? periodKeyFromTs(ts, grain) : b.area_negocio);
      const ym = ymFromTs(ts);
      if (ym < minYM) minYM = ym;
      if (ym > maxYM) maxYM = ym;
    });

    const ingresoByCol = new Map<string, number>();
    finRows.forEach(({ b }) => {
      const col = colOf.get(b.key)!;
      ingresoByCol.set(col, (ingresoByCol.get(col) ?? 0) + b.ingreso);
    });

    const gastoByCat = new Map<string, Map<string, number>>();
    const totalByCat = new Map<string, number>();
    let gastoTotal = 0;
    const gastoByCol = new Map<string, number>();
    expenseRows.forEach((r) => {
      const col = colOf.get(r.key);
      if (!col || !r.gasto) return;
      const cat = r.categoriaGasto || "SIN CLASIFICAR";
      const byCol = gastoByCat.get(cat) ?? new Map<string, number>();
      byCol.set(col, (byCol.get(col) ?? 0) + r.gasto);
      gastoByCat.set(cat, byCol);
      totalByCat.set(cat, (totalByCat.get(cat) ?? 0) + r.gasto);
      gastoByCol.set(col, (gastoByCol.get(col) ?? 0) + r.gasto);
      gastoTotal += r.gasto;
    });

    // Columnas: períodos ordenados cronológicamente, o áreas por ingreso desc.
    const cols =
      cut === "periodo"
        ? [...ingresoByCol.keys()].sort((a, b) => a.localeCompare(b))
        : [...ingresoByCol.keys()].sort(
            (a, b) => (ingresoByCol.get(b) ?? 0) - (ingresoByCol.get(a) ?? 0),
          );

    // Top categorías por gasto total; el resto se agrupa en "Otras categorías".
    const ranked = [...totalByCat.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, TOP_CATEGORIAS).map(([cat]) => cat);
    const hasOtras = ranked.length > TOP_CATEGORIAS;
    const catRows = hasOtras ? [...top, OTRAS] : top;

    const catValue = (cat: string, col: string): number => {
      if (cat !== OTRAS) return gastoByCat.get(cat)?.get(col) ?? 0;
      const topSum = top.reduce((s, c) => s + (gastoByCat.get(c)?.get(col) ?? 0), 0);
      return (gastoByCol.get(col) ?? 0) - topSum;
    };
    const catTotal = (cat: string): number => {
      if (cat !== OTRAS) return totalByCat.get(cat) ?? 0;
      return gastoTotal - top.reduce((s, c) => s + (totalByCat.get(c) ?? 0), 0);
    };

    // Estructura por columna (solo corte por período; en el corte por área no
    // es atribuible). Solo se imputa a columnas ya presentes.
    const estructuraByCol = new Map<string, number>();
    let estructuraTotal = 0;
    if (cut === "periodo") {
      estructura.rows.forEach((r) => {
        if (!r.mes || r.mes < minYM || r.mes > maxYM) return;
        const col = periodKeyFromMonth(r.mes, grain);
        if (!ingresoByCol.has(col)) return;
        estructuraByCol.set(col, (estructuraByCol.get(col) ?? 0) + r.gasto);
        estructuraTotal += r.gasto;
      });
    }

    const ingresoTotal = [...ingresoByCol.values()].reduce((s, v) => s + v, 0);

    return {
      cols,
      catRows,
      catValue,
      catTotal,
      ingresoByCol,
      gastoByCol,
      estructuraByCol,
      ingresoTotal,
      gastoTotal,
      estructuraTotal,
    };
  }, [finRows, expenseRows, estructura.rows, grain, cut]);

  const toggle = (
    <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5">
      {(
        [
          { key: "periodo", label: "Por período" },
          { key: "area", label: "Por área" },
        ] as const
      ).map((m) => {
        const active = cut === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => setCut(m.key)}
            aria-pressed={active}
            className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
              active ? "bg-[#F0EFFE] text-[#9F99F8]" : "text-[#666666] hover:text-[#333333]"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );

  if (!data) {
    return (
      <Panel title="Análisis vertical" right={toggle}>
        <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
          <Inbox className="h-6 w-6" />
          Sin negocios en el alcance filtrado
        </div>
      </Panel>
    );
  }

  const {
    cols,
    catRows,
    catValue,
    catTotal,
    ingresoByCol,
    gastoByCol,
    estructuraByCol,
    ingresoTotal,
    gastoTotal,
    estructuraTotal,
  } = data;

  const pct = (value: number, ingreso: number): number | null =>
    ingreso > 0 ? value / ingreso : null;

  // Escala del heatmap normalizada al mayor % de categoría de la tabla.
  let maxCatPct = 0;
  catRows.forEach((cat) => {
    cols.forEach((col) => {
      const p = pct(catValue(cat, col), ingresoByCol.get(col) ?? 0);
      if (p !== null && p > maxCatPct) maxCatPct = p;
    });
  });

  const heatBg = (p: number | null): string | undefined => {
    if (p === null || p <= 0 || maxCatPct <= 0) return undefined;
    return heatmapScale(Math.min(1, p / maxCatPct)).hex();
  };

  const fmt = (p: number | null): string => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);

  return (
    <Panel
      title="Análisis vertical (% del ingreso)"
      subtitle="Formato common-size: cada línea como porcentaje del ingreso de su columna"
      right={toggle}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="sticky left-0 z-10 bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                Línea
              </th>
              {cols.map((c) => (
                <th
                  key={c}
                  className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]"
                >
                  {cut === "periodo" ? periodLabel(c, grain) : c}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#333333]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#E5E5E5]">
              <td className="sticky left-0 z-10 bg-white px-4 py-3 font-sans text-sm font-medium text-[#333333]">
                Ingresos
              </td>
              {cols.map((c) => (
                <td
                  key={c}
                  className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]"
                >
                  {(ingresoByCol.get(c) ?? 0) > 0 ? "100%" : "—"}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                {ingresoTotal > 0 ? "100%" : "—"}
              </td>
            </tr>

            {catRows.map((cat) => (
              <tr key={cat} className="border-b border-[#E5E5E5]">
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-sans text-sm text-[#333333]">
                  {cat}
                </td>
                {cols.map((c) => {
                  const p = pct(catValue(cat, c), ingresoByCol.get(c) ?? 0);
                  return (
                    <td
                      key={c}
                      className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]"
                      style={{ background: heatBg(p) }}
                    >
                      {fmt(p)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                  {fmt(pct(catTotal(cat), ingresoTotal))}
                </td>
              </tr>
            ))}

            <SummaryPctRow
              label="Gasto directo total"
              cols={cols}
              get={(c) => pct(gastoByCol.get(c) ?? 0, ingresoByCol.get(c) ?? 0)}
              total={pct(gastoTotal, ingresoTotal)}
            />
            <SummaryPctRow
              label="Margen de contribución"
              cols={cols}
              get={(c) => {
                const ing = ingresoByCol.get(c) ?? 0;
                return pct(ing - (gastoByCol.get(c) ?? 0), ing);
              }}
              total={pct(ingresoTotal - gastoTotal, ingresoTotal)}
              signColor
            />
            {showEstructura && (
              <>
                <SummaryPctRow
                  label="Gasto de estructura GLOVOX"
                  cols={cols}
                  get={(c) => pct(estructuraByCol.get(c) ?? 0, ingresoByCol.get(c) ?? 0)}
                  total={pct(estructuraTotal, ingresoTotal)}
                />
                <SummaryPctRow
                  label="Resultado operacional"
                  cols={cols}
                  get={(c) => {
                    const ing = ingresoByCol.get(c) ?? 0;
                    return pct(
                      ing - (gastoByCol.get(c) ?? 0) - (estructuraByCol.get(c) ?? 0),
                      ing,
                    );
                  }}
                  total={pct(ingresoTotal - gastoTotal - estructuraTotal, ingresoTotal)}
                  signColor
                />
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="font-sans text-xs text-[#999999]">
        {cut === "area"
          ? "En el corte por área la estructura no se asigna: no es atribuible a un área de negocio. Las áreas juegan el rol de \"comparables\" del análisis vertical."
          : "Columnas sin ingreso muestran — (no hay base para el porcentaje). La intensidad de color compara el peso de cada categoría dentro de la tabla."}
      </p>
    </Panel>
  );
}

function SummaryPctRow({
  label,
  cols,
  get,
  total,
  signColor = false,
}: {
  label: string;
  cols: string[];
  get: (c: string) => number | null;
  total: number | null;
  signColor?: boolean;
}) {
  const fmt = (p: number | null): string => (p === null ? "—" : `${(p * 100).toFixed(1)}%`);
  const cls = (p: number | null) =>
    `px-4 py-3 text-right font-sans text-sm font-medium tabular-nums ${
      signColor && p !== null && p < 0 ? "text-[#ED75A0]" : "text-[#333333]"
    }`;
  return (
    <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
      <td className="sticky left-0 z-10 bg-[#FAFAFA] px-4 py-3 font-sans text-sm font-medium text-[#333333]">
        {label}
      </td>
      {cols.map((c) => {
        const p = get(c);
        return (
          <td key={c} className={cls(p)}>
            {fmt(p)}
          </td>
        );
      })}
      <td className={cls(total)}>{fmt(total)}</td>
    </tr>
  );
}
