"use client";

import { useMemo } from "react";
import { useFilters } from "@/components/unabase/context/DashboardContext";
import { compactCurrency, formatNumber } from "@/lib/unabase/formatting";

type Delta = "neutral" | "positive" | "negative";

interface Card {
  label: string;
  value: string;
  sub: string;
  delta: Delta;
}

export default function SummaryCards() {
  const { filteredRows } = useFilters();

  const cards = useMemo<Card[]>(() => {
    if (!filteredRows.length) return [];

    const totalIngreso = filteredRows.reduce((s, r) => s + r.ingreso, 0);
    const totalFacturado = filteredRows.reduce((s, r) => s + r.facturado, 0);
    const totalGasto = filteredRows.reduce((s, r) => s + r.gasto, 0);
    const totalPresupuesto = filteredRows.reduce((s, r) => s + r.presupuesto, 0);
    const totalMargen = totalIngreso - totalGasto;
    const margenPct = totalIngreso ? totalMargen / totalIngreso : 0;
    const facturadoPct = totalIngreso ? totalFacturado / totalIngreso : 0;

    const topBusiness = [...filteredRows].sort((a, b) => b.ingreso - a.ingreso)[0];
    const clientMap: Record<string, { name: string; ingreso: number; negocios: number }> = {};
    filteredRows.forEach((r) => {
      const k = r.principalCliente;
      if (!clientMap[k]) clientMap[k] = { name: k, ingreso: 0, negocios: 0 };
      clientMap[k].ingreso += r.ingreso;
      clientMap[k].negocios += 1;
    });
    const topClient = Object.values(clientMap).sort((a, b) => b.ingreso - a.ingreso)[0];

    return [
      {
        label: "Ingreso total",
        value: compactCurrency(totalIngreso),
        sub: `${formatNumber(filteredRows.length)} negocios visibles`,
        delta: "neutral",
      },
      {
        label: "Facturado",
        value: compactCurrency(totalFacturado),
        sub: `Sobre ingreso: ${(facturadoPct * 100).toFixed(1)}%`,
        delta: facturadoPct >= 0.6 ? "positive" : "negative",
      },
      {
        label: "Gasto total",
        value: compactCurrency(totalGasto),
        sub: `Presupuesto: ${compactCurrency(totalPresupuesto)}`,
        delta: totalGasto > totalPresupuesto ? "negative" : "neutral",
      },
      {
        label: "Margen",
        value: compactCurrency(totalMargen),
        sub: `Margen %: ${(margenPct * 100).toFixed(1)}%`,
        delta: totalMargen >= 0 ? "positive" : "negative",
      },
      {
        label: "Top negocio",
        value: topBusiness?.nombre ?? "Sin dato",
        sub: topBusiness?.EventoID ?? "—",
        delta: "neutral",
      },
      {
        label: "Top cliente",
        value: topClient?.name ?? "Sin dato",
        sub: topClient ? `${formatNumber(topClient.negocios)} negocios` : "—",
        delta: "neutral",
      },
    ];
  }, [filteredRows]);

  if (!cards.length) return null;

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <article
          key={card.label}
          className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-6"
        >
          <div className="font-sans text-xs text-[#666666]">{card.label}</div>
          <div className="mt-2 truncate font-display text-4xl font-extrabold leading-none tracking-tight text-[#333333]">
            {card.value}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {card.delta !== "neutral" && <DeltaDot delta={card.delta} />}
            <span className="truncate font-sans text-xs text-[#666666]">{card.sub}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function DeltaDot({ delta }: { delta: Delta }) {
  const bg =
    delta === "positive"
      ? "bg-[#B1D750]"
      : delta === "negative"
        ? "bg-[#ED75A0]"
        : "bg-[#999999]";
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${bg}`} />;
}
