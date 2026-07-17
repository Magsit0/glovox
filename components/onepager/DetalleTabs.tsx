"use client";

import { useState } from "react";
import BrutalChartPanel from "./BrutalChartPanel";
import TipoProductoChart from "./TipoProductoChart";
import FfbbRankingChart from "./FfbbRankingChart";
import PuntoVentaChart from "./PuntoVentaChart";
import FfbbDetalleTable from "./FfbbDetalleTable";
import FfbbEvolucionChart from "./FfbbEvolucionChart";
import MarcaIngresosTable from "./MarcaIngresosTable";
import MarcaIngresoFormSheet from "./MarcaIngresoFormSheet";
import type {
  OnepagerTipoProductoRow,
  OnepagerFfbbCategoriaProductoRow,
  OnepagerPuntoVentaRow,
  OnepagerFfbbEvolucionRow,
} from "@/lib/queries/onepager";
import type { MarcaClienteRow, MarcaIngresoRow } from "@/lib/queries/marca";

type Props = {
  eventoId: string;
  ticketsByTipo: OnepagerTipoProductoRow[];
  ffbbByCatProd: OnepagerFfbbCategoriaProductoRow[];
  ffbbByPuntoVenta: OnepagerPuntoVentaRow[];
  ffbbEvolucion: OnepagerFfbbEvolucionRow[];
  marcaClientes: MarcaClienteRow[];
  marcaIngresos: MarcaIngresoRow[];
};

type Tab = "tickets" | "ffbb" | "marcas";

export default function DetalleTabs({
  eventoId,
  ticketsByTipo,
  ffbbByCatProd,
  ffbbByPuntoVenta,
  ffbbEvolucion,
  marcaClientes,
  marcaIngresos,
}: Props) {
  const [tab, setTab] = useState<Tab>("tickets");
  const [marcaSheetOpen, setMarcaSheetOpen] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "tickets", label: "Tickets" },
    { key: "ffbb", label: "FF&BB" },
    { key: "marcas", label: "Marcas" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-0 border-b border-[#E5E5E5]">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`font-sans font-medium text-sm leading-none px-4 py-3 -mb-px border-b-2 transition-colors duration-150 cursor-pointer ${
                active
                  ? "border-[#9F99F8] text-[#333333]"
                  : "border-transparent text-[#666666] hover:text-[#333333]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "tickets" && (
        <BrutalChartPanel title="Tickets — Tipo Producto">
          {ticketsByTipo.length === 0 ? (
            <p className="font-sans text-sm text-[#999999]">Sin datos.</p>
          ) : (
            <TipoProductoChart data={ticketsByTipo} color="#9F99F8" />
          )}
        </BrutalChartPanel>
      )}

      {tab === "ffbb" && (
        <div className="space-y-6">
          <BrutalChartPanel title="FF&BB — Evolución Horaria">
            <FfbbEvolucionChart data={ffbbEvolucion} />
          </BrutalChartPanel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BrutalChartPanel title="FF&BB — Ranking">
              {ffbbByCatProd.length === 0 ? (
                <p className="font-sans text-sm text-[#999999]">Sin datos.</p>
              ) : (
                <FfbbRankingChart data={ffbbByCatProd} color="#B1D750" />
              )}
            </BrutalChartPanel>
            <BrutalChartPanel title="FF&BB — Ranking Punto de Venta">
              {ffbbByPuntoVenta.length === 0 ? (
                <p className="font-sans text-sm text-[#999999]">Sin datos.</p>
              ) : (
                <PuntoVentaChart data={ffbbByPuntoVenta} color="#B1D750" />
              )}
            </BrutalChartPanel>
          </div>
          <BrutalChartPanel title="FF&BB — Detalle por Producto">
            <FfbbDetalleTable data={ffbbByCatProd} eventoId={eventoId} />
          </BrutalChartPanel>
        </div>
      )}

      {tab === "marcas" && (
        <BrutalChartPanel title="Marcas">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-sans text-xs text-[#666666]">
                Ingresos imputados al evento
              </p>
              <button
                type="button"
                onClick={() => setMarcaSheetOpen(true)}
                className="rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer transition-colors duration-150"
              >
                + Imputar ingreso
              </button>
            </div>
            <MarcaIngresosTable rows={marcaIngresos} />
          </div>
          <MarcaIngresoFormSheet
            open={marcaSheetOpen}
            onClose={() => setMarcaSheetOpen(false)}
            eventoId={eventoId}
            clientes={marcaClientes}
          />
        </BrutalChartPanel>
      )}
    </div>
  );
}
