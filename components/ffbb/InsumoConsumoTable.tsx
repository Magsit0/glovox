"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import type { InsumoConsumoRow } from "@/lib/ffbb/types";

interface Props {
  rows: InsumoConsumoRow[];
}

const fmtCantidad = (v: number): string =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(v);

interface TooltipPayload {
  value: number;
  payload: { insumo: string; total: number };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <p className="font-medium">{p.insumo}</p>
      <p className="mt-1 text-xs text-[#666666]">{fmtCantidad(p.total)} consumido</p>
    </div>
  );
}

export default function InsumoConsumoTable({ rows }: Props) {
  const barras = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.nombreBarra);
    return Array.from(set).sort();
  }, [rows]);

  const [barraFilter, setBarraFilter] = useState<string>("__all__");

  const filteredRows = useMemo(
    () => (barraFilter === "__all__" ? rows : rows.filter((r) => r.nombreBarra === barraFilter)),
    [rows, barraFilter],
  );

  const totalsByInsumo = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows) {
      map.set(r.insumo, (map.get(r.insumo) ?? 0) + r.cantidadConsumida);
    }
    return Array.from(map.entries())
      .map(([insumo, total]) => ({ insumo, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRows]);

  if (rows.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Insumos consumidos
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">
          No hay datos cruzados con recetas. Verifica que los productos vendidos tengan fórmula en
          <code className="ml-1 rounded bg-[#F5F5F5] px-1 py-0.5 text-xs">onfire.formulaTragoBQ</code>.
        </p>
      </article>
    );
  }

  const chartData = totalsByInsumo.slice(0, 20).reverse().map((r) => ({
    ...r,
    label: r.insumo.length > 28 ? `${r.insumo.slice(0, 27)}…` : r.insumo,
  }));
  const chartHeight = Math.max(280, chartData.length * 28 + 40);

  return (
    <div className="flex flex-col gap-6">
      <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Insumos consumidos
            </h2>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              Suma de <code className="rounded bg-[#F5F5F5] px-1 py-0.5 text-xs">unidades vendidas × cantidad de fórmula</code>
              {barraFilter !== "__all__" && (
                <>
                  {" "}para{" "}
                  <span className="font-medium text-[#333333]">{barraFilter}</span>
                </>
              )}
              . Top 20 por volumen.
            </p>
          </div>

          {barras.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-sans text-sm text-[#666666]">Barra</span>
              <button
                type="button"
                onClick={() => setBarraFilter("__all__")}
                className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                  barraFilter === "__all__"
                    ? "bg-[#9F99F8] text-white"
                    : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
                }`}
              >
                Todas
              </button>
              {barras.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBarraFilter(b)}
                  className={`rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                    barraFilter === b
                      ? "bg-[#9F99F8] text-white"
                      : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </header>

        <div style={{ height: chartHeight }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
            >
              <CartesianGrid {...gridProps} horizontal={false} vertical={true} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => fmtCantidad(v as number)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                tick={axisTick}
                width={180}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F0F0F0" }} />
              <Bar
                dataKey="total"
                fill={seriesColor(1)}
                radius={[0, 4, 4, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Detalle insumo × barra
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Filas ordenadas por cantidad consumida.
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                  Insumo
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                  Barra
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                  Cantidad consumida
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[#666666]">
                    Sin datos para los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, i) => (
                  <tr
                    key={`${row.insumo}::${row.nombreBarra}::${i}`}
                    className="border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 text-[#333333]">{row.insumo}</td>
                    <td className="px-4 py-3 text-[#666666]">{row.nombreBarra}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                      {fmtCantidad(row.cantidadConsumida)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
