"use client";

import { usePathname } from "next/navigation";
import { useQueryFiltros } from "@/components/filters/useQueryFiltros";
import { montoModeFrom, type MontoMode } from "@/components/montoMode";

/**
 * Switch neto/bruto compartido por los dashboards de finanzas.
 *
 * Los montos vienen de las vistas marts.finanzas_* que exponen el par
 * `*_neto` / `*_bruto` (bruto = neto + IVA; en boletas de honorarios la
 * retención está contenida en el neto, así que ambos coinciden).
 *
 * Mecánica: escribe `?monto=bruto` en la URL (mismo patrón que los demás
 * filtros de los dashboards server-rendered); la página lee el parámetro con
 * `montoModeFrom()` (en @/components/montoMode, módulo plano server-safe) y
 * las queries eligen la columna con un mapa seguro (nunca interpolando el
 * valor del usuario en SQL).
 */

const OPTIONS: { value: MontoMode; label: string; title: string }[] = [
  { value: "neto", label: "Neto", title: "Montos netos (sin IVA)" },
  { value: "bruto", label: "Bruto", title: "Montos brutos (con IVA)" },
];

const PARAM = "monto";

export default function MontoModeToggle({ value: confirmado }: { value: MontoMode }) {
  // Query vigente de la página en la que está montado el switch (el último
  // cambio pedido aunque la navegación no haya terminado), para que un cambio
  // de Montos y otro filtro seguidos se sumen en vez de pisarse.
  const { search, navegar } = useQueryFiltros(usePathname());

  // Mientras el servidor responde se ve el modo pedido (y un segundo clic se
  // compara contra él, no contra la URL vieja). Con el param repetido manda el
  // que resolvió el servidor (montoModeFrom solo acepta un "bruto" suelto).
  const pedidos = new URLSearchParams(search).getAll(PARAM);
  const value = pedidos.length > 1 ? confirmado : montoModeFrom(pedidos[0]);

  // Escribe SOLO `monto` (neto = sin param); el resto de la URL queda igual.
  function set(mode: MontoMode) {
    if (mode === value) return;
    const params = new URLSearchParams(search);
    if (mode === "neto") params.delete(PARAM);
    else params.set(PARAM, mode);
    navegar(params.toString());
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-xs text-[#666666]">Montos</span>
      <div
        role="group"
        aria-label="Modo de montos"
        className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.title}
            aria-pressed={value === opt.value}
            onClick={() => set(opt.value)}
            className={`rounded-md px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
              value === opt.value
                ? "bg-[#F0EFFE] text-[#9F99F8]"
                : "text-[#666666] hover:text-[#333333]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </label>
  );
}
