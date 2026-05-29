import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getFfbbEvolucionInsumo,
  getFfbbEvolucionProducto,
  getFfbbInsumos,
  getFfbbProductos,
} from "@/lib/queries/ffbb";
import type { EvolucionRow } from "@/lib/ffbb/types";
import EvolucionPanel, {
  type EvolucionMetric,
  type EvolucionMode,
} from "@/components/ffbb/EvolucionPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "FF&BB · Evolución",
  description: "Evolución de productos e insumos a través de los eventos.",
};

interface PageProps {
  searchParams: Promise<{
    producto?: string;
    insumo?: string;
    metric?: string;
  }>;
}

function parseMetric(raw: string | undefined): EvolucionMetric {
  return raw === "unidades" ? "unidades" : "ventas";
}

export default async function FfbbEvolucionPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/ffbb")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const producto = params.producto?.trim() || null;
  const insumo = params.insumo?.trim() || null;
  const metric = parseMetric(params.metric);

  const mode: EvolucionMode = insumo ? "insumo" : "producto";
  const selected = mode === "insumo" ? insumo : producto;

  let productos: string[] = [];
  let insumos: string[] = [];
  let data: EvolucionRow[] = [];
  let error: string | null = null;

  try {
    [productos, insumos] = await Promise.all([getFfbbProductos(), getFfbbInsumos()]);
    if (mode === "producto" && selected) {
      data = await getFfbbEvolucionProducto(selected, metric);
    } else if (mode === "insumo" && selected) {
      data = await getFfbbEvolucionInsumo(selected);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Error inesperado al cargar la evolución";
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#FAFAFA] text-[#333333]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              aria-label="Volver al menú principal"
              className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
            >
              <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
            </Link>
            <Link
              href="/ffbb"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al listado
            </Link>
          </div>
          <div>
            <p className="font-sans text-xs text-[#666666]">FF&BB</p>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
              Evolución
            </h1>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              Cómo cambia un producto o un insumo a través de los eventos. No está atado a un cierre puntual.
            </p>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
            <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
            <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
          </div>
        ) : (
          <EvolucionPanel
            productos={productos}
            insumos={insumos}
            mode={mode}
            selected={selected}
            metric={metric}
            data={data}
          />
        )}
      </div>
    </main>
  );
}
