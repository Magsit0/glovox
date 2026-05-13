"use client";

import { useState } from "react";
import BrutalChartPanel from "./BrutalChartPanel";
import TipoProductoChart from "./TipoProductoChart";
import FfbbRankingChart from "./FfbbRankingChart";
import PuntoVentaChart from "./PuntoVentaChart";
import CategoriaFunnel from "./CategoriaFunnel";
import type {
  OnepagerTipoProductoRow,
  OnepagerFfbbCategoriaProductoRow,
  OnepagerPuntoVentaRow,
  OnepagerCategoriaRow,
} from "@/lib/queries/onepager";

type Props = {
  ticketsByTipo: OnepagerTipoProductoRow[];
  ffbbByCatProd: OnepagerFfbbCategoriaProductoRow[];
  ffbbByPuntoVenta: OnepagerPuntoVentaRow[];
  ffbbByCategoria: OnepagerCategoriaRow[];
};

type Tab = "tickets" | "ffbb";

export default function DetalleTabs({
  ticketsByTipo,
  ffbbByCatProd,
  ffbbByPuntoVenta,
  ffbbByCategoria,
}: Props) {
  const [tab, setTab] = useState<Tab>("tickets");

  const tabs: { key: Tab; label: string }[] = [
    { key: "tickets", label: "Tickets" },
    { key: "ffbb", label: "FF&BB" },
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
    </div>
  );
}
