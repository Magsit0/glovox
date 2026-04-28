import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import {
  getPeruKpis,
  getPeruEventBreakdown,
  getPeruMonthlyEvolution,
  getPeruTopTipoTicket,
  getPeruMedioPago,
  getPeruHourly,
} from "@/lib/queries/peru";
import { KpiCard, SpotlightKpi } from "@/components/peru/KpiCard";
import { Card } from "@/components/peru/Card";
import EventsTable from "@/components/peru/EventsTable";
import MonthlyEvolutionChart from "@/components/peru/charts/MonthlyEvolutionChart";
import EventBreakdownChart from "@/components/peru/charts/EventBreakdownChart";
import TipoTicketChart from "@/components/peru/charts/TipoTicketChart";
import MedioPagoChart from "@/components/peru/charts/MedioPagoChart";
import HourlyChart from "@/components/peru/charts/HourlyChart";
import { fmtPen, fmtPenShort, fmtNumber, fmtPct } from "@/lib/peru-format";

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${i === 0 ? "col-span-3" : "col-span-2"} bg-white border border-[#E5E5E5] rounded-lg p-6 animate-pulse`}>
          <div className="h-3 bg-[#F0F0F0] rounded w-1/2 mb-4" />
          <div className="h-9 bg-[#F0F0F0] rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white border border-[#E5E5E5] rounded-lg p-6 animate-pulse ${className}`}>
      <div className="h-4 bg-[#F0F0F0] rounded w-1/3 mb-6" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[#F0F0F0] rounded-t-sm"
            style={{ height: `${40 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default async function PeruPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] px-8 py-10">
      {/* Back */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-sans text-sm text-[#666666] hover:text-[#333333] transition-colors"
        >
          <ArrowLeft size={16} />
          Volver al menú
        </Link>
      </div>

      {/* Page Header */}
      <header className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={16} className="text-[#9F99F8]" />
            <span className="font-sans text-xs text-[#999999] uppercase tracking-wide">
              Glovox Perú · TeleTicket
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#333333] tracking-tight">
            Dashboard Perú
          </h1>
          <p className="font-sans text-sm text-[#666666] mt-1">
            Ticketing en Perú vía TeleTicket — ventas, cortesías y revenue en S/
          </p>
        </div>
      </header>

      {/* KPI Strip */}
      <Suspense fallback={<KpiSkeleton />}>
        <KpiStrip />
      </Suspense>

      {/* Monthly Evolution */}
      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton className="col-span-12" />}>
          <MonthlySection />
        </Suspense>
      </div>

      {/* Events Breakdown + Medios de Pago */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <Suspense fallback={<ChartSkeleton className="col-span-8" />}>
          <EventBreakdownSection />
        </Suspense>
        <Suspense fallback={<ChartSkeleton className="col-span-4" />}>
          <MedioPagoSection />
        </Suspense>
      </div>

      {/* Tipo Ticket + Horario de compra */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <Suspense fallback={<ChartSkeleton className="col-span-6" />}>
          <TipoTicketSection />
        </Suspense>
        <Suspense fallback={<ChartSkeleton className="col-span-6" />}>
          <HourlySection />
        </Suspense>
      </div>

      {/* Events Table */}
      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton />}>
          <EventsTableSection />
        </Suspense>
      </div>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

async function KpiStrip() {
  const kpis = await getPeruKpis();
  const totalTickets = kpis.totalSold + kpis.totalCortesias;
  const ventaPct = totalTickets > 0 ? (kpis.totalSold / totalTickets) * 100 : 0;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Spotlight — max 1 per view */}
      <div className="col-span-3">
        <SpotlightKpi
          label="Revenue total (S/)"
          value={fmtPenShort(kpis.totalRevenue)}
          caption={`${kpis.events} eventos · precio prom. ${fmtPen(kpis.avgPrice, 2)}`}
        />
      </div>

      <div className="col-span-9 grid grid-cols-4 gap-6">
        <KpiCard
          label="Tickets vendidos"
          value={fmtNumber(kpis.totalSold)}
          delta={`${fmtPct(ventaPct)} del total`}
          deltaTone="positive"
        />
        <KpiCard
          label="Cortesías"
          value={fmtNumber(kpis.totalCortesias)}
          caption={`de ${fmtNumber(totalTickets)} tickets totales`}
        />
        <KpiCard
          label="Eventos"
          value={String(kpis.events)}
          caption="vía TeleTicket"
        />
        <KpiCard
          label="Ticket promedio"
          value={fmtPen(kpis.avgPrice, 2)}
          caption="ventas pagadas"
        />
      </div>
    </div>
  );
}

async function MonthlySection() {
  const data = await getPeruMonthlyEvolution();
  return (
    <Card
      title="Evolución mensual"
      subtitle="Ventas y cortesías por mes de compra, con línea de revenue"
    >
      <MonthlyEvolutionChart data={data} />
    </Card>
  );
}

async function EventBreakdownSection() {
  const data = await getPeruEventBreakdown();
  return (
    <Card
      title="Desglose por evento"
      subtitle="Ventas vs cortesías por evento, en orden cronológico"
      className="col-span-8"
    >
      <EventBreakdownChart data={data} />
    </Card>
  );
}

async function MedioPagoSection() {
  const data = await getPeruMedioPago();
  return (
    <Card
      title="Medios de pago"
      subtitle="Distribución de tickets vendidos"
      className="col-span-4"
    >
      <MedioPagoChart data={data} />
    </Card>
  );
}

async function TipoTicketSection() {
  const data = await getPeruTopTipoTicket(8);
  return (
    <Card
      title="Top tipos de ticket"
      subtitle="Los 8 tipos de ticket más comprados"
      className="col-span-6"
    >
      <TipoTicketChart data={data} />
    </Card>
  );
}

async function HourlySection() {
  const data = await getPeruHourly();
  const peak = [...data].sort((a, b) => b.ventas - a.ventas)[0];
  const peakLabel = peak ? `Pico: ${String(peak.hour).padStart(2, "0")}:00 (${fmtNumber(peak.ventas)} tickets)` : undefined;
  return (
    <Card
      title="Horario de compra"
      subtitle={peakLabel ?? "Distribución por hora del día — hora Lima (UTC-5)"}
      className="col-span-6"
    >
      <HourlyChart data={data} />
    </Card>
  );
}

async function EventsTableSection() {
  const data = await getPeruEventBreakdown();
  return (
    <section>
      <h2 className="font-display font-bold text-xl text-[#333333] mb-4">
        Todos los eventos
      </h2>
      <EventsTable data={data} />
    </section>
  );
}
