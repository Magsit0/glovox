import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  computeRrssKpis,
  filterByTrimestre,
  filterNegociosByTrimestre,
  filterRrssByLabel,
  filterRrssByTrimestre,
  getCierreTrimestralRows,
  getNegociosVentas,
  getRrssFollowers,
  getRrssNetworkOptions,
  getTrimestresDisponibles,
} from "@/lib/queries/cierreTrimestral";
import { aggregateTrimestre, aggregateVentas } from "@/lib/unabase/cierreTrimestral";
import TrimestreSelector from "@/components/cierre-trimestral/TrimestreSelector";
import { montoModeFrom } from "@/components/montoMode";
import KpiRow from "@/components/cierre-trimestral/KpiRow";
import CategoriaBreakdown from "@/components/cierre-trimestral/CategoriaBreakdown";
import EventosTable from "@/components/cierre-trimestral/EventosTable";
import VentasPorArea from "@/components/cierre-trimestral/VentasPorArea";
import RrssSection from "@/components/cierre-trimestral/RrssSection";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ trimestre?: string; network?: string; monto?: string }>;
}

const DEFAULT_NETWORK = "instagram";

export default async function CierreTrimestralPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/cierre-trimestral")) {
    redirect("/?unauthorized=1");
  }

  const { trimestre, network, monto: montoParam } = await searchParams;
  const monto = montoModeFrom(montoParam);

  let rows;
  let negociosRows;
  let rrssRows;
  try {
    [rows, negociosRows, rrssRows] = await Promise.all([
      getCierreTrimestralRows(),
      getNegociosVentas(monto),
      getRrssFollowers(),
    ]);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  const trimestres = getTrimestresDisponibles(rows);

  if (trimestres.length === 0) {
    return (
      <Shell>
        <Heading />
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8">
          <p className="font-display text-lg font-bold text-[#333333]">
            Sin trimestres disponibles
          </p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            Aún no hay eventos con fecha asociada para construir el reporte trimestral.
          </p>
        </section>
      </Shell>
    );
  }

  const selectedId =
    trimestre && trimestres.some((t) => t.id === trimestre)
      ? trimestre
      : trimestres[0].id;

  const filtered = filterByTrimestre(rows, selectedId);
  const agg = aggregateTrimestre(filtered);
  const ventasAgg = aggregateVentas(filterNegociosByTrimestre(negociosRows, selectedId));
  const trimestreLabel = trimestres.find((t) => t.id === selectedId)?.label ?? selectedId;

  const networkOptions = getRrssNetworkOptions(rrssRows);
  const selectedNetwork =
    network && networkOptions.includes(network)
      ? network
      : networkOptions.includes(DEFAULT_NETWORK)
        ? DEFAULT_NETWORK
        : networkOptions[0] ?? DEFAULT_NETWORK;
  const rrssFiltered = filterRrssByLabel(
    filterRrssByTrimestre(rrssRows, selectedId),
    selectedNetwork,
  );
  const rrssKpis = computeRrssKpis(rrssFiltered);

  return (
    <Shell>
      <Heading />
      <section className="flex flex-col gap-3">
        <p className="font-sans text-xs text-[#666666]">Trimestre</p>
        <TrimestreSelector options={trimestres} selectedId={selectedId} />
      </section>
      <section className="flex flex-col gap-2">
        <p className="font-sans text-xs uppercase tracking-wide text-[#666666]">
          {trimestreLabel}
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#333333]">
          {agg.totalEventos > 0
            ? `${agg.totalEventos} eventos en el trimestre`
            : "Sin eventos en el trimestre"}
        </h2>
      </section>
      <KpiRow agg={agg} />
      <VentasPorArea agg={ventasAgg} monto={monto} />
      <CategoriaBreakdown rows={agg.porCategoria} />
      <EventosTable rows={agg.eventos} />
      <RrssSection
        rows={rrssFiltered}
        kpis={rrssKpis}
        networkOptions={networkOptions.length > 0 ? networkOptions : [DEFAULT_NETWORK]}
        selectedNetwork={selectedNetwork}
        trimestreId={selectedId}
        trimestreLabel={trimestreLabel}
      />
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
      <p className="font-sans text-xs text-[#666666]">Cierre trimestral</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Informe de cierre trimestral
      </h1>
    </header>
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
  return err instanceof Error
    ? err.message
    : "Error inesperado al cargar el cierre trimestral";
}
