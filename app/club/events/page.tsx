import type { Metadata } from "next";
import { Suspense } from "react";
import { getEventSales } from "@/lib/queries/comunidad";
import EventSalesChart from "@/components/charts/EventSalesChart";
import Skeleton from "@/components/Skeleton";

export const metadata: Metadata = {
  title: "Eventos — Glovox Data",
};

async function EventsSection() {
  const data = await getEventSales();
  return <EventSalesChart data={data} />;
}

export default async function EventsPage() {
  return (
    <main id="main-content" className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex flex-wrap items-baseline gap-3">
          <h1 className="text-base font-semibold text-zinc-100">
            Ventas Comunidad por Evento
          </h1>
          <span className="text-xs text-zinc-500">
            Tickets y revenue atribuidos a códigos FF · todos los tiempos
          </span>
        </div>
        <Suspense fallback={<Skeleton height={640} />}>
          <EventsSection />
        </Suspense>
      </div>
    </main>
  );
}
