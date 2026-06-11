import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
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
  type EventOption,
  type Scope,
} from "@/lib/queries/marketing";
import EventSelector from "@/components/marketing/EventSelector";
import CompareEventSelector from "@/components/marketing/CompareEventSelector";
import TipoTicketFilter from "@/components/marketing/TipoTicketFilter";
import BrutalKpiCard from "@/components/marketing/BrutalKpiCard";
import BrutalChartPanel from "@/components/marketing/BrutalChartPanel";
import BrutalHighlightPanel from "@/components/marketing/BrutalHighlightPanel";
import CumulativeSalesComparisonChart from "@/components/marketing/charts/CumulativeSalesComparisonChart";
import SalesOriginTable from "@/components/marketing/charts/SalesOriginTable";
import FunnelChart from "@/components/marketing/charts/FunnelChart";
import FunnelLandingPageFilter from "@/components/marketing/FunnelLandingPageFilter";
import CampaignBreakdownChart from "@/components/marketing/charts/CampaignBreakdownChart";
import UtmTrafficTable from "@/components/marketing/charts/UtmTrafficTable";
import TrafficTimelineChart from "@/components/marketing/charts/TrafficTimelineChart";

const fmtUsd = (v: number) => "US$" + v.toFixed(1);
// CLP compact formatter, matching BrutalKpiCard's "clp-compact" style.
// Reused for KPI secondary lines so the styling stays consistent.
const compactClpFmt = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});
const fmtClpCompact = (v: number) => "$" + compactClpFmt.format(Math.round(v));
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

  return (
    <div className="bg-white text-black min-h-full">
      <EventSelector
        events={events}
        selected={selectedId}
        upcomingEvents={upcomingEvents}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            aria-label="Volver al menú principal"
            className="inline-flex items-center justify-center border-4 border-black bg-white p-1.5 shadow-[4px_4px_0px_#000] transition-colors hover:bg-[#FFFF00]"
          >
            <Image
              src="/glovox_logo_gvx_black.svg"
              alt="Glovox"
              width={24}
              height={24}
              priority
            />
          </Link>
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

        {/* Row: Sales Origin + Funnel */}
        <div className="grid grid-cols-4 gap-6">
          <Suspense fallback={<Skeleton />}>
            <SalesOriginSection eventoId={selectedId} scope={scope} />
          </Suspense>
          <Suspense key={`funnel-${selectedId}-${selectedLandingPages.join("|")}`} fallback={<Skeleton />}>
            <FunnelSection eventoId={selectedId} landingPages={selectedLandingPages} />
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
  const [kpis, followers, pm, community] = await Promise.all([
    getEventKpis(eventoId, scope),
    getFollowersDelta(eventoId, scope),
    getPaidMediaSummary(eventoId, scope),
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

  // Community card: % over total tickets (both already counted as personas),
  // and an inline "(N packs)" annotation when the event actually has FBM
  // packs in the community subset.
  const communityPct =
    kpis.totalTickets > 0
      ? Math.round((community.personas / kpis.totalTickets) * 100)
      : 0;
  const communityInline =
    community.packs > 0
      ? `(${community.packs.toLocaleString("es-CL")} pack${community.packs === 1 ? "" : "s"})`
      : undefined;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <BrutalKpiCard
        label="Tickets Vendidos"
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
      <BrutalKpiCard
        label="Comunidad"
        value={community.personas}
        formatType="number"
        inlineSuffix={communityInline}
        secondary={{ label: "Del total", value: `${communityPct}%` }}
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
        </div>
      </div>
    </BrutalHighlightPanel>
  );
}

async function SalesOriginSection({ eventoId, scope }: { eventoId: string; scope?: Scope }) {
  const data = await getSalesOrigin(eventoId, scope);
  return (
    <BrutalChartPanel title="Origen de Venta" className="col-span-2">
      <SalesOriginTable data={data} />
    </BrutalChartPanel>
  );
}

async function FunnelSection({
  eventoId,
  landingPages,
}: {
  eventoId: string;
  landingPages: string[];
}) {
  const [data, availableLandingPages] = await Promise.all([
    getFunnelData(eventoId, landingPages.length > 0 ? landingPages : undefined),
    getFunnelLandingPages(eventoId),
  ]);
  return (
    <BrutalChartPanel title="Funnel" className="col-span-2">
      <FunnelLandingPageFilter
        landingPages={availableLandingPages}
        selected={landingPages}
      />
      {data.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">
          Sin datos de funnel para este evento.
        </p>
      ) : (
        <FunnelChart data={data} />
      )}
    </BrutalChartPanel>
  );
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
        <UtmTrafficTable data={data} />
      </div>
    </BrutalChartPanel>
  );
}
