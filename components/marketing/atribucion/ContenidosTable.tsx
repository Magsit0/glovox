"use client";

import { TOP_CONTENIDOS, type ContenidosQueVenden, type Moneda } from "@/lib/marketing/atribucion";
import { fmtFechaCorta, fmtPct, fmtVentaCompact } from "@/lib/marketing/formato";
import { buildContenidosCsv, csvFilename } from "@/components/marketing/csvExports";
import BrutalCsvButton from "@/components/marketing/BrutalCsvButton";
import { BloqueTitulo, Nota, fmtNum, plural } from "./ui";

type Props = {
  data: ContenidosQueVenden;
  moneda: Moneda;
  desde: string;
  hasta: string;
  eventoId: string;
};

const TH = "font-mono-data uppercase text-xs px-3 py-3 sticky top-0 z-10 bg-black";
const TD = "font-mono-data text-xs px-3 py-2";

/**
 * "Qué contenido vende": sesiones UTM y órdenes GA4 por contenido en la ventana
 * medida, cruzadas por la clave MANUAL source|medium|content|term (las mismas
 * dims de la tabla de Tráfico). Muestra el top por órdenes y luego sesiones; el
 * CSV lleva la lista completa.
 */
export default function ContenidosTable({ data, moneda, desde, hasta, eventoId }: Props) {
  const visibles = data.rows.slice(0, TOP_CONTENIDOS);
  const conOrdenes = data.rows.filter((r) => r.ordenes > 0).length;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BloqueTitulo sub={`Sesiones UTM y órdenes GA4 por contenido · ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)}`}>
          Qué contenido vende
        </BloqueTitulo>
        <div className="pr-1">
          <BrutalCsvButton
            filename={() => csvFilename("contenido-que-vende", eventoId)}
            build={() => buildContenidosCsv(data.rows, moneda)}
            context="Qué contenido vende"
            disabled={data.rows.length === 0}
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="font-mono-data text-sm text-black/60">Sin tráfico UTM del evento en la ventana medida.</p>
      ) : (
        <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[420px]">
          <table className="w-full">
            <caption className="sr-only">
              Sesiones UTM, órdenes GA4, conversión y venta por contenido en la ventana medida
            </caption>
            <thead>
              <tr className="bg-black text-white">
                <th scope="col" className={`${TH} text-left`}>Canal</th>
                <th scope="col" className={`${TH} text-left`}>Source / medium</th>
                <th scope="col" className={`${TH} text-left`}>Content</th>
                <th scope="col" className={`${TH} text-right`}>Sesiones</th>
                <th scope="col" className={`${TH} text-right`}>Órdenes GA4</th>
                <th scope="col" className={`${TH} text-right`} title="Órdenes GA4 ÷ sesiones del contenido, en la ventana medida">
                  Conv. %
                </th>
                <th scope="col" className={`${TH} text-right`} title={`En ${moneda}, la moneda del evento`}>
                  Venta ({moneda})
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r, i) => (
                <tr
                  key={`${r.canal}|${r.source}|${r.medium}|${r.content}|${r.term}|${i}`}
                  className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150 align-top"
                >
                  <td className={TD}>{r.canal || "(sin canal)"}</td>
                  <td className={`${TD} wrap-anywhere`}>
                    {r.source} / {r.medium}
                  </td>
                  <td className={`${TD} wrap-anywhere max-w-[320px]`}>
                    {r.content ? r.content : <span className="text-black/40">(sin content)</span>}
                    {r.term && <span className="block text-black/60">term: {r.term}</span>}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.sesiones)}</td>
                  <td className={`${TD} text-right tabular-nums font-bold`}>{fmtNum(r.ordenes)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtPct(r.conv, 2)}</td>
                  <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>
                    {r.ordenes > 0 ? fmtVentaCompact(r.venta, moneda) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Nota>
        {data.rows.length > visibles.length
          ? `Top ${fmtNum(visibles.length)} de ${plural(data.rows.length, "contenido", "contenidos")} (${fmtNum(conOrdenes)} con órdenes); el CSV trae la lista completa. `
          : ""}
        {plural(data.ordenesGa4, "orden GA4", "órdenes GA4")} en la ventana
        {data.huerfanas > 0
          ? `; ${plural(data.huerfanas, "orden", "órdenes")} sin fila de tráfico (su landing quedó fuera del filtro del evento).`
          : data.ordenesGa4 > 0
            ? "; todas tienen fila de tráfico."
            : "."}
      </Nota>
      <Nota>
        Cómo leer: el canal sale de las etiquetas UTM manuales de la sesión (las mismas de la tabla de Tráfico). Ahí el
        tráfico directo aparece como «(not set)» y no existe «Directo», así que estos canales no coinciden uno a uno con
        «Origen real de la venta». Conv. = órdenes GA4 ÷ sesiones del contenido; GA4 no ve todas las órdenes, así que
        es un piso.
      </Nota>
    </div>
  );
}
