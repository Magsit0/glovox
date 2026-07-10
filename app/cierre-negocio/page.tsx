import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getCategoriaEventoMap,
  getNegocioDetail,
  getNegocioOptions,
} from "@/lib/queries/cierreNegocio";
import { getRebatePorcentaje } from "@/lib/queries/rebate";
import { getAllNegociosAdmin } from "@/lib/queries/cierreMensual";
import type { NegocioOption, NegocioRow } from "@/lib/unabase/types";
import { seriesColor } from "@/lib/chart-colors";
import { aggregateNegocio } from "@/lib/unabase/cierreNegocio";
import NegocioSelector from "@/components/cierre-negocio/NegocioSelector";
import NegocioHeader from "@/components/cierre-negocio/NegocioHeader";
import KpiRow from "@/components/cierre-negocio/KpiRow";
import CategoriaBreakdown from "@/components/cierre-negocio/CategoriaBreakdown";
import CategoriaTree from "@/components/cierre-negocio/CategoriaTree";
import GastosDocumentsTable from "@/components/cierre-negocio/GastosDocumentsTable";
import TopProveedoresChart from "@/components/cierre-negocio/TopProveedoresChart";
import OcStatusPanel from "@/components/cierre-negocio/OcStatusPanel";
import ResumenKpis from "@/components/cierre-negocio/ResumenKpis";
import EventoResumen from "@/components/cierre-negocio/EventoResumen";
import VentasSection from "@/components/cierre-negocio/VentasSection";
import DownloadPdfButton from "@/components/cierre-negocio/DownloadPdfButton";
import CierreTable from "@/components/cierre-negocio/CierreTable";
import GrupoNav from "@/components/cierre-negocio/GrupoNav";
import MontoModeToggle from "@/components/MontoModeToggle";
import { montoModeFrom } from "@/components/montoMode";

export const dynamic = "force-dynamic";

type AreaKey = "produccion" | "btl" | "corporativos" | "otros";

const AREA_LABELS: Record<AreaKey, string> = {
  produccion: "Producción de eventos propios",
  btl: "BTL",
  corporativos: "Corporativos",
  otros: "Otros",
};

function isAreaKey(value: string | undefined): value is AreaKey {
  return (
    value === "produccion" ||
    value === "btl" ||
    value === "corporativos" ||
    value === "otros"
  );
}

// Clasifica el area_negocio crudo en uno de los 3 buckets del dashboard.
function areaBucketOf(areaNegocio: string | null | undefined): AreaKey {
  const a = (areaNegocio ?? "").trim().toLowerCase();
  if (a === "produccion de eventos propios") return "produccion";
  if (a === "btl") return "btl";
  if (a === "corporativos") return "corporativos";
  return "otros";
}

function filterByArea(rows: NegocioRow[], area: AreaKey): NegocioRow[] {
  return rows.filter((r) => areaBucketOf(r.area_negocio) === area);
}

const SIN_RUT = "__sin_rut__";
const SIN_EJECUTIVO = "__sin_ejecutivo__";

type GroupBy = "cliente" | "ejecutivo";

function isGroupBy(value: string | undefined): value is GroupBy {
  return value === "cliente" || value === "ejecutivo";
}

function normalizeRut(rut: string | null | undefined): string {
  return (rut ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
}

function clienteKey(rut: string | null | undefined): string {
  return normalizeRut(rut) || SIN_RUT;
}

function ejecutivoKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase() || SIN_EJECUTIVO;
}

function formatRut(rut: string | null | undefined): string {
  const clean = normalizeRut(rut);
  if (clean.length < 2) return (rut ?? "").trim();
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

interface GroupCard {
  key: string;
  title: string;
  subtitle: string;
  count: number;
}

// Agrupa negocios por cliente (RUT normalizado) o por ejecutivo responsable.
// El título es cualquiera de los nombres presentes para esa llave.
function groupRows(rows: NegocioRow[], groupBy: GroupBy): GroupCard[] {
  const map = new Map<string, { title: string; subtitle: string; count: number }>();
  for (const r of rows) {
    let key: string;
    let title: string;
    let subtitle: string;
    if (groupBy === "cliente") {
      key = clienteKey(r.rut_cliente);
      title = (r.razon_cliente ?? "").trim();
      subtitle = key === SIN_RUT ? "Sin RUT" : formatRut(r.rut_cliente);
    } else {
      key = ejecutivoKey(r.ejecutivo);
      title = (r.ejecutivo ?? "").trim();
      subtitle = "";
    }
    let g = map.get(key);
    if (!g) {
      g = { title: "", subtitle, count: 0 };
      map.set(key, g);
    }
    g.count += 1;
    if (!g.title && title) g.title = title;
    if (!g.subtitle && subtitle) g.subtitle = subtitle;
  }
  const fallback = groupBy === "cliente" ? "Sin cliente" : "Sin ejecutivo";
  return Array.from(map.entries())
    .map(([key, g]) => ({
      key,
      title: g.title || fallback,
      subtitle: g.subtitle,
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

const CATEGORIA_OTRO = "Otro";

// Categoría del negocio = CategoriaEvento2 del EventoID (primeros 6 chars de la
// referencia) según glovox.categoriaEvento. Sin match → "Otro".
function categoriaDeNegocio(r: NegocioRow, catMap: Map<string, string>): string {
  const eid = (r.referencia ?? "").trim().slice(0, 6).toUpperCase();
  if (eid.length === 6) {
    const cat = catMap.get(eid);
    if (cat) return cat;
  }
  return CATEGORIA_OTRO;
}

function groupByCategoria(rows: NegocioRow[], catMap: Map<string, string>): GroupCard[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const cat = categoriaDeNegocio(r, catMap);
    map.set(cat, (map.get(cat) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, title: key, subtitle: "", count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

interface PageProps {
  searchParams: Promise<{
    id?: string;
    area?: string;
    cliente?: string;
    ejecutivo?: string;
    group?: string;
    categoria?: string;
    monto?: string;
    from?: string;
  }>;
}

// URL de retorno al listado. Solo se acepta un path interno del propio
// dashboard (evita redirects raros); si no, cae al selector de áreas.
function listadoHref(from: string | undefined): string {
  if (from && /^\/cierre-negocio(\?|$)/.test(from)) return from;
  return "/cierre-negocio";
}

// Bucket de área (produccion|btl|otros) leído del ?area= de la URL del listado
// de origen. null si no viene o no es válido.
function areaFromUrl(from: string | undefined): AreaKey | null {
  if (!from) return null;
  const q = from.indexOf("?");
  if (q < 0) return null;
  const a = new URLSearchParams(from.slice(q + 1)).get("area") ?? undefined;
  return isAreaKey(a) ? a : null;
}

// Opciones del selector acotadas al bucket de área (para que dentro de un
// cierre solo aparezcan los negocios de esa misma área). Sin bucket → todas.
function optionsForArea(
  options: NegocioOption[],
  bucket: AreaKey | null,
): NegocioOption[] {
  if (!bucket) return options;
  return options.filter((o) => areaBucketOf(o.area_negocio) === bucket);
}

export default async function CierreNegocioPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/cierre-negocio")) {
    redirect("/?unauthorized=1");
  }

  const { id, area, cliente, ejecutivo, group, categoria, monto: montoParam, from } =
    await searchParams;
  const monto = montoModeFrom(montoParam);
  const backToListado = listadoHref(from);

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

    const rows = filterByArea(negocios, area);

    // BTL y Corporativos (negocio por cliente): selección de cliente/ejecutivo
    // con transición animada (cards ↔ lista horizontal) y toggle de agrupamiento.
    if (area === "btl" || area === "corporativos") {
      const items = rows.map((row) => ({
        keys: {
          cliente: clienteKey(row.rut_cliente),
          ejecutivo: ejecutivoKey(row.ejecutivo),
        },
        row,
      }));
      const modes = [
        {
          key: "cliente",
          label: "Por cliente",
          title: "Escoge cliente",
          groups: groupRows(rows, "cliente"),
        },
        {
          key: "ejecutivo",
          label: "Por ejecutivo responsable",
          title: "Escoge ejecutivo responsable",
          groups: groupRows(rows, "ejecutivo"),
        },
      ];
      const initialMode = isGroupBy(group) ? group : ejecutivo ? "ejecutivo" : "cliente";

      return (
        <Shell>
          <GrupoNav
            area={area}
            eyebrowBase={`Cierre negocio · ${AREA_LABELS[area]}`}
            modes={modes}
            items={items}
            initialMode={initialMode}
            initialSelected={ejecutivo ?? cliente ?? null}
          />
        </Shell>
      );
    }

    // Producción de eventos propios: selección de categoría de evento con
    // transición animada (cards ↔ lista horizontal) en el cliente.
    if (area === "produccion") {
      let catMap: Map<string, string>;
      try {
        catMap = await getCategoriaEventoMap();
      } catch (err) {
        return (
          <Shell>
            <ListHeading area={area} />
            <ErrorView message={errorMessage(err)} />
          </Shell>
        );
      }

      const items = rows.map((row) => ({
        keys: { categoria: categoriaDeNegocio(row, catMap) },
        row,
      }));
      const modes = [
        {
          key: "categoria",
          label: "Categoría",
          title: "Escoge categoría de evento",
          groups: groupByCategoria(rows, catMap),
        },
      ];

      return (
        <Shell>
          <GrupoNav
            area="produccion"
            eyebrowBase={`Cierre negocio · ${AREA_LABELS.produccion}`}
            modes={modes}
            items={items}
            initialMode="categoria"
            initialSelected={categoria ?? null}
          />
        </Shell>
      );
    }

    return (
      <Shell>
        <ListHeading area={area} />
        <CierreTable rows={rows} />
      </Shell>
    );
  }

  let options;
  try {
    options = await getNegocioOptions();
  } catch (err) {
    return (
      <Shell>
        <DetailHeading backHref={backToListado} />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  let detail;
  try {
    detail = await getNegocioDetail(id, monto);
  } catch (err) {
    return (
      <Shell>
        <DetailHeading backHref={backToListado} />
        <SelectorRow
          options={optionsForArea(options, areaFromUrl(from))}
          selectedId={id}
          from={from}
        />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  // El selector dentro del cierre solo muestra negocios de la MISMA área: bucket
  // del ?area= de origen, o —si no viene— el del propio negocio.
  const selectorBucket =
    areaFromUrl(from) ??
    (detail.negocio ? areaBucketOf(detail.negocio.area_negocio) : null);
  const selectorOptions = optionsForArea(options, selectorBucket);

  if (
    detail.items.length === 0 &&
    detail.gastos.length === 0 &&
    detail.ventas.length === 0
  ) {
    return (
      <Shell>
        <DetailHeading backHref={backToListado} />
        <SelectorRow options={selectorOptions} selectedId={id} from={from} />
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

  // % de rebate leído fresco en cada render (fuera del detailCache de 5 min):
  // es editable en la propia página y así el guardado se refleja de inmediato.
  const rebatePorcentaje = detail.eventoId
    ? await getRebatePorcentaje(detail.eventoId)
    : null;

  return (
    <Shell>
      <DetailHeading backHref={backToListado} />
      <SelectorRow options={selectorOptions} selectedId={id} from={from} />
      <div className="flex justify-end" data-no-print="true">
        <DownloadPdfButton filename={pdfFilename} />
      </div>
      <PrintHeader negocio={detail.negocio} externalId={id} />
      <NegocioHeader negocio={detail.negocio} externalId={id} />
      {detail.evento && (
        <EventoResumen
          evento={detail.evento}
          eventoId={detail.eventoId}
          marcaIngresoNeto={detail.marcaIngresoNeto}
          marcaIngresoBruto={detail.marcaIngresoBruto}
          mesasVipNeto={detail.mesasVipNeto}
          mesasVipBruto={detail.mesasVipBruto}
          mediosNeto={detail.mediosNeto}
          mediosBruto={detail.mediosBruto}
          rebatePorcentaje={rebatePorcentaje}
          marcaDetalle={detail.marcaDetalle}
          mesasVipDetalle={detail.mesasVipDetalle}
          mediosDetalle={detail.mediosDetalle}
        />
      )}
      <UnabaseHeading />
      <ResumenKpis resumen={detail.resumen} />
      <section data-pdf-section data-pdf-break-before="true" className="flex flex-col gap-6">
        <VentasSection agg={agg} ventas={detail.ventas} />
      </section>
      <section data-pdf-section data-pdf-break-before="true" className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
              Gastos
            </h2>
            <span className="font-sans text-xs text-[#666666]">
              Presupuesto vs gasto real, desglose por categoría y proveedores
              {monto === "bruto" ? " · gasto bruto (con IVA)" : ""}
            </span>
          </div>
          {/* El switch aplica al GASTO documentado; las ventas ya muestran
              neto, IVA y bruto a la vez y el presupuesto es neto por diseño. */}
          <MontoModeToggle value={monto} />
        </header>
        <KpiRow agg={agg} />
        <CategoriaBreakdown
          rows={agg.porCategoria}
          itemsConOcByCategoria={agg.itemsConOcByCategoria}
        />
        <CategoriaTree arbol={agg.arbol} />
        <GastosDocumentsTable gastos={detail.gastos} />
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
      <div className="text-center">
        <p className="font-sans text-xs text-[#666666]">Cierre negocio</p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          Escoge área de negocio
        </h1>
      </div>
    </header>
  );
}

function AreaChooser() {
  const areas: AreaKey[] = ["produccion", "btl", "corporativos", "otros"];
  return (
    // ESQUEMA: 4 columnas verticales lado a lado (estilo glovox.io). El diseño
    // (imágenes de fondo por área, colores, hover) viene después.
    <section className="flex gap-2 sm:gap-3">
      {areas.map((key, i) => (
        <Link
          key={key}
          href={`/cierre-negocio?area=${key}`}
          className="group relative flex h-[70vh] flex-1 flex-col items-center justify-center gap-6 overflow-hidden rounded-lg bg-[#333333] py-8 transition-colors duration-200 hover:bg-[#2A2A2A] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        >
          {/* Línea de acento vertical (arriba del título). */}
          <span
            className="h-14 w-px shrink-0"
            style={{ backgroundColor: seriesColor(i) }}
          />
          {/* Título en vertical, leyendo de abajo hacia arriba. */}
          <span className="flex max-h-[72%] items-center rotate-180 font-display text-2xl font-bold leading-tight tracking-tight text-white [writing-mode:vertical-rl]">
            {AREA_LABELS[key]}
          </span>
        </Link>
      ))}
    </section>
  );
}

// Divisor de sección: abre el bloque de datos de Unabase (KPIs de resumen,
// Ventas y Gastos). Píldora centrada, gemela de la de "Inputs externos" en
// EventoResumen, para que las dos fuentes se lean como secciones hermanas.
function UnabaseHeading() {
  return (
    <div className="flex justify-center" data-pdf-section>
      <span className="inline-flex items-center gap-2 rounded-full bg-[#9F99F8] px-4 py-1.5 font-sans text-sm font-semibold uppercase tracking-wide text-white">
        <span className="inline-block h-2 w-2 rounded-full bg-white" />
        Admin y Finanzas: Unabase
      </span>
    </div>
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

function DetailHeading({ backHref }: { backHref: string }) {
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
          href={backHref}
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
  from,
}: {
  options: Awaited<ReturnType<typeof getNegocioOptions>>;
  selectedId: string;
  from?: string;
}) {
  return (
    <section className="flex flex-col gap-3" data-no-print="true">
      <p className="font-sans text-xs text-[#666666]">Negocio</p>
      <div className="max-w-xl">
        <NegocioSelector options={options} selectedId={selectedId} from={from} />
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
