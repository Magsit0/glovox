import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getFfbbEventDetail,
  getFfbbEventOptions,
  getFfbbInsumos,
  getFfbbInsumosConsumidos,
  getFfbbListadoKpis,
} from "@/lib/queries/ffbb";
import {
  getCompradoPorInsumo,
  getComprasByEvento,
} from "@/lib/queries/compras-insumo";
import {
  getInsumosCatalogoList,
  getProveedoresList,
} from "@/lib/queries/catalogos";
import FfbbEventSelector from "@/components/ffbb/FfbbEventSelector";
import FfbbListadoTable from "@/components/ffbb/FfbbListadoTable";
import FfbbTabs, { type FfbbTabKey } from "@/components/ffbb/FfbbTabs";
import VentasKpiRow from "@/components/ffbb/VentasKpiRow";
import CategoriaBreakdownFfbb from "@/components/ffbb/CategoriaBreakdownFfbb";
import TopProductosChart from "@/components/ffbb/TopProductosChart";
import VentasPorBarraTable from "@/components/ffbb/VentasPorBarraTable";
import InsumoConsumoTable from "@/components/ffbb/InsumoConsumoTable";
import InventarioTable from "@/components/ffbb/InventarioTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "FF&BB · Glovox",
  description: "Resultados de operación de alimentos y bebidas por evento.",
};

interface PageProps {
  searchParams: Promise<{
    id?: string;
    tab?: string;
  }>;
}

function parseTab(raw: string | undefined): FfbbTabKey {
  if (raw === "insumos" || raw === "inventario") return raw;
  return "ventas";
}

export default async function FfbbPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/ffbb")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const id = params.id?.trim() || "";
  const tab = parseTab(params.tab);

  if (!id) {
    let listado;
    try {
      listado = await getFfbbListadoKpis();
    } catch (err) {
      return (
        <Shell>
          <ListHeading />
          <ErrorView message={errorMessage(err)} />
        </Shell>
      );
    }
    return (
      <Shell>
        <ListHeading />
        <FfbbListadoTable rows={listado} />
      </Shell>
    );
  }

  let options;
  try {
    options = await getFfbbEventOptions();
  } catch (err) {
    return (
      <Shell>
        <DetailHeading nombre={id} eventoId={id} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  let detail;
  try {
    detail = await getFfbbEventDetail(id);
  } catch (err) {
    return (
      <Shell>
        <DetailHeading nombre={id} eventoId={id} />
        <SelectorRow options={options} selectedId={id} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  const sinDatos =
    detail.kpis.ventas === 0 &&
    detail.porBarra.length === 0 &&
    detail.topProductos.length === 0;

  if (sinDatos) {
    return (
      <Shell>
        <DetailHeading nombre={detail.nombre} eventoId={id} fechaEvento={detail.fechaEvento} />
        <SelectorRow options={options} selectedId={id} />
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
          <p className="font-display text-lg font-bold text-[#333333]">
            Sin información disponible
          </p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            El evento <span className="font-medium text-[#333333]">{id}</span> no tiene ventas FF&BB.
          </p>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <DetailHeading nombre={detail.nombre} eventoId={id} fechaEvento={detail.fechaEvento} />
      <SelectorRow options={options} selectedId={id} />
      <FfbbTabs active={tab} eventoId={id} />

      {tab === "ventas" && (
        <section className="flex flex-col gap-6">
          <VentasKpiRow kpis={detail.kpis} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoriaBreakdownFfbb rows={detail.porCategoria} />
            <TopProductosChart rows={detail.topProductos} />
          </div>
          <VentasPorBarraTable rows={detail.porBarra} />
        </section>
      )}

      {tab === "insumos" && <InsumosSection eventoId={id} />}

      {tab === "inventario" && <InventarioSection eventoId={id} />}
    </Shell>
  );
}

async function InsumosSection({ eventoId }: { eventoId: string }) {
  let rows;
  try {
    rows = await getFfbbInsumosConsumidos(eventoId);
  } catch (err) {
    return <ErrorView message={errorMessage(err)} />;
  }
  return <InsumoConsumoTable rows={rows} />;
}

async function InventarioSection({ eventoId }: { eventoId: string }) {
  let data;
  try {
    const [rows, compradoMap, compras, insumosBQ, insumosCat, proveedores] = await Promise.all([
      getFfbbInsumosConsumidos(eventoId),
      getCompradoPorInsumo(eventoId),
      getComprasByEvento(eventoId),
      getFfbbInsumos(),
      getInsumosCatalogoList(),
      getProveedoresList(),
    ]);
    // Unión deduplicada: catálogo de Postgres + insumos que aparecen en
    // formulaTragoBQ. Esto cubre la transición mientras el catálogo de
    // Postgres se va llenando (los de BigQuery quedan disponibles igual).
    const insumosSet = new Set<string>([...insumosCat, ...insumosBQ]);
    const insumos = Array.from(insumosSet).sort((a, b) => a.localeCompare(b, "es-CL"));
    const compradoByInsumo: Record<string, number> = {};
    compradoMap.forEach((v, k) => {
      compradoByInsumo[k] = v;
    });
    data = { rows, compradoByInsumo, compras, insumos, proveedores };
  } catch (err) {
    return <ErrorView message={errorMessage(err)} />;
  }
  return (
    <InventarioTable
      rows={data.rows}
      compradoByInsumo={data.compradoByInsumo}
      compras={data.compras}
      insumos={data.insumos}
      proveedores={data.proveedores}
      eventoId={eventoId}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-[#FAFAFA] text-[#333333]"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
        {children}
      </div>
    </main>
  );
}

function ListHeading() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          aria-label="Volver al menú principal"
          className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
        >
          <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
        </Link>
        <p className="font-sans text-xs text-[#666666]">FF&BB</p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          Alimentos y bebidas
        </h1>
        <p className="font-sans text-sm text-[#666666]">
          Selecciona un evento para ver ventas e insumos consumidos.
        </p>
      </div>
      <Link
        href="/ffbb/evolucion"
        className="inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
      >
        <TrendingUp className="h-4 w-4" />
        Evolución entre eventos
      </Link>
    </header>
  );
}

function DetailHeading({
  nombre,
  eventoId,
  fechaEvento,
}: {
  nombre: string;
  eventoId: string;
  fechaEvento?: string | null;
}) {
  const fechaLabel = fechaEvento
    ? new Date(fechaEvento).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
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
        <p className="font-sans text-xs text-[#666666]">
          FF&BB · Evento {eventoId}
          {fechaLabel && <span className="ml-2 text-[#999999]">· {fechaLabel}</span>}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          {nombre}
        </h1>
      </div>
    </header>
  );
}

function SelectorRow({
  options,
  selectedId,
}: {
  options: Awaited<ReturnType<typeof getFfbbEventOptions>>;
  selectedId: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="font-sans text-xs text-[#666666]">Evento</p>
      <div className="max-w-xl">
        <FfbbEventSelector options={options} selectedId={selectedId} />
      </div>
    </section>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
      <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
      <p className="flex-1 font-sans text-sm text-[#333333]">{message}</p>
    </div>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error inesperado al cargar el dashboard FF&BB";
}
