"use client";

import { useRouter } from "next/navigation";

interface Props {
  options: string[];
  selected: string;
  trimestreId: string;
}

export default function RrssNetworkSelector({ options, selected, trimestreId }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const network = e.target.value;
    const params = new URLSearchParams();
    params.set("trimestre", trimestreId);
    params.set("network", network);
    router.push(`/cierre-trimestral?${params.toString()}#rrss`);
  }

  const labelFor = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <div className="relative inline-flex items-center">
      <span
        className="pointer-events-none absolute left-3 inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]"
        aria-hidden="true"
      />
      <select
        value={selected}
        onChange={handleChange}
        className="appearance-none rounded-lg border border-[#E5E5E5] bg-white py-2 pl-7 pr-9 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        aria-label="Seleccionar red social"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labelFor(opt)}
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
