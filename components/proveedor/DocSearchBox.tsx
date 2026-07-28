"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Buscador de la vista /proveedor/documento. Navega a `?doc=<n>` (Enter o botón);
 * el server component resuelve el documento. Vacío → limpia el resultado.
 */
export default function DocSearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        router.push(
          `/proveedor/documento${v ? `?doc=${encodeURIComponent(v)}` : ""}`,
        );
      }}
      className="flex w-full max-w-md items-center gap-2"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
        <input
          type="text"
          inputMode="numeric"
          placeholder="Nº DOC — ej: 27861"
          className="w-full rounded-lg border border-[#E5E5E5] bg-white py-2 pl-9 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Buscar por Nº DOC"
          autoFocus
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
      >
        Buscar
      </button>
    </form>
  );
}
