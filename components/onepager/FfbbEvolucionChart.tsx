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
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import {
  disponibles,
  enConflicto,
  filtrar,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { normalizarSeleccion } from "@/lib/filters/url";

type Props = {
  data: OnepagerFfbbEvolucionRow[];
};

type FacetaKey = "categoria" | "producto" | "puntoVenta";

// Facetas encadenadas (lib/filters/facetas.ts): cada filtro acota las opciones
// de los otros. Categoría es padre de Producto: elegir un producto no le
// esconde categorías (`ignora`). Ningún filtro modifica a otro: cada uno
// escribe solo su propia selección.
const FACETAS: Faceta<OnepagerFfbbEvolucionRow>[] = [
  { key: "categoria", valores: (r) => r.categoria, ignora: ["producto"] },
  { key: "producto", valores: (r) => r.producto },
  { key: "puntoVenta", valores: (r) => r.puntoVenta },
];

const FACETA_LABEL: Record<FacetaKey, string> = {
  categoria: "Categoría",
  producto: "Producto",
  puntoVenta: "Punto de venta",
};

const FACETA_KEYS: readonly FacetaKey[] = ["categoria", "producto", "puntoVenta"];

type Selecciones = Record<FacetaKey, Set<string>>;

function seleccionVacia(): Selecciones {
  return { categoria: new Set(), producto: new Set(), puntoVenta: new Set() };
}

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
  return Array.from(new Set(values))
    .filter((v) => v.length > 0)
    .sort((a, b) => a.localeCompare(b, "es-CL"));
}

export default function FfbbEvolucionChart({ data }: Props) {
  // Selección cruda de cada filtro (vacía = "Todos").
  const [sel, setSel] = useState<Selecciones>(seleccionVacia);

  // Universo de cada faceta en los datos del evento.
  const universo = useMemo<Record<FacetaKey, string[]>>(
    () => ({
      categoria: uniqueSorted(data.map((r) => r.categoria)),
      producto: uniqueSorted(data.map((r) => r.producto)),
      puntoVenta: uniqueSorted(data.map((r) => r.puntoVenta)),
    }),
    [data],
  );

  // Opciones de cada dropdown: lo compatible con los otros filtros + lo ya
  // elegido. Lo elegido que quedó incompatible sigue a la vista, atenuado
  // (`available`), para poder desmarcarlo.
  const disp = useMemo(() => disponibles(data, FACETAS, sel), [data, sel]);
  const items = useMemo(() => {
    const out = {} as Record<FacetaKey, { value: string; label: string }[]>;
    for (const key of FACETA_KEYS) {
      out[key] = opcionesVisibles(universo[key], disp[key], sel[key]).map((v) => ({
        value: v,
        label: v,
      }));
    }
    return out;
  }, [universo, disp, sel]);

  // Filtros que chocan entre sí cuando la combinación no deja ningún dato.
  const conflictos = useMemo(
    () =>
      enConflicto(data, FACETAS, sel).map((key) => ({
        key,
        label: FACETA_LABEL[key as FacetaKey] ?? key,
      })),
    [data, sel],
  );

  const serie = useMemo<SerieRow[]>(() => {
    const filtered = filtrar(data, FACETAS, sel);
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
  }, [data, sel]);

  // Cada filtro escribe solo su propia key; las demás quedan como estaban.
  // Marcar todo su universo se guarda como "Todos" (normalizarSeleccion).
  function cambiarFaceta(key: FacetaKey, next: Set<string>) {
    const lista = normalizarSeleccion(next, universo[key]);
    setSel((prev) => ({ ...prev, [key]: new Set(lista) }));
  }

  function limpiarFaceta(key: string) {
    if ((FACETA_KEYS as readonly string[]).includes(key)) {
      cambiarFaceta(key as FacetaKey, new Set());
    }
  }

  // Único control que toca varios filtros: vuelve al estado por defecto.
  function clearAll() {
    setSel(seleccionVacia());
  }

  const hasActiveFilter = FACETA_KEYS.some((key) => sel[key].size > 0);

  if (data.length === 0) {
    return <p className="font-sans text-sm text-[#999999]">Sin datos.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {FACETA_KEYS.map((key) => (
          <StandardMultiFilter
            key={key}
            label={FACETA_LABEL[key]}
            selected={sel[key]}
            onChange={(next) => cambiarFaceta(key, next)}
            options={items[key]}
            available={disp[key]}
          />
        ))}
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
        conflictos.length > 0 ? (
          <FilterConflictNotice conflicts={conflictos} onClear={limpiarFaceta} />
        ) : (
          <p className="font-sans text-sm text-[#999999]">
            Sin datos para la combinación de filtros seleccionada.
          </p>
        )
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
