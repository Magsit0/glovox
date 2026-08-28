"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox } from "lucide-react";
import Panel from "@/components/cierre-mensual/financiero/Panel";
import type { FinBusiness } from "@/components/cierre-mensual/financiero/FinancieroTab";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import { axisTick, BRAND, gridProps, SURFACE } from "@/lib/chart-colors";
import {
  periodKeyFromMonth,
  periodKeyFromTs,
  periodLabel,
  type PeriodGrain,
} from "@/lib/unabase/dates";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { EstructuraMensualRow } from "@/lib/unabase/types";

interface EstructuraState {
  rows: EstructuraMensualRow[];
  loading: boolean;
  error: string | null;
}

interface Props {
  finRows: FinBusiness[];
  estructura: EstructuraState;
  grain: PeriodGrain;
}

interface PeriodValues {
  ingreso: number;
  gastoDirecto: number;
  estructura: number;
}

const ymFromTs = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function EstadoResultadosSection({ finRows, estructura, grain }: Props) {
  const estructuraOk = !estructura.loading && !estructura.error;

  const data = useMemo(() => {
    if (!finRows.length) return null;

    const byPeriod = new Map<string, PeriodValues>();
    let minYM = "9999-99";
    let maxYM = "0000-00";

    finRows.forEach(({ b, ts }) => {
      const key = periodKeyFromTs(ts, grain);
      const curr = byPeriod.get(key) ?? { ingreso: 0, gastoDirecto: 0, estructura: 0 };
      curr.ingreso += b.ingreso;
      curr.gastoDirecto += b.gasto;
      byPeriod.set(key, curr);
      const ym = ymFromTs(ts);
      if (ym < minYM) minYM = ym;
      if (ym > maxYM) maxYM = ym;
    });

    // La estructura se acota al rango de meses visibles: la nómina/oficina de
    // un mes cuenta aunque ese mes no tenga eventos (el overhead corre igual),
    // pero no se arrastran meses fuera del timeline mostrado.
    estructura.rows.forEach((r) => {
      if (!r.mes || r.mes < minYM || r.mes > maxYM) return;
      const key = periodKeyFromMonth(r.mes, grain);
      const curr = byPeriod.get(key) ?? { ingreso: 0, gastoDirecto: 0, estructura: 0 };
      curr.estructura += r.gasto;
      byPeriod.set(key, curr);
    });

    const keys = [...byPeriod.keys()].sort((a, b) => a.localeCompare(b));
    const totals = { ingreso: 0, gastoDirecto: 0, estructura: 0 };
    keys.forEach((k) => {
      const v = byPeriod.get(k)!;
      totals.ingreso += v.ingreso;
      totals.gastoDirecto += v.gastoDirecto;
      totals.estructura += v.estructura;
    });

    return { byPeriod, keys, totals };
  }, [finRows, estructura.rows, grain]);

  if (!data) {
    return (
      <Panel title="Estado de resultados">
        <EmptyState />
      </Panel>
    );
  }

  const { byPeriod, keys, totals } = data;
  const margen = totals.ingreso - totals.gastoDirecto;
  const margenPct = totals.ingreso ? margen / totals.ingreso : 0;
  const resultado = margen - totals.estructura;
  const resultadoPct = totals.ingreso ? resultado / totals.ingreso : 0;

  // Segmentos de la cascada: barra invisible `base` + barra visible `val`
  // (waterfall clásico con barras apiladas). `display` guarda el valor con
  // signo para el tooltip.
  const waterfall = [
    seg("Ingresos", 0, totals.ingreso, totals.ingreso, BRAND.green),
    seg("Gasto directo", totals.ingreso, margen, -totals.gastoDirecto, BRAND.pink),
    seg("Margen de contribución", 0, margen, margen, BRAND.purple),
    ...(estructuraOk
      ? [
          seg("Gasto de estructura", margen, resultado, -totals.estructura, BRAND.orange),
          seg("Resultado operacional", 0, resultado, resultado, resultado >= 0 ? BRAND.green : BRAND.pink),
        ]
      : []),
  ];

  const kpis = [
    {
      label: "Ingresos",
      value: compactCurrency(totals.ingreso),
      sub: "Venta de los negocios visibles",
      dot: null as string | null,
    },
    {
      label: "Margen de contribución",
      value: compactCurrency(margen),
      sub: totals.ingreso ? `${(margenPct * 100).toFixed(1)}% del ingreso` : "—",
      dot: margen >= 0 ? "#B1D750" : "#ED75A0",
    },
    {
      label: "Gasto de estructura",
      value: estructuraOk ? compactCurrency(totals.estructura) : estructura.loading ? "…" : "—",
      sub: "Total GLOVOX del período (no se filtra)",
      dot: null,
    },
    {
      label: "Resultado operacional",
      value: estructuraOk ? compactCurrency(resultado) : estructura.loading ? "…" : "—",
      sub: estructuraOk && totals.ingreso ? `${(resultadoPct * 100).toFixed(1)}% del ingreso` : "—",
      dot: estructuraOk ? (resultado >= 0 ? "#B1D750" : "#ED75A0") : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <article
            key={k.label}
            className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <div className="font-sans text-xs text-[#666666]">{k.label}</div>
            <div className="mt-2 truncate font-display text-4xl font-extrabold leading-none tracking-tight text-[#333333]">
              {k.value}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {k.dot && (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: k.dot }}
                />
              )}
              <span className="truncate font-sans text-xs text-[#666666]">{k.sub}</span>
            </div>
          </article>
        ))}
      </section>

      <Panel
        title="Estado de resultados"
        subtitle="Ingresos → gasto directo de eventos → margen de contribución → estructura → resultado operacional"
      >
        {estructura.error && (
          <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-4">
            <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
            <p className="flex-1 font-sans text-sm text-[#333333]">
              No se pudo cargar el gasto de estructura: {estructura.error}. Se
              muestra el estado de resultados hasta el margen de contribución.
            </p>
          </div>
        )}
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={waterfall}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            barCategoryGap="25%"
          >
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={{ stroke: SURFACE.divider }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactCurrency(v)}
            />
            <Tooltip
              cursor={{ fill: SURFACE.canvas }}
              content={({ active, label, payload }) => {
                const row = payload?.find((p) => p.dataKey === "val");
                const datum = row?.payload as (typeof waterfall)[number] | undefined;
                return (
                  <ChartTooltip
                    active={active}
                    label={label}
                    items={
                      datum
                        ? [
                            {
                              name: "Monto",
                              color: datum.color,
                              formatted: formatCurrency(datum.display),
                            },
                          ]
                        : []
                    }
                  />
                );
              }}
            />
            <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar
              dataKey="val"
              stackId="wf"
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            >
              {waterfall.map((w) => (
                <Cell key={w.name} fill={w.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="font-sans text-xs text-[#999999]">
          El gasto de estructura es el total del gasto interno GLOVOX (sueldos,
          oficina y administración, en neto) de los meses visibles; no responde
          a los filtros de área, categoría ni evento.
        </p>
      </Panel>

      <Panel
        title="Estado de resultados por período"
        subtitle="Cada negocio imputado al período de su fecha de realización"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="sticky left-0 z-10 bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                  Línea
                </th>
                {keys.map((k) => (
                  <th
                    key={k}
                    className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]"
                  >
                    {periodLabel(k, grain)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#333333]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <MoneyRow
                label="Ingresos"
                keys={keys}
                get={(k) => byPeriod.get(k)!.ingreso}
                total={totals.ingreso}
              />
              <MoneyRow
                label="Gasto directo de eventos"
                keys={keys}
                get={(k) => -byPeriod.get(k)!.gastoDirecto}
                total={-totals.gastoDirecto}
              />
              <MoneyRow
                label="Margen de contribución"
                keys={keys}
                get={(k) => {
                  const v = byPeriod.get(k)!;
                  return v.ingreso - v.gastoDirecto;
                }}
                total={margen}
                bold
                signColor
              />
              <PercentRow
                label="% margen de contribución"
                keys={keys}
                get={(k) => {
                  const v = byPeriod.get(k)!;
                  return v.ingreso ? (v.ingreso - v.gastoDirecto) / v.ingreso : null;
                }}
                total={totals.ingreso ? margenPct : null}
              />
              {estructuraOk && (
                <>
                  <MoneyRow
                    label="Gasto de estructura GLOVOX"
                    keys={keys}
                    get={(k) => -byPeriod.get(k)!.estructura}
                    total={-totals.estructura}
                  />
                  <MoneyRow
                    label="Resultado operacional"
                    keys={keys}
                    get={(k) => {
                      const v = byPeriod.get(k)!;
                      return v.ingreso - v.gastoDirecto - v.estructura;
                    }}
                    total={resultado}
                    bold
                    signColor
                  />
                  <PercentRow
                    label="% resultado operacional"
                    keys={keys}
                    get={(k) => {
                      const v = byPeriod.get(k)!;
                      return v.ingreso
                        ? (v.ingreso - v.gastoDirecto - v.estructura) / v.ingreso
                        : null;
                    }}
                    total={totals.ingreso ? resultadoPct : null}
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
        <p className="font-sans text-xs text-[#999999]">
          Un período puede mostrar estructura sin ingresos (meses sin eventos
          dentro del rango visible): el overhead corre igual.
        </p>
      </Panel>
    </div>
  );
}

function seg(name: string, start: number, end: number, display: number, color: string) {
  return {
    name,
    base: Math.min(start, end),
    val: Math.abs(end - start),
    display,
    color,
  };
}

function MoneyRow({
  label,
  keys,
  get,
  total,
  bold = false,
  signColor = false,
}: {
  label: string;
  keys: string[];
  get: (k: string) => number;
  total: number;
  bold?: boolean;
  signColor?: boolean;
}) {
  const cellClass = (v: number) =>
    `px-4 py-3 text-right font-sans text-sm tabular-nums ${
      signColor && v < 0 ? "text-[#ED75A0]" : "text-[#333333]"
    } ${bold ? "font-medium" : ""}`;
  return (
    <tr className="border-b border-[#E5E5E5] transition-colors hover:bg-[#FAFAFA]">
      <td
        className={`sticky left-0 z-10 bg-white px-4 py-3 text-left font-sans text-sm text-[#333333] ${
          bold ? "font-medium" : ""
        }`}
      >
        {label}
      </td>
      {keys.map((k) => {
        const v = get(k);
        return (
          <td key={k} className={cellClass(v)}>
            {formatCurrency(v)}
          </td>
        );
      })}
      <td className={cellClass(total)}>{formatCurrency(total)}</td>
    </tr>
  );
}

function PercentRow({
  label,
  keys,
  get,
  total,
}: {
  label: string;
  keys: string[];
  get: (k: string) => number | null;
  total: number | null;
}) {
  const fmt = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
  const cls = (v: number | null) =>
    `px-4 py-3 text-right font-sans text-xs tabular-nums ${
      v !== null && v < 0 ? "text-[#ED75A0]" : "text-[#666666]"
    }`;
  return (
    <tr className="border-b border-[#E5E5E5] transition-colors hover:bg-[#FAFAFA]">
      <td className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-sans text-xs text-[#666666]">
        {label}
      </td>
      {keys.map((k) => {
        const v = get(k);
        return (
          <td key={k} className={cls(v)}>
            {fmt(v)}
          </td>
        );
      })}
      <td className={cls(total)}>{fmt(total)}</td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
      <Inbox className="h-6 w-6" />
      Sin negocios en el alcance filtrado
    </div>
  );
}
