"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type FunnelVentana = "todo" | "ga4";

/** Parámetro de URL del modo del Funnel: "ga4" o ausente (toda la venta). */
export const FUNNEL_VENTANA_PARAM = "funnelVentana";

const MODOS: { id: FunnelVentana; label: string; title: string }[] = [
  { id: "todo", label: "Toda la venta", title: "Pasos del funnel en toda la ventana de venta del evento." },
  {
    id: "ga4",
    label: "Desde medición GA4",
    title: "Pasos desde que GA4 mide compras con número de orden, más el paso «Compran (órdenes GA4)».",
  },
];

/**
 * Selector opt-in del Funnel: «Toda la venta» (la vista de siempre) o «Desde
 * medición GA4», que recorta los pasos a la ventana medida y agrega el paso
 * Compran. Vive en la URL (`?funnelVentana=ga4`), con la misma lógica de push
 * que FunnelLandingPageFilter, para que el link compartido abra igual.
 */
export default function FunnelVentanaToggle({ modo }: { modo: FunnelVentana }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function elegir(next: FunnelVentana) {
    if (next === modo) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ga4") params.set(FUNNEL_VENTANA_PARAM, "ga4");
    else params.delete(FUNNEL_VENTANA_PARAM);
    router.push(`/marketing/weekly?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Período del funnel"
      className="mb-3 flex w-fit max-w-full border-4 border-black shadow-[4px_4px_0px_#000] bg-white"
    >
      {MODOS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => elegir(m.id)}
          aria-pressed={modo === m.id}
          title={m.title}
          className={`font-mono-data text-xs px-3 py-1.5 whitespace-nowrap cursor-pointer transition-colors duration-150 ${
            modo === m.id ? "bg-black text-white" : "bg-white text-black hover:bg-[#FFFF00]"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
