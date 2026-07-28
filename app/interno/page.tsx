import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getByCategoria,
  getByNegocio,
  getByProveedor,
  getCategoriaOptions,
  getDateRange,
  getDocumentos,
  getKpis,
  getMensual,
  getMensualPorCategoria,
  getPnlInterno,
  DOCUMENTOS_LIMIT,
  type InternoFilters as Filters,
} from "@/lib/queries/interno";
import InternoFilters from "@/components/interno/InternoFilters";
import { montoModeFrom } from "@/components/montoMode";
import KpiRowInterno from "@/components/interno/KpiRowInterno";
import MensualCategoriaChart from "@/components/interno/MensualCategoriaChart";
import PnlInternoTable from "@/components/interno/PnlInternoTable";
import EvolucionChart from "@/components/proveedor/EvolucionChart";
import CategoriaDonut from "@/components/proveedor/CategoriaDonut";
import BreakdownTable, {
  type BreakdownRow,
} from "@/components/proveedor/BreakdownTable";
import DocumentosTable from "@/components/proveedor/DocumentosTable";
import { dateLabel } from "@/components/proveedor/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    categoria?: string;
    from?: string;
    to?: string;
    monto?: string;
  }>;
}

export default async function InternoPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/interno")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const categoria = params.categoria?.trim() || undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;
  const monto = montoModeFrom(params.monto);
  const filters: Filters = { categoria, from, to, monto };
  const montoLabel = monto === "bruto" ? " · montos brutos (con IVA)" : "";

  let options;
  let dateRange;
  try {
    [options, dateRange] = await Promise.all([
      getCategoriaOptions(),
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

  const baseQuery: Record<string, string | undefined> = {
    from,
    to,
    monto: monto === "bruto" ? "bruto" : undefined,
  };

  // ---- Vista sin categoría: resumen del gasto interno completo ----
  if (!categoria) {
    let kpis;
    let mensualCategoria;
    let porCategoria;
    let porNegocio;
    let porProveedor;
    let pnl;
    let documentos;
    try {
      [kpis, mensualCategoria, porCategoria, porNegocio, porProveedor, pnl, documentos] =
        await Promise.all([
          getKpis(filters),
          getMensualPorCategoria(filters),
          getByCategoria(filters),
          getByNegocio(filters),
          getByProveedor(filters),
          getPnlInterno(monto),
          getDocumentos(filters),
        ]);
    } catch (err) {
      return (
        <Shell>
          <Heading dateRange={dateRange} />
          <InternoFilters options={options} categoria="" from={from ?? ""} to={to ?? ""} monto={monto} />
          <ErrorView message={errorMessage(err)} />
        </Shell>
      );
    }

    const categoriaRows: BreakdownRow[] = porCategoria.map((c) => ({
      key: c.categoria,
      label: c.categoria,
      gasto: c.gasto,
      docs: c.docs,
    }));

    const negocioRows: BreakdownRow[] = porNegocio.map((r) => ({
      key: r.negocioId,
      label: r.nombre || `Negocio ${r.negocioId}`,
      sublabel: r.negocioId,
      gasto: r.gasto,
      docs: r.docs,
      meta: r.ultimaFecha ? dateLabel(r.ultimaFecha) : "—",
      metaNumeric: r.ultimaFecha ? Date.parse(r.ultimaFecha) : 0,
    }));

    const TOP_PROVEEDORES = 100;
    const proveedorRows: BreakdownRow[] = porProveedor
      .slice(0, TOP_PROVEEDORES)
      .map((p) => ({
        key: p.proveedor,
        label: p.proveedor,
        sublabel: p.rut || undefined,
        gasto: p.gasto,
        docs: p.docs,
        meta: `${p.negocios}`,
        metaNumeric: p.negocios,
      }));

    return (
      <Shell>
        <Heading dateRange={dateRange} />
        <InternoFilters options={options} categoria="" from={from ?? ""} to={to ?? ""} monto={monto} />
        <KpiRowInterno
          kpis={kpis}
          scopeLabel={`Gasto interno total${montoLabel}`}
        />
        <MensualCategoriaChart rows={mensualCategoria} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CategoriaDonut rows={porCategoria} />
          <BreakdownTable
            title="Gasto por categoría"
            subtitle="Categorías oficiales del catálogo. Click en una para ver su detalle."
            firstColLabel="Categoría"
            rows={categoriaRows}
            drillParam="categoria"
            basePath="/interno"
            baseSearchParams={baseQuery}
            csv={{
              filename: "gasto-interno-categorias",
              sheetName: "Gasto por categoría",
              headers: ["Categoría", "Gasto (CLP)", "Documentos"],
              rows: porCategoria.map((c) => [
                c.categoria,
                Math.round(c.gasto),
                c.docs,
              ]),
            }}
          />
        </div>

        <BreakdownTable
          title="Gasto por negocio interno"
          subtitle="Contenedores anuales por rubro (oficina, administración, botillería…), ordenados por gasto."
          firstColLabel="Negocio"
          metaColLabel="Última"
          rows={negocioRows}
          csv={{
            filename: "gasto-interno-negocios",
            sheetName: "Gasto por negocio",
            headers: ["Negocio ID", "Negocio", "Gasto (CLP)", "Documentos", "Última fecha"],
            rows: porNegocio.map((r) => [
              r.negocioId,
              r.nombre,
              Math.round(r.gasto),
              r.docs,
              r.ultimaFecha,
            ]),
          }}
        />

        <BreakdownTable
          title="Proveedores del gasto interno"
          subtitle={`Top ${Math.min(TOP_PROVEEDORES, porProveedor.length)} de ${porProveedor.length} proveedores por gasto en el período.`}
          firstColLabel="Proveedor"
          metaColLabel="Negocios"
          rows={proveedorRows}
          csv={{
            filename: "gasto-interno-proveedores",
            sheetName: "Proveedores",
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

        <PnlInternoTable rows={pnl} monto={monto} />

        <DocumentosTable
          rows={documentos}
          proveedor="interno"
          capped={documentos.length >= DOCUMENTOS_LIMIT}
          csvFilename="detalle-gasto-interno"
        />
      </Shell>
    );
  }

  // ---- Vista de una categoría ----
  const selected = options.find((o) => o.categoria === categoria);

  let kpis;
  let mensual;
  let porNegocio;
  let porProveedor;
  let documentos;
  try {
    [kpis, mensual, porNegocio, porProveedor, documentos] = await Promise.all([
      getKpis(filters),
      getMensual(filters),
      getByNegocio(filters),
      getByProveedor(filters),
      getDocumentos(filters),
    ]);
  } catch (err) {
    return (
      <Shell>
        <Heading dateRange={dateRange} />
        <InternoFilters options={options} categoria={categoria} from={from ?? ""} to={to ?? ""} monto={monto} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  const negocioRows: BreakdownRow[] = porNegocio.map((r) => ({
    key: r.negocioId,
    label: r.nombre || `Negocio ${r.negocioId}`,
    sublabel: r.negocioId,
    gasto: r.gasto,
    docs: r.docs,
    meta: r.ultimaFecha ? dateLabel(r.ultimaFecha) : "—",
    metaNumeric: r.ultimaFecha ? Date.parse(r.ultimaFecha) : 0,
  }));

  const proveedorRows: BreakdownRow[] = porProveedor.map((p) => ({
    key: p.proveedor,
    label: p.proveedor,
    sublabel: p.rut || undefined,
    gasto: p.gasto,
    docs: p.docs,
    meta: `${p.negocios}`,
    metaNumeric: p.negocios,
  }));

  const slug = categoria.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

  return (
    <Shell>
      <Heading dateRange={dateRange} />
      <InternoFilters options={options} categoria={categoria} from={from ?? ""} to={to ?? ""} monto={monto} />

      <section className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-sm font-medium text-[#333333]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
          {categoria}
        </span>
        {selected && (
          <span className="font-sans text-sm text-[#666666]">
            {selected.docs} documentos históricos en la categoría
          </span>
        )}
      </section>

      <KpiRowInterno
        kpis={kpis}
        scopeLabel={`Gasto interno · ${categoria}${montoLabel}`}
      />
      <EvolucionChart rows={mensual} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="Gasto por negocio interno"
          subtitle="Contenedores donde vive esta categoría, ordenados por gasto."
          firstColLabel="Negocio"
          metaColLabel="Última"
          rows={negocioRows}
          csv={{
            filename: `gasto-interno-${slug}-negocios`,
            sheetName: "Por negocio",
            headers: ["Negocio ID", "Negocio", "Gasto (CLP)", "Documentos", "Última fecha"],
            rows: porNegocio.map((r) => [
              r.negocioId,
              r.nombre,
              Math.round(r.gasto),
              r.docs,
              r.ultimaFecha,
            ]),
          }}
        />
        <BreakdownTable
          title="Proveedores de la categoría"
          subtitle="Gasto por proveedor dentro de la categoría, en el período."
          firstColLabel="Proveedor"
          metaColLabel="Negocios"
          rows={proveedorRows}
          csv={{
            filename: `gasto-interno-${slug}-proveedores`,
            sheetName: "Proveedores",
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
      </div>

      <DocumentosTable
        rows={documentos}
        proveedor={categoria}
        capped={documentos.length >= DOCUMENTOS_LIMIT}
        csvFilename={`detalle-gasto-interno-${slug}`}
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
      <p className="font-sans text-xs text-[#666666]">Gasto interno</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Gasto interno GLOVOX
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Sueldos y gasto administrativo de los negocios internos (área GLOVOX de
        Unabase): evolución por categoría, contenedores anuales, proveedores y
        detalle descargable. Es el universo que los demás dashboards excluyen.
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
    : "Error al cargar el dashboard de gasto interno.";
}
