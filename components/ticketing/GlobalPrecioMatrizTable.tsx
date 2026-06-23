"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GlobalPrecioMatriz, GlobalPrecioMatrizFila } from "@/lib/queries/ticketing";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import DownloadMenu from "./DownloadMenu";

interface Props {
  matriz: GlobalPrecioMatriz;
}

// Estado del hover card: la fila bajo el cursor y el rectángulo de su celda
// (para anclar el panel flotante, que se renderiza en un portal porque la tabla
// vive dentro de un overflow-auto que lo recortaría).
type Hover = { fila: GlobalPrecioMatrizFila; rect: DOMRect };

export default function GlobalPrecioMatrizTable({ matriz }: Props) {
  const { eventos, filas } = matriz;
  const isEmpty = eventos.length === 0 || filas.length === 0;

  // ---- Hover card de categorías por etapa ----
  // El portal solo se monta cuando hay hover (siempre tras un evento de mouse,
  // o sea client-side), así que no hace falta un guard de "mounted".
  const [hover, setHover] = useState<Hover | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function openHover(fila: GlobalPrecioMatrizFila, el: HTMLElement) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHover({ fila, rect: el.getBoundingClientRect() });
  }
  // Cierre diferido: da tiempo a mover el mouse de la celda al card (para
  // scrollear listas largas) sin que se cierre en el camino.
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHover(null), 120);
  }
  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

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
            = media simple). Pasa el cursor sobre una etapa para ver qué categorías de ticket
            la componen. Excluye cortesías y tickets con precio 0.
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
                    onMouseEnter={(e) => openHover(f, e.currentTarget)}
                    onMouseLeave={scheduleClose}
                    className="sticky left-0 z-10 cursor-help border-b border-r border-[#E5E5E5] bg-white px-4 py-3 text-left font-medium text-[#333333] transition-colors duration-150 group-hover:bg-[#FAFAFA]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className="underline decoration-dotted decoration-[#CCCCCC] underline-offset-4">
                        {f.label}
                      </span>
                      {f.categorias.length > 0 && (
                        <span className="font-sans text-xs font-normal text-[#999999]">
                          {f.categorias.length}
                        </span>
                      )}
                    </span>
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

      {hover && (
        <CategoriasHoverCard
          hover={hover}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  );
}

// Panel flotante con las categorías de ticket que componen la etapa. Se ancla a
// la derecha de la celda; si no cabe, salta a la izquierda. Renderizado en un
// portal para escapar del overflow-auto de la tabla.
function CategoriasHoverCard({
  hover,
  onMouseEnter,
  onMouseLeave,
}: {
  hover: Hover;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { fila, rect } = hover;
  const WIDTH = 320;
  const GAP = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // A la derecha de la celda salvo que se salga del viewport.
  const placeRight = rect.right + GAP + WIDTH <= vw;
  const left = placeRight ? rect.right + GAP : Math.max(GAP, rect.left - GAP - WIDTH);
  const top = Math.min(rect.top, vh - 24 - 360);
  const maxHeight = Math.min(360, vh - top - 16);

  const total = fila.categorias.reduce((acc, c) => acc + c.tickets, 0);

  return createPortal(
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "fixed", left, top: Math.max(GAP, top), width: WIDTH }}
      className="z-50 overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <div className="border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2.5">
        <p className="font-sans text-sm font-medium text-[#333333]">{fila.label}</p>
        <p className="font-sans text-xs text-[#999999]">
          {fila.categorias.length}{" "}
          {fila.categorias.length === 1 ? "categoría de ticket" : "categorías de ticket"}
          {total > 0 && ` · ${formatNumber(total)} tickets`}
        </p>
      </div>
      {fila.categorias.length === 0 ? (
        <p className="px-4 py-3 font-sans text-sm text-[#999999]">
          Sin categorías en el alcance filtrado.
        </p>
      ) : (
        <ul className="overflow-y-auto py-1" style={{ maxHeight }}>
          {fila.categorias.map((c) => (
            <li
              key={c.categoria}
              className="flex items-center justify-between gap-3 px-4 py-1.5"
            >
              <span className="truncate font-sans text-sm text-[#333333]" title={c.categoria}>
                {c.categoria}
              </span>
              <span className="shrink-0 font-sans text-xs tabular-nums text-[#999999]">
                {formatNumber(c.tickets)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
