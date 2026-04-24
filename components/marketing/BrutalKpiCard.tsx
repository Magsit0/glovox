"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion";

type FormatType = "number" | "clp" | "usd" | "percent" | "integer";

const formatters: Record<FormatType, (v: number) => string> = {
  number: (v) => Math.round(v).toLocaleString("es-CL"),
  clp: (v) => "$" + Math.round(v).toLocaleString("es-CL"),
  usd: (v) => "US$" + v.toFixed(1),
  percent: (v) => Math.round(v).toString(),
  integer: (v) => Math.round(v).toString(),
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
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-4 flex flex-col gap-1">
      <span className="font-mono-data uppercase text-xs text-black tracking-wide">
        {label}
      </span>
      <span
        ref={ref}
        className="font-display text-5xl leading-none text-black"
      >
        {displayed}
        {suffix && <span className="text-2xl">{suffix}</span>}
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
