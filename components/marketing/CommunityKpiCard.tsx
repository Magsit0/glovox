"use client";

import { useState } from "react";
import BrutalKpiCard from "./BrutalKpiCard";

type Mode = "personas" | "monto";

type CommunityKpiCardProps = {
  // Personas sold through the community channel (SUM of PersonasPorTicket).
  personas: number;
  // Pack ROWS inside that subset — annotation for the personas view only.
  packs: number;
  // Net revenue of the same subset (Precio - Descuento, no service fee).
  revenue: number;
  // Service fee of the subset, already formatted — same convention as
  // `BrutalKpiCard.secondary`, so it renders identically to the "Cargo
  // Servicio" line of the "Venta Tickets" card.
  cargoServicio: string;
  // Share over the event total, one per unit: personas over totalTickets,
  // revenue over totalRevenue. Pre-computed by the page so both use the same
  // denominators as the rest of the KPI strip.
  personasPct: number;
  revenuePct: number;
};

const MODES: { id: Mode; label: string }[] = [
  { id: "personas", label: "Personas" },
  { id: "monto", label: "Monto" },
];

/**
 * "Comunidad" KPI card with a unit switch: it either counts the people that
 * bought through the community channel, or sums what they paid. Both figures
 * come from the same query, so switching is instant and does not refetch.
 */
export default function CommunityKpiCard({
  personas,
  packs,
  revenue,
  cargoServicio,
  personasPct,
  revenuePct,
}: CommunityKpiCardProps) {
  const [mode, setMode] = useState<Mode>("personas");
  const isPersonas = mode === "personas";

  return (
    <BrutalKpiCard
      label="Comunidad"
      value={isPersonas ? personas : revenue}
      formatType={isPersonas ? "number" : "clp-compact"}
      // The "(N packs)" note explains how the personas figure was weighted, so
      // it has no meaning next to an amount.
      inlineSuffix={
        isPersonas && packs > 0
          ? `(${packs.toLocaleString("es-CL")} pack${packs === 1 ? "" : "s"})`
          : undefined
      }
      // "Cargo Servicio" is the fee the community subset generated, and it is
      // excluded from `revenue` — the same relationship the "Venta Tickets"
      // card shows for the event total. It stays visible in both units so the
      // card does not change height when you flip the switch.
      secondary={[
        { label: "Del total", value: `${isPersonas ? personasPct : revenuePct}%` },
        { label: "Cargo Servicio", value: cargoServicio },
      ]}
      action={
        <div
          role="group"
          aria-label="Unidad de la venta comunidad"
          className="flex border-2 border-black"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`font-mono-data uppercase text-[10px] leading-none px-1.5 py-1 transition-colors ${
                mode === m.id
                  ? "bg-black text-white"
                  : "bg-white text-black hover:bg-black/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
