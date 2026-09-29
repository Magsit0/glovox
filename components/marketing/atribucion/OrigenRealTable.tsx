"use client";

import { useMemo } from "react";
import {
  CANAL_SIN_ORIGEN,
  CANAL_VENDEDORES,
  agruparCanales,
  pct,
  segmentosCobertura,
  type CanalRealRow,
  type Moneda,
} from "@/lib/marketing/atribucion";
import { fmtFechaCorta, fmtPct, fmtVentaCompact, simboloMoneda } from "@/lib/marketing/formato";
import { buildOrigenRealCsv, csvFilename } from "@/components/marketing/csvExports";
import BrutalCsvButton from "@/components/marketing/BrutalCsvButton";
import { BloqueTitulo, Nota, fmtNum, plural } from "./ui";

type Props = {
  rows: CanalRealRow[];
  medibles: number;
  moneda: Moneda;
  excluidas: { pase: number; antes: number; pendientes: number; fueraWeb: number };
  desde: string;
  hasta: string;
  eventoId: string;
};

// D3: los códigos FF se llaman como en la taxonomía GA4; la tabla "Origen de
// Venta" los muestra como Club Glovox.
const AYUDA_CANAL: Record<string, string> = {
  [CANAL_VENDEDORES]: "Códigos FF del link de vendedores. En «Origen de Venta» aparecen como Club Glovox.",
  [CANAL_SIN_ORIGEN]: "Órdenes que GA4 no registró y que no traen Referido en el link.",
};

const TH = "font-mono-data uppercase text-xs px-3 py-3 sticky top-0 z-10 bg-black";

/**
 * "Origen real de la venta": un canal por orden del checkout web medido. Manda
 * GA4; si GA4 no vio la orden o la vio sin un canal útil (directo, sin dato,
 * pasarela), el Referido del link decide. Barra de cobertura arriba (de dónde
 * sale el canal de cada orden), tabla y CSV plano por canal × fuente.
 */
export default function OrigenRealTable({ rows, medibles, moneda, excluidas, desde, hasta, eventoId }: Props) {
  const grupos = useMemo(() => agruparCanales(rows, medibles), [rows, medibles]);
  const seg = useMemo(() => segmentosCobertura(rows), [rows]);
  const totalSeg = seg.ga4Canal + seg.ga4SinCanal + seg.referido + seg.sinOrigen;
  const total = useMemo(
    () =>
      grupos.reduce(
        (acc, g) => ({ ordenes: acc.ordenes + g.ordenes, personas: acc.personas + g.personas, venta: acc.venta + g.venta }),
        { ordenes: 0, personas: 0, venta: 0 },
      ),
    [grupos],
  );

  const segmentos = [
    { key: "ga4Canal", label: "GA4 con canal", n: seg.ga4Canal, className: "bg-[#0000FF]" },
    { key: "ga4SinCanal", label: "GA4 directo o sin canal", n: seg.ga4SinCanal, className: "bg-[#FF00FF]" },
    { key: "referido", label: "Solo Referido", n: seg.referido, className: "bg-[#FFFF00]" },
    { key: "sinOrigen", label: "Sin origen", n: seg.sinOrigen, className: "bg-black/10" },
  ].map((s) => ({ ...s, titulo: `${s.label}: ${fmtNum(s.n)} (${fmtPct(pct(s.n, totalSeg))})` }));

  const excl = [
    excluidas.pase > 0 && plural(excluidas.pase, "pase de temporada", "pases de temporada"),
    excluidas.antes > 0 && plural(excluidas.antes, "orden anterior a la medición", "órdenes anteriores a la medición"),
    excluidas.pendientes > 0 && plural(excluidas.pendientes, "orden que GA4 aún no carga", "órdenes que GA4 aún no carga"),
    excluidas.fueraWeb > 0 && `${fmtNum(excluidas.fueraWeb)} de boletería, invitación o gratis`,
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BloqueTitulo sub={`Órdenes del checkout web · ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)}`}>
          Origen real de la venta
        </BloqueTitulo>
        {/* pr-1: la sombra dura del botón no sobresale del bloque. */}
        <div className="pr-1">
          <BrutalCsvButton
            filename={() => csvFilename("origen-real-venta", eventoId)}
            build={() => buildOrigenRealCsv(rows, medibles, moneda)}
            context="Origen real de la venta"
            disabled={rows.length === 0}
          />
        </div>
      </div>

      {totalSeg === 0 ? (
        <p className="font-mono-data text-sm text-black/60">Sin órdenes web en la ventana medida.</p>
      ) : (
        <>
          {/* Barra de cobertura: de dónde sale el canal de cada orden medida. */}
          <div
            role="group"
            aria-label="Fuente del canal de cada orden medida"
            className="flex h-6 border-4 border-black divide-x-2 divide-black"
          >
            {segmentos
              .filter((s) => s.n > 0)
              .map((s) => (
                <div
                  key={s.key}
                  role="img"
                  aria-label={s.titulo}
                  title={s.titulo}
                  className={`h-full min-w-[3px] ${s.className}`}
                  style={{ width: `${(100 * s.n) / totalSeg}%` }}
                />
              ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-mono-data text-xs">
            {segmentos.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden className={`inline-block w-3 h-3 border-2 border-black ${s.className}`} />
                <span>
                  {s.label} <span className="text-black/60 tabular-nums">{fmtNum(s.n)} ({fmtPct(pct(s.n, totalSeg))})</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[420px] mt-3">
            <table className="w-full">
              <caption className="sr-only">Órdenes web medidas por canal real, con personas, venta y fuente del canal</caption>
              <thead>
                <tr className="bg-black text-white">
                  <th scope="col" className={`${TH} text-left`}>Canal</th>
                  <th scope="col" className={`${TH} text-right`}>Órdenes</th>
                  <th scope="col" className={`${TH} text-right`}>Personas</th>
                  <th scope="col" className={`${TH} text-right`} title={`En ${moneda}, la moneda del evento`}>
                    Venta ({moneda})
                  </th>
                  <th scope="col" className={`${TH} text-right`}>%</th>
                  <th scope="col" className={`${TH} text-left`}>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const ayuda = AYUDA_CANAL[g.canal];
                  const fuente =
                    g.ga4 === 0 && g.referido === 0
                      ? "Sin dato"
                      : [g.ga4 > 0 && `GA4 ${fmtNum(g.ga4)}`, g.referido > 0 && `Ref. ${fmtNum(g.referido)}`]
                          .filter(Boolean)
                          .join(" · ");
                  return (
                    <tr key={g.canal} className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150">
                      <td className="font-mono-data text-sm px-3 py-2">
                        {ayuda ? (
                          <span title={ayuda} className="underline decoration-dotted underline-offset-2 cursor-help">
                            {g.canal}
                          </span>
                        ) : (
                          g.canal
                        )}
                      </td>
                      <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">{fmtNum(g.ordenes)}</td>
                      <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">{fmtNum(g.personas)}</td>
                      <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {fmtVentaCompact(g.venta, moneda)}
                      </td>
                      <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">{fmtPct(g.pct)}</td>
                      <td className="font-mono-data text-xs px-3 py-2 text-black/60 whitespace-nowrap">{fuente}</td>
                    </tr>
                  );
                })}
                <tr className="bg-black/5 font-bold">
                  <th scope="row" className="font-mono-data text-sm px-3 py-2 text-left">Total</th>
                  <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">{fmtNum(total.ordenes)}</td>
                  <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">{fmtNum(total.personas)}</td>
                  <td
                    className="font-mono-data text-sm px-3 py-2 text-right tabular-nums whitespace-nowrap"
                    title={`${simboloMoneda(moneda)}${fmtNum(total.venta)}`}
                  >
                    {fmtVentaCompact(total.venta, moneda)}
                  </td>
                  <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">
                    {fmtPct(pct(total.ordenes, medibles))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {excl.length > 0 && <Nota>No se incluyen: {excl.join(", ")}.</Nota>}
      <Nota>
        Cómo leer: cada orden se asigna a un solo canal. Manda GA4 (la visita en que se compró); si GA4 no vio la
        orden o la vio como directa o desde la pasarela de pago, se usa el Referido del link. «Vendedores (ref)» son
        los códigos FF, que en «Origen de Venta» aparecen como Club Glovox.
      </Nota>
    </div>
  );
}
