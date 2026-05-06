import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getFreesDashboardData,
  getFreesEventList,
} from "@/lib/queries/frees";
import { FreesDashboard } from "@/components/frees/FreesDashboard";

export const metadata: Metadata = {
  title: "Free's · Glovox",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function FreesContent({ eventoId }: { eventoId: string }) {
  const [events, data] = await Promise.all([
    getFreesEventList(),
    getFreesDashboardData(eventoId || undefined),
  ]);
  const validEvent = eventoId && events.some((e) => e.eventoId === eventoId)
    ? eventoId
    : "";
  return (
    <FreesDashboard data={data} events={events} selectedEvent={validEvent} />
  );
}

function FreesSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-3">
        <div className="h-5 w-24 animate-pulse rounded-full bg-[#F0F0F0]" />
        <div className="h-9 w-40 animate-pulse rounded-lg bg-[#F0F0F0]" />
        <div className="h-4 w-96 animate-pulse rounded-lg bg-[#F0F0F0]" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-lg border border-[#E5E5E5] bg-white"
          />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-[#F0F0F0]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-96 animate-pulse rounded-lg border border-[#E5E5E5] bg-white lg:col-span-8" />
        <div className="h-96 animate-pulse rounded-lg border border-[#E5E5E5] bg-white lg:col-span-4" />
        <div className="h-80 animate-pulse rounded-lg border border-[#E5E5E5] bg-white lg:col-span-12" />
      </div>
    </div>
  );
}

export default async function FreesPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const params = await searchParams;
  const eventoId = params.event ?? "";
  return (
    <main id="main-content" className="min-h-screen bg-[#FAFAFA]">
      <Suspense key={eventoId} fallback={<FreesSkeleton />}>
        <FreesContent eventoId={eventoId} />
      </Suspense>
    </main>
  );
}
