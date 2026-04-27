import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDonationTotals, getJardinBoskoProject, type DonationBucket } from "@/lib/queries/donations";
import DonationProjectCard from "@/components/DonationProjectCard";

export const metadata: Metadata = {
  title: "Donations",
};

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type Accent = "blue" | "red" | "yellow";

function KpiCard({
  label,
  bucket,
  accent,
  badgeText,
}: {
  label: string;
  bucket: DonationBucket;
  accent: Accent;
  badgeText?: string;
}) {
  const isHighlight = accent === "yellow";
  const cardBg = isHighlight ? "bg-[#FFFF00]" : "bg-white";
  const badgeBg =
    accent === "blue"
      ? "bg-[#0000FF] text-white"
      : accent === "red"
        ? "bg-[#FF0000] text-white"
        : "bg-black text-[#FFFF00]";

  return (
    <div
      className={`${cardBg} flex flex-col gap-6 border-4 border-black p-6 shadow-[4px_4px_0px_#000000] rounded-none`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-xs font-bold uppercase text-black">
          {label}
        </span>
        <span
          className={`${badgeBg} font-mono-data text-xs px-2 py-1 rounded-none`}
        >
          {badgeText ?? `${bucket.count} PAGOS`}
        </span>
      </div>
      <div className="font-display text-5xl font-black uppercase leading-none tracking-tight text-black sm:text-6xl">
        {clpFormatter.format(bucket.amount)}
      </div>
    </div>
  );
}

async function DonationsSection() {
  const totals = await getDonationTotals();
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <KpiCard label="Cortesías" bucket={totals.cortesias} accent="blue" />
      <KpiCard label="Yoga" bucket={totals.yoga} accent="red" badgeText="HARDCODED" />
      <KpiCard label="Total Donaciones" bucket={totals.total} accent="yellow" />
    </section>
  );
}

function LoadingGrid() {
  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 border-4 border-black bg-white shadow-[4px_4px_0px_#000000] rounded-none"
        />
      ))}
    </section>
  );
}

function LoadingProject() {
  return (
    <div className="mt-12 h-96 bg-white border border-[#E5E5E5] rounded-lg">
      <div className="p-6 space-y-4">
        <div className="h-6 w-40 bg-[#F0F0F0] rounded-lg" />
        <div className="h-4 w-64 bg-[#F0F0F0] rounded-lg" />
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-[#F0F0F0] rounded-lg" />
          ))}
        </div>
        <div className="h-2 w-full bg-[#F0F0F0] rounded-full mt-4" />
      </div>
    </div>
  );
}

async function BoskoSection() {
  const project = await getJardinBoskoProject();
  return (
    <section className="mt-12">
      <h2 className="font-display font-bold text-xl text-[#333333] mb-6 border-b border-[#E5E5E5] pb-4">
        Proyectos
      </h2>
      <DonationProjectCard project={project} />
    </section>
  );
}

export default function DonationsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-white p-6">
      <header className="mb-8 flex items-end justify-between border-b-4 border-black pb-6">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2 border-2 border-black bg-white px-3 py-1 font-mono-data text-xs font-bold uppercase text-black transition-colors hover:bg-[#FFFF00]"
          >
            <ArrowLeft size={14} strokeWidth={3} />
            Back
          </Link>
          <h1 className="font-display text-6xl font-black uppercase leading-none tracking-tight text-black sm:text-7xl">
            Donations
          </h1>
          <p className="mt-2 font-mono-data text-xs uppercase tracking-widest text-black">
            Mercado Pago · Desde 2025-01-01
          </p>
        </div>
      </header>

      <Suspense fallback={<LoadingGrid />}>
        <DonationsSection />
      </Suspense>

      <Suspense fallback={<LoadingProject />}>
        <BoskoSection />
      </Suspense>
    </main>
  );
}
