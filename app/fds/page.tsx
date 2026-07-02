import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getFdsEventOptions,
  getFdsFfbb,
  getFdsFinanzas,
  getFdsResumen,
  getFdsTickets,
} from "@/lib/queries/fds";
import type { FdsResumen, FdsTabKey } from "@/lib/fds/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import FdsEventSelector from "@/components/fds/FdsEventSelector";
import FdsTabs from "@/components/fds/FdsTabs";
import FdsKpiRow, { type FdsKpiItem } from "@/components/fds/FdsKpiRow";
import FdsBarBreakdown from "@/components/fds/FdsBarBreakdown";
import FdsPresupuestoBars from "@/components/fds/FdsPresupuestoBars";
import CategoriaBreakdownFfbb from "@/components/ffbb/CategoriaBreakdownFfbb";
import TopProductosChart from "@/components/ffbb/TopProductosChart";
import VentasPorBarraTable from "@/components/ffbb/VentasPorBarraTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feria del Sanguche · Glovox",
  description: "Resumen integral por edición: tickets, FF&BB, finanzas y admin.",
};

interface PageProps {
  searchParams: Promise<{ id?: string; tab?: string }>;
}

function parseTab(raw: string | undefined): FdsTabKey {
  if (raw === "tickets" || raw === "ffbb" || raw === "finanzas") return raw;
  return "resumen";
}

export default async function FdsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/fds")) redirect("/?unauthorized=1");

  const params = await searchParams;
  const tab = parseTab(params.tab);

  let options;
  try {
    options = await getFdsEventOptions();
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  if (options.length === 0) {
    return (
      <Shell>
        <Heading />
        <EmptyView message="No hay ediciones de Feria del Sanguche en el catálogo." />
      </Shell>
    );
  }

  const requestedId = params.id?.trim() || "";
  const selected = options.find((o) => o.eventoId === requestedId) ?? options[0];
  const id = selected.eventoId;

  let resumen: FdsResumen;
  try {
    resumen = await getFdsResumen(id);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <SelectorRow options={options} selectedId={id} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Heading resumen={resumen} />
      <SelectorRow options={options} selectedId={id} />
      <FdsTabs
        active={tab}
        eventoId={id}
        tieneFfbb={resumen.tieneFfbb}
        tieneFinanzas={resumen.tieneFinanzas}
      />

      {tab === "resumen" && <ResumenSection resumen={resumen} />}
      {tab === "tickets" && <TicketsSection id={id} />}
      {tab === "ffbb" && <FfbbSection id={id} tieneFfbb={resumen.tieneFfbb} />}
      {tab === "finanzas" && <FinanzasSection id={id} />}
    </Shell>
  );
}

// --- Resumen ---------------------------------------------------------------

function ResumenSection({ resumen }: { resumen: FdsResumen }) {
  const kpis: FdsKpiItem[] = [
    {
      label: "Asistentes",
      value: resumen.asistentes ? formatNumber(resumen.asistentes) : "—",
      caption: resumen.asistentes ? "en cierre de evento" : "sin dato de asistencia",
    },
    {
      label: "Venta tickets",
      value: compactCurrency(resumen.ventaTickets),
      caption: `${formatNumber(resumen.tickets)} tickets`,
    },
    {
      label: "Venta FF&BB",
      value: resumen.tieneFfbb ? compactCurrency(resumen.ventaFfbb) : "—",
      caption: resumen.tieneFfbb ? `${formatNumber(resumen.unidadesFfbb)} unidades` : "sin datos de barra",
    },
    {
      label: "Venta total",
      value: compactCurrency(resumen.ventaTotal),
      caption: "tickets + FF&BB + cargo",
    },
  ];

  const secundarios: FdsKpiItem[] = [
    {
      label: "Per cápita FF&BB",
      value: resumen.perCapitaFfbb != null ? formatCurrency(resumen.perCapitaFfbb) : "—",
      caption: "gasto en barra por asistente",
    },
    {
      label: "Per cápita tickets",
      value: resumen.perCapitaTickets != null ? formatCurrency(resumen.perCapitaTickets) : "—",
      caption: "ingreso de ticket por asistente",
    },
    {
      label: "Cargo por servicio",
      value: compactCurrency(resumen.cargoServicio),
      caption: "recargo de ticketera",
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <FdsKpiRow items={kpis} />
      <FdsKpiRow items={secundarios} cols={3} />
      <CoverageNote resumen={resumen} />
    </section>
  );
}

function CoverageNote({ resumen }: { resumen: FdsResumen }) {
  const faltantes: string[] = [];
  if (!resumen.tieneFfbb) faltantes.push("FF&BB");
  if (!resumen.tieneFinanzas) faltantes.push("Finanzas & Admin");
  if (faltantes.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#E5E5E5] bg-white p-4">
      <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#F6C544]" />
      <p className="font-sans text-sm text-[#666666]">
        Esta edición no tiene datos de{" "}
        <span className="font-medium text-[#333333]">{faltantes.join(" ni ")}</span>. Suele pasar en
        ediciones antiguas o aún sin cierre.
      </p>
    </div>
  );
}

// --- Tickets ---------------------------------------------------------------

async function TicketsSection({ id }: { id: string }) {
  let data;
  try {
    data = await getFdsTickets(id);
  } catch (err) {
    return <ErrorView message={errorMessage(err)} />;
  }
  if (data.kpis.tickets === 0) {
    return <EmptyView message="Esta edición no tiene ventas de tickets registradas." />;
  }

  const kpis: FdsKpiItem[] = [
    { label: "Tickets vendidos", value: formatNumber(data.kpis.tickets), caption: "no devueltos" },
    {
      label: "Venta tickets",
      value: compactCurrency(data.kpis.venta),
      caption: formatCurrency(data.kpis.venta),
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(data.kpis.ticketPromedio),
      caption: "por ticket",
    },
    { label: "Cortesías", value: formatNumber(data.kpis.cortesias), caption: "entradas liberadas" },
  ];

  return (
    <section className="flex flex-col gap-6">
      <FdsKpiRow items={kpis} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FdsBarBreakdown
          title="Venta por tipo de ticket"
          subtitle="Ranking de tipos de entrada por venta."
          rows={data.porTipo.map((r) => ({
            label: r.label,
            value: r.venta,
            sub: `${formatNumber(r.qtty)} tickets`,
          }))}
          colorIndex={0}
        />
        <FdsBarBreakdown
          title="Venta por categoría de ticket"
          subtitle="Preventas, normal y otras categorías."
          rows={data.porCategoria.map((r) => ({
            label: r.label,
            value: r.venta,
            sub: `${formatNumber(r.qtty)} tickets`,
          }))}
          colorIndex={2}
        />
      </div>
    </section>
  );
}

// --- FF&BB -----------------------------------------------------------------

async function FfbbSection({ id, tieneFfbb }: { id: string; tieneFfbb: boolean }) {
  if (!tieneFfbb) {
    return <EmptyView message="Esta edición no tiene ventas de alimentos y bebidas registradas." />;
  }
  let data;
  try {
    data = await getFdsFfbb(id);
  } catch (err) {
    return <ErrorView message={errorMessage(err)} />;
  }

  const kpis: FdsKpiItem[] = [
    {
      label: "Venta FF&BB",
      value: compactCurrency(data.kpis.ventas),
      caption: formatCurrency(data.kpis.ventas),
    },
    {
      label: "Unidades",
      value: formatNumber(data.kpis.unidades),
      caption: `${formatNumber(data.kpis.productosUnicos)} productos únicos`,
    },
    {
      label: "Per cápita",
      value: data.perCapita != null ? formatCurrency(data.perCapita) : "—",
      caption: "gasto en barra por asistente",
    },
    {
      label: "Ticket promedio",
      value: formatCurrency(data.kpis.ticketPromedio),
      caption: `${formatNumber(data.kpis.transacciones)} transacciones`,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <FdsKpiRow items={kpis} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoriaBreakdownFfbb rows={data.porCategoria} />
        <TopProductosChart rows={data.topProductos} />
      </div>
      <VentasPorBarraTable rows={data.porPunto} />
    </section>
  );
}

// --- Finanzas & Admin ------------------------------------------------------

async function FinanzasSection({ id }: { id: string }) {
  let data;
  try {
    data = await getFdsFinanzas(id);
  } catch (err) {
    return <ErrorView message={errorMessage(err)} />;
  }
  if (!data) {
    return (
      <EmptyView message="Esta edición no tiene un negocio de producción conectado en finanzas (referencia sin el EventoID)." />
    );
  }

  const margenTone = data.margen >= 0 ? "positive" : "negative";
  const kpis: FdsKpiItem[] = [
    {
      label: "Ingreso neto",
      value: compactCurrency(data.neto),
      caption: `facturado ${compactCurrency(data.facturado)}`,
    },
    {
      label: "Gasto real",
      value: compactCurrency(data.costoReal),
      caption: `presupuestado ${compactCurrency(data.costoPresupuestado)}`,
    },
    {
      label: "Margen",
      value: compactCurrency(data.margen),
      caption: data.margenPct != null ? `${(data.margenPct * 100).toFixed(1)}% sobre ingreso` : "sin base",
      tone: margenTone,
    },
    {
      label: "Estado del negocio",
      value: data.estado || "—",
      caption: data.cliente || `negocio ${data.negocioId}`,
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <FdsKpiRow items={kpis} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FdsPresupuestoBars rows={data.itemsPorCategoria} />
        <FdsBarBreakdown
          title="Top proveedores"
          subtitle="Gasto real por proveedor (OCs)."
          rows={data.topProveedores.map((p) => ({
            label: p.proveedor,
            value: p.monto,
            sub: `${formatNumber(p.docs)} doc${p.docs === 1 ? "" : "s"}`,
          }))}
          colorIndex={5}
          emptyText="Sin gastos con proveedor registrados."
        />
      </div>
      <p className="font-sans text-xs text-[#999999]">
        Negocio {data.negocioId} · {data.referencia} · área {data.area.toLowerCase()}
      </p>
    </section>
  );
}

// --- Chrome ----------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="min-h-screen bg-[#FAFAFA] text-[#333333]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
        {children}
      </div>
    </main>
  );
}

function Heading({ resumen }: { resumen?: FdsResumen }) {
  const fechaLabel = resumen?.fechaEvento
    ? new Date(resumen.fechaEvento).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
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
        <p className="font-sans text-xs text-[#666666]">
          Feria del Sanguche
          {resumen && (
            <>
              {" · "}
              {resumen.eventoId}
              {resumen.temporada && <span className="text-[#999999]"> · temp. {resumen.temporada}</span>}
              {fechaLabel && <span className="text-[#999999]"> · {fechaLabel}</span>}
            </>
          )}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          {resumen?.nombre ?? "Feria del Sanguche"}
        </h1>
      </div>
      <Link
        href="/fds/historico"
        className="inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
      >
        <TrendingUp className="h-4 w-4" />
        Histórico entre ediciones
      </Link>
    </header>
  );
}

function SelectorRow({
  options,
  selectedId,
}: {
  options: Awaited<ReturnType<typeof getFdsEventOptions>>;
  selectedId: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="font-sans text-xs text-[#666666]">Edición</p>
      <div className="max-w-xl">
        <FdsEventSelector options={options} selectedId={selectedId} />
      </div>
    </section>
  );
}

function EmptyView({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center">
      <p className="font-display text-lg font-bold text-[#333333]">Sin información disponible</p>
      <p className="mt-2 font-sans text-sm text-[#666666]">{message}</p>
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
  return err instanceof Error ? err.message : "Error inesperado al cargar el dashboard de FDS";
}
