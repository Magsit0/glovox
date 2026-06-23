export default function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <span className="inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
        {accent && (
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
        )}
        {label}
      </span>
      <span className="font-display text-4xl font-bold leading-none text-[#333333]">
        {value}
      </span>
      {hint && <span className="font-sans text-xs text-[#999999]">{hint}</span>}
    </div>
  );
}
