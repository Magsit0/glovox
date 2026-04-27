import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 text-center">
      <h1 className="font-display text-6xl font-black uppercase leading-none tracking-tight text-black sm:text-7xl">
        403
      </h1>
      <p className="mt-4 font-mono-data text-xs uppercase tracking-widest text-black">
        No tienes acceso a este dashboard.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block border-2 border-black bg-[#FFFF00] px-4 py-2 font-mono-data text-xs font-bold uppercase text-black shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#FFFF00]"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
