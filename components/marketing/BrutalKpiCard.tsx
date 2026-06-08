"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion";

type FormatType = "number" | "clp" | "clp-compact" | "usd" | "percent" | "integer";

const compactClp = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

// Pill formatter: up to 1 decimal, locale "es-CL" (uses comma as separator).
// Whole numbers render without decimals (e.g. "+5%" not "+5,0%").
const deltaFmt = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

const formatters: Record<FormatType, (v: number) => string> = {
  number: (v) => Math.round(v).toLocaleString("es-CL"),
  clp: (v) => "$" + Math.round(v).toLocaleString("es-CL"),
  "clp-compact": (v) => "$" + compactClp.format(Math.round(v)),
  usd: (v) => "US$" + v.toFixed(1),
  percent: (v) => Math.round(v).toString(),
  integer: (v) => Math.round(v).toString(),
};

type SecondaryLine = { label: string; value: string };

type BrutalKpiCardProps = {
  label: string;
  value: number;
  formatType?: FormatType;
  delta?: number;
  suffix?: string;
  // Small, discreet annotation that sits to the RIGHT of the main value (not
  // below). Use for short context like "(120 packs)" that explains how the
  // main number was composed. Mutually exclusive with `delta` (they share the
  // same slot — if both are passed, `delta` wins).
  inlineSuffix?: string;
  // Optional, smaller metric(s) under the main value. Pass a single object for
  // one line or an array for multiple lines. The caller pre-formats each
  // value (so it can choose its own currency/compact rules).
  secondary?: SecondaryLine | SecondaryLine[];
  // Optional "from → to" progression line under the main value. Renders as
  // one line: initial on the left, arrow centered, final on the right.
  // Useful for KPIs where the main value is the delta itself (e.g. followers).
  progression?: { from: string; to: string };
};

export default function BrutalKpiCard({
  label,
  value,
  formatType = "number",
  delta,
  suffix,
  inlineSuffix,
  secondary,
  progression,
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
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-4 flex flex-col gap-1 min-w-0">
      <span className="font-mono-data uppercase text-xs text-black tracking-wide">
        {label}
      </span>
      {/* Main value + (optional) delta pill on the same row. The pill aligns to
          the value's baseline and parks on the right; the value still wraps
          freely thanks to `min-w-0` + `flex-1`. */}
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <span
          ref={ref}
          className="font-display text-3xl xl:text-4xl leading-none text-black break-words flex-1 min-w-0"
        >
          {displayed}
          {suffix && (
            <span className="block text-base xl:text-lg mt-1">{suffix}</span>
          )}
        </span>
        {delta != null ? (
          <span
            className={`shrink-0 font-mono-data text-xs px-2 py-1 rounded-none ${deltaColor}`}
          >
            {delta > 0 ? "+" : ""}
            {deltaFmt.format(delta)}%
          </span>
        ) : inlineSuffix ? (
          <span className="shrink-0 font-mono-data text-xs text-black/60">
            {inlineSuffix}
          </span>
        ) : null}
      </div>
      {progression && (
        <div className="mt-1 border-t-2 border-black/20 pt-1 font-mono-data text-xs flex items-baseline justify-between gap-2">
          <span className="text-black tabular-nums">{progression.from}</span>
          <span className="text-black/40">→</span>
          <span className="text-black tabular-nums">{progression.to}</span>
        </div>
      )}
      {secondary && (() => {
        const lines = Array.isArray(secondary) ? secondary : [secondary];
        if (lines.length === 0) return null;
        return (
          <div className="mt-1 border-t-2 border-black/20 pt-1 space-y-0.5 font-mono-data text-xs">
            {lines.map((line) => (
              <div
                key={line.label}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="uppercase text-black/60">{line.label}</span>
                <span className="text-black tabular-nums">{line.value}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
