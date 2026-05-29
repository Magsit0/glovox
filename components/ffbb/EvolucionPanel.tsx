"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisTick, gridProps, seriesColor } from "@/lib/chart-colors";
import { compactCurrency, formatCurrency } from "@/lib/unabase/formatting";
import type { EvolucionRow } from "@/lib/ffbb/types";

export type EvolucionMode = "producto" | "insumo";
export type EvolucionMetric = "ventas" | "unidades";

interface Props {
  productos: string[];
  insumos: string[];
  mode: EvolucionMode;
  selected: string | null;
  metric: EvolucionMetric;
  data: EvolucionRow[];
}

const fmtCantidad = (v: number): string =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(v);

function shortFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function EvolucionPanel({
  productos,
  insumos,
  mode,
  selected,
  metric,
  data,
}: Props) {
  const router = useRouter();

  function pushUrl(next: { mode?: EvolucionMode; item?: string | null; metric?: EvolucionMetric }) {
    const m = next.mode ?? mode;
    const item = next.item === undefined ? selected : next.item;
    const met = next.metric ?? metric;
    const params = new URLSearchParams();
    if (m === "producto") {
      if (item) params.set("producto", item);
      if (met !== "ventas") params.set("metric", met);
    } else {
      if (item) params.set("insumo", item);
    }
    const qs = params.toString();
    router.push(qs ? `/ffbb/evolucion?${qs}` : "/ffbb/evolucion");
  }

  const options = mode === "producto" ? productos : insumos;

  const chartData = useMemo(
    () =>
      data.map((r) => ({
        ...r,
        fechaCorta: shortFecha(r.fechaEvento),
        label: r.fechaEvento ? `${shortFecha(r.fechaEvento)} · ${r.eventoId}` : r.eventoId,
      })),
    [data],
  );

  const isCurrency = mode === "producto" && metric === "ventas";
  const yTickFormatter = (v: number) =>
    isCurrency ? compactCurrency(v) : fmtCantidad(v);
  const valueLabel =
    mode === "producto"
      ? metric === "ventas"
        ? "Ventas"
        : "Unidades"
      : "Consumo";

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Evolución a través de eventos
        </h2>
        <p className="font-sans text-sm text-[#666666]">
          Compará un producto o insumo a través del tiempo. Los eventos se ordenan por fecha.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">Vista</span>
          <div className="inline-flex rounded-lg border border-[#E5E5E5] p-0.5">
            {(["producto", "insumo"] as EvolucionMode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pushUrl({ mode: m, item: null })}
                  className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                    active ? "bg-[#9F99F8] text-white" : "text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {m === "producto" ? "Producto" : "Insumo"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="font-sans text-xs text-[#666666]">
            {mode === "producto" ? "Producto" : "Insumo"}
          </span>
          <select
            value={selected ?? ""}
            onChange={(e) => pushUrl({ item: e.target.value || null })}
            className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          >
            <option value="">— Elegir {mode === "producto" ? "producto" : "insumo"} —</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {mode === "producto" && (
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-[#666666]">Métrica</span>
            <div className="inline-flex rounded-lg border border-[#E5E5E5] p-0.5">
              {(["ventas", "unidades"] as EvolucionMetric[]).map((m) => {
                const active = metric === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pushUrl({ metric: m })}
                    className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                      active ? "bg-[#9F99F8] text-white" : "text-[#666666] hover:text-[#333333]"
                    }`}
                  >
                    {m === "ventas" ? "Ventas" : "Unidades"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!selected ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="font-sans text-sm text-[#999999]">
            Elegí un {mode === "producto" ? "producto" : "insumo"} para ver su evolución.
          </p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="font-sans text-sm text-[#999999]">
            Sin datos para <span className="font-medium text-[#666666]">{selected}</span>.
          </p>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 0, left: 8 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="fechaCorta"
                tickLine={false}
                axisLine={{ stroke: "#E5E5E5" }}
                tick={axisTick}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisTick}
                tickFormatter={(v) => yTickFormatter(v as number)}
              />
              <Tooltip
                cursor={{ stroke: "#E5E5E5" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as EvolucionRow & { fechaCorta: string };
                  return (
                    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
                      <p className="text-xs text-[#666666]">{p.fechaCorta} · {p.eventoId}</p>
                      <p className="font-medium">{p.nombre}</p>
                      <p className="mt-1 text-xs text-[#666666]">
                        {valueLabel}:{" "}
                        <span className="text-[#333333]">
                          {isCurrency ? formatCurrency(p.valor) : fmtCantidad(p.valor)}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke={seriesColor(0)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selected && chartData.length > 0 && (
        <p className="font-sans text-xs text-[#999999]">
          {chartData.length} evento{chartData.length === 1 ? "" : "s"} en la serie ·{" "}
          Total {valueLabel.toLowerCase()}:{" "}
          <span className="text-[#666666]">
            {isCurrency
              ? formatCurrency(chartData.reduce((acc, r) => acc + r.valor, 0))
              : fmtCantidad(chartData.reduce((acc, r) => acc + r.valor, 0))}
          </span>
        </p>
      )}
    </article>
  );
}
