import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getEventList,
  getUpcomingEvents,
  getEventKpis,
  getCumulativeSales,
  getPaidMediaSummary,
  getSalesOrigin,
  getFollowersDelta,
  getFunnelData,
  getCampaignBreakdown,
  getUtmTraffic,
} from "@/lib/queries/marketing";
import EventSelector from "@/components/marketing/EventSelector";
import BrutalKpiCard from "@/components/marketing/BrutalKpiCard";
import BrutalChartPanel from "@/components/marketing/BrutalChartPanel";
import BrutalHighlightPanel from "@/components/marketing/BrutalHighlightPanel";
import CumulativeSalesChart from "@/components/marketing/charts/CumulativeSalesChart";
import SalesOriginTable from "@/components/marketing/charts/SalesOriginTable";
import FunnelChart from "@/components/marketing/charts/FunnelChart";
import CampaignBreakdownChart from "@/components/marketing/charts/CampaignBreakdownChart";
import UtmTrafficTable from "@/components/marketing/charts/UtmTrafficTable";

const fmtUsd = (v: number) => "US$" + v.toFixed(1);

function Skeleton() {
  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-6 animate-pulse">
      <div className="h-6 bg-black/10 rounded-none w-1/3 mb-4" />
      <div className="h-40 bg-black/5 rounded-none" />
    </div>
  );
}

export default async function MarketingWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const params = await searchParams;
  const [events, upcomingEvents] = await Promise.all([
    getEventList(),
    getUpcomingEvents(),
  ]);

  if (events.length === 0) {
    return (
      <div className="bg-white text-black min-h-full p-6">
        <p className="font-mono-data text-sm">No hay eventos disponibles.</p>
      </div>
    );
  }

  const selectedId = params.event ?? "GLO198";

  return (
    <div className="bg-white text-black min-h-full">
      <EventSelector
        events={events}
        selected={selectedId}
        upcomingEvents={upcomingEvents}
      />

      <div className="p-6 space-y-6">
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

        {/* KPI Strip */}
        <Suspense fallback={<div className="grid grid-cols-4 gap-4"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div>}>
          <KpiStrip eventoId={selectedId} />
        </Suspense>

        {/* Row: Cumulative Sales + Paid Media */}
        <div className="grid grid-cols-4 gap-6">
          <Suspense fallback={<Skeleton />}>
            <CumulativeSalesSection eventoId={selectedId} />
          </Suspense>
          <Suspense fallback={<Skeleton />}>
            <PaidMediaSection eventoId={selectedId} />
          </Suspense>
        </div>

        {/* Row: Sales Origin + Funnel */}
        <div className="grid grid-cols-4 gap-6">
          <Suspense fallback={<Skeleton />}>
            <SalesOriginSection eventoId={selectedId} />
          </Suspense>
          <Suspense fallback={<Skeleton />}>
            <FunnelSection eventoId={selectedId} />
          </Suspense>
        </div>

        {/* Row: Campaign Breakdown */}
        <Suspense fallback={<Skeleton />}>
          <CampaignSection eventoId={selectedId} />
        </Suspense>

        {/* Row: UTM Traffic */}
        <Suspense fallback={<Skeleton />}>
          <UtmTrafficSection eventoId={selectedId} />
        </Suspense>
      </div>
    </div>
  );
}

// ---------- Section components ----------

async function KpiStrip({ eventoId }: { eventoId: string }) {
  const [kpis, followersDelta, pm] = await Promise.all([
    getEventKpis(eventoId),
    getFollowersDelta(eventoId),
    getPaidMediaSummary(eventoId),
  ]);
  const soldPct = kpis.goalTickets > 0 ? Math.round((kpis.totalTickets / kpis.goalTickets) * 100) : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <BrutalKpiCard
        label="Tickets Vendidos"
        value={kpis.totalTickets}
        suffix={`/${kpis.goalTickets.toLocaleString("es-CL")} (${soldPct}%)`}
      />
      <BrutalKpiCard label="Días para el Evento" value={kpis.daysToEvent + 1} formatType="integer" />
      <BrutalKpiCard label="CPA Total Vendidos" value={kpis.cpa} formatType="usd" />
      <BrutalKpiCard label="CPA Paid Media" value={pm.cpa} formatType="usd" />
      <BrutalKpiCard label="Instagram Followers Δ" value={followersDelta} formatType="number" delta={followersDelta > 0 ? 1 : followersDelta < 0 ? -1 : 0} />
    </div>
  );
}

async function CumulativeSalesSection({ eventoId }: { eventoId: string }) {
  const [sales, kpis] = await Promise.all([
    getCumulativeSales(eventoId),
    getEventKpis(eventoId),
  ]);
  return (
    <BrutalChartPanel title="Venta Acumulada" className="col-span-3">
      <CumulativeSalesChart data={sales} goalTickets={kpis.goalTickets} fechaEvento={kpis.fechaEvento} />
    </BrutalChartPanel>
  );
}

async function PaidMediaSection({ eventoId }: { eventoId: string }) {
  const pm = await getPaidMediaSummary(eventoId);
  return (
    <BrutalHighlightPanel title="Paid Media" className="col-span-1">
      <div className="space-y-4">
        <div>
          <p className="font-mono-data text-xs uppercase">Invertido</p>
          <p className="font-display text-4xl leading-none">{fmtUsd(pm.totalSpend)}</p>
        </div>
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

async function SalesOriginSection({ eventoId }: { eventoId: string }) {
  const data = await getSalesOrigin(eventoId);
  return (
    <BrutalChartPanel title="Origen de Venta" className="col-span-2">
      <SalesOriginTable data={data} />
    </BrutalChartPanel>
  );
}

async function FunnelSection({ eventoId }: { eventoId: string }) {
  const data = await getFunnelData(eventoId);
  if (data.length === 0) {
    return (
      <BrutalChartPanel title="Funnel" className="col-span-2">
        <p className="font-mono-data text-sm text-black/50">Sin datos de funnel para este evento.</p>
      </BrutalChartPanel>
    );
  }
  return (
    <BrutalChartPanel title="Funnel" className="col-span-2">
      <FunnelChart data={data} />
    </BrutalChartPanel>
  );
}

async function CampaignSection({ eventoId }: { eventoId: string }) {
  const [data, kpis] = await Promise.all([
    getCampaignBreakdown(eventoId),
    getEventKpis(eventoId),
  ]);
  return (
    <BrutalChartPanel title="Desglose por Campana" className="col-span-4">
      <CampaignBreakdownChart data={data} fechaEvento={kpis.fechaEvento} />
    </BrutalChartPanel>
  );
}

async function UtmTrafficSection({ eventoId }: { eventoId: string }) {
  const data = await getUtmTraffic(eventoId);
  if (data.length === 0) {
    return (
      <BrutalChartPanel title="Tráfico" className="col-span-4">
        <p className="font-mono-data text-sm text-black/50">Sin datos de tráfico UTM para este evento.</p>
      </BrutalChartPanel>
    );
  }
  return (
    <BrutalChartPanel title="Tráfico" className="col-span-4">
      <UtmTrafficTable data={data} />
    </BrutalChartPanel>
  );
}
