"use client";

import { useState } from "react";
import BrutalChartPanel from "./BrutalChartPanel";
import TipoProductoChart from "./TipoProductoChart";
import FfbbRankingChart from "./FfbbRankingChart";
import PuntoVentaChart from "./PuntoVentaChart";
import CategoriaFunnel from "./CategoriaFunnel";
import FfbbEvolucionChart from "./FfbbEvolucionChart";
import MarcaIngresosTable from "./MarcaIngresosTable";
import MarcaIngresoFormSheet from "./MarcaIngresoFormSheet";
import type {
  OnepagerTipoProductoRow,
  OnepagerFfbbCategoriaProductoRow,
  OnepagerPuntoVentaRow,
  OnepagerCategoriaRow,
  OnepagerFfbbEvolucionRow,
} from "@/lib/queries/onepager";
import type { MarcaClienteRow, MarcaIngresoRow } from "@/lib/queries/marca";

type Props = {
  eventoId: string;
  ticketsByTipo: OnepagerTipoProductoRow[];
  ffbbByCatProd: OnepagerFfbbCategoriaProductoRow[];
  ffbbByPuntoVenta: OnepagerPuntoVentaRow[];
  ffbbByCategoria: OnepagerCategoriaRow[];
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
  ffbbByCategoria,
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
      <div className="flex gap-0 border-b-4 border-black">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`font-display uppercase text-lg leading-none px-6 py-3 border-4 border-black border-b-0 -mb-1 transition-colors duration-150 cursor-pointer ${
                active
                  ? "bg-black text-[#FFFF00]"
                  : "bg-white text-black hover:bg-[#FFFF00]"
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
            <p className="font-mono-data text-sm text-black/50">Sin datos.</p>
          ) : (
            <TipoProductoChart data={ticketsByTipo} color="#0000FF" />
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
                <p className="font-mono-data text-sm text-black/50">Sin datos.</p>
              ) : (
                <FfbbRankingChart data={ffbbByCatProd} color="#FF0000" />
              )}
            </BrutalChartPanel>
            <BrutalChartPanel title="FF&BB — Ranking Punto de Venta">
              {ffbbByPuntoVenta.length === 0 ? (
                <p className="font-mono-data text-sm text-black/50">Sin datos.</p>
              ) : (
                <PuntoVentaChart data={ffbbByPuntoVenta} color="#FF0000" />
              )}
            </BrutalChartPanel>
          </div>
          <BrutalChartPanel title="FF&BB — Venta por Categoría">
            <CategoriaFunnel data={ffbbByCategoria} />
          </BrutalChartPanel>
        </div>
      )}

      {tab === "marcas" && (
        <BrutalChartPanel title="Marcas">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono-data uppercase text-xs text-black/70">
                Ingresos imputados al evento
              </p>
              <button
                type="button"
                onClick={() => setMarcaSheetOpen(true)}
                className="font-display uppercase text-sm leading-none px-4 py-2 border-4 border-black bg-[#FFFF00] text-black shadow-[4px_4px_0px_#000] hover:bg-black hover:text-[#FFFF00] cursor-pointer transition-colors duration-150"
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
