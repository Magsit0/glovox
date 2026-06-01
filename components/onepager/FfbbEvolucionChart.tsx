"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Props = {
  data: OnepagerFfbbEvolucionRow[];
};

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

type TooltipPayloadEntry = {
  dataKey?: string | number;
  value?: number | string;
  payload?: SerieRow;
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const venta = payload.find((p) => p.dataKey === "venta")?.value;
  const qtty  = payload.find((p) => p.dataKey === "qtty")?.value;
  const labelStr = typeof label === "string" ? label : String(label ?? "");
  const rangeLabel = labelStr ? slotRange(labelStr) : labelStr;
  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none px-3 py-2 font-mono-data text-xs">
      <div className="font-bold uppercase mb-1">{rangeLabel}</div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 border border-black" style={{ background: "#FFFF00" }} />
        <span className="uppercase">Venta</span>
        <span className="ml-auto font-bold whitespace-nowrap">
          {typeof venta === "number" ? fmtClp(venta) : "—"}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="inline-block w-3 h-3 border border-black bg-black" />
        <span className="uppercase">Cantidad</span>
        <span className="ml-auto font-bold whitespace-nowrap">
          {typeof qtty === "number" ? fmtQty(qtty) : "—"}
        </span>
      </div>
    </div>
  );
}

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
    return <p className="font-mono-data text-sm text-black/50">Sin datos.</p>;
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
            className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-white text-black hover:bg-[#FFFF00] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Chart */}
      {serie.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">
          Sin datos para la combinación de filtros seleccionada.
        </p>
      ) : (
        <div className="border-4 border-black bg-white p-3">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart
              data={serie}
              margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                stroke="#000"
                strokeDasharray="2 3"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="slotLabel"
                stroke="#000"
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
                tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
              />
              <YAxis
                yAxisId="venta"
                orientation="left"
                stroke="#000"
                tickLine={false}
                tickFormatter={fmtClpShort}
                tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
                width={56}
              />
              <YAxis
                yAxisId="qtty"
                orientation="right"
                stroke="#000"
                tickLine={false}
                tickFormatter={(v: number) => fmtQty(v)}
                tick={{ fontFamily: "monospace", fontSize: 11, fill: "#000" }}
                width={44}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "#000", strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="square"
                wrapperStyle={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "#000",
                  paddingBottom: 4,
                }}
              />
              <Area
                yAxisId="venta"
                type="linear"
                dataKey="venta"
                name="Venta CLP"
                fill="#FFFF00"
                stroke="#000"
                strokeWidth={3}
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: "#000", strokeWidth: 2, fill: "#FFFF00" }}
              />
              <Line
                yAxisId="qtty"
                type="linear"
                dataKey="qtty"
                name="Cantidad"
                stroke="#000"
                strokeWidth={3}
                dot={{ r: 3, fill: "#000", stroke: "#000" }}
                activeDot={{ r: 5, stroke: "#000", strokeWidth: 2, fill: "#FFFFFF" }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function MultiFilter({
  label,
  selected,
  onChange,
  options,
}: {
  label: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const isActive = selected.size > 0;
  const triggerText =
    selected.size === 0
      ? "Todos"
      : selected.size === 1
      ? Array.from(selected)[0]
      : `${selected.size} seleccionados`;

  function toggle(opt: string) {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(options));
  }

  function clear() {
    onChange(new Set());
  }

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      <span className="font-mono-data uppercase text-[10px] text-black/70">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center justify-between gap-3 min-w-[180px] font-mono-data uppercase text-xs px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00] ${
          isActive ? "bg-[#FFFF00]" : "bg-white"
        }`}
      >
        <span className="truncate text-left">{triggerText}</span>
        <span aria-hidden className="font-bold leading-none">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute top-full left-0 z-50 mt-1 w-[260px] max-h-72 overflow-y-auto bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-black text-white px-3 py-2 border-b-2 border-black">
            <button
              type="button"
              onClick={selectAll}
              disabled={options.length === 0}
              className="font-mono-data uppercase text-[10px] hover:text-[#FFFF00] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Marcar todos
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={selected.size === 0}
              className="font-mono-data uppercase text-[10px] hover:text-[#FFFF00] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Limpiar
            </button>
          </div>
          {options.length === 0 ? (
            <div className="font-mono-data text-xs text-black/50 px-3 py-2">
              Sin opciones
            </div>
          ) : (
            options.map((opt) => {
              const checked = selected.has(opt);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  key={opt}
                  onClick={() => toggle(opt)}
                  className="flex items-center gap-2 w-full text-left px-3 py-2 border-b border-black/20 last:border-b-0 hover:bg-[#FFFF00] cursor-pointer transition-colors duration-150"
                >
                  <span
                    aria-hidden
                    className={`relative inline-block w-4 h-4 border-2 border-black flex-shrink-0 ${
                      checked ? "bg-black" : "bg-white"
                    }`}
                  >
                    {checked && (
                      <span className="absolute inset-0 flex items-center justify-center text-[#FFFF00] text-[10px] font-bold leading-none">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="font-mono-data uppercase text-xs truncate">
                    {opt}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
