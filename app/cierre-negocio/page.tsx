import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getNegocioDetail, getNegocioOptions } from "@/lib/queries/cierreNegocio";
import { aggregateNegocio } from "@/lib/unabase/cierreNegocio";
import NegocioSelector from "@/components/cierre-negocio/NegocioSelector";
import NegocioHeader from "@/components/cierre-negocio/NegocioHeader";
import KpiRow from "@/components/cierre-negocio/KpiRow";
import CategoriaBreakdown from "@/components/cierre-negocio/CategoriaBreakdown";
import CategoriaTree from "@/components/cierre-negocio/CategoriaTree";
import TopProveedoresChart from "@/components/cierre-negocio/TopProveedoresChart";
import OcStatusPanel from "@/components/cierre-negocio/OcStatusPanel";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function CierreNegocioPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/cierre-negocio")) {
    redirect("/?unauthorized=1");
  }

  const { id } = await searchParams;

  let options;
  try {
    options = await getNegocioOptions();
  } catch (err) {
    return <ErrorView message={errorMessage(err)} />;
  }

  if (!id) {
    return (
      <Shell>
        <Heading />
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8">
          <p className="font-sans text-xs text-[#666666]">Selecciona un negocio</p>
          <div className="mt-3 max-w-xl">
            <NegocioSelector options={options} />
          </div>
          <p className="mt-4 font-sans text-sm text-[#666666]">
            Elige un negocio del listado para ver su informe de cierre: presupuesto vs gasto real,
            desglose por categoría, top proveedores y estado de las OCs.
          </p>
        </section>
      </Shell>
    );
  }

  let detail;
  try {
    detail = await getNegocioDetail(id);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <SelectorRow options={options} selectedId={id} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  if (detail.items.length === 0 && detail.gastos.length === 0) {
    return (
      <Shell>
        <Heading />
        <SelectorRow options={options} selectedId={id} />
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
          <p className="font-display text-lg font-bold text-[#333333]">
            Sin información disponible
          </p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            El negocio <span className="font-medium text-[#333333]">{id}</span> no tiene items
            presupuestados ni gastos asociados.
          </p>
        </section>
      </Shell>
    );
  }

  const agg = aggregateNegocio(detail.items, detail.gastos);

  return (
    <Shell>
      <Heading />
      <SelectorRow options={options} selectedId={id} />
      <NegocioHeader negocio={detail.negocio} externalId={id} />
      <KpiRow agg={agg} />
      <CategoriaBreakdown
        rows={agg.porCategoria}
        itemsConOcByCategoria={agg.itemsConOcByCategoria}
      />
      <CategoriaTree arbol={agg.arbol} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopProveedoresChart rows={agg.topProveedores} />
        <OcStatusPanel ocStatus={agg.ocStatus} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/"
        aria-label="Volver al menú principal"
        className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
      >
        <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
      </Link>
      <p className="font-sans text-xs text-[#666666]">Cierre negocio</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Informe de cierre
      </h1>
    </header>
  );
}

function SelectorRow({
  options,
  selectedId,
}: {
  options: Awaited<ReturnType<typeof getNegocioOptions>>;
  selectedId: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="font-sans text-xs text-[#666666]">Negocio</p>
      <div className="max-w-xl">
        <NegocioSelector options={options} selectedId={selectedId} />
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
  return err instanceof Error ? err.message : "Error inesperado al cargar el cierre del negocio";
}
