import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  caption,
  delta,
  deltaTone = "neutral",
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
}) {
  const dotColor =
    deltaTone === "positive"
      ? "bg-[#B1D750]"
      : deltaTone === "negative"
        ? "bg-[#ED75A0]"
        : "bg-[#999999]";
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-6 flex flex-col">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="font-display font-bold text-4xl leading-none text-[#333333] mt-2 tracking-tight tabular-nums">
        {value}
      </p>
      {(caption || delta) && (
        <div className="mt-3 flex items-center gap-2">
          {delta && (
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#333333]">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              {delta}
            </span>
          )}
          {caption && (
            <span className="font-sans text-xs text-[#999999]">{caption}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function SpotlightKpi({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
}) {
  return (
    <div className="bg-[#9F99F8] rounded-xl p-8 flex flex-col justify-between min-h-[180px]">
      <p className="font-sans text-xs text-white/80">{label}</p>
      <div>
        <p className="font-display font-bold text-5xl leading-none text-white mt-2 tracking-tight tabular-nums">
          {value}
        </p>
        {caption && (
          <p className="font-sans text-sm text-white/80 mt-4">{caption}</p>
        )}
      </div>
    </div>
  );
}
