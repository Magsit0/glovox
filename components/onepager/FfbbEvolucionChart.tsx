"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OnepagerFfbbEvolucionRow } from "@/lib/queries/onepager";
import {
  axisTick,
  gridProps,
  legendProps,
  seriesColor,
  seriesFillSoft,
  SURFACE,
} from "@/lib/chart-colors";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import MultiFilter from "./MultiFilter";

type Props = {
  data: OnepagerFfbbEvolucionRow[];
};

// Series colors in index order: venta (Area) = 0, qtty (Line) = 1.
const VENTA_COLOR = seriesColor(0);
const QTTY_COLOR = seriesColor(1);

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function fmtClpShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000)     return "$" + Math.round(value / 1_000) + "K";
  return "$" + Math.round(value);
}

function fmtQty(value: number) {
  return Math.round(value).toLocaleString("es-CL");
}

// Slots are 30-minute buckets labeled by their start (see getOnepagerFfbbEvolucion).
// Render the explicit window so the user sees what range is being aggregated.
function slotRange(slotLabel: string): string {
  const [hStr, mStr] = slotLabel.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return slotLabel;
  const total = (h * 60 + m + 30) % (24 * 60);
  const eh = Math.floor(total / 60);
  const em = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${slotLabel} – ${pad(eh)}:${pad(em)}`;
}

type SerieRow = { slotLabel: string; slotIso: string; venta: number; qtty: number };

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "es-CL"));
}

function inSet(set: Set<string>, value: string): boolean {
  return set.size === 0 || set.has(value);
}

export default function FfbbEvolucionChart({ data }: Props) {
  const [categorias, setCategorias]   = useState<Set<string>>(new Set());
  const [productos, setProductos]     = useState<Set<string>>(new Set());
  const [puntosVenta, setPuntosVenta] = useState<Set<string>>(new Set());

  const categoriasOpts = useMemo(() => uniqueSorted(data.map((r) => r.categoria)), [data]);

  const productosOpts = useMemo(() => {
    const filtered = data.filter((r) => inSet(categorias, r.categoria));
    return uniqueSorted(filtered.map((r) => r.producto));
  }, [data, categorias]);

  const puntosVentaOpts = useMemo(() => uniqueSorted(data.map((r) => r.puntoVenta)), [data]);

  // Derive the effective productos selection: drop any pick that's no longer in the
  // current productosOpts (e.g. after a categoría is deselected). The raw `productos`
  // state is preserved so re-enabling a categoría restores those picks.
  const effectiveProductos = useMemo(() => {
    if (productos.size === 0) return productos;
    const valid = new Set(productosOpts);
    const next = new Set<string>();
    for (const p of productos) if (valid.has(p)) next.add(p);
    return next;
  }, [productos, productosOpts]);

  const serie = useMemo<SerieRow[]>(() => {
    const filtered = data.filter(
      (r) =>
        inSet(categorias,           r.categoria) &&
        inSet(effectiveProductos,   r.producto) &&
        inSet(puntosVenta,          r.puntoVenta),
    );
    const byIso = new Map<string, SerieRow>();
    for (const r of filtered) {
      const existing = byIso.get(r.slotIso);
      if (existing) {
        existing.venta += r.venta;
        existing.qtty += r.qtty;
      } else {
        byIso.set(r.slotIso, {
          slotIso: r.slotIso,
          slotLabel: r.slotLabel,
          venta: r.venta,
          qtty: r.qtty,
        });
      }
    }
    return Array.from(byIso.values()).sort((a, b) => a.slotIso.localeCompare(b.slotIso));
  }, [data, categorias, effectiveProductos, puntosVenta]);

  function clearAll() {
    setCategorias(new Set());
    setProductos(new Set());
    setPuntosVenta(new Set());
  }

  const hasActiveFilter =
    categorias.size > 0 || effectiveProductos.size > 0 || puntosVenta.size > 0;

  if (data.length === 0) {
    return <p className="font-sans text-sm text-[#999999]">Sin datos.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <MultiFilter
          label="Categoría"
          selected={categorias}
          onChange={setCategorias}
          options={categoriasOpts}
        />
        <MultiFilter
          label="Producto"
          selected={effectiveProductos}
          onChange={setProductos}
          options={productosOpts}
        />
        <MultiFilter
          label="Punto de venta"
          selected={puntosVenta}
          onChange={setPuntosVenta}
          options={puntosVentaOpts}
        />
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg px-3 py-2 font-sans font-medium text-sm text-[#666666] hover:text-[#333333] hover:bg-[#F5F5F5] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Chart */}
      {serie.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          Sin datos para la combinación de filtros seleccionada.
        </p>
      ) : (
        <div className="border border-[#E5E5E5] bg-white rounded-lg p-3">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={serie}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="slotLabel"
                axisLine={{ stroke: SURFACE.divider }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
                tick={axisTick}
              />
              <YAxis
                yAxisId="venta"
                orientation="left"
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtClpShort}
                tick={axisTick}
                width={56}
              />
              <YAxis
                yAxisId="qtty"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtQty(v)}
                tick={axisTick}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: SURFACE.divider, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  const labelStr = typeof label === "string" ? label : String(label ?? "");
                  const rangeLabel = labelStr ? slotRange(labelStr) : labelStr;
                  return (
                    <ChartTooltip
                      active={active}
                      label={rangeLabel}
                      items={(payload ?? []).map((p) => {
                        const key = String(p.dataKey ?? "");
                        const num = Number(p.value);
                        return {
                          name: key === "venta" ? "Venta" : "Cantidad",
                          color: key === "venta" ? VENTA_COLOR : QTTY_COLOR,
                          formatted:
                            key === "venta"
                              ? Number.isFinite(num) ? fmtClp(num) : String(p.value)
                              : Number.isFinite(num) ? fmtQty(num) : String(p.value),
                        };
                      })}
                    />
                  );
                }}
              />
              <Legend {...legendProps} verticalAlign="top" height={28} />
              <Area
                yAxisId="venta"
                type="linear"
                dataKey="venta"
                name="Venta CLP"
                fill={seriesFillSoft(VENTA_COLOR, 0.15)}
                stroke={VENTA_COLOR}
                strokeWidth={2}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="qtty"
                type="linear"
                dataKey="qtty"
                name="Cantidad"
                stroke={QTTY_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
