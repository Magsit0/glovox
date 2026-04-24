import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
  accent?: string;
}

const trendConfig = {
  up: {
    Icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  down: {
    Icon: TrendingDown,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  flat: {
    Icon: Minus,
    color: "text-zinc-400",
    bg: "bg-zinc-700/40",
  },
} as const;

export default function KpiCard({
  label,
  value,
  sub,
  delta,
  trend = "flat",
  accent,
}: KpiCardProps) {
  const { Icon, color, bg } = trendConfig[trend];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </p>

      <p
        className={`text-3xl font-semibold leading-none tracking-tight ${accent ?? "text-zinc-50"}`}
      >
        {value}
      </p>

      {(sub || delta) && (
        <div className="flex items-center justify-between gap-2">
          {sub && (
            <span className="truncate text-xs text-zinc-500">{sub}</span>
          )}
          {delta && (
            <span
              className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${color} ${bg}`}
            >
              <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
