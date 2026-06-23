import type { AssetStatus } from "@/lib/governance/types";
import { STATUS_META } from "@/lib/governance/format";

export default function StatusBadge({ status }: { status: AssetStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      title={m.help}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]"
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: m.dot }}
      />
      {m.label}
    </span>
  );
}
