"use client";

import type { ReactNode } from "react";

interface TooltipItem {
  name?: string | number;
  color?: string;
  value?: number | string;
  formatted?: string;
}

export function ChartTooltip({
  active,
  label,
  items,
}: {
  active?: boolean;
  label?: ReactNode;
  items: TooltipItem[];
}) {
  if (!active || !items.length) return null;
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      {label !== undefined && (
        <div className="mb-1.5 text-xs text-[#666666]">{label}</div>
      )}
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-[#333333]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: item.color ?? "#9F99F8" }}
            />
            <span className="text-[#666666]">{item.name}</span>
            <span className="ml-auto tabular-nums font-medium text-[#333333]">
              {item.formatted ?? item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const BrutalTooltip = ChartTooltip;
