import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FreesPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-2 border-4 border-black bg-white px-3 py-1.5 font-mono-data text-xs font-bold uppercase text-black shadow-[4px_4px_0px_#000] transition-colors hover:bg-[#00FF00]"
      >
        <ArrowLeft size={14} strokeWidth={3} />
        Menú
      </Link>
      <div className="border-4 border-black bg-[#00FF00] px-12 py-10 shadow-[8px_8px_0px_#000000] text-center">
        <p className="font-display text-7xl font-black uppercase leading-none tracking-tight text-black">
          EN PROCESO
        </p>
        <p className="mt-4 font-mono-data text-xs uppercase tracking-widest text-black/60">
          Free&apos;s Dashboard — Próximamente
        </p>
      </div>
    </main>
  );
}
