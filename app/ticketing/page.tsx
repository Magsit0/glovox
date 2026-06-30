import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import type { Country } from "@/lib/queries/comunidad";
import {
  getTicketingByCategoria,
  getTicketingByTipo,
  getTicketingByVipGral,
  getTicketingEventOptions,
  getTicketingEvolucion,
  getTicketingKpis,
  getTicketingPrecioMatriz,
  type ClaseVenta,
  type TicketingEvolucionRow,
  type TicketingFilters,
} from "@/lib/queries/ticketing";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import TicketingFilters_ from "@/components/ticketing/TicketingFilters";
import EvolucionChart from "@/components/ticketing/EvolucionChart";
import ProductoSection from "@/components/ticketing/ProductoSection";
import PrecioSection from "@/components/ticketing/PrecioSection";
import VipGralDonut from "@/components/ticketing/VipGralDonut";
import TicketingTabs, { type TicketingTabKey } from "@/components/ticketing/TicketingTabs";
import PricingTabSection from "@/components/ticketing/pricing/PricingTabSection";
import GlobalAnalysisSection from "@/components/ticketing/GlobalAnalysisSection";
import DemandaSection from "@/components/ticketing/DemandaSection";
import type { DemandaGranularidad } from "@/lib/queries/ticketing";
import type { ProyeccionMetodo } from "@/lib/ticketing/demanda-forecast";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    event?: string;
    categoria?: string | string[];
    country?: string;
    from?: string;
    to?: string;
    clase?: string | string[];
    devueltos?: string;
    tab?: string;
    plan?: string;
    // Tab "Análisis global": filtros multi-selección (params repetibles).
    categorias?: string | string[];
    eventos?: string | string[];
    productos?: string | string[];
    // Tab "Demanda".
    granularidad?: string;
    metrica?: string;
    proyeccion?: string;
    categorias2?: string | string[];
    categorias3?: string | string[];
    temporadas?: string | string[];
  }>;
}

function parseClase(v?: string): ClaseVenta | undefined {
  return v === "VENTA" || v === "CORTESIA" || v === "OTRO" ? v : undefined;
}

function parseClases(v: string | string[] | undefined): ClaseVenta[] {
  return toArray(v).flatMap((item) => {
    const clase = parseClase(item);
    return clase ? [clase] : [];
  });
}

/** Normaliza un searchParam repetible a string[] (descarta vacíos). */
function toArray(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}

function parseTab(v?: string): TicketingTabKey {
  if (v === "pricing") return "pricing";
  if (v === "global") return "global";
  if (v === "demanda") return "demanda";
  return "analisis";
}

function parseGranularidad(v?: string): DemandaGranularidad {
  if (v === "MONTH") return "MONTH";
  if (v === "EVENTO") return "EVENTO";
  if (v === "CATEGORIA") return "CATEGORIA";
  return "ISOWEEK";
}

function parseMetrica(v?: string): import("@/lib/queries/ticketing").DemandaMetrica {
  return v === "venta" ? "venta" : "tickets";
}

function parseProyeccion(v?: string): ProyeccionMetodo {
  if (v === "lineal") return "lineal";
  if (v === "holt") return "holt";
  return "ninguna";
}

function fmtFecha(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TicketingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/ticketing")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;

  // El país de la sesión bloquea la vista; ?country sólo se respeta para
  // usuarios sin país asignado (staff glovox.cl).
  const sessionCountry = session.user.country ?? null;
  const countryLocked = sessionCountry != null;
  const country: Country = sessionCountry
    ? sessionCountry === "PE"
      ? "peru"
      : "chile"
    : params.country === "chile" || params.country === "peru"
      ? params.country
      : "all";

  const tab = parseTab(params.tab);
  const canEditPricing = (session.user.role ?? "user") === "superadmin";

  // Tab Planificador de pricing: builder editable (no requiere las queries
  // pesadas del análisis). Solo superadmin puede editar; el resto ve un aviso.
  if (tab === "pricing") {
    return (
      <Shell>
        <Heading />
        <TicketingTabs active="pricing" eventParam={params.event} showPricing={canEditPricing} />
        <PricingTabSection country={country} canEdit={canEditPricing} planId={params.plan} />
      </Shell>
    );
  }

  // Tab Análisis global: tabla general de eventos (no requiere las queries
  // pesadas del análisis por evento).
  if (tab === "global") {
    return (
      <Shell>
        <Heading />
        <TicketingTabs active="global" eventParam={params.event} showPricing={canEditPricing} />
        <GlobalAnalysisSection
          country={country}
          countryLocked={countryLocked}
          categoriaEventos={toArray(params.categorias)}
          eventoIds={toArray(params.eventos)}
          productos={toArray(params.productos)}
        />
      </Shell>
    );
  }

  // Tab Demanda: evolución temporal de tickets vendidos por tipo.
  if (tab === "demanda") {
    return (
      <Shell>
        <Heading />
        <TicketingTabs active="demanda" eventParam={params.event} showPricing={canEditPricing} />
        <DemandaSection
          country={country}
          countryLocked={countryLocked}
          categoriaEventos={toArray(params.categorias)}
          categoriaEventos2={toArray(params.categorias2)}
          categoriaEventos3={toArray(params.categorias3)}
          temporadas={toArray(params.temporadas)}
          eventoIds={toArray(params.eventos)}
          granularidad={parseGranularidad(params.granularidad)}
          metrica={parseMetrica(params.metrica)}
          proyeccion={parseProyeccion(params.proyeccion)}
        />
      </Shell>
    );
  }

  const baseFilters: Omit<TicketingFilters, "eventoId"> = {
    categoriaEventos: toArray(params.categoria),
    country,
    from: params.from || undefined,
    to: params.to || undefined,
    clases: parseClases(params.clase),
    incluirDevueltos: params.devueltos === "1",
  };

  let events;
  let kpis;
  let byTipo;
  let byCategoria;
  let byPrecio;
  let byVipGral;
  let evolucion: TicketingEvolucionRow[] = [];
  let selectedEventId: string | undefined;
  let defaultEventId: string | undefined;
  let isAll = false;
  try {
    events = await getTicketingEventOptions(country);

    // Default = último evento ocurrido (la fecha más reciente que ya pasó),
    // dentro de la categoría seleccionada si la hay.
    const selectedCategorias = new Set(baseFilters.categoriaEventos ?? []);
    const scopedEvents = selectedCategorias.size
      ? events.filter((e) => selectedCategorias.has(e.categoriaEvento))
      : events;
    const today = new Date().toISOString().slice(0, 10);
    const pastEvents = scopedEvents.filter(
      (e) => e.fechaEvento && e.fechaEvento <= today,
    );
    defaultEventId = pastEvents[0]?.eventoId ?? scopedEvents[0]?.eventoId;

    isAll = params.event === "all";
    selectedEventId = isAll ? undefined : params.event || defaultEventId;

    const filters: TicketingFilters = { ...baseFilters, eventoId: selectedEventId };

    [kpis, byTipo, byCategoria, byPrecio, byVipGral, evolucion] =
      await Promise.all([
        getTicketingKpis(filters),
        getTicketingByTipo(filters),
        getTicketingByCategoria(filters),
        getTicketingPrecioMatriz(filters),
        getTicketingByVipGral(filters),
        isAll ? getTicketingEvolucion(filters) : Promise.resolve([]),
      ]);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
          <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">
            {err instanceof Error ? err.message : "Error al cargar el ticketing."}
          </p>
        </div>
      </Shell>
    );
  }

  const selectedEvent = selectedEventId
    ? events.find((e) => e.eventoId === selectedEventId)
    : null;

  const kpiCards = [
    {
      label: "Tickets",
      value: formatNumber(kpis.tickets),
      caption: isAll
        ? `${formatNumber(kpis.eventos)} eventos`
        : selectedEvent
          ? fmtFecha(selectedEvent.fechaEvento)
          : "",
    },
    {
      label: "Venta total",
      value: compactCurrency(kpis.venta),
      caption: formatCurrency(kpis.venta),
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(kpis.ticketPromedio),
      caption: "Venta / cantidad de tickets",
    },
    {
      label: "Tipos de ticket",
      value: formatNumber(byTipo.length),
      caption: `${formatNumber(byCategoria.length)} categorías`,
    },
  ];

  return (
    <Shell>
      <Heading />

      <TicketingTabs active="analisis" eventParam={params.event} showPricing={canEditPricing} />

      <TicketingFilters_
        events={events}
        eventoId={isAll ? "all" : (selectedEventId ?? "")}
        defaultEventId={defaultEventId ?? ""}
        categoriaEventos={baseFilters.categoriaEventos ?? []}
        country={country}
        countryLocked={countryLocked}
        from={baseFilters.from ?? ""}
        to={baseFilters.to ?? ""}
        clases={baseFilters.clases ?? []}
        incluirDevueltos={baseFilters.incluirDevueltos}
      />

      {!isAll && selectedEvent && (
        <section className="flex flex-col gap-1">
          {selectedEvent.categoriaEvento && (
            <p className="font-sans text-xs uppercase tracking-wide text-[#666666]">
              {selectedEvent.categoriaEvento}
            </p>
          )}
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#333333]">
            {selectedEvent.nombre || selectedEvent.eventoId}
          </h2>
          <p className="font-sans text-sm text-[#666666]">
            {selectedEvent.eventoId} · {fmtFecha(selectedEvent.fechaEvento)}
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <article
            key={k.label}
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <p className="font-sans text-xs text-[#666666]">{k.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {k.value}
            </p>
            <p className="mt-3 truncate font-sans text-xs text-[#666666]">
              {k.caption}
            </p>
          </article>
        ))}
      </section>

      {isAll && <EvolucionChart rows={evolucion} />}

      <ProductoSection
        title="Por tipo de ticket"
        subtitle="Productos ofrecidos según TipoTicket (texto original), ordenados por venta."
        rows={byTipo}
        columnLabel="Tipo de ticket"
      />

      <ProductoSection
        title="Por categoría de ticket"
        subtitle="Distribución según CategoriaTicket, ordenada por venta."
        rows={byCategoria}
        columnLabel="Categoría de ticket"
      />

      <PrecioSection rows={byPrecio} />

      <VipGralDonut rows={byVipGral} />
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
      <p className="font-sans text-xs text-[#666666]">Ticketing</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Producto de ticketing
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Análisis por evento de tipos y categorías de ticket: cantidad y venta.
      </p>
    </header>
  );
}
