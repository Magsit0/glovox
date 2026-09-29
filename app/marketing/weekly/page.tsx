import { Suspense } from "react";
import { auth } from "@/lib/auth";
import {
  getEventList,
  getUpcomingEvents,
  getEventKpis,
  getTicketDateRange,
  getCumulativeSalesRelative,
  getTipoTicketOptions,
  getCommunityTicketsCount,
  getPaidMediaSummary,
  getSalesOrigin,
  getFollowersDelta,
  getFunnelData,
  getFunnelLandingPages,
  getCampaignBreakdown,
  getUtmTraffic,
  getTrafficTimeline,
  getAtribucionCompras,
  getFunnelCompra,
  type EventOption,
  type FunnelRow,
  type Scope,
} from "@/lib/queries/marketing";
import EventSelector from "@/components/marketing/EventSelector";
import CompareEventSelector from "@/components/marketing/CompareEventSelector";
import TipoTicketFilter from "@/components/marketing/TipoTicketFilter";
import BrutalKpiCard from "@/components/marketing/BrutalKpiCard";
import CommunityKpiCard from "@/components/marketing/CommunityKpiCard";
import BrutalChartPanel from "@/components/marketing/BrutalChartPanel";
import BrutalHighlightPanel from "@/components/marketing/BrutalHighlightPanel";
import CumulativeSalesComparisonChart from "@/components/marketing/charts/CumulativeSalesComparisonChart";
import SalesOriginTable from "@/components/marketing/charts/SalesOriginTable";
import FunnelChart from "@/components/marketing/charts/FunnelChart";
import FunnelLandingPageFilter from "@/components/marketing/FunnelLandingPageFilter";
import CampaignBreakdownChart from "@/components/marketing/charts/CampaignBreakdownChart";
import UtmTrafficTable from "@/components/marketing/charts/UtmTrafficTable";
import TrafficTimelineChart from "@/components/marketing/charts/TrafficTimelineChart";
import AtribucionSection, { ANCLA_ATRIBUCION } from "@/components/marketing/atribucion/AtribucionSection";
import FunnelVentanaToggle from "@/components/marketing/FunnelVentanaToggle";
// fmtClpCompact: CLP compact formatter, matching BrutalKpiCard's "clp-compact"
// style. Reused for KPI secondary lines (and shared with the attribution section).
import { fmtClpCompact, fmtFechaCorta, fmtPct, fmtUsd } from "@/lib/marketing/formato";
import {
  FUNNEL_PASO_COMPRA,
  pct,
  tieneMedicion,
  ventanaMedida,
  type AtribucionCompras,
} from "@/lib/marketing/atribucion";
// Raw amount in its own currency (no symbol; the currency code is shown alongside).
// USD keeps 1 decimal; CLP/BRL/others are whole-number amounts.
const fmtAmount = (currency: string, v: number) =>
  v.toLocaleString("es-CL", {
    minimumFractionDigits: currency === "USD" ? 1 : 0,
    maximumFractionDigits: currency === "USD" ? 1 : 0,
  });
// Display labels for ad platforms. Unknown values fall back to the raw string,
// so a new platform (e.g. tiktok) shows up without a code change.
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};
const platformLabel = (p: string) => PLATFORM_LABELS[p.toLowerCase()] ?? p;

function Skeleton() {
  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-6 animate-pulse">
      <div className="h-6 bg-black/10 rounded-none w-1/3 mb-4" />
      <div className="h-40 bg-black/5 rounded-none" />
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function MarketingWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{
    event?: string;
    landingPage?: string | string[];
    compare?: string | string[];
    tipoTicket?: string | string[];
    funnelVentana?: string; // "ga4" = Funnel "Desde medición GA4"; ausente = toda la venta
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const scope: Scope = { country: session?.user?.country ?? null };
  const [events, upcomingEvents] = await Promise.all([
    getEventList(scope),
    getUpcomingEvents(scope),
  ]);

  if (events.length === 0) {
    return (
      <div className="bg-white text-black min-h-full p-6">
        <p className="font-mono-data text-sm">No hay eventos disponibles.</p>
      </div>
    );
  }

  // Default: closest upcoming event by `fechaEvento`. If none upcoming,
  // fall back to the most recent past event. `upcomingEvents` is sorted
  // ASC and already filtered to fecha_evento >= today; `events` is sorted
  // DESC, so the first past event there is the latest realized one.
  const today = new Date().toISOString().slice(0, 10);
  const defaultId =
    upcomingEvents[0]?.eventoId ??
    events.find((e) => e.fechaEvento && e.fechaEvento < today)?.eventoId ??
    events[0].eventoId;
  const selectedId = params.event ?? defaultId;
  const selectedLandingPages = Array.isArray(params.landingPage)
    ? params.landingPage
    : params.landingPage
      ? [params.landingPage]
      : [];

  // Comparators: any event the user can see (already scoped by country in
  // `getEventList`), excluding the main event itself. The selector lets the
  // user drill in by category first, then pick events.
  const mainEvent = events.find((e) => e.eventoId === selectedId);
  const comparableEvents: EventOption[] = events.filter(
    (e) => e.eventoId !== selectedId,
  );
  const rawCompare = Array.isArray(params.compare)
    ? params.compare
    : params.compare
      ? [params.compare]
      : [];
  const comparableIds = new Set(comparableEvents.map((e) => e.eventoId));
  const compareIds = Array.from(new Set(rawCompare)).filter((id) =>
    comparableIds.has(id),
  );

  // TipoTicket filter (applies only to the cumulative-sales chart). The user
  // picks values from the union of TipoTickets across the visible events
  // (main + active comparators). Deduped + canonicalised here so the cache key
  // below is stable across reorderings.
  const rawTipoTicket = Array.isArray(params.tipoTicket)
    ? params.tipoTicket
    : params.tipoTicket
      ? [params.tipoTicket]
      : [];
  const selectedTipoTickets = Array.from(new Set(rawTipoTicket)).sort();
  const funnelVentanaGa4 = params.funnelVentana === "ga4";

  return (
    <div className="bg-white text-black min-h-full">
      <EventSelector
        events={events}
        selected={selectedId}
        upcomingEvents={upcomingEvents}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-end gap-4">
          <Suspense
            key={`countdown-${selectedId}`}
            fallback={
              <div className="px-4 py-2 h-[44px] w-[200px] animate-pulse bg-black/5" />
            }
          >
            <EventCountdownBanner eventoId={selectedId} scope={scope} />
          </Suspense>
        </div>

        {/* KPI Strip */}
        <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-5 gap-4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>}>
          <KpiStrip eventoId={selectedId} scope={scope} />
        </Suspense>

        {/* Row: Cumulative Sales + Paid Media */}
        <div className="grid grid-cols-4 gap-6">
          <Suspense
            key={`cum-${selectedId}-${compareIds.join("|")}-${selectedTipoTickets.join("|")}`}
            fallback={<Skeleton />}
          >
            <CumulativeSalesSection
              eventoId={selectedId}
              mainNombre={mainEvent?.nombre ?? selectedId}
              mainCategoria={mainEvent?.categoriaEvento ?? ""}
              compareIds={compareIds}
              comparableEvents={comparableEvents}
              tipoTickets={selectedTipoTickets}
              scope={scope}
            />
          </Suspense>
          <Suspense fallback={<Skeleton />}>
            <PaidMediaSection eventoId={selectedId} scope={scope} />
          </Suspense>
        </div>

        {/* Row: Atribución de compras (GA4). Its own window: only since GA4 measures purchases */}
        <Suspense key={`atrib-${selectedId}`} fallback={<Skeleton />}>
          <AtribucionSection eventoId={selectedId} country={scope.country} />
        </Suspense>

        {/* Row: Sales Origin + Funnel */}
        <div className="grid grid-cols-4 gap-6">
          <Suspense fallback={<Skeleton />}>
            <SalesOriginSection eventoId={selectedId} scope={scope} />
          </Suspense>
          <Suspense
            key={`funnel-${selectedId}-${selectedLandingPages.join("|")}-${funnelVentanaGa4 ? "ga4" : "todo"}`}
            fallback={<Skeleton />}
          >
            <FunnelSection
              eventoId={selectedId}
              landingPages={selectedLandingPages}
              country={scope.country}
              ventanaGa4={funnelVentanaGa4}
            />
          </Suspense>
        </div>

        {/* Row: Campaign Breakdown */}
        <Suspense fallback={<Skeleton />}>
          <CampaignSection eventoId={selectedId} scope={scope} />
        </Suspense>

        {/* Row: UTM Traffic */}
        <Suspense fallback={<Skeleton />}>
          <UtmTrafficSection eventoId={selectedId} scope={scope} />
        </Suspense>
      </div>
    </div>
  );
}

// ---------- Section components ----------

// Spanish date formatter used by EventCountdownBanner for past events.
// Renders "14 jun 2026" — short, locale-aware, no day-of-week clutter.
const dateFmtEs = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
function formatEventDate(iso: string): string {
  // `iso` is YYYY-MM-DD straight from BigQuery (see FORMAT_TIMESTAMP in getEventKpis).
  // Parse it as a UTC date so the displayed day matches the source row (avoids the
  // off-by-one that Date.parse on a date-only string can introduce in some locales).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return dateFmtEs.format(new Date(Date.UTC(y, m - 1, d)));
}

// Days-to-event indicator rendered in the row with the home logo. Classifies by
// the raw `daysToEvent` (fecha_evento - CURRENT_DATE), but displays the count
// with the same `+1` convention as the "Días para el Evento" KPI card used to
// (the inclusive day-of count Glovox uses internally). Three modes:
//   > 0  → big number + "días para el evento"
//   = 0  → "DÍA DEL EVENTO"
//   < 0  → "Realizado" + formatted event date
//
// Wraps in flex `items-center` so the number and label sit on the same visual
// midline (vertical centering with the home logo on the same row).
async function EventCountdownBanner({
  eventoId,
  scope,
}: {
  eventoId: string;
  scope?: Scope;
}) {
  const kpis = await getEventKpis(eventoId, scope);
  const d = kpis.daysToEvent;

  if (d > 0) {
    const display = d + 1; // matches the KPI card's inclusive count
    return (
      <div className="px-4 py-2 flex items-center gap-2">
        {/* Number kept at the original size; only the label scales up. */}
        <span className="font-display text-3xl leading-none text-black tabular-nums">
          {display}
        </span>
        <span className="font-mono-data font-bold uppercase text-[0.975rem] leading-none text-black">
          {display === 1 ? "día para el evento" : "días para el evento"}
        </span>
      </div>
    );
  }

  if (d === 0) {
    return (
      <div className="px-4 py-2 flex items-center">
        <span className="font-display font-bold uppercase text-[1.625rem] leading-none text-black">
          Día del evento
        </span>
      </div>
    );
  }

  // Past event: show the actual event date (kpis.fechaEvento is "YYYY-MM-DD").
  return (
    <div className="px-4 py-2 flex items-center gap-2">
      <span className="font-mono-data font-bold uppercase text-[0.975rem] leading-none text-black/60">
        Realizado
      </span>
      <span className="font-display font-bold text-[1.625rem] leading-none text-black">
        {kpis.fechaEvento ? formatEventDate(kpis.fechaEvento) : "—"}
      </span>
    </div>
  );
}

async function KpiStrip({ eventoId, scope }: { eventoId: string; scope?: Scope }) {
  const [kpis, followers, community] = await Promise.all([
    getEventKpis(eventoId, scope),
    getFollowersDelta(eventoId, scope),
    getCommunityTicketsCount(eventoId, scope),
  ]);
  const soldPct = kpis.goalTickets > 0 ? Math.round((kpis.totalTickets / kpis.goalTickets) * 100) : 0;
  // Build the Instagram card's "initial → final" progression line. Only shown
  // when the IG window actually has observations (e.g. very short past events
  // can have no rows). Otherwise the card renders just the delta.
  const fmtFollowers = (v: number) => v.toLocaleString("es-CL");
  const followersProgression =
    followers.initial != null && followers.final != null
      ? {
          from: fmtFollowers(followers.initial),
          to: fmtFollowers(followers.final),
        }
      : undefined;
  // Real growth %: relative to the starting follower count. Falls back to
  // `undefined` (which hides the pill) when initial is missing or 0 — we'd
  // be dividing by zero or showing nonsense like "Infinity%".
  const followersPct =
    followers.initial != null && followers.initial > 0
      ? (followers.delta / followers.initial) * 100
      : undefined;

  // Community card: share over the event total, one per unit the card can
  // show. Personas over `totalTickets` (both counted as personas) and revenue
  // over `totalRevenue` (both are Precio - Descuento, service fee excluded).
  const communityPersonasPct =
    kpis.totalTickets > 0
      ? Math.round((community.personas / kpis.totalTickets) * 100)
      : 0;
  const communityRevenuePct =
    kpis.totalRevenue > 0
      ? Math.round((community.revenue / kpis.totalRevenue) * 100)
      : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <BrutalKpiCard
        label="Personas"
        value={kpis.totalTickets}
        suffix={`/${kpis.goalTickets.toLocaleString("es-CL")} (${soldPct}%)`}
      />
      <BrutalKpiCard
        label="Venta Tickets"
        value={kpis.totalRevenue}
        formatType="clp-compact"
        secondary={{
          label: "Cargo Servicio",
          value: fmtClpCompact(kpis.cargoServicio),
        }}
      />
      <BrutalKpiCard label="CPA Total Vendidos" value={kpis.cpa} formatType="usd" />
      <CommunityKpiCard
        personas={community.personas}
        packs={community.packs}
        revenue={community.revenue}
        cargoServicio={fmtClpCompact(community.cargoServicio)}
        personasPct={communityPersonasPct}
        revenuePct={communityRevenuePct}
      />
      <BrutalKpiCard
        label="Instagram Followers Δ"
        value={followers.delta}
        formatType="number"
        delta={followersPct}
        progression={followersProgression}
      />
    </div>
  );
}

async function CumulativeSalesSection({
  eventoId,
  mainNombre,
  mainCategoria,
  compareIds,
  comparableEvents,
  tipoTickets,
  scope,
}: {
  eventoId: string;
  mainNombre: string;
  mainCategoria: string;
  compareIds: string[];
  comparableEvents: EventOption[];
  tipoTickets: string[];
  scope?: Scope;
}) {
  const ids = [eventoId, ...compareIds];
  const [series, kpis, range, tipoOptions] = await Promise.all([
    getCumulativeSalesRelative(ids, scope, tipoTickets),
    getEventKpis(eventoId, scope),
    getTicketDateRange(eventoId, scope),
    // List of available TipoTickets is the union across the visible events
    // (main + active comparators). Computed regardless of the current filter
    // so the user can always change selection.
    getTipoTicketOptions(ids, scope),
  ]);
  const events = [
    { eventoId, nombre: mainNombre },
    ...comparableEvents
      .filter((e) => compareIds.includes(e.eventoId))
      .map((e) => ({ eventoId: e.eventoId, nombre: e.nombre })),
  ];
  let saleStartDaysToEvent: number | undefined;
  if (kpis.fechaEvento && range.startDate) {
    const eventMs = Date.parse(`${kpis.fechaEvento}T00:00:00Z`);
    const startMs = Date.parse(`${range.startDate}T00:00:00Z`);
    if (Number.isFinite(eventMs) && Number.isFinite(startMs)) {
      const diff = Math.round((eventMs - startMs) / 86_400_000);
      if (diff > 0) saleStartDaysToEvent = diff;
    }
  }
  // When a TipoTicket filter is active, hide the target line: `goalTickets`
  // is the event's total goal (not broken down by ticket type), so it would
  // be misleading next to a filtered series.
  const filterActive = tipoTickets.length > 0;
  return (
    <BrutalChartPanel title="Venta Acumulada" className="col-span-3">
      <div className="flex flex-wrap gap-2">
        <CompareEventSelector
          events={comparableEvents.map((e) => ({
            eventoId: e.eventoId,
            nombre: e.nombre,
            fechaEvento: e.fechaEvento,
            categoriaEvento: e.categoriaEvento,
          }))}
          selected={compareIds}
          defaultCategory={mainCategoria}
        />
        <TipoTicketFilter options={tipoOptions} selected={tipoTickets} />
      </div>
      <CumulativeSalesComparisonChart
        series={series}
        mainEventoId={eventoId}
        events={events}
        goalTickets={filterActive ? undefined : kpis.goalTickets}
        saleStartDaysToEvent={filterActive ? undefined : saleStartDaysToEvent}
      />
    </BrutalChartPanel>
  );
}

async function PaidMediaSection({ eventoId, scope }: { eventoId: string; scope?: Scope }) {
  const pm = await getPaidMediaSummary(eventoId, scope);
  return (
    <BrutalHighlightPanel title="Paid Media" className="col-span-1">
      <div className="space-y-4">
        <div>
          <p className="font-mono-data text-xs uppercase">Invertido (USD)</p>
          <p className="font-display text-4xl leading-none">{fmtUsd(pm.totalSpend)}</p>
          {pm.spendByCurrency.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t-2 border-black/20 pt-2">
              {pm.spendByCurrency.map((c) => (
                <li
                  key={c.currency}
                  className="flex items-baseline justify-between font-mono-data text-xs"
                >
                  <span className="uppercase">{c.currency}</span>
                  <span>{fmtAmount(c.currency, c.spend)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {pm.spendByPlatform.length > 0 && (
          <div>
            <p className="font-mono-data text-xs uppercase">Por Plataforma (USD)</p>
            <ul className="mt-1 space-y-0.5">
              {pm.spendByPlatform.map((p) => (
                <li
                  key={p.platform}
                  className="flex items-baseline justify-between font-mono-data text-xs"
                >
                  <span>{platformLabel(p.platform)}</span>
                  <span>{fmtUsd(p.spendUsd)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="font-mono-data text-xs uppercase">Budget</p>
          <p className="font-display text-3xl leading-none">{fmtUsd(pm.budget)}</p>
        </div>
        <div>
          <p className="font-mono-data text-xs uppercase">Ejecucion</p>
          <p className="font-display text-3xl leading-none">{Math.round(pm.execPct)}%</p>
        </div>
        <div>
          <p className="font-mono-data text-xs uppercase">Compras PM Pixel</p>
          <p className="font-display text-3xl leading-none">{pm.purchases.toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="font-mono-data text-xs uppercase">Compras PM Puntoticket</p>
          <p className="font-display text-3xl leading-none">{pm.purchasesPuntoticket.toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="font-mono-data text-xs uppercase">CPA Paid Media</p>
          <p className="font-display text-3xl leading-none">{fmtUsd(pm.cpa)}</p>
          {/* Own boundary: the link waits for the attribution query (shared with the
              section via React.cache) without delaying the rest of the panel. */}
          <Suspense fallback={null}>
            <CompararGa4Link eventoId={eventoId} country={scope?.country ?? null} />
          </Suspense>
        </div>
      </div>
    </BrutalHighlightPanel>
  );
}

// "Compara con GA4 y Referido ↓": only when the event has a GA4 measured window.
async function CompararGa4Link({ eventoId, country }: { eventoId: string; country: Scope["country"] }) {
  const atrib = await getAtribucionCompras(eventoId, country).catch(() => null);
  if (!atrib || !tieneMedicion(atrib)) return null;
  return (
    <a
      href={`#${ANCLA_ATRIBUCION}`}
      className="mt-1 inline-block font-mono-data text-[10px] uppercase underline"
    >
      Compara con GA4 y Referido ↓
    </a>
  );
}

async function SalesOriginSection({ eventoId, scope }: { eventoId: string; scope?: Scope }) {
  const data = await getSalesOrigin(eventoId, scope);
  return (
    <BrutalChartPanel title="Origen de Venta" className="col-span-2">
      <SalesOriginTable data={data} eventoId={eventoId} />
    </BrutalChartPanel>
  );
}

async function FunnelSection({
  eventoId,
  landingPages,
  country,
  ventanaGa4,
}: {
  eventoId: string;
  landingPages: string[];
  country: Scope["country"];
  ventanaGa4: boolean;
}) {
  const filtro = landingPages.length > 0 ? landingPages : undefined;

  // The attribution query (shared with the section above via React.cache) is
  // awaited together with the funnel queries: the toggle then renders in the
  // same pass as the chart and never pushes an already-painted chart down. The
  // default view knows its funnel query up front, so it runs in parallel too.
  const [atrib, availableLandingPages, dataTodo] = await Promise.all([
    getAtribucionCompras(eventoId, country).catch(() => null),
    getFunnelLandingPages(eventoId),
    ventanaGa4 ? Promise.resolve(null) : getFunnelData(eventoId, filtro),
  ]);
  const ventana = atrib ? ventanaMedida(atrib) : null;

  // Default view ("Toda la venta"), or GA4 mode asked for an event without a
  // measured window: exactly the funnel as before. The toggle only shows up when
  // the event has a GA4 measured window; in the second case a note explains why
  // the GA4 mode is not available (the param survives event switches).
  if (!ventanaGa4 || !ventana) {
    const data = dataTodo ?? (await getFunnelData(eventoId, filtro));
    return (
      <BrutalChartPanel title="Funnel" className="col-span-2">
        <FunnelLandingPageFilter
          landingPages={availableLandingPages}
          selected={landingPages}
        />
        {ventana && <FunnelVentanaToggle modo="todo" />}
        {data.length === 0 ? (
          <p className="font-mono-data text-sm text-black/50">
            Sin datos de funnel para este evento.
          </p>
        ) : (
          <FunnelChart data={data} nota={ventanaGa4 ? notaSinVentanaGa4(atrib) : undefined} />
        )}
      </BrutalChartPanel>
    );
  }

  // "Desde medición GA4": steps clipped to the measured window + "Compran".
  const [data, compra] = await Promise.all([
    getFunnelData(eventoId, filtro, ventana),
    // The purchases table has no landingPage: no "Compran" with a landing filter.
    !filtro
      ? getFunnelCompra(eventoId, country, ventana).catch(() => null)
      : Promise.resolve(null),
  ]);
  const steps: FunnelRow[] = compra ? [...data, { ...FUNNEL_PASO_COMPRA, users: compra.users }] : data;

  let nota: string | undefined;
  if (filtro) {
    nota = "El paso Compran no se puede filtrar por landing: se oculta con el filtro activo.";
  } else if (!compra) {
    nota = "No se pudo cargar el paso Compran. Vuelve a cargar la página en unos minutos.";
  } else if (compra.alcance === "propiedad") {
    // Steps 1-4 leave out other events' coded links (/codigo/<otro>/…); Compran
    // cannot (the purchases table has no landing), so it is the whole property.
    nota =
      "Sin landings mapeadas: los pasos cuentan toda la propiedad GA4, salvo los links con código de otro evento, " +
      (compra.otrosEventos.length > 0
        ? `y Compran cuenta todas sus compras (incluye órdenes de ${compra.otrosEventos.join(", ")}).`
        : "y Compran cuenta todas sus compras.");
  }
  const lecturaGa4 =
    `Desde el ${fmtFechaCorta(ventana.desde)}.` +
    (compra
      ? ` Compran = órdenes que GA4 registró con su número de orden (GA4 ve ${fmtPct(pct(atrib!.ordenes.vistas, atrib!.ordenes.medibles))} de las órdenes web del evento).`
      : "");

  return (
    <BrutalChartPanel title="Funnel" className="col-span-2">
      <FunnelLandingPageFilter
        landingPages={availableLandingPages}
        selected={landingPages}
      />
      <FunnelVentanaToggle modo="ga4" />
      {data.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">
          Sin datos de funnel para este evento desde que GA4 mide compras.
        </p>
      ) : (
        <FunnelChart data={steps} nota={nota} lecturaGa4={lecturaGa4} />
      )}
    </BrutalChartPanel>
  );
}

// ?funnelVentana=ga4 on an event without a measured window: why the funnel shows the whole sale.
function notaSinVentanaGa4(atrib: AtribucionCompras | null): string {
  const cola = "el funnel muestra toda la venta.";
  if (!atrib) return `No se pudo cargar la medición GA4: ${cola}`;
  switch (atrib.estado) {
    case "sin_ordenes":
      return `Sin órdenes para este evento: ${cola}`;
    case "sin_propiedad":
      return `Este evento no tiene una propiedad GA4 asignada: ${cola}`;
    case "sin_dias":
      return atrib.ventanaHasta && atrib.medibleDesde && atrib.medibleDesde > atrib.ventanaHasta
        ? `La venta de este evento terminó antes de que GA4 midiera sus compras: ${cola}`
        : `GA4 empieza a medir las compras de este evento el ${fmtFechaCorta(atrib.medibleDesde)}: por ahora ${cola}`;
    default:
      return `GA4 no mide compras con número de orden para este evento: ${cola}`;
  }
}

async function CampaignSection({ eventoId, scope }: { eventoId: string; scope?: Scope }) {
  const [data, kpis] = await Promise.all([
    getCampaignBreakdown(eventoId, scope),
    getEventKpis(eventoId, scope),
  ]);
  return (
    <BrutalChartPanel title="Desglose por Campana" className="col-span-4">
      <CampaignBreakdownChart data={data} fechaEvento={kpis.fechaEvento} />
    </BrutalChartPanel>
  );
}

async function UtmTrafficSection({ eventoId, scope }: { eventoId: string; scope?: Scope }) {
  const [data, timeline] = await Promise.all([
    getUtmTraffic(eventoId, scope),
    getTrafficTimeline(eventoId, scope),
  ]);
  if (data.length === 0) {
    return (
      <BrutalChartPanel title="Tráfico" className="col-span-4">
        <p className="font-mono-data text-sm text-black/50">Sin datos de tráfico UTM para este evento.</p>
      </BrutalChartPanel>
    );
  }
  return (
    <BrutalChartPanel title="Tráfico" className="col-span-4">
      <div className="space-y-6">
        <TrafficTimelineChart data={timeline} />
        <UtmTrafficTable data={data} eventoId={eventoId} />
      </div>
    </BrutalChartPanel>
  );
}
