import { Suspense, cache } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getOnepagerKpis,
  getOnepagerByIngreso,
  getOnepagerTicketsByTipo,
  getOnepagerFfbbByCategoriaProducto,
  getOnepagerFfbbByPuntoVenta,
  getOnepagerFfbbEvolucion,
  getOnepagerTicketsAsistencia,
  getOnepagerEventList,
  getOnepagerRecentEvents,
  getOnepagerListadoKpis,
  getOnepagerFfbbConsumo,
  getOnepagerLlegadas,
  type OnepagerIngresoRow,
} from "@/lib/queries/onepager";
import { getCierreEvento, getCierreEventos } from "@/lib/queries/cierreEventos";
import { getRebatePorcentaje } from "@/lib/queries/rebate";
import { rebateFrom } from "@/lib/constants/rebate";
import { brutoToNeto } from "@/lib/constants/tax";
import {
  getMarcaClientes,
  getMarcaIngresosByEvento,
  getMarcaIngresosAggByEvento,
  getMarcaIngresosAggMap,
  getMarcaIngresosMatrix,
} from "@/lib/queries/marca";
import {
  getMesasVipClientes,
  getMesasVipMatrix,
  getMesasVipAggByEvento,
} from "@/lib/queries/mesasVip";
import {
  getMarcaClientesConTag,
  getMediosMatrix,
  getMediosAggByEvento,
} from "@/lib/queries/medios";
import {
  getMarcaClientesConTagProducto,
  getProductoMatrix,
  getProductoAggByEvento,
} from "@/lib/queries/producto";
import {
  getOnepagerCostosMap,
  getOnepagerFacturacionMap,
  getOnepagerCostosByEvento,
  getOnepagerFacturasByEvento,
} from "@/lib/queries/onepagerCostos";
import EventSelector from "@/components/onepager/EventSelector";
import BrutalChartPanel from "@/components/onepager/BrutalChartPanel";
import IngresoChart from "@/components/onepager/IngresoChart";
import IngresosResumen from "@/components/onepager/IngresosResumen";
import LlegadasChart from "@/components/onepager/LlegadasChart";
import DetalleTabs from "@/components/onepager/DetalleTabs";
import OnepagerListadoTable, {
  type OnepagerListadoTableRow,
} from "@/components/onepager/OnepagerListadoTable";

function Skeleton() {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-6 animate-pulse">
      <div className="h-5 bg-[#F0F0F0] rounded w-1/3 mb-4" />
      <div className="h-40 bg-[#F0F0F0] rounded-lg" />
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 animate-pulse">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Skeleton /><Skeleton /><Skeleton />
        </div>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Skeleton /><Skeleton /><Skeleton /><Skeleton />
        </div>
      </div>
      <div className="rounded-xl bg-[#F0EFFE] lg:col-span-1 min-h-[220px]" />
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function OnepagerPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const params = await searchParams;
  const eventoId = params.event;

  // Sin ?event=  → vista índice (matriz de todos los eventos).
  if (!eventoId) {
    return (
      <div className="text-[#333333] min-h-full p-6 space-y-6">
        <Link
          href="/"
          aria-label="Volver al menú principal"
          className="inline-flex items-center justify-center border border-[#E5E5E5] rounded-lg bg-white p-1.5 shadow-sm transition-colors hover:bg-[#FAFAFA]"
        >
          <Image
            src="/glovox_logo_gvx_black.svg"
            alt="Glovox"
            width={24}
            height={24}
            priority
          />
        </Link>
        <h1 className="font-display font-bold text-3xl leading-none text-[#333333] tracking-tight">
          Eventos
        </h1>
        <Suspense fallback={<Skeleton />}>
          <ListadoSection />
        </Suspense>
      </div>
    );
  }

  // Con ?event=  → vista detalle (one-pager por evento).
  const [events, recentEvents] = await Promise.all([
    getOnepagerEventList(),
    getOnepagerRecentEvents(),
  ]);

  if (events.length === 0) {
    return (
      <div className="text-[#333333] min-h-full p-6">
        <p className="font-sans text-sm text-[#666666]">
          No hay eventos disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="text-[#333333] min-h-full">
      <EventSelector
        events={events}
        selected={eventoId}
        recentEvents={recentEvents}
      />

      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al menú principal"
            className="inline-flex items-center justify-center border border-[#E5E5E5] rounded-lg bg-white p-1.5 shadow-sm transition-colors hover:bg-[#FAFAFA]"
          >
            <Image
              src="/glovox_logo_gvx_black.svg"
              alt="Glovox"
              width={24}
              height={24}
              priority
            />
          </Link>
          <Link
            href="/onepager"
            className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] hover:bg-[#FAFAFA] transition-colors"
          >
            ← Volver al listado
          </Link>
        </div>

        <Suspense fallback={<CardsSkeleton />}>
          <ResumenSection eventoId={eventoId} />
        </Suspense>

        <Suspense fallback={<Skeleton />}>
          <IngresoSection eventoId={eventoId} />
        </Suspense>

        <Suspense fallback={<Skeleton />}>
          <ValidacionSection eventoId={eventoId} />
        </Suspense>

        <Suspense fallback={<Skeleton />}>
          <DetalleSection eventoId={eventoId} />
        </Suspense>
      </div>
    </div>
  );
}

// ---------- Listado section ----------

async function ListadoSection() {
  const [
    listado,
    cierres,
    marcaMap,
    marcaClientes,
    marcaMatrix,
    ffbbConsumo,
    mesasVipClientes,
    mesasVipMatrix,
    mediosMarcas,
    mediosMatrix,
    productoMarcas,
    productoMatrix,
    costosMap,
    facturacionMap,
  ] = await Promise.all([
    getOnepagerListadoKpis(),
    getCierreEventos(),
    getMarcaIngresosAggMap(),
    getMarcaClientes(),
    getMarcaIngresosMatrix(),
    getOnepagerFfbbConsumo(),
    getMesasVipClientes(),
    getMesasVipMatrix(),
    getMarcaClientesConTag(),
    getMediosMatrix(),
    getMarcaClientesConTagProducto(),
    getProductoMatrix(),
    getOnepagerCostosMap(),
    getOnepagerFacturacionMap(),
  ]);

  const asistMap = new Map<string, number | null>();
  const cat2Map = new Map<string, string>();
  for (const c of cierres) {
    asistMap.set(c.eventoId, c.totalAsistentes);
    if (c.categoriaEvento2) cat2Map.set(c.eventoId, c.categoriaEvento2);
  }

  const rows: OnepagerListadoTableRow[] = listado.map((r) => ({
    eventoId:         r.eventoId,
    nombre:           r.nombre,
    categoriaEvento:  r.categoriaEvento,
    categoriaEvento2: cat2Map.get(r.eventoId) ?? "",
    fechaEvento:      r.fechaEvento,
    ventaTickets:     r.ventaTickets,
    ticketsComprados: r.ticketsComprados,
    ventaFfBb:        r.ventaFfBb,
    ventaMarcas:      marcaMap.get(r.eventoId) ?? 0,
    asistentes:       asistMap.has(r.eventoId) ? asistMap.get(r.eventoId)! : null,
    // Unabase (neto). null = el evento no tiene negocio vigente con datos.
    costos:           costosMap.get(r.eventoId)?.gastoNeto ?? null,
    facturado:        facturacionMap.get(r.eventoId)?.ventaNeta ?? null,
  }));

  return (
    <OnepagerListadoTable
      rows={rows}
      marcaClientes={marcaClientes}
      marcaMatrix={marcaMatrix}
      ffbbConsumo={ffbbConsumo}
      mesasVipClientes={mesasVipClientes}
      mesasVipMatrix={mesasVipMatrix}
      mediosMarcas={mediosMarcas}
      mediosMatrix={mediosMatrix}
      productoMarcas={productoMarcas}
      productoMatrix={productoMatrix}
    />
  );
}

// ---------- Datos compartidos del detalle ----------

/**
 * Todo lo que necesitan ResumenSection e IngresoSection. `cache()` dedupea
 * entre ambas dentro del mismo render (cada Suspense lo pide por su lado).
 *
 * Rebate — MISMO criterio que /cierre-negocio: % imputado por evento
 * (`rebate_config`, default 55%, editable desde ambos dashboards) sobre el cargo
 * por servicio REAL (cierreEventos.TotalCargoServicio, bruto). El rebate
 * modelado Venta × 15% × 55% que vivía en el SQL se retiró el 2026-09-02.
 */
const loadEventoResumen = cache(async function loadEventoResumen(eventoId: string) {
  const [
    kpis,
    byIngreso,
    cierre,
    rebatePct,
    marcaAgg,
    mesasVipAgg,
    mediosAgg,
    productoAgg,
    costos,
    facturas,
  ] = await Promise.all([
    getOnepagerKpis(eventoId),
    getOnepagerByIngreso(eventoId),
    getCierreEvento(eventoId),
    getRebatePorcentaje(eventoId),
    getMarcaIngresosAggByEvento(eventoId),
    getMesasVipAggByEvento(eventoId),
    getMediosAggByEvento(eventoId),
    getProductoAggByEvento(eventoId),
    getOnepagerCostosByEvento(eventoId),
    getOnepagerFacturasByEvento(eventoId),
  ]);
  const cargoBruto = cierre?.totalCargoServicio ?? null;
  const rebateBruto = cargoBruto != null ? rebateFrom(cargoBruto, rebatePct) : null;
  return {
    kpis,
    byIngreso,
    cierre,
    rebatePct,
    cargoBruto,
    rebateBruto,
    marcaAgg,
    mesasVipAgg,
    mediosAgg,
    productoAgg,
    costos,
    facturas,
  };
});

// ---------- Sections ----------

async function ResumenSection({ eventoId }: { eventoId: string }) {
  const d = await loadEventoResumen(eventoId);
  const facturadoNeto = d.facturas.reduce((a, f) => a + f.ventaNeta, 0);
  const facturadoBruto = d.facturas.reduce((a, f) => a + f.ventaBruta, 0);
  return (
    <IngresosResumen
      eventoId={eventoId}
      ventaTicketsBruto={d.kpis.ventaTickets}
      ventaFfBbBruto={d.kpis.ventaFfBb}
      cargoServicioBruto={d.cargoBruto}
      rebatePct={d.rebatePct}
      marcas={{ neto: d.marcaAgg.ventaNeto, bruto: d.marcaAgg.ventaBruto }}
      mesasVip={{ neto: d.mesasVipAgg.ventaNeto, bruto: d.mesasVipAgg.ventaBruto }}
      medios={{ neto: d.mediosAgg.ventaNeto, bruto: d.mediosAgg.ventaBruto }}
      producto={{ neto: d.productoAgg.ventaNeto, bruto: d.productoAgg.ventaBruto }}
      costos={{
        neto: d.costos.resumen.gastoNeto,
        bruto: d.costos.resumen.gastoBruto,
        lineas: d.costos.resumen.lineas,
        negocios: d.costos.negocios.length,
      }}
      facturado={{ neto: facturadoNeto, bruto: facturadoBruto, docs: d.facturas.length }}
      asistentes={d.cierre?.totalAsistentes ?? null}
    />
  );
}

async function DetalleSection({ eventoId }: { eventoId: string }) {
  const [
    ticketsByTipo,
    ffbbByCatProd,
    ffbbByPuntoVenta,
    ffbbEvolucion,
    marcaClientes,
    marcaIngresos,
    costos,
    facturas,
  ] = await Promise.all([
    getOnepagerTicketsByTipo(eventoId),
    getOnepagerFfbbByCategoriaProducto(eventoId),
    getOnepagerFfbbByPuntoVenta(eventoId),
    getOnepagerFfbbEvolucion(eventoId),
    getMarcaClientes(),
    getMarcaIngresosByEvento(eventoId),
    getOnepagerCostosByEvento(eventoId),
    getOnepagerFacturasByEvento(eventoId),
  ]);
  return (
    <DetalleTabs
      eventoId={eventoId}
      ticketsByTipo={ticketsByTipo}
      ffbbByCatProd={ffbbByCatProd}
      ffbbByPuntoVenta={ffbbByPuntoVenta}
      ffbbEvolucion={ffbbEvolucion}
      marcaClientes={marcaClientes}
      marcaIngresos={marcaIngresos}
      costos={costos}
      facturas={facturas}
    />
  );
}

/**
 * Validación de asistencia: tickets emitidos vs personas que entraron, por tipo
 * (VENTA / CORTESIA), en PERSONAS. Separado de las cards de ingresos: es un
 * chequeo operativo, no una cifra de negocio.
 */
async function ValidacionSection({ eventoId }: { eventoId: string }) {
  const [asistencia, llegadas] = await Promise.all([
    getOnepagerTicketsAsistencia(eventoId),
    getOnepagerLlegadas(eventoId),
  ]);
  const VENTA_ORDER: Record<string, number> = { VENTA: 0, CORTESIA: 1 };
  const asistenciaSorted = [...asistencia].sort(
    (a, b) => (VENTA_ORDER[a.ventaNoventa] ?? 99) - (VENTA_ORDER[b.ventaNoventa] ?? 99)
  );
  const totalQtty = asistenciaSorted.reduce((a, r) => a + r.qtty, 0);
  const totalQtty2 = asistenciaSorted.reduce((a, r) => a + r.qtty2, 0);
  const totalPct = totalQtty > 0 ? (totalQtty2 / totalQtty) * 100 : null;

  const TH =
    "font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3";
  const NUM = "font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums";

  return (
    <BrutalChartPanel title="Validación de asistencia">
      <p className="font-sans text-xs text-[#666666] -mt-2 mb-4">
        Personas con ticket vs personas que entraron (quemados), por tipo de
        ticket. Los asistentes son los que se usan en los percápita.
      </p>
      {/* Tres cifras arriba, tabla a ancho completo abajo (misma grilla que las
          cifras del peak más abajo, para que el panel lea como una sola pieza). */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">Tickets emitidos</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {totalQtty.toLocaleString("es-CL")}
          </p>
          <p className="mt-2 font-sans text-xs text-[#999999]">Personas con ticket (venta + cortesía)</p>
        </div>
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">Asistentes</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {totalQtty2.toLocaleString("es-CL")}
          </p>
          <p className="mt-2 font-sans text-xs text-[#999999]">Personas que entraron (quemados)</p>
        </div>
        <div className="border border-[#E5E5E5] rounded-lg p-4">
          <p className="font-sans text-xs text-[#666666]">% asistencia</p>
          <p className="mt-2 font-display font-bold text-2xl leading-none tracking-tight text-[#333333] tabular-nums">
            {totalPct != null ? `${totalPct.toFixed(1)}%` : "—"}
          </p>
          <p className="mt-2 font-sans text-xs text-[#999999]">
            {totalQtty > 0
              ? `${(totalQtty - totalQtty2).toLocaleString("es-CL")} personas no asistieron`
              : "Sin tickets emitidos"}
          </p>
        </div>
      </div>

      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <th className={`${TH} text-left`}>Tipo</th>
                <th className={`${TH} text-right`}>Tickets</th>
                <th className={`${TH} text-right`}>Asistentes</th>
                <th className={`${TH} text-right`}>% asistencia</th>
              </tr>
            </thead>
            <tbody>
              {asistenciaSorted.map((r) => {
                const pct = r.qtty > 0 ? (r.qtty2 / r.qtty) * 100 : null;
                return (
                  <tr
                    key={r.ventaNoventa}
                    className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                  >
                    <td className="font-sans text-sm font-medium text-[#333333] px-4 py-3">
                      {r.ventaNoventa === "CORTESIA" ? "Cortesía" : r.ventaNoventa === "VENTA" ? "Venta" : r.ventaNoventa}
                    </td>
                    <td className={NUM}>{r.qtty.toLocaleString("es-CL")}</td>
                    <td className={NUM}>{r.qtty2.toLocaleString("es-CL")}</td>
                    <td className={NUM}>{pct != null ? `${pct.toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
              <tr className="bg-[#FAFAFA]">
                <td className="font-sans text-sm font-semibold text-[#333333] px-4 py-3">
                  Total
                </td>
                <td className={`${NUM} font-semibold`}>{totalQtty.toLocaleString("es-CL")}</td>
                <td className={`${NUM} font-semibold`}>{totalQtty2.toLocaleString("es-CL")}</td>
                <td className={`${NUM} font-semibold`}>
                  {totalPct != null ? `${totalPct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
      </div>

      {/* Curva de hora de llegada (quemados por slot de 15 min) con el peak marcado */}
      <div className="mt-6 pt-6 border-t border-[#E5E5E5]">
        <h4 className="font-display font-bold text-base text-[#333333] mb-1">
          Evolución de hora de llegada
        </h4>
        <p className="font-sans text-xs text-[#666666] mb-4">
          Personas que entraron por slot de 15 minutos según la hora de quemado del
          ticket, con el peak marcado y el % de público acumulado.
        </p>
        <LlegadasChart data={llegadas} />
      </div>
    </BrutalChartPanel>
  );
}

function fmtClp(value: number) {
  return value.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });
}

function labelIngreso(ingreso: string): string {
  if (ingreso === "FFBB") return "FF&BB";
  if (ingreso === "TICKETS") return "Tickets";
  if (ingreso === "REBATE") return "Rebate";
  if (ingreso === "MARCAS") return "Marcas";
  if (ingreso === "MESAS VIP") return "Mesas VIP";
  if (ingreso === "MEDIOS") return "Medios";
  if (ingreso === "PRODUCTO") return "Producto";
  return ingreso;
}

type IngresoFila = {
  ingreso: string;
  neto: number;
  iva: number;
  bruto: number;
  /** null = no aplica (rebate no tiene unidades). */
  qtty: number | null;
};

async function IngresoSection({ eventoId }: { eventoId: string }) {
  const d = await loadEventoResumen(eventoId);
  const totalAsistentes = d.cierre?.totalAsistentes ?? null;
  const hasAttendees = totalAsistentes != null && totalAsistentes > 0;

  // Todo en NETO (misma base que las cards y que /cierre-negocio): tickets y
  // FF&BB vienen brutos de BigQuery → neto = ÷1,19; las imputaciones manuales
  // (Neon) ya traen neto y bruto; el rebate se deriva del cargo por servicio.
  const desdeBruto = (ingreso: string, bruto: number, qtty: number | null): IngresoFila => {
    const neto = brutoToNeto(bruto);
    return { ingreso, neto, iva: bruto - neto, bruto, qtty };
  };
  const manual = (
    ingreso: string,
    agg: { ventaNeto: number; ventaBruto: number; qtty: number },
  ): IngresoFila => ({
    ingreso,
    neto: agg.ventaNeto,
    iva: agg.ventaBruto - agg.ventaNeto,
    bruto: agg.ventaBruto,
    qtty: agg.qtty,
  });

  const data: IngresoFila[] = [
    ...d.byIngreso.map((r) => desdeBruto(r.ingreso, r.venta, r.qtty)),
    ...(d.rebateBruto != null ? [desdeBruto("REBATE", d.rebateBruto, null)] : []),
    manual("MARCAS", d.marcaAgg),
    manual("MESAS VIP", d.mesasVipAgg),
    manual("MEDIOS", d.mediosAgg),
    manual("PRODUCTO", d.productoAgg),
  ].sort((a, b) => b.neto - a.neto);

  const totalNeto = data.reduce((a, r) => a + r.neto, 0);
  const totalIva = data.reduce((a, r) => a + r.iva, 0);
  const totalBruto = data.reduce((a, r) => a + r.bruto, 0);

  // El donut reparte el NETO.
  const chartData: OnepagerIngresoRow[] = data.map((r) => ({
    ingreso: r.ingreso,
    venta: r.neto,
    qtty: r.qtty ?? 0,
  }));

  const TH =
    "font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3";

  return (
    <BrutalChartPanel title="Ingresos por fuente">
      <p className="font-sans text-xs text-[#666666] -mt-2 mb-4">
        Montos netos (sin IVA). Rebate = {d.rebatePct}% del cargo por servicio.
        Percápita = neto / asistentes
        {hasAttendees ? ` (${totalAsistentes!.toLocaleString("es-CL")})` : " (sin asistentes en cierreEventos)"}.
      </p>
      <div className="flex items-start gap-8">
        {/* Tabla */}
        <div className="overflow-x-auto flex-1">
          <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                  <th className={`${TH} text-left`}>Ingreso</th>
                  <th className={`${TH} text-right`}>Neto</th>
                  <th className={`${TH} text-right`}>IVA</th>
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={`${TH} text-right`}>Qtty</th>
                  <th className={`${TH} text-right`}>Percápita</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.ingreso}
                    className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                  >
                    <td className="font-sans text-sm font-medium text-[#333333] px-4 py-3">
                      {labelIngreso(row.ingreso)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                      {fmtClp(row.neto)}
                    </td>
                    <td className="font-sans text-sm text-[#666666] px-4 py-3 text-right tabular-nums">
                      {fmtClp(row.iva)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                      {fmtClp(row.bruto)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                      {row.qtty != null ? row.qtty.toLocaleString("es-CL") : "—"}
                    </td>
                    <td className="font-sans text-sm text-[#666666] px-4 py-3 text-right tabular-nums">
                      {hasAttendees ? fmtClp(row.neto / totalAsistentes!) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#FAFAFA]">
                  <td className="font-sans text-sm font-semibold text-[#333333] px-4 py-3">
                    Total
                  </td>
                  <td className="font-sans text-sm font-semibold text-[#333333] px-4 py-3 text-right tabular-nums">
                    {fmtClp(totalNeto)}
                  </td>
                  <td className="font-sans text-sm font-semibold text-[#666666] px-4 py-3 text-right tabular-nums">
                    {fmtClp(totalIva)}
                  </td>
                  <td className="font-sans text-sm font-semibold text-[#333333] px-4 py-3 text-right tabular-nums">
                    {fmtClp(totalBruto)}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="font-sans text-sm font-semibold text-[#666666] px-4 py-3 text-right tabular-nums">
                    {hasAttendees ? fmtClp(totalNeto / totalAsistentes!) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Donut al lado derecho */}
        <div className="flex-shrink-0 w-[144px]">
          <IngresoChart data={chartData} />
        </div>
      </div>
    </BrutalChartPanel>
  );
}
