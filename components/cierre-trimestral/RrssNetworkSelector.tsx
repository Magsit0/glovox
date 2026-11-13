"use client";

import { useQueryFiltros } from "@/components/filters/useQueryFiltros";

interface Props {
  options: string[];
  selected: string;
}

const PARAM = "network";

export default function RrssNetworkSelector({ options, selected }: Props) {
  // Query vigente (el último cambio pedido aunque la navegación no haya
  // terminado), para que dos cambios seguidos se sumen.
  const { search, navegar } = useQueryFiltros("/cierre-trimestral");

  // Mientras el servidor responde se ve la red pedida. Si la URL trae una que
  // no existe, o la trae repetida (misma regla que page.tsx), manda la que
  // resolvió el servidor (instagram o la primera).
  const pedidos = new URLSearchParams(search).getAll(PARAM);
  const pedido = pedidos.length === 1 ? pedidos[0] : null;
  const value = pedido && options.includes(pedido) ? pedido : selected;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    // Regla única de filtros: escribe solo `network`. Trimestre y Montos
    // (`monto`) quedan como estaban. Ya no hace falta el ancla `#rrss`:
    // `navegar` no sube al inicio y, como solo cambian los searchParams, la
    // página sigue a la vista mientras carga, así que no se pierde la sección.
    const params = new URLSearchParams(search);
    params.set(PARAM, e.target.value);
    navegar(params.toString());
  }

  const labelFor = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <div className="relative inline-flex items-center">
      <span
        className="pointer-events-none absolute left-3 inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]"
        aria-hidden="true"
      />
      <select
        value={value}
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
