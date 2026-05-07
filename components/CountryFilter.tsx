"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Country } from "@/lib/queries/comunidad";

const buttons: { id: Country; label: string }[] = [
  { id: "all", label: "\u{1F30D} Todos" },
  { id: "chile", label: "\u{1F1E8}\u{1F1F1} Chile" },
  { id: "peru", label: "\u{1F1F5}\u{1F1EA} Per\u00FA" },
];

export default function CountryFilter({
  active,
  locked = false,
}: {
  active: Country;
  /**
   * When the user has a session country attribute, this filter is locked:
   * the active option is forced and the others are visually disabled to
   * reflect that the user cannot widen their data scope.
   */
  locked?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(id: Country) {
    if (locked) return;
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
      {buttons.map((b) => {
        const isActive = active === b.id;
        const disabled = locked && !isActive;
        return (
          <button
            key={b.id}
            onClick={() => handleChange(b.id)}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-zinc-800 text-zinc-100"
                : disabled
                  ? "cursor-not-allowed text-zinc-700"
                  : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
