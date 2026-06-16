import type { Country } from "@/lib/queries/comunidad";
import type { Country as PgCountry } from "@/db/schema";
import { getPlan, listPlanes, listSponsors } from "@/lib/queries/pricing";
import { getEventInfo, getCategoriaEventos } from "@/lib/queries/ticketing";
import { coerceDoc } from "@/lib/ticketing-pricing/config";
import PlanList from "./PlanList";
import PlanBuilder from "./PlanBuilder";
import SponsorManager from "./SponsorManager";

function toPgCountry(c: Country): PgCountry | undefined {
  if (c === "chile") return "CL";
  if (c === "peru") return "PE";
  return undefined; // "all"
}

interface Props {
  country: Country;
  canEdit: boolean;
  planId?: string;
}

export default async function PricingTabSection({ country, canEdit, planId }: Props) {
  if (!canEdit) {
    return (
      <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
        <p className="font-display text-lg font-bold text-[#333333]">
          Sin acceso al planificador
        </p>
        <p className="mt-2 font-sans text-sm text-[#666666]">
          Solo un superadmin puede construir planes de pricing.
        </p>
      </section>
    );
  }

  const pgCountry = toPgCountry(country);

  // Modo edición de un plan concreto.
  if (planId) {
    const plan = await getPlan(planId);
    if (!plan) {
      return (
        <section className="rounded-lg border border-[#ED75A0] bg-white p-6">
          <p className="font-sans text-sm text-[#333333]">
            El plan solicitado no existe o fue eliminado.
          </p>
        </section>
      );
    }
    // Info general del evento (fuente de verdad: glovox.categoriaEvento).
    const [sponsorCatalog, eventInfo] = await Promise.all([
      listSponsors(),
      getEventInfo(coerceDoc(plan.doc).eventoId),
    ]);
    return <PlanBuilder plan={plan} sponsorCatalog={sponsorCatalog} eventInfo={eventInfo} />;
  }

  // Modo listado: planes + gestión del catálogo de sponsors.
  const [planes, sponsors, eventosCat] = await Promise.all([
    listPlanes(pgCountry),
    listSponsors({ includeInactive: true }), // todos (incluye inactivos) para gestionar
    getCategoriaEventos(country), // eventos del catálogo para crear planes
  ]);
  // Eventos disponibles para un plan nuevo = los de categoriaEvento sin plan aún.
  const usados = new Set(planes.map((p) => coerceDoc(p.doc).eventoId).filter(Boolean));
  const eventosDisponibles = eventosCat.filter((e) => !usados.has(e.eventoId));
  return (
    <div className="flex flex-col gap-8">
      <PlanList planes={planes} eventosDisponibles={eventosDisponibles} />
      <SponsorManager sponsors={sponsors} defaultCountry={pgCountry ?? "CL"} />
    </div>
  );
}
