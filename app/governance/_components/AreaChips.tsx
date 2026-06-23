"use client";

import { ALL_AREAS, AREA_COLOR, AREA_LABEL } from "@/lib/governance/format";

/**
 * Barra de chips para filtrar por área. Compartida por las vistas Calidad,
 * ETLs y Flujo. `value` es el id activo ("all" o una Area); `onChange` lo cambia.
 */
export default function AreaChips({
  value,
  onChange,
  includeAll = true,
}: {
  value: string;
  onChange: (id: string) => void;
  includeAll?: boolean;
}) {
  const chips = [
    ...(includeAll ? [{ id: "all", label: "Todas", color: "#333333" }] : []),
    ...ALL_AREAS.map((a) => ({ id: a, label: AREA_LABEL[a], color: AREA_COLOR[a] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-sm font-medium transition-colors"
            style={
              active
                ? { backgroundColor: c.color, borderColor: c.color, color: c.id === "all" ? "#fff" : "#333333" }
                : { backgroundColor: "#fff", borderColor: "#E5E5E5", color: "#666666" }
            }
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
