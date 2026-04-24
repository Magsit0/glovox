"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Country } from "@/lib/queries/comunidad";

const buttons: { id: Country; label: string }[] = [
  { id: "all", label: "\u{1F30D} Todos" },
  { id: "chile", label: "\u{1F1E8}\u{1F1F1} Chile" },
  { id: "peru", label: "\u{1F1F5}\u{1F1EA} Per\u00FA" },
];

export default function CountryFilter({ active }: { active: Country }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(id: Country) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") {
      params.delete("country");
    } else {
      params.set("country", id);
    }
    const qs = params.toString();
    router.push(`/club${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
      {buttons.map((b) => (
        <button
          key={b.id}
          onClick={() => handleChange(b.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === b.id
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
