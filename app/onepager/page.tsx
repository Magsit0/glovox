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
} from "@/lib/queries/onepager";
import { getCierreEventos, getTotalAsistentes } from "@/lib/queries/cierreEventos";
import {
  getMarcaClientes,
  getMarcaIngresosByEvento,
  getMarcaIngresosAggByEvento,
  getMarcaIngresosAggMap,
  getMarcaIngresosMatrix,
} from "@/lib/queries/marca";
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
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-6 animate-pulse">
      <div className="h-6 bg-black/10 rounded-none w-1/3 mb-4" />
      <div className="h-40 bg-black/5 rounded-none" />
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
      <div className="bg-white text-black min-h-full p-6 space-y-6">
        <Link
          href="/"
          aria-label="Volver al menú principal"
          className="inline-flex items-center justify-center border-4 border-black bg-white p-1.5 shadow-[4px_4px_0px_#000] transition-colors hover:bg-[#FFFF00]"
        >
          <Image
            src="/glovox_logo_gvx_black.svg"
            alt="Glovox"
            width={24}
            height={24}
            priority
          />
        </Link>
        <h1 className="font-display uppercase text-3xl leading-none text-black">
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
      <div className="bg-white text-black min-h-full p-6">
        <p className="font-mono-data text-sm">No hay eventos disponibles.</p>
      </div>
    );
  }

  return (
    <div className="bg-white text-black min-h-full">
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
            className="inline-flex items-center justify-center border-4 border-black bg-white p-1.5 shadow-[4px_4px_0px_#000] transition-colors hover:bg-[#FFFF00]"
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
            className="font-display uppercase text-xs leading-none px-3 py-2 border-4 border-black bg-white shadow-[4px_4px_0px_#000] hover:bg-[#FFFF00] transition-colors"
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
  const [listado, cierres, marcaMap, marcaClientes, marcaMatrix] =
    await Promise.all([
      getOnepagerListadoKpis(),
      getCierreEventos(),
      getMarcaIngresosAggMap(),
      getMarcaClientes(),
      getMarcaIngresosMatrix(),
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
      <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-black text-white">
              <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                Tipo
              </th>
              <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                Tickets
              </th>
              <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                Asistentes
              </th>
              <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
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
                  className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
                >
                  <td className="font-mono-data text-sm px-4 py-3 font-bold border-r-2 border-black">
                    {r.ventaNoventa}
                  </td>
                  <td className="font-display text-xl sm:text-2xl leading-none text-black px-3 py-2.5 border-r-2 border-black">
                    {r.qtty.toLocaleString("es-CL")}
                  </td>
                  <td className="font-display text-xl sm:text-2xl leading-none text-black px-3 py-2.5 border-r-2 border-black">
                    {r.qtty2.toLocaleString("es-CL")}
                  </td>
                  <td className="font-display text-xl sm:text-2xl leading-none text-black px-3 py-2.5">
                    {pct != null ? `${pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#FFFF00]">
              <td className="font-mono-data text-sm px-4 py-3 font-bold uppercase border-r-2 border-black">
                Total
              </td>
              <td className="font-display text-xl sm:text-2xl leading-none text-black px-3 py-2.5 border-r-2 border-black">
                {totalQtty.toLocaleString("es-CL")}
              </td>
              <td className="font-display text-xl sm:text-2xl leading-none text-black px-3 py-2.5 border-r-2 border-black">
                {totalQtty2.toLocaleString("es-CL")}
              </td>
              <td className="font-display text-xl sm:text-2xl leading-none text-black px-3 py-2.5">
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
  return ingreso;
}

async function IngresoSection({ eventoId }: { eventoId: string }) {
  const [bqData, totalAsistentes, marcaAgg] = await Promise.all([
    getOnepagerByIngreso(eventoId),
    getTotalAsistentes(eventoId),
    getMarcaIngresosAggByEvento(eventoId),
  ]);
  const hasAttendees = totalAsistentes != null && totalAsistentes > 0;

  // Append Marcas como tercera fila usando el monto neto (Postgres) — no viene
  // de BigQuery porque son imputaciones manuales. Re-ordenamos por venta desc
  // para que ocupe la posición correcta tanto en la tabla como en el donut.
  const data = [
    ...bqData,
    {
      ingreso: "MARCAS",
      venta: marcaAgg.ventaNeto,
      qtty: marcaAgg.qtty,
      rebate: 0,
    },
  ].sort((a, b) => b.venta - a.venta);

  return (
    <BrutalChartPanel title="Ingresos por Fuente" className="col-span-4">
      <div className="flex items-start gap-8">
        {/* Tabla */}
        <div className="overflow-x-auto flex-1">
          <table className="border-4 border-black rounded-none w-full">
            <thead>
              <tr className="bg-black text-white">
                {["Ingreso", "Venta (CLP)", "Qtty", "Rebate Est.", "Percápita"].map((h) => (
                  <th
                    key={h}
                    className="font-mono-data uppercase text-xs px-4 py-3 text-left"
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
                  className="border-b-2 border-black last:border-b-0 hover:bg-[#FFFF00] transition-colors duration-150"
                >
                  <td className="font-mono-data text-sm px-4 py-3 font-bold">
                    {labelIngreso(row.ingreso)}
                  </td>
                  <td className="font-mono-data text-sm px-4 py-3">
                    {fmtClp(row.venta)}
                  </td>
                  <td className="font-mono-data text-sm px-4 py-3">
                    {row.qtty.toLocaleString("es-CL")}
                  </td>
                  <td className="font-mono-data text-sm px-4 py-3">
                    {fmtClp(row.rebate)}
                  </td>
                  <td className="font-mono-data text-sm px-4 py-3">
                    {hasAttendees ? fmtClp(row.venta / totalAsistentes) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Donut al lado derecho */}
        <div className="flex-shrink-0 w-[144px]">
          <IngresoChart data={data} />
        </div>
      </div>
    </BrutalChartPanel>
  );
}

