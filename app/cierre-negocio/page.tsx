import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getNegocioDetail, getNegocioOptions } from "@/lib/queries/cierreNegocio";
import { getAllNegociosAdmin } from "@/lib/queries/unabase";
import type { NegocioRow } from "@/lib/unabase/types";
import { aggregateNegocio } from "@/lib/unabase/cierreNegocio";
import NegocioSelector from "@/components/cierre-negocio/NegocioSelector";
import NegocioHeader from "@/components/cierre-negocio/NegocioHeader";
import KpiRow from "@/components/cierre-negocio/KpiRow";
import CategoriaBreakdown from "@/components/cierre-negocio/CategoriaBreakdown";
import CategoriaTree from "@/components/cierre-negocio/CategoriaTree";
import TopProveedoresChart from "@/components/cierre-negocio/TopProveedoresChart";
import OcStatusPanel from "@/components/cierre-negocio/OcStatusPanel";
import ResumenKpis from "@/components/cierre-negocio/ResumenKpis";
import EventoResumen from "@/components/cierre-negocio/EventoResumen";
import VentasSection from "@/components/cierre-negocio/VentasSection";
import DownloadPdfButton from "@/components/cierre-negocio/DownloadPdfButton";
import CierreTable from "@/components/cierre-negocio/CierreTable";

export const dynamic = "force-dynamic";

type AreaKey = "produccion" | "btl" | "otros";

const AREA_LABELS: Record<AreaKey, string> = {
  produccion: "Producción de eventos propios",
  btl: "BTL",
  otros: "Otros",
};

function isAreaKey(value: string | undefined): value is AreaKey {
  return value === "produccion" || value === "btl" || value === "otros";
}

function filterByArea(rows: NegocioRow[], area: AreaKey): NegocioRow[] {
  const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
  if (area === "produccion") {
    return rows.filter((r) => norm(r.area_negocio) === "produccion de eventos propios");
  }
  if (area === "btl") {
    return rows.filter((r) => norm(r.area_negocio) === "btl");
  }
  return rows.filter((r) => {
    const a = norm(r.area_negocio);
    return a !== "produccion de eventos propios" && a !== "btl";
  });
}

interface PageProps {
  searchParams: Promise<{ id?: string; area?: string }>;
}

export default async function CierreNegocioPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/cierre-negocio")) {
    redirect("/?unauthorized=1");
  }

  const { id, area } = await searchParams;

  if (!id) {
    if (!isAreaKey(area)) {
      return (
        <Shell>
          <ChooserHeading />
          <AreaChooser />
        </Shell>
      );
    }

    let negocios;
    try {
      negocios = await getAllNegociosAdmin();
    } catch (err) {
      return (
        <Shell>
          <ListHeading area={area} />
          <ErrorView message={errorMessage(err)} />
        </Shell>
      );
    }
    return (
      <Shell>
        <ListHeading area={area} />
        <CierreTable rows={filterByArea(negocios, area)} />
      </Shell>
    );
  }

  let options;
  try {
    options = await getNegocioOptions();
  } catch (err) {
    return (
      <Shell>
        <DetailHeading />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  let detail;
  try {
    detail = await getNegocioDetail(id);
  } catch (err) {
    return (
      <Shell>
        <DetailHeading />
        <SelectorRow options={options} selectedId={id} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  if (
    detail.items.length === 0 &&
    detail.gastos.length === 0 &&
    detail.ventas.length === 0
  ) {
    return (
      <Shell>
        <DetailHeading />
        <SelectorRow options={options} selectedId={id} />
        <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
          <p className="font-display text-lg font-bold text-[#333333]">
            Sin información disponible
          </p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            El negocio <span className="font-medium text-[#333333]">{id}</span> no tiene items
            presupuestados, gastos ni ventas asociadas.
          </p>
        </section>
      </Shell>
    );
  }

  const agg = aggregateNegocio(
    detail.items,
    detail.gastos,
    detail.ventas,
    detail.ventasAggregate,
  );

  const referencia = detail.negocio?.referencia?.trim() || `Negocio ${id}`;
  const pdfFilename = `Cierre ${id} - ${referencia}`;

  return (
    <Shell>
      <DetailHeading />
      <SelectorRow options={options} selectedId={id} />
      <div className="flex justify-end" data-no-print="true">
        <DownloadPdfButton filename={pdfFilename} />
      </div>
      <PrintHeader negocio={detail.negocio} externalId={id} />
      <NegocioHeader negocio={detail.negocio} externalId={id} />
      {detail.evento && (
        <EventoResumen
          evento={detail.evento}
          marcaIngresoNeto={detail.marcaIngresoNeto}
          marcaIngresoBruto={detail.marcaIngresoBruto}
        />
      )}
      <ResumenKpis agg={agg} />
      <section data-pdf-section data-pdf-break-before="true" className="flex flex-col gap-6">
        <VentasSection agg={agg} ventas={detail.ventas} />
      </section>
      <section data-pdf-section data-pdf-break-before="true" className="flex flex-col gap-6">
        <header className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            Gastos
          </h2>
          <span className="font-sans text-xs text-[#666666]">
            Presupuesto vs gasto real, desglose por categoría y proveedores
          </span>
        </header>
        <KpiRow agg={agg} />
        <CategoriaBreakdown
          rows={agg.porCategoria}
          itemsConOcByCategoria={agg.itemsConOcByCategoria}
        />
        <CategoriaTree arbol={agg.arbol} />
        <div
          data-pdf-grid="side-by-side"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <TopProveedoresChart rows={agg.topProveedores} />
          <OcStatusPanel ocStatus={agg.ocStatus} />
        </div>
      </section>
    </Shell>
  );
}

function PrintHeader({
  negocio,
  externalId,
}: {
  negocio: Awaited<ReturnType<typeof getNegocioDetail>>["negocio"];
  externalId: string;
}) {
  const referencia = negocio?.referencia?.trim() || `Negocio ${externalId}`;
  const area = negocio?.area_negocio?.trim() || "";
  const today = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return (
    <div className="print-only border-b border-[#E5E5E5] pb-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={20} height={20} />
          <div className="flex flex-col">
            <span className="font-sans text-xs uppercase tracking-wide text-[#666666]">
              Informe de cierre · Negocio {externalId}
            </span>
            <span className="font-display text-base font-bold text-[#333333]">
              {referencia}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          {area && (
            <span className="font-sans text-xs text-[#666666]">{area}</span>
          )}
          <span className="font-sans text-xs text-[#999999]">
            Generado el {today}
          </span>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-pdf-shell
      className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8"
    >
      {children}
    </div>
  );
}

function ChooserHeading() {
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
        Escoge área de negocio
      </h1>
    </header>
  );
}

function AreaChooser() {
  const areas: AreaKey[] = ["produccion", "btl", "otros"];
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {areas.map((key) => (
        <Link
          key={key}
          href={`/cierre-negocio?area=${key}`}
          className="flex min-h-[120px] flex-col justify-between rounded-lg border border-[#E5E5E5] bg-white p-6 transition-colors hover:border-[#9F99F8] hover:bg-[#FAFAFA] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[#9F99F8]" />
          <span className="font-display text-lg font-bold leading-tight tracking-tight text-[#333333]">
            {AREA_LABELS[key]}
          </span>
        </Link>
      ))}
    </section>
  );
}

function ListHeading({ area }: { area: AreaKey }) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Volver al menú principal"
          className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
        >
          <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
        </Link>
        <Link
          href="/cierre-negocio"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
        >
          <ArrowLeft className="h-4 w-4" />
          Cambiar área
        </Link>
      </div>
      <p className="font-sans text-xs text-[#666666]">Cierre negocio · {AREA_LABELS[area]}</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Cierre de negocio
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Selecciona un negocio para ver su informe de cierre.
      </p>
    </header>
  );
}

function DetailHeading() {
  return (
    <header className="flex flex-col gap-3" data-no-print="true">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Volver al menú principal"
          className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
        >
          <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
        </Link>
        <Link
          href="/cierre-negocio"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>
      </div>
      <div>
        <p className="font-sans text-xs text-[#666666]">Cierre negocio</p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          Informe de cierre
        </h1>
      </div>
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
    <section className="flex flex-col gap-3" data-no-print="true">
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
