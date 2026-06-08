import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getByCategoria,
  getByNegocio,
  getByProveedor,
  getDateRange,
  getDocumentos,
  getKpis,
  getMatrizProveedorAnio,
  getMensual,
  getProveedorOptions,
  DOCUMENTOS_LIMIT,
  type ProveedorFilters,
} from "@/lib/queries/proveedor";
import ProveedorFilters_ from "@/components/proveedor/ProveedorFilters";
import KpiRow from "@/components/proveedor/KpiRow";
import EvolucionChart from "@/components/proveedor/EvolucionChart";
import PorNegocioChart from "@/components/proveedor/PorNegocioChart";
import CategoriaDonut from "@/components/proveedor/CategoriaDonut";
import BreakdownTable, {
  type BreakdownRow,
} from "@/components/proveedor/BreakdownTable";
import MatrizProveedorAnio from "@/components/proveedor/MatrizProveedorAnio";
import DocumentosTable from "@/components/proveedor/DocumentosTable";
import { dateLabel } from "@/components/proveedor/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ proveedor?: string; from?: string; to?: string }>;
}

export default async function ProveedorPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/proveedor")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const proveedor = params.proveedor?.trim() || undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;
  const filters: ProveedorFilters = { proveedor, from, to };

  let options;
  let dateRange;
  try {
    [options, dateRange] = await Promise.all([
      getProveedorOptions(),
      getDateRange(),
    ]);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  const baseQuery: Record<string, string | undefined> = { from, to };

  // ---- Vista sin proveedor: resumen + ranking ----
  if (!proveedor) {
    let kpis;
    let mensual;
    let porProveedor;
    let porCategoria;
    let matriz;
    try {
      [kpis, mensual, porProveedor, porCategoria, matriz] = await Promise.all([
        getKpis(filters),
        getMensual(filters),
        getByProveedor(filters),
        getByCategoria(filters),
        getMatrizProveedorAnio(filters),
      ]);
    } catch (err) {
      return (
        <Shell>
          <Heading dateRange={dateRange} />
          <ProveedorFilters_ options={options} proveedor="" from={from ?? ""} to={to ?? ""} />
          <ErrorView message={errorMessage(err)} />
        </Shell>
      );
    }

    const RANKING_TOP = 200;
    const rankingRows: BreakdownRow[] = porProveedor
      .slice(0, RANKING_TOP)
      .map((p) => ({
        key: p.proveedor,
        label: p.proveedor,
        sublabel: p.rut || undefined,
        gasto: p.gasto,
        docs: p.docs,
        meta: `${p.negocios}`,
        metaNumeric: p.negocios,
      }));
    const rankingSubtitle =
      porProveedor.length > RANKING_TOP
        ? `Top ${RANKING_TOP} de ${porProveedor.length} proveedores por gasto. Usa el buscador del filtro para encontrar otros, o descarga el CSV con todos.`
        : "Gasto total por proveedor en el período. Click en un proveedor para ver su detalle.";

    return (
      <Shell>
        <Heading dateRange={dateRange} />
        <ProveedorFilters_ options={options} proveedor="" from={from ?? ""} to={to ?? ""} />
        <KpiRow kpis={kpis} scopeLabel="Gasto total · todos los proveedores" />
        <EvolucionChart rows={mensual} />
        <MatrizProveedorAnio
          years={matriz.years}
          rows={matriz.rows}
          baseSearchParams={baseQuery}
        />
        <BreakdownTable
          title="Ranking de proveedores"
          subtitle={rankingSubtitle}
          firstColLabel="Proveedor"
          metaColLabel="Negocios"
          rows={rankingRows}
          drillParam="proveedor"
          baseSearchParams={baseQuery}
          csv={{
            filename: "ranking-proveedores",
            sheetName: "Ranking proveedores",
            headers: ["Proveedor", "RUT", "Gasto (CLP)", "Documentos", "Negocios"],
            rows: porProveedor.map((p) => [
              p.proveedor,
              p.rut,
              Math.round(p.gasto),
              p.docs,
              p.negocios,
            ]),
          }}
        />
        <CategoriaDonut rows={porCategoria} />
      </Shell>
    );
  }

  // ---- Vista de un proveedor ----
  const selected = options.find((o) => o.proveedor === proveedor);

  let kpis;
  let mensual;
  let porNegocio;
  let porCategoria;
  let documentos;
  try {
    [kpis, mensual, porNegocio, porCategoria, documentos] = await Promise.all([
      getKpis(filters),
      getMensual(filters),
      getByNegocio(filters),
      getByCategoria(filters),
      getDocumentos(filters),
    ]);
  } catch (err) {
    return (
      <Shell>
        <Heading dateRange={dateRange} />
        <ProveedorFilters_ options={options} proveedor={proveedor} from={from ?? ""} to={to ?? ""} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  const negocioRows: BreakdownRow[] = porNegocio.map((nrow) => ({
    key: nrow.negocioId,
    label: nrow.nombre || `Negocio ${nrow.negocioId}`,
    sublabel: nrow.negocioId,
    gasto: nrow.gasto,
    docs: nrow.docs,
    meta: nrow.ultimaFecha ? dateLabel(nrow.ultimaFecha) : "—",
    metaNumeric: nrow.ultimaFecha ? Date.parse(nrow.ultimaFecha) : 0,
  }));

  const capped = documentos.length >= DOCUMENTOS_LIMIT;
  const slug = proveedor.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

  return (
    <Shell>
      <Heading dateRange={dateRange} />
      <ProveedorFilters_ options={options} proveedor={proveedor} from={from ?? ""} to={to ?? ""} />

      <section className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-sm font-medium text-[#333333]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
          {proveedor}
        </span>
        {selected?.rut && (
          <span className="font-sans text-sm text-[#666666]">RUT {selected.rut}</span>
        )}
      </section>

      <KpiRow kpis={kpis} scopeLabel={`Gasto total · ${proveedor}`} />
      <EvolucionChart rows={mensual} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PorNegocioChart rows={porNegocio} />
        <CategoriaDonut rows={porCategoria} />
      </div>

      <BreakdownTable
        title="Gasto por negocio"
        subtitle="Una fila por negocio, ordenada por gasto."
        firstColLabel="Negocio"
        metaColLabel="Última"
        rows={negocioRows}
        csv={{
          filename: `negocios-${slug}`,
          sheetName: "Gasto por negocio",
          headers: ["Negocio ID", "Negocio", "Gasto (CLP)", "Documentos", "Última fecha"],
          rows: porNegocio.map((nrow) => [
            nrow.negocioId,
            nrow.nombre,
            Math.round(nrow.gasto),
            nrow.docs,
            nrow.ultimaFecha,
          ]),
        }}
      />

      <DocumentosTable
        rows={documentos}
        proveedor={proveedor}
        capped={capped}
        csvFilename={`detalle-gasto-${slug}`}
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

function Heading({ dateRange }: { dateRange?: { min: string; max: string } }) {
  return (
    <header className="flex flex-col gap-2">
      <Link
        href="/"
        aria-label="Volver al menú principal"
        className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
      >
        <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
      </Link>
      <p className="font-sans text-xs text-[#666666]">Proveedor</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Gasto por proveedor
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Gasto total por proveedor, su evolución en el tiempo y el desglose por
        negocio. Excluye negocios de área GLOVOX y gastos marcados como excluidos.
      </p>
      {dateRange?.min && dateRange?.max && (
        <p className="font-sans text-xs text-[#999999]">
          Datos disponibles entre {dateLabel(dateRange.min)} y {dateLabel(dateRange.max)}.
        </p>
      )}
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
    : "Error al cargar el dashboard de proveedor.";
}
