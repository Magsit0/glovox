"use client";

import type { GlobalPrecioMatriz } from "@/lib/queries/ticketing";
import { formatCurrency } from "@/lib/unabase/formatting";
import DownloadMenu from "./DownloadMenu";

interface Props {
  matriz: GlobalPrecioMatriz;
}

export default function GlobalPrecioMatrizTable({ matriz }: Props) {
  const { eventos, filas } = matriz;
  const isEmpty = eventos.length === 0 || filas.length === 0;

  // Excel/CSV: Etapa · una columna por evento · Mínimo · Promedio · Máximo.
  // Celda de evento vacía = sin venta.
  const headers = [
    "Etapa",
    ...eventos.map((e) => `${e.eventoId} — ${e.nombre}`),
    "Mínimo",
    "Promedio",
    "Máximo",
  ];
  const excelRows = filas.map((f) => [
    f.label,
    ...eventos.map((e) => (e.eventoId in f.precios ? Math.round(f.precios[e.eventoId]) : "")),
    Math.round(f.minimo),
    Math.round(f.promedio),
    Math.round(f.maximo),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Precio medio por etapa de venta
          </h3>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Precio medio (precio − descuento) en cada cruce etapa × evento. Las columnas
            Mínimo / Promedio / Máximo resumen los eventos con venta en esa etapa (promedio
            = media simple). Excluye cortesías y tickets con precio 0.
          </p>
        </div>
        <DownloadMenu
          filename="ticketing-precio-medio-etapa"
          sheetName="Precio por etapa"
          headers={headers}
          rows={excelRows}
          label="Descargar"
        />
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-[#E5E5E5] bg-white px-4 py-12 text-center font-sans text-sm text-[#999999]">
          No hay ventas por etapa para los filtros seleccionados.
        </div>
      ) : (
        <div className="max-h-[600px] overflow-auto rounded-lg border border-[#E5E5E5] bg-white">
          <table className="w-full border-separate border-spacing-0 font-sans text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-left font-medium text-[#666666]">
                  Etapa
                </th>
                {eventos.map((e) => (
                  <th
                    key={e.eventoId}
                    className="sticky top-0 z-20 min-w-[140px] border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-right font-medium text-[#666666]"
                    title={`${e.eventoId} — ${e.nombre}`}
                  >
                    <span className="block truncate text-[#333333]">{e.nombre || e.eventoId}</span>
                    <span className="block font-normal text-[#999999]">{e.eventoId}</span>
                  </th>
                ))}
                <th className="sticky right-[240px] top-0 z-30 w-[120px] min-w-[120px] border-b border-l border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-right font-medium text-[#666666]">
                  Mínimo
                </th>
                <th className="sticky right-[120px] top-0 z-30 w-[120px] min-w-[120px] border-b border-[#E5E5E5] bg-[#F0EFFE] px-4 py-3 text-right font-medium text-[#9F99F8]">
                  Promedio
                </th>
                <th className="sticky right-0 top-0 z-30 w-[120px] min-w-[120px] border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-right font-medium text-[#666666]">
                  Máximo
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.etapaNorm} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-[#E5E5E5] bg-white px-4 py-3 text-left font-medium text-[#333333] transition-colors duration-150 group-hover:bg-[#FAFAFA]"
                  >
                    {f.label}
                  </th>
                  {eventos.map((e) => {
                    const has = e.eventoId in f.precios;
                    return (
                      <td
                        key={e.eventoId}
                        className="border-b border-[#E5E5E5] px-4 py-3 text-right tabular-nums text-[#333333] transition-colors duration-150 group-hover:bg-[#FAFAFA]"
                      >
                        {has ? formatCurrency(f.precios[e.eventoId]) : <span className="text-[#999999]">—</span>}
                      </td>
                    );
                  })}
                  <td className="sticky right-[240px] z-10 w-[120px] min-w-[120px] border-b border-l border-[#E5E5E5] bg-white px-4 py-3 text-right tabular-nums text-[#666666] transition-colors duration-150 group-hover:bg-[#FAFAFA]">
                    {formatCurrency(f.minimo)}
                  </td>
                  <td className="sticky right-[120px] z-10 w-[120px] min-w-[120px] border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-right font-medium tabular-nums text-[#333333] transition-colors duration-150 group-hover:bg-[#F0EFFE]">
                    {formatCurrency(f.promedio)}
                  </td>
                  <td className="sticky right-0 z-10 w-[120px] min-w-[120px] border-b border-[#E5E5E5] bg-white px-4 py-3 text-right tabular-nums text-[#666666] transition-colors duration-150 group-hover:bg-[#FAFAFA]">
                    {formatCurrency(f.maximo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="font-sans text-xs text-[#999999]">
        {eventos.length} {eventos.length === 1 ? "evento" : "eventos"} ·{" "}
        {filas.length} {filas.length === 1 ? "etapa" : "etapas"}. Devueltos y precio 0 excluidos.
      </p>
    </div>
  );
}
