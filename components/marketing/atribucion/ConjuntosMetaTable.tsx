"use client";

import { cpa, type RendimientoConjuntos } from "@/lib/marketing/atribucion";
import { fmtFechaCorta, fmtPct, fmtUsd, fmtUsdOGuion } from "@/lib/marketing/formato";
import { buildConjuntosCsv, csvFilename } from "@/components/marketing/csvExports";
import BrutalCsvButton from "@/components/marketing/BrutalCsvButton";
import { BloqueTitulo, Nota, fmtNum, plural } from "./ui";

type Props = {
  data: RendimientoConjuntos;
  coberturaPct: number | null; // órdenes web vistas por GA4, en %
  desde: string;
  hasta: string;
  eventoId: string;
};

const TH = "font-mono-data uppercase text-xs px-3 py-3 sticky top-0 z-10 bg-black";
const TD = "font-mono-data text-xs px-3 py-2";

function motivo(gasto: number, compras: number): string | undefined {
  if (gasto <= 0) return "Sin gasto atribuido en el período.";
  if (compras <= 0) return "Sin compras en esta lente.";
  return undefined;
}

/** "—" con su motivo: `title` para el mouse y texto sr-only para el lector de pantalla. */
function CeldaCpa({ valor, motivo, className }: { valor: number | null; motivo?: string; className: string }) {
  return (
    <td className={className} title={valor == null ? motivo : undefined}>
      {fmtUsdOGuion(valor)}
      {valor == null && motivo && <span className="sr-only"> ({motivo})</span>}
    </td>
  );
}

// La fila Total suma gasto de TODOS los objetivos (incluye Cobertura) y conjuntos
// de otros eventos con órdenes de este: su CPA contradiría el de las lentes (D1),
// así que no lleva CPA.
const SIN_CPA_TOTAL =
  "Sin CPA: el total incluye conjuntos de Cobertura. El CPA del evento (solo campañas de Ventas) está en «Paid Media · compras por lente».";

/**
 * "Rendimiento por conjunto (Meta)": gasto y pixel de cada adset en la ventana
 * medida junto a las órdenes web medidas cuya sesión GA4 trae ese adset
 * (sessionCampaignId). Los dos CPA se calculan aquí por conjunto: gasto ÷ pixel
 * y gasto ÷ órdenes GA4.
 */
export default function ConjuntosMetaTable({ data, coberturaPct, desde, hasta, eventoId }: Props) {
  const total = data.rows.reduce(
    (acc, r) => ({ gasto: acc.gasto + r.gastoUsd, pixel: acc.pixel + r.pixel, ordenes: acc.ordenes + r.ordenesGa4 }),
    { gasto: 0, pixel: 0, ordenes: 0 },
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BloqueTitulo sub={`Gasto, pixel y órdenes GA4 por conjunto de anuncios · ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)}`}>
          Rendimiento por conjunto (Meta)
        </BloqueTitulo>
        <div className="pr-1">
          <BrutalCsvButton
            filename={() => csvFilename("rendimiento-conjuntos-meta", eventoId)}
            build={() => buildConjuntosCsv(data.rows)}
            context="Rendimiento por conjunto (Meta)"
            disabled={data.rows.length === 0}
          />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="font-mono-data text-sm text-black/60">
          Sin gasto Meta ni órdenes GA4 con conjunto identificado en la ventana medida.
        </p>
      ) : (
        <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[420px]">
          <table className="w-full">
            <caption className="sr-only">
              Gasto, pixel, órdenes GA4 y CPA por conjunto de anuncios de Meta en la ventana medida
            </caption>
            <thead>
              <tr className="bg-black text-white">
                <th scope="col" className={`${TH} text-left`}>Campaña</th>
                <th scope="col" className={`${TH} text-left`}>Conjunto</th>
                <th scope="col" className={`${TH} text-left`}>Objetivo</th>
                <th scope="col" className={`${TH} text-right`}>Gasto</th>
                <th scope="col" className={`${TH} text-right`}>Pixel</th>
                <th scope="col" className={`${TH} text-right`}>Órdenes GA4</th>
                <th scope="col" className={`${TH} text-right`}>CPA pixel</th>
                <th scope="col" className={`${TH} text-right`}>CPA GA4</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const cpaPixel = cpa(r.gastoUsd, r.pixel);
                const cpaGa4 = cpa(r.gastoUsd, r.ordenesGa4);
                return (
                  <tr
                    key={r.adsetId || `${r.campana}|${r.conjunto}`}
                    className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150 align-top"
                  >
                    <td className={`${TD} wrap-anywhere max-w-[260px]`}>
                      {r.campana || <span className="text-black/40">(sin campaña en la pauta)</span>}
                    </td>
                    <td className={`${TD} wrap-anywhere max-w-[260px]`} title={r.adsetId ? `ID ${r.adsetId}` : undefined}>
                      {r.conjunto || <span className="text-black/40">{r.adsetId || "(sin nombre)"}</span>}
                    </td>
                    <td className={TD}>{r.objetivo || r.objective || "—"}</td>
                    <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>{fmtUsd(r.gastoUsd)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.pixel)}</td>
                    <td className={`${TD} text-right tabular-nums font-bold`}>{fmtNum(r.ordenesGa4)}</td>
                    <CeldaCpa
                      valor={cpaPixel}
                      motivo={motivo(r.gastoUsd, r.pixel)}
                      className={`${TD} text-right tabular-nums whitespace-nowrap`}
                    />
                    <CeldaCpa
                      valor={cpaGa4}
                      motivo={motivo(r.gastoUsd, r.ordenesGa4)}
                      className={`${TD} text-right tabular-nums whitespace-nowrap font-bold`}
                    />
                  </tr>
                );
              })}
              <tr className="bg-black/5 font-bold">
                <th scope="row" colSpan={3} className={`${TD} text-left`}>
                  Total (todos los objetivos)
                </th>
                <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>{fmtUsd(total.gasto)}</td>
                <td className={`${TD} text-right tabular-nums`}>{fmtNum(total.pixel)}</td>
                <td className={`${TD} text-right tabular-nums`}>{fmtNum(total.ordenes)}</td>
                <CeldaCpa valor={null} motivo={SIN_CPA_TOTAL} className={`${TD} text-right tabular-nums whitespace-nowrap`} />
                <CeldaCpa valor={null} motivo={SIN_CPA_TOTAL} className={`${TD} text-right tabular-nums whitespace-nowrap`} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Nota>
        {plural(data.ga4MetaSinConjunto, "orden Meta en GA4 sin conjunto identificado", "órdenes Meta en GA4 sin conjunto identificado")}
        {data.ga4Meta > 0 ? ` (de ${plural(data.ga4Meta, "orden", "órdenes")} con canal Meta en GA4)` : ""}.
      </Nota>
      <Nota>
        Cómo leer: gasto y pixel son del período medido, todos los objetivos; los conjuntos de Cobertura no buscan
        ventas, por eso el Total no lleva CPA (el del evento, solo Ventas, está en las lentes). Órdenes GA4 = órdenes
        web cuya visita de compra trae el ID del conjunto. GA4 ve {fmtPct(coberturaPct)} de las órdenes web, así que el
        CPA GA4 es un techo: el real es menor.
      </Nota>
    </div>
  );
}
