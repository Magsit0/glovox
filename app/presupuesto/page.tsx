import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import type { Country } from "@/lib/queries/comunidad";
import type { Country as PgCountry } from "@/db/schema";
import { getPresupuesto, listPresupuestos } from "@/lib/queries/presupuesto";
import { getCategoriaEventos, getEventInfo } from "@/lib/queries/ticketing";
import { coerceDoc } from "@/lib/budget-forecast/config";
import PresupuestoList from "@/components/presupuesto/PresupuestoList";
import PresupuestoBuilder from "@/components/presupuesto/PresupuestoBuilder";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ plan?: string; country?: string }>;
}

function toPgCountry(c: Country): PgCountry | undefined {
  if (c === "chile") return "CL";
  if (c === "peru") return "PE";
  return undefined; // "all"
}

export default async function PresupuestoPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/presupuesto")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const canEdit = (session.user.role ?? "user") === "superadmin";

  // El país de la sesión bloquea la vista; ?country solo para staff sin país.
  const sessionCountry = session.user.country ?? null;
  const country: Country = sessionCountry
    ? sessionCountry === "PE"
      ? "peru"
      : "chile"
    : params.country === "chile" || params.country === "peru"
      ? params.country
      : "all";

  if (!canEdit) {
    return (
      <Shell>
        <Heading />
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
          <p className="font-display text-lg font-bold text-[#333333]">Sin acceso al constructor</p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            Solo un superadmin puede construir presupuestos de evento.
          </p>
        </section>
      </Shell>
    );
  }

  // Modo edición de un presupuesto concreto.
  if (params.plan) {
    const presupuesto = await getPresupuesto(params.plan);
    if (!presupuesto) {
      return (
        <Shell>
          <Heading />
          <section className="rounded-lg border border-[#ED75A0] bg-white p-6">
            <p className="font-sans text-sm text-[#333333]">
              El presupuesto solicitado no existe o fue eliminado.
            </p>
          </section>
        </Shell>
      );
    }
    const eventInfo = await getEventInfo(coerceDoc(presupuesto.doc).eventoId);
    return (
      <Shell>
        <Heading />
        <PresupuestoBuilder presupuesto={presupuesto} eventInfo={eventInfo} />
      </Shell>
    );
  }

  // Modo listado.
  const pgCountry = toPgCountry(country);
  const [presupuestos, eventosCat] = await Promise.all([
    listPresupuestos(pgCountry),
    getCategoriaEventos(country),
  ]);
  const usados = new Set(presupuestos.map((p) => coerceDoc(p.doc).eventoId).filter(Boolean));
  const eventosDisponibles = eventosCat.filter((e) => !usados.has(e.eventoId));

  return (
    <Shell>
      <Heading />
      <PresupuestoList presupuestos={presupuestos} eventosDisponibles={eventosDisponibles} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-2">
      <p className="font-sans text-xs text-[#666666]">Presupuesto</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Constructor de presupuesto de evento
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Proyectá el ingreso desde los asistentes, fijá un techo por margen objetivo y bajalo en
        cascada a las categorías de costo.
      </p>
    </header>
  );
}
