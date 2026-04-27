"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Database,
  Megaphone,
  HeartHandshake,
  Ticket,
  Gift,
  Lock,
  AlertCircle,
  X,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  database: Database,
  megaphone: Megaphone,
  heart: HeartHandshake,
  ticket: Ticket,
  gift: Gift,
};

interface Section {
  title: string;
  description: string;
  href: string;
  accentClass: string;
  accentText: string;
  icon: string;
}

interface HomeDashboardsProps {
  sections: Section[];
}

const MAX_COLS = 4;

export default function HomeDashboards({ sections }: HomeDashboardsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("unauthorized") === "1") {
      setShowBanner(true);
      // Clean the URL without re-rendering
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  const numRows =
    sections.length > 0 ? Math.ceil(sections.length / MAX_COLS) : 1;
  const cols =
    sections.length > 0 ? Math.ceil(sections.length / numRows) : 1;
  const lgGridCols: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16">
      {/* Unauthorized banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-3 border-4 border-black bg-[#FFFF00] px-5 py-3 shadow-[4px_4px_0px_#000000]"
          >
            <AlertCircle
              size={18}
              strokeWidth={2.5}
              className="shrink-0 text-black"
            />
            <span className="font-mono-data text-xs font-bold uppercase tracking-wide text-black">
              No tienes acceso a ese dashboard
            </span>
            <button
              onClick={() => setShowBanner(false)}
              aria-label="Cerrar aviso"
              className="ml-2 shrink-0 text-black hover:opacity-60"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
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

      {/* Dashboard grid or empty state */}
      {sections.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="mt-16 flex max-w-md flex-col items-center gap-6 border-4 border-black bg-white p-10 text-center shadow-[6px_6px_0px_#000000]"
        >
          <div className="inline-flex items-center justify-center border-2 border-black bg-black p-4">
            <Lock size={32} className="text-[#FFFF00]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display text-xl font-black uppercase tracking-tight text-black">
              Sin acceso a dashboards
            </p>
            <p className="mt-3 font-mono-data text-xs uppercase leading-relaxed tracking-wide text-black">
              Consigue un permiso escribiendo a{" "}
              <a
                href="mailto:maximiliano@glovox.cl"
                className="underline decoration-2 underline-offset-2 hover:opacity-60"
              >
                maximiliano@glovox.cl
              </a>{" "}
              para ver dashboards.
            </p>
          </div>
        </motion.div>
      ) : (
        <div
          className={`mt-16 grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 ${lgGridCols[cols] ?? "lg:grid-cols-4"}`}
        >
          {sections.map((section, i) => {
            const Icon = ICON_MAP[section.icon] ?? Ticket;
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
                    <div
                      className={`inline-flex shrink-0 items-center justify-center border-2 border-black p-3 ${section.accentClass}`}
                    >
                      <Icon
                        size={24}
                        className={section.accentText}
                        strokeWidth={2.5}
                      />
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
      )}
    </main>
  );
}
