import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FF&BB · Glovox",
  description: "Dashboard de resultados de operacion de alimentos y bebidas.",
};

export const dynamic = "force-dynamic";

export default function FfbbPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[#FAFAFA] px-6 py-10 text-black"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="border-b-4 border-black pb-6">
          <Link
            href="/"
            aria-label="Volver al menu principal"
            className="mb-4 inline-flex items-center justify-center border-2 border-black bg-white p-1.5 transition-colors hover:bg-[#FFFF00]"
          >
            <Image
              src="/glovox_logo_gvx_black.svg"
              alt="Glovox"
              width={20}
              height={20}
              priority
            />
          </Link>

          <h1 className="font-display text-6xl font-black uppercase leading-none tracking-tight sm:text-7xl">
            FF&BB
          </h1>
          <p className="mt-3 font-mono-data text-xs uppercase tracking-widest">
            Alimentos y bebidas
          </p>
        </header>

        <section className="border-4 border-black bg-white p-8 shadow-[4px_4px_0px_#000000]">
          <div className="inline-block border-2 border-black bg-[#722F37] px-3 py-1 font-mono-data text-xs font-bold uppercase text-white">
            En construccion
          </div>

          <p className="mt-6 max-w-2xl font-mono-data text-sm uppercase leading-relaxed tracking-wide">
            Esta tarjeta ya tiene ruta propia. Cuando armemos el dashboard real,
            podemos reemplazar esta vista por los resultados de operacion de
            alimentos y bebidas.
          </p>

          <Link
            href="/onepager"
            className="mt-8 inline-block border-2 border-black bg-[#FFFF00] px-4 py-2 font-mono-data text-xs font-bold uppercase transition-colors hover:bg-black hover:text-[#FFFF00]"
          >
            Ver onepager actual
          </Link>
        </section>
      </div>
    </main>
  );
}
