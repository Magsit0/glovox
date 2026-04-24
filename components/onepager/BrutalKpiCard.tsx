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

  const deltaColor =
    delta == null
      ? null
      : delta > 0
        ? "bg-[#0000FF] text-white"
        : delta < 0
          ? "bg-[#FF0000] text-white"
          : "bg-[#FFFF00] text-black";

  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-2 flex flex-col gap-0.5 overflow-hidden min-w-0">
      <span className="font-mono-data uppercase text-[10px] text-black tracking-wide truncate leading-tight">
        {label}
      </span>
      <span
        ref={ref}
        className="font-display text-xl leading-none text-black truncate block"
        title={displayed + (suffix ?? "")}
      >
        {displayed}
        {suffix && <span className="text-base">{suffix}</span>}
      </span>
      {delta != null && (
        <span
          className={`inline-block self-start font-mono-data text-xs px-2 py-1 rounded-none ${deltaColor}`}
        >
          {delta > 0 ? "+" : ""}
          {delta}%
        </span>
      )}
    </div>
  );
}
