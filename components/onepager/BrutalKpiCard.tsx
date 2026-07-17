"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion";

type FormatType = "number" | "clp" | "usd" | "percent" | "integer";

function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (abs >= 10_000) return (v / 1_000).toFixed(1).replace(/\.?0+$/, "") + "K";
  return Math.round(v).toLocaleString("es-CL");
}

const formatters: Record<FormatType, (v: number) => string> = {
  number: (v) => compact(v),
  clp: (v) => "$" + compact(v),
  usd: (v) => "US$" + (Math.abs(v) >= 1000 ? compact(v) : v.toFixed(1)),
  percent: (v) => Math.round(v).toString() + "%",
  integer: (v) => compact(v),
};

type BrutalKpiCardProps = {
  label: string;
  value: number;
  formatType?: FormatType;
  delta?: number;
  suffix?: string;
};

// KPI card estándar Glovox (docs/STYLE_DASHBOARD.md § KPI CARD). Nombre
// histórico; mantiene el count-up sutil permitido por el manual.
export default function BrutalKpiCard({
  label,
  value,
  formatType = "number",
  delta,
  suffix,
}: BrutalKpiCardProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [displayed, setDisplayed] = useState("0");
  const fmt = formatters[formatType];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(0, value, {
      duration: 0.6,
      onUpdate(v) {
        setDisplayed(fmt(v));
      },
    });
    return () => controls.stop();
  }, [value, fmt]);

  const dotColor =
    delta == null
      ? null
      : delta > 0
        ? "bg-[#B1D750]"
        : delta < 0
          ? "bg-[#ED75A0]"
          : "bg-[#999999]";

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex flex-col gap-1 overflow-hidden min-w-0">
      <span className="font-sans text-xs text-[#666666] truncate leading-tight">
        {label}
      </span>
      <span
        ref={ref}
        className="font-display font-bold text-2xl leading-none text-[#333333] truncate block mt-1 tracking-tight"
        title={displayed + (suffix ?? "")}
      >
        {displayed}
        {suffix && <span className="text-base font-medium text-[#666666]">{suffix}</span>}
      </span>
      {delta != null && (
        <span className="inline-flex items-center gap-1.5 font-sans text-xs text-[#666666] mt-2">
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`}
          />
          {delta > 0 ? "+" : ""}
          {delta}%
        </span>
      )}
    </div>
  );
}
