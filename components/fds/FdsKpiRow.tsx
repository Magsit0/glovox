export type KpiTone = "positive" | "negative" | "neutral";

export interface FdsKpiItem {
  label: string;
  value: string;
  caption?: string;
  tone?: KpiTone;
}

const dotColor: Record<KpiTone, string> = {
  positive: "#B1D750",
  negative: "#ED75A0",
  neutral: "#999999",
};

interface Props {
  items: FdsKpiItem[];
  /** Columnas en desktop. Default 4. */
  cols?: 3 | 4;
}

export default function FdsKpiRow({ items, cols = 4 }: Props) {
  const gridCols = cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${gridCols}`}>
      {items.map((k) => (
        <article
          key={k.label}
          className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
        >
          <span className="font-sans text-xs text-[#666666]">{k.label}</span>
          <span className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
            {k.value}
          </span>
          {k.caption && (
            <div className="mt-3 flex items-center gap-2">
              {k.tone && (
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor[k.tone] }}
                />
              )}
              <span className="truncate font-sans text-xs text-[#999999]">{k.caption}</span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
