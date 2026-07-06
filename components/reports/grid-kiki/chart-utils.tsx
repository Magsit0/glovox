"use client";

import { ReferenceArea, ReferenceLine } from "recharts";

export const fmtCLP = (v: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(v);

export const fmtNum = (v: number, decimals = 0) =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

export const fmtCLPCompact = (v: number) =>
  v >= 1_000_000
    ? `$${fmtNum(v / 1_000_000, 1)}M`
    : v >= 1_000
      ? `$${fmtNum(Math.round(v / 1_000))}K`
      : `$${fmtNum(v)}`;

export const axisTick = {
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fill: "#999999",
} as const;

export const gridProps = {
  vertical: false,
  stroke: "#F0F0F0",
  strokeDasharray: "0",
} as const;

type TooltipEntry = {
  color?: string;
  name?: string | number;
  value?: number | string | Array<number | string>;
  dataKey?: string | number;
};

/** "23:00" → "22:30 – 23:00": cada punto es el bloque que TERMINA a esa hora. */
export function rangoDe(slotLabel: string): string {
  const [h, m] = slotLabel.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return slotLabel;
  const inicio = (h * 60 + m - 30 + 1440) % 1440;
  const ih = String(Math.floor(inicio / 60)).padStart(2, "0");
  const im = String(inicio % 60).padStart(2, "0");
  return `${ih}:${im} – ${slotLabel}`;
}

export function GlovoxTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (value: number, dataKey: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entries = payload;
  const shownLabel = labelFormatter ? labelFormatter(String(label)) : String(label);
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <div className="text-xs text-[#666666]">{shownLabel}</div>
      {entries.map((e, i) => {
        const raw = typeof e.value === "number" ? e.value : Number(e.value ?? 0);
        const shown = formatter
          ? formatter(raw, String(e.dataKey ?? ""))
          : fmtNum(raw);
        return (
          <div key={i} className="mt-1 flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: e.color ?? "#999999" }}
            />
            <span className="text-[#666666]">{String(e.name ?? "")}</span>
            <span className="ml-auto pl-3 tabular-nums">{shown}</span>
          </div>
        );
      })}
    </div>
  );
}

const markLabel = (value: string, fill: string, dy: number) => ({
  value,
  position: "top" as const,
  dy,
  fontSize: 10,
  fill,
  fontFamily: "var(--font-sans)",
});

/**
 * Hitos de la promo (banda de ventana + líneas de envío y cierres) con los
 * labels escalonados en tres filas para que no se pisen entre sí.
 * Devuelve un array de elementos: recharts solo reconoce hijos directos,
 * así que se usa como `{promoMarks(...)}` dentro del chart.
 */
export function promoMarks(yAxisId?: string) {
  const common = yAxisId ? { yAxisId } : {};
  return [
    <ReferenceArea
      key="ventana"
      {...common}
      x1="21:30"
      x2="23:00"
      fill="#9F99F8"
      fillOpacity={0.07}
      label={{
        value: "Ventana promo",
        position: "insideBottom",
        fontSize: 10,
        fill: "#9F99F8",
        fontFamily: "var(--font-sans)",
      }}
    />,
    <ReferenceLine
      key="inicio-original"
      {...common}
      x="21:30"
      stroke="#333333"
      strokeDasharray="4 3"
      label={markLabel("Inicio original · 21:30", "#333333", -20)}
    />,
    <ReferenceLine
      key="cierre-original"
      {...common}
      x="22:00"
      stroke="#999999"
      strokeDasharray="4 3"
      label={markLabel("Cierre original · 22:00", "#999999", -6)}
    />,
    <ReferenceLine
      key="cierre-extendido"
      {...common}
      x="23:00"
      stroke="#ED75A0"
      strokeDasharray="4 3"
      label={markLabel("Cierre extendido · 23:00", "#ED75A0", 8)}
    />,
  ];
}

/** Pill para activar/desactivar una serie del gráfico. */
export function SeriePill({
  label,
  color,
  on,
  onToggle,
}: {
  label: string;
  color: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#E5E5E5] px-3 py-1 font-sans text-xs transition-colors hover:border-[#333333] ${
        on ? "text-[#333333]" : "text-[#999999] line-through"
      }`}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: on ? color : "#CCCCCC" }}
      />
      {label}
    </button>
  );
}

/** Selector Venta CLP / Cantidad compartido por los gráficos del reporte. */
export function MetricToggle({
  metric,
  onChange,
  labels = { venta: "Venta CLP", qtty: "Cantidad" },
}: {
  metric: "venta" | "qtty";
  onChange: (m: "venta" | "qtty") => void;
  labels?: { venta: string; qtty: string };
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[#E5E5E5]">
      {(["venta", "qtty"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`cursor-pointer px-3 py-1.5 font-sans text-xs transition-colors ${
            metric === m
              ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
              : "bg-white text-[#666666] hover:text-[#333333]"
          }`}
        >
          {labels[m]}
        </button>
      ))}
    </div>
  );
}
