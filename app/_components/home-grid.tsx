"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Users, Database, Megaphone, HeartHandshake, Ticket, Gift } from "lucide-react";

const ICONS = { users: Users, database: Database, megaphone: Megaphone, heart: HeartHandshake, ticket: Ticket, gift: Gift } as const;
export type IconKey = keyof typeof ICONS;

export type HomeSection = {
  title: string;
  description: string;
  href: string;
  icon: IconKey;
  accent: string;
  accentText: string;
};

export function HomeGrid({ sections }: { sections: HomeSection[] }) {
  const MAX_COLS = 4;
  const numRows = Math.max(1, Math.ceil(sections.length / MAX_COLS));
  const cols = Math.max(1, Math.ceil(sections.length / numRows));
  const lgGridCols: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  };

  return (
    <div className={`mt-16 grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 ${lgGridCols[cols] ?? "lg:grid-cols-4"}`}>
      {sections.map((section, i) => {
        const Icon = ICONS[section.icon];
        return (
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
                  <Icon size={24} className={section.accentText} strokeWidth={2.5} />
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
        );
      })}
    </div>
  );
}

export function HomeHeader() {
  return (
    <>
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
    </>
  );
}
