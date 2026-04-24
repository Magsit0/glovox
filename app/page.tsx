"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Users, Database, Megaphone, HeartHandshake, Ticket, Gift } from "lucide-react";

const sections = [
  {
    title: "CLUB GLOVOX",
    description: "Community sales, seller analytics, event performance, and earnings dashboards.",
    href: "/club",
    icon: Users,
    accent: "bg-[#0000FF]",
    accentText: "text-white",
  },
  {
    title: "MARKETING",
    description: "Weekly marketing meeting dashboard — paid media, sales origin, club referrals, and campaign performance.",
    href: "/marketing/weekly",
    icon: Megaphone,
    accent: "bg-[#FFFF00]",
    accentText: "text-black",
  },
  {
    title: "UNABASE",
    description: "Monthly closing reports and financial summaries.",
    href: "/unabase/cierre-mensual",
    icon: Database,
    accent: "bg-[#FF0000]",
    accentText: "text-white",
  },
  {
    title: "DONATIONS",
    description: "Mercado Pago donation income — cortesías and Yoga totals.",
    href: "/donations",
    icon: HeartHandshake,
    accent: "bg-black",
    accentText: "text-[#FFFF00]",
  },
  {
    title: "ONEPAGER",
    description: "Tickets and FF&BB sales overview.",
    href: "/onepager",
    icon: Ticket,
    accent: "bg-[#FF0000]",
    accentText: "text-[#FFFF00]",
  },
  {
    title: "FREE'S",
    description: "Free entries given out.",
    href: "/frees",
    icon: Gift,
    accent: "bg-[#00FF00]",
    accentText: "text-black",
  }
];

const MAX_COLS = 4;
const numRows = Math.ceil(sections.length / MAX_COLS);
const cols = Math.ceil(sections.length / numRows);
const lgGridCols: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="font-display text-7xl font-black uppercase leading-none tracking-tight text-black sm:text-8xl md:text-9xl"
      >
        DATA GLOVOX
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="mt-4 font-mono-data text-xs uppercase tracking-widest text-black"
      >
        Internal Data Dashboards
      </motion.p>

      <div className={`mt-16 grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 ${lgGridCols[cols] ?? "lg:grid-cols-4"}`}>
        {sections.map((section, i) => (
          <motion.div
            key={section.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 + i * 0.08 }}
            className="h-full"
          >
            <Link
              href={section.href}
              className="group flex h-full flex-col border-4 border-black bg-white p-6 shadow-[4px_4px_0px_#000000] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#000000]"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className={`inline-flex shrink-0 items-center justify-center border-2 border-black p-3 ${section.accent}`}>
                  <section.icon size={24} className={section.accentText} strokeWidth={2.5} />
                </div>
                <h2 className="min-w-0 font-display text-xl font-black uppercase leading-none tracking-tight text-black sm:text-2xl">
                  {section.title}
                </h2>
              </div>

              <p className="mt-3 grow text-justify font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black">
                {section.description}
              </p>

              <div className="mt-5 inline-block border-2 border-black bg-[#FFFF00] px-4 py-2 font-mono-data text-xs font-bold uppercase text-black transition-colors group-hover:bg-black group-hover:text-[#FFFF00]">
                Open Dashboard
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
