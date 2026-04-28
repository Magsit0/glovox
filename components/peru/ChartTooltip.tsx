"use client";

import type { TooltipContentProps } from "recharts";

type Formatter = (value: number | undefined, name?: string) => string;

type Props = Partial<TooltipContentProps> & { formatter?: Formatter };

export function GlovoxTooltip({ active, payload, label, formatter }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg shadow-md px-3 py-2 font-sans text-sm text-[#333333]">
      {label !== undefined && (
        <p className="text-xs text-[#666666] mb-1.5">{String(label)}</p>
      )}
      <ul className="flex flex-col gap-1">
        {payload.map((p, i) => {
          const numVal = p.value != null ? Number(p.value) : undefined;
          return (
            <li key={i} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: (p.color as string) ?? "#9F99F8" }}
              />
              <span className="text-[#666666]">{String(p.name ?? "")}</span>
              <span className="ml-auto font-medium tabular-nums">
                {formatter
                  ? formatter(numVal, String(p.name ?? ""))
                  : (numVal ?? 0).toLocaleString("es-PE")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
