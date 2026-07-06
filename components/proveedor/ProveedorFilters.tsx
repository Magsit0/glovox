"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { ProveedorOption } from "@/lib/queries/proveedor";
import ProveedorCombobox from "@/components/proveedor/ProveedorCombobox";
import MontoModeToggle from "@/components/MontoModeToggle";
import type { MontoMode } from "@/components/montoMode";

interface Props {
  options: ProveedorOption[];
  proveedor: string;
  from: string;
  to: string;
  monto: MontoMode;
}

const INPUT_CLS =
  "rounded-lg border border-[#E5E5E5] bg-white py-2 px-3 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

export default function ProveedorFilters({
  options,
  proveedor,
  from,
  to,
  monto,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(`/proveedor${qs ? `?${qs}` : ""}`);
  }

  const hasActiveFilters = Boolean(proveedor) || Boolean(from) || Boolean(to);

  return (
    <section className="flex flex-wrap items-end gap-3">
      {/* Proveedor (combobox con búsqueda) */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">
          Proveedor
          {proveedor && (
            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8] align-middle" />
          )}
        </span>
        <ProveedorCombobox
          options={options}
          value={proveedor}
          onSelect={(p) => update({ proveedor: p })}
        />
      </label>

      {/* Rango de fechas */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Desde</span>
        <input
          type="date"
          className={INPUT_CLS}
          value={from}
          onChange={(e) => update({ from: e.target.value || null })}
          aria-label="Fecha desde"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Hasta</span>
        <input
          type="date"
          className={INPUT_CLS}
          value={to}
          onChange={(e) => update({ to: e.target.value || null })}
          aria-label="Fecha hasta"
        />
      </label>

      {/* Switch neto/bruto: modo de visualización, no filtro (Limpiar lo preserva) */}
      <MontoModeToggle value={monto} />

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() =>
            router.push(`/proveedor${monto === "bruto" ? "?monto=bruto" : ""}`)
          }
          className="flex items-center gap-1 px-2 py-2 font-sans text-sm text-[#666666] transition-colors hover:text-[#333333]"
        >
          <X className="h-4 w-4" />
          Limpiar
        </button>
      )}
    </section>
  );
}
