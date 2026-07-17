import { Suspense } from "react";
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
} from "@/lib/queries/onepager";
import { getCierreEventos, getTotalAsistentes } from "@/lib/queries/cierreEventos";
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
import EventSelector from "@/components/onepager/EventSelector";
import BrutalKpiCard from "@/components/onepager/BrutalKpiCard";
import BrutalChartPanel from "@/components/onepager/BrutalChartPanel";
import IngresoChart from "@/components/onepager/IngresoChart";
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
        <Suspense
          fallback={
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton /><Skeleton /><Skeleton /><Skeleton />
              </div>
              <Skeleton />
            </div>
          }
        >
          <KpiStrip eventoId={eventoId} />
        </Suspense>

        <Suspense fallback={<Skeleton />}>
          <IngresoSection eventoId={eventoId} />
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

// ---------- Sections ----------

async function DetalleSection({ eventoId }: { eventoId: string }) {
  const [
    ticketsByTipo,
    ffbbByCatProd,
    ffbbByPuntoVenta,
    ffbbEvolucion,
    marcaClientes,
    marcaIngresos,
  ] = await Promise.all([
    getOnepagerTicketsByTipo(eventoId),
    getOnepagerFfbbByCategoriaProducto(eventoId),
    getOnepagerFfbbByPuntoVenta(eventoId),
    getOnepagerFfbbEvolucion(eventoId),
    getMarcaClientes(),
    getMarcaIngresosByEvento(eventoId),
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
    />
  );
}

async function KpiStrip({ eventoId }: { eventoId: string }) {
  const [kpis, asistencia] = await Promise.all([
    getOnepagerKpis(eventoId),
    getOnepagerTicketsAsistencia(eventoId),
  ]);
  const VENTA_ORDER: Record<string, number> = { VENTA: 0, CORTESIA: 1 };
  const asistenciaSorted = [...asistencia].sort(
    (a, b) => (VENTA_ORDER[a.ventaNoventa] ?? 99) - (VENTA_ORDER[b.ventaNoventa] ?? 99)
  );
  const totalQtty = asistenciaSorted.reduce((a, r) => a + r.qtty, 0);
  const totalQtty2 = asistenciaSorted.reduce((a, r) => a + r.qtty2, 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Montos (izquierda) */}
      <div className="grid grid-cols-2 gap-4">
        <BrutalKpiCard
          label="Venta Total"
          value={kpis.totalVenta}
          formatType="clp"
        />
        <BrutalKpiCard
          label="Venta Tickets"
          value={kpis.ventaTickets}
          formatType="clp"
        />
        <BrutalKpiCard
          label="Venta FF&BB"
          value={kpis.ventaFfBb}
          formatType="clp"
        />
        <BrutalKpiCard
          label="Rebate Est."
          value={kpis.totalRebate}
          formatType="clp"
        />
      </div>

      {/* Conteos: tickets vs asistentes por tipo (derecha) */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
              <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
                Tipo
              </th>
              <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                Tickets
              </th>
              <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                Asistentes
              </th>
              <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                % Asistencia
              </th>
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
                    {r.ventaNoventa}
                  </td>
                  <td className="font-display font-bold text-xl leading-none text-[#333333] px-4 py-3 text-right tabular-nums">
                    {r.qtty.toLocaleString("es-CL")}
                  </td>
                  <td className="font-display font-bold text-xl leading-none text-[#333333] px-4 py-3 text-right tabular-nums">
                    {r.qtty2.toLocaleString("es-CL")}
                  </td>
                  <td className="font-display font-bold text-xl leading-none text-[#333333] px-4 py-3 text-right tabular-nums">
                    {pct != null ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#FAFAFA] border-t border-[#E5E5E5]">
              <td className="font-sans text-sm font-semibold text-[#333333] px-4 py-3">
                Total
              </td>
              <td className="font-display font-bold text-xl leading-none text-[#333333] px-4 py-3 text-right tabular-nums">
                {totalQtty.toLocaleString("es-CL")}
              </td>
              <td className="font-display font-bold text-xl leading-none text-[#333333] px-4 py-3 text-right tabular-nums">
                {totalQtty2.toLocaleString("es-CL")}
              </td>
              <td className="font-display font-bold text-xl leading-none text-[#333333] px-4 py-3 text-right tabular-nums">
                {totalQtty > 0
                  ? `${((totalQtty2 / totalQtty) * 100).toFixed(1)}%`
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
  if (ingreso === "MARCAS") return "Marcas";
  if (ingreso === "MESAS VIP") return "Mesas VIP";
  if (ingreso === "MEDIOS") return "Medios";
  if (ingreso === "PRODUCTO") return "Producto";
  return ingreso;
}

async function IngresoSection({ eventoId }: { eventoId: string }) {
  const [bqData, totalAsistentes, marcaAgg, mesasVipAgg, mediosAgg, productoAgg] =
    await Promise.all([
      getOnepagerByIngreso(eventoId),
      getTotalAsistentes(eventoId),
      getMarcaIngresosAggByEvento(eventoId),
      getMesasVipAggByEvento(eventoId),
      getMediosAggByEvento(eventoId),
      getProductoAggByEvento(eventoId),
    ]);
  const hasAttendees = totalAsistentes != null && totalAsistentes > 0;

  // Append Marcas y Mesas VIP como filas extra usando el monto neto (Postgres)
  // — no vienen de BigQuery porque son imputaciones manuales. Re-ordenamos por
  // venta desc para que ocupen la posición correcta tanto en la tabla como en
  // el donut.
  const data = [
    ...bqData,
    {
      ingreso: "MARCAS",
      venta: marcaAgg.ventaNeto,
      qtty: marcaAgg.qtty,
      rebate: 0,
    },
    {
      ingreso: "MESAS VIP",
      venta: mesasVipAgg.ventaNeto,
      qtty: mesasVipAgg.qtty,
      rebate: 0,
    },
    {
      ingreso: "MEDIOS",
      venta: mediosAgg.ventaNeto,
      qtty: mediosAgg.qtty,
      rebate: 0,
    },
    {
      ingreso: "PRODUCTO",
      venta: productoAgg.ventaNeto,
      qtty: productoAgg.qtty,
      rebate: 0,
    },
  ].sort((a, b) => b.venta - a.venta);

  return (
    <BrutalChartPanel title="Ingresos por Fuente">
      <div className="flex items-start gap-8">
        {/* Tabla */}
        <div className="overflow-x-auto flex-1">
          <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                  {[
                    { h: "Ingreso", right: false },
                    { h: "Venta (CLP)", right: true },
                    { h: "Qtty", right: true },
                    { h: "Rebate Est.", right: true },
                    { h: "Percápita", right: true },
                  ].map(({ h, right }) => (
                    <th
                      key={h}
                      className={`font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 ${
                        right ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.ingreso}
                    className="border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#FAFAFA] transition-colors duration-150"
                  >
                    <td className="font-sans text-sm font-medium text-[#333333] px-4 py-3">
                      {labelIngreso(row.ingreso)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                      {fmtClp(row.venta)}
                    </td>
                    <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                      {row.qtty.toLocaleString("es-CL")}
                    </td>
                    <td className="font-sans text-sm text-[#666666] px-4 py-3 text-right tabular-nums">
                      {fmtClp(row.rebate)}
                    </td>
                    <td className="font-sans text-sm text-[#666666] px-4 py-3 text-right tabular-nums">
                      {hasAttendees ? fmtClp(row.venta / totalAsistentes) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Donut al lado derecho */}
        <div className="flex-shrink-0 w-[144px]">
          <IngresoChart data={data} />
        </div>
      </div>
    </BrutalChartPanel>
  );
}

