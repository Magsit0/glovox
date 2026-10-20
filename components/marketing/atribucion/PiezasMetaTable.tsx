"use client";

import { TOP_PIEZAS, cpa, type PiezaMetaRow, type RendimientoPiezas } from "@/lib/marketing/atribucion";
import { fmtFechaCorta, fmtUsd, fmtUsdOGuion } from "@/lib/marketing/formato";
import { buildPiezasCsv, csvFilename } from "@/components/marketing/csvExports";
import BrutalCsvButton from "@/components/marketing/BrutalCsvButton";
import { BloqueTitulo, Nota, fmtNum, plural } from "./ui";

type Props = {
  data: RendimientoPiezas;
  desde: string;
  hasta: string;
  eventoId: string;
};

const TH = "font-mono-data uppercase text-xs px-3 py-3 sticky top-0 z-10 bg-black";
const TD = "font-mono-data text-xs px-3 py-2";

const OBJETIVO_VENTAS = "OUTCOME_SALES";
const SIN_ALCANCE_TOTAL = "Sin total: el alcance son personas únicas y no se suma entre piezas.";
const SIN_CPA_TOTAL = "Sin CPA: el total mezcla objetivos. El CPA del evento (solo Ventas) está en «Paid Media · compras por lente».";

function motivoAlcance(r: PiezaMetaRow): string {
  if (r.alcanceCuentas > 1) {
    return `La pieza corre en ${r.alcanceCuentas} cuentas: Meta no deduplica personas entre cuentas, así que no hay un alcance único.`;
  }
  return "Alcance aún no medido para esta pieza.";
}

function motivoCpa(r: PiezaMetaRow): string | undefined {
  if (r.objective !== OBJETIVO_VENTAS) {
    return `Pieza de ${r.objetivo || "otro objetivo"}: no busca compras. Mírala por alcance o visitas.`;
  }
  if (r.gastoUsd <= 0) return "Sin gasto atribuido en el período.";
  if (r.comprasClic <= 0) return "Sin compras por clic en el período.";
  return undefined;
}

/** "—" con su motivo: `title` para el mouse y texto sr-only para el lector de pantalla. */
function CeldaGuion({ valor, motivo, className }: { valor: string; motivo?: string; className: string }) {
  const vacio = valor === "—";
  return (
    <td className={className} title={vacio ? motivo : undefined}>
      {valor}
      {vacio && motivo && <span className="sr-only"> ({motivo})</span>}
    </td>
  );
}

/** Barra clic (negro) / vista (amarillo) con los dos números debajo. */
function ComprasPixel({ clic, vista }: { clic: number; vista: number }) {
  const total = clic + vista;
  if (total <= 0) return <span className="text-black/40">0</span>;
  const pctClic = Math.round((100 * clic) / total);
  return (
    <div className="min-w-[120px]">
      <div className="h-2 w-[120px] border border-black bg-[#FFFF00]" aria-hidden="true">
        <div className="h-full bg-black" style={{ width: `${pctClic}%` }} />
      </div>
      <div className="mt-1 whitespace-nowrap">
        <span className="font-bold">{fmtNum(clic)}</span> clic · {fmtNum(vista)} vista
      </div>
    </div>
  );
}

function Pieza({ r }: { r: PiezaMetaRow }) {
  const detalle = [
    r.tipo || "Sin ficha",
    r.formatos > 1 ? `${r.formatos} formatos` : null,
    plural(r.anuncios, "anuncio", "anuncios"),
  ]
    .filter(Boolean)
    .join(" · ");
  const nombre = r.nombre || "(sin nombre)";
  return (
    <div className="flex items-start gap-3 min-w-[220px] max-w-[320px]">
      {r.miniatura ? (
        // Miniatura guardada en BigQuery como JPEG base64: las URLs de Meta caducan.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/jpeg;base64,${r.miniatura}`}
          alt={`Pieza: ${nombre}`}
          width={48}
          height={48}
          className="w-12 h-12 object-cover border-2 border-black shrink-0"
        />
      ) : (
        <div className="w-12 h-12 border-2 border-black bg-black/5 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="font-bold wrap-anywhere" title={`ID ${r.piezaId}`}>
          {r.permalink ? (
            <a href={r.permalink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {nombre}
            </a>
          ) : (
            nombre
          )}
        </div>
        <div className="text-black/60 mt-0.5">{detalle}</div>
      </div>
    </div>
  );
}

/**
 * "Rendimiento por pieza (Meta)": cada imagen o video con todos los anuncios que
 * la usan, en la ventana medida. Solo métricas de Meta: GA4 no trae el ID del
 * anuncio, así que las órdenes GA4 quedan a nivel conjunto (tabla de arriba).
 */
export default function PiezasMetaTable({ data, desde, hasta, eventoId }: Props) {
  const visibles = data.rows.slice(0, TOP_PIEZAS);
  const total = data.rows.reduce(
    (acc, r) => ({
      gasto: acc.gasto + r.gastoUsd,
      impresiones: acc.impresiones + r.impresiones,
      visitas: acc.visitas + r.visitasLanding,
      clic: acc.clic + r.comprasClic,
      vista: acc.vista + r.comprasVista,
    }),
    { gasto: 0, impresiones: 0, visitas: 0, clic: 0, vista: 0 },
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BloqueTitulo sub={`Gasto, alcance y compras pixel por imagen o video · ${fmtFechaCorta(desde)} – ${fmtFechaCorta(hasta)}`}>
          Rendimiento por pieza (Meta)
        </BloqueTitulo>
        <div className="pr-1">
          <BrutalCsvButton
            filename={() => csvFilename("rendimiento-piezas-meta", eventoId)}
            build={() => buildPiezasCsv(data.rows)}
            context="Rendimiento por pieza (Meta)"
            disabled={data.rows.length === 0}
          />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="font-mono-data text-sm text-black/60">Sin gasto Meta por anuncio en la ventana medida.</p>
      ) : (
        <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[560px]">
          <table className="w-full">
            <caption className="sr-only">
              Gasto, impresiones, alcance, visitas y compras pixel por pieza de Meta en la ventana medida
            </caption>
            <thead>
              <tr className="bg-black text-white">
                <th scope="col" className={`${TH} text-left`}>Pieza</th>
                <th scope="col" className={`${TH} text-left`}>Objetivo</th>
                <th scope="col" className={`${TH} text-right`}>Gasto</th>
                <th scope="col" className={`${TH} text-right`}>Impresiones</th>
                <th scope="col" className={`${TH} text-right`}>Alcance evento</th>
                <th scope="col" className={`${TH} text-right`}>Visitas landing</th>
                <th scope="col" className={`${TH} text-left`}>Compras pixel</th>
                <th scope="col" className={`${TH} text-right`}>CPA clic</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => {
                const cpaClic = r.objective === OBJETIVO_VENTAS ? cpa(r.gastoUsd, r.comprasClic) : null;
                return (
                  <tr
                    key={`${r.piezaId}|${r.objective}`}
                    className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150 align-top"
                  >
                    <td className={TD}>
                      <Pieza r={r} />
                    </td>
                    <td className={TD}>{r.objetivo || r.objective || "—"}</td>
                    <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>{fmtUsd(r.gastoUsd)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.impresiones)}</td>
                    <CeldaGuion
                      valor={r.alcance == null ? "—" : fmtNum(r.alcance)}
                      motivo={motivoAlcance(r)}
                      className={`${TD} text-right tabular-nums`}
                    />
                    <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.visitasLanding)}</td>
                    <td className={TD}>
                      <ComprasPixel clic={r.comprasClic} vista={r.comprasVista} />
                    </td>
                    <CeldaGuion
                      valor={fmtUsdOGuion(cpaClic)}
                      motivo={motivoCpa(r)}
                      className={`${TD} text-right tabular-nums whitespace-nowrap font-bold`}
                    />
                  </tr>
                );
              })}
              <tr className="bg-black/5 font-bold">
                <th scope="row" colSpan={2} className={`${TD} text-left`}>
                  Total ({plural(data.rows.length, "pieza", "piezas")}, todos los objetivos)
                </th>
                <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>{fmtUsd(total.gasto)}</td>
                <td className={`${TD} text-right tabular-nums`}>{fmtNum(total.impresiones)}</td>
                <CeldaGuion valor="—" motivo={SIN_ALCANCE_TOTAL} className={`${TD} text-right tabular-nums`} />
                <td className={`${TD} text-right tabular-nums`}>{fmtNum(total.visitas)}</td>
                <td className={TD}>
                  <ComprasPixel clic={total.clic} vista={total.vista} />
                </td>
                <CeldaGuion valor="—" motivo={SIN_CPA_TOTAL} className={`${TD} text-right tabular-nums whitespace-nowrap`} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {data.rows.length > visibles.length && (
        <Nota>
          Top {fmtNum(visibles.length)} de {plural(data.rows.length, "pieza", "piezas")} por gasto; el Total y el CSV
          traen todas.
        </Nota>
      )}
      {data.anunciosSinFicha > 0 && (
        <Nota>
          {plural(data.anunciosSinFicha, "anuncio con gasto todavía no tiene", "anuncios con gasto todavía no tienen")} ficha
          de creativo: aparecen por anuncio, sin miniatura.
        </Nota>
      )}
      <Nota>
        Cómo leer: una pieza es una imagen o un video, con todos los anuncios que la usan (un dinámico feed + story
        cuenta como una sola). Gasto, impresiones, visitas y compras son del período medido; el alcance son personas
        únicas en todo el evento, calculadas por Meta, y no se suman. Compras pixel: negro = tras un clic (7 días),
        amarillo = vio el anuncio sin hacer clic (1 día). El CPA usa solo las de clic y solo en piezas de Ventas. GA4 no
        trae el ID del anuncio: las órdenes GA4 están por conjunto, en la tabla de arriba.
      </Nota>
    </div>
  );
}
