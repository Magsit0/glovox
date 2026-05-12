"use client";

import { useRouter } from "next/navigation";
import type { TrimestreOption } from "@/lib/queries/cierreTrimestral";

interface Props {
  options: TrimestreOption[];
  selectedId: string;
}

export default function TrimestreSelector({ options, selectedId }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    router.push(`/cierre-trimestral?trimestre=${encodeURIComponent(id)}`);
  }

  return (
    <div className="relative inline-flex items-center">
      <span
        className="pointer-events-none absolute left-3 inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]"
        aria-hidden="true"
      />
      <select
        value={selectedId}
        onChange={handleChange}
        className="appearance-none rounded-lg border border-[#E5E5E5] bg-white py-2 pl-7 pr-9 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        aria-label="Seleccionar trimestre"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 h-3 w-3 text-[#999999]"
        aria-hidden="true"
      >
        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
