import type { Metadata } from "next";
import { Suspense } from "react";
import { getMonthlyEarningsByCountry } from "@/lib/queries/comunidad";
import { getMpMonthlyEarnings } from "@/lib/mercadopago";
import EarningsChart from "@/components/charts/EarningsChart";
import Skeleton from "@/components/Skeleton";

export const metadata: Metadata = {
  title: "Venta Tecnología por Mes",
};

async function getPenToClpRate(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/PEN", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`FX API ${res.status}`);
    const json = await res.json();
    return json.rates?.CLP ?? 100;
  } catch {
    return 100;
  }
}

async function EarningsSection() {
  const [data, mpData, penToClp] = await Promise.all([
    getMonthlyEarningsByCountry(),
    getMpMonthlyEarnings(),
    getPenToClpRate(),
  ]);
  return <EarningsChart data={data} mpData={mpData} initialRate={penToClp} />;
}

export default async function EarningsPage() {
  return (
    <main id="main-content" className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-5 flex flex-wrap items-baseline gap-3">
          <h1 className="text-base font-semibold text-zinc-100">
            Venta Tecnología por Mes — desde 2025
          </h1>
          <span className="text-xs text-zinc-500">
            Incluye tickets devueltos · Chile (GLO%) y Perú (GLP%)
          </span>
        </div>
        <Suspense fallback={<Skeleton height={560} />}>
          <EarningsSection />
        </Suspense>
      </div>
    </main>
  );
}
