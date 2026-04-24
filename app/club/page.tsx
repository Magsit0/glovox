import { Suspense } from "react";
import Skeleton from "@/components/Skeleton";
import KpiCard from "@/components/KpiCard";
import TopSellersTable from "@/components/TopSellersTable";
import DormantSellersTable from "@/components/DormantSellersTable";
import {
  getKpis,
  getMonthlySales,
  getTopEvents,
  getActivationFunnel,
  getMonthlyNewSellers,
  getEnrichedTopSellers,
  getDormantSellers,
} from "@/lib/queries/comunidad";
import type { Country } from "@/lib/queries/comunidad";
import MonthlyEvolutionChart from "@/components/charts/MonthlyEvolutionChart";
import TopEventsChart from "@/components/charts/TopEventsChart";
import NewSellersChart from "@/components/charts/NewSellersChart";
import CountryFilter from "@/components/CountryFilter";

function fmClp(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function pct(a: number, b: number) {
  return b === 0 ? "0%" : `${((a / b) * 100).toFixed(1)}%`;
}

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-200">{title}</h2>
      {children}
    </div>
  );
}

// ─── KPI strip ───────────────────────────────────────────────────────────────

async function KpiStrip({ country }: { country: Country }) {
  const kpi = await getKpis(country);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      <KpiCard label="Total Revenue" value={fmClp(kpi.total_revenue)} sub="CLP, non-returned" />
      <KpiCard label="Tickets Sold" value={kpi.total_tickets.toLocaleString("es-CL")} />
      <KpiCard label="Unique Sellers" value={kpi.total_referrers.toLocaleString("es-CL")} sub="FF codes active" />
      <KpiCard label="Total Orders" value={kpi.total_orders.toLocaleString("es-CL")} />
      <KpiCard label="Avg Ticket Price" value={fmClp(Math.round(kpi.avg_price))} sub="CLP" />
    </div>
  );
}

// ─── Activation funnel ───────────────────────────────────────────────────────

async function ActivationFunnel({ country }: { country: Country }) {
  const f = await getActivationFunnel(country);
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-semibold text-zinc-200">Community Activation Funnel</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Members" value={f.total_members.toLocaleString("es-CL")} />
        <KpiCard
          label="Ever Sold"
          value={f.ever_sold.toLocaleString("es-CL")}
          sub={`${pct(f.ever_sold, f.total_members)} of members`}
          accent="text-indigo-400"
        />
        <KpiCard
          label="Active Last 90d"
          value={f.sold_last_90d.toLocaleString("es-CL")}
          sub={`${pct(f.sold_last_90d, f.ever_sold)} of sellers`}
          accent="text-emerald-400"
        />
        <KpiCard
          label="Never Activated"
          value={f.never_sold.toLocaleString("es-CL")}
          sub={`${pct(f.never_sold, f.total_members)} untapped`}
          accent="text-amber-400"
        />
      </div>
    </div>
  );
}

// ─── Monthly charts ──────────────────────────────────────────────────────────

async function MonthlySection({ country }: { country: Country }) {
  const data = await getMonthlySales(country);
  return (
    <ChartShell title="Monthly Sales Evolution — Revenue · Tickets · Active Referrers">
      <MonthlyEvolutionChart data={data} />
    </ChartShell>
  );
}

async function NewSellersSection({ country }: { country: Country }) {
  const data = await getMonthlyNewSellers(country);
  return (
    <ChartShell title="New Sellers per Month — First-time FF activations">
      <NewSellersChart data={data} />
    </ChartShell>
  );
}

// ─── Top sellers table ───────────────────────────────────────────────────────

async function TopSellersSection({ country }: { country: Country }) {
  const data = await getEnrichedTopSellers(country);
  return (
    <ChartShell title="Top 25 Sellers">
      <TopSellersTable data={data} />
    </ChartShell>
  );
}

// ─── Dormant sellers ─────────────────────────────────────────────────────────

async function DormantSellersSection({ country }: { country: Country }) {
  const data = await getDormantSellers(country);
  return (
    <ChartShell title="Dormant Sellers — sold before, silent for 90+ days">
      <DormantSellersTable data={data} />
    </ChartShell>
  );
}

// ─── Top events ───────────────────────────────────────────────────────────────

async function TopEventsSection({ country }: { country: Country }) {
  const data = await getTopEvents(country);
  return (
    <ChartShell title="Top 10 Events by Community Revenue">
      <TopEventsChart data={data} />
    </ChartShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClubDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const params = await searchParams;
  const country: Country =
    params.country === "chile" || params.country === "peru"
      ? params.country
      : "all";

  return (
    <main id="main-content" className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8">

      <CountryFilter active={country} />

      <Suspense fallback={<Skeleton height={96} />}>
        <KpiStrip country={country} />
      </Suspense>

      <Suspense fallback={<Skeleton height={96} />}>
        <ActivationFunnel country={country} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartShell title="Monthly Sales Evolution"><Skeleton /></ChartShell>}>
            <MonthlySection country={country} />
          </Suspense>
        </div>
        <Suspense fallback={<ChartShell title="New Sellers per Month"><Skeleton height={200} /></ChartShell>}>
          <NewSellersSection country={country} />
        </Suspense>
      </div>

      <Suspense fallback={<ChartShell title="Top 25 Sellers"><Skeleton height={480} /></ChartShell>}>
        <TopSellersSection country={country} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-2">
        <Suspense fallback={<ChartShell title="Dormant Sellers"><Skeleton height={400} /></ChartShell>}>
          <DormantSellersSection country={country} />
        </Suspense>
        <Suspense fallback={<ChartShell title="Top 10 Events"><Skeleton height={360} /></ChartShell>}>
          <TopEventsSection country={country} />
        </Suspense>
      </div>

    </main>
  );
}
