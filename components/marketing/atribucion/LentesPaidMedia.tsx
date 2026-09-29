import {
  cpa,
  muestraCpaReferido,
  pct,
  propagacionReferidoPct,
  type AtribucionCompras,
} from "@/lib/marketing/atribucion";
import { PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";
import { fmtPct, fmtUsd, fmtUsdOGuion } from "@/lib/marketing/formato";
import { BloqueTitulo, fmtNum } from "./ui";

type Props = {
  a: Pick<AtribucionCompras, "ordenes" | "meta" | "google">;
};

type Fila = {
  lente: string;
  ayuda: string; // title de la etiqueta: qué cuenta esta lente
  compras: number;
  cpa: number | null;
  sinCpa: string; // title del "—" cuando no hay CPA
};

// Tooltips de los "—" (native title, sin JavaScript).
const SIN_GASTO = "Sin gasto atribuido en el período.";
const SIN_COMPRAS = "Sin compras en esta lente.";

function motivoSinCpa(gasto: number, compras: number): string {
  return gasto <= 0 ? SIN_GASTO : compras <= 0 ? SIN_COMPRAS : "";
}

/**
 * "Paid Media · compras por lente": las tres lentes (Pixel, GA4 último clic,
 * Referido) sobre la MISMA ventana medida, con su CPA. Numerador del CPA = gasto
 * de las campañas Meta de Ventas en la ventana (D1); el resto del gasto Meta se
 * muestra aparte. El CPA por Referido solo se muestra con suficiente propagación
 * del código PM_ (D2).
 */
export default function LentesPaidMedia({ a }: Props) {
  const { ordenes, meta, google } = a;
  const medibles = ordenes.medibles;
  const gastoVentas = meta.gastoVentasUsd;
  const otrosObjetivos = meta.gastoTotalUsd - meta.gastoVentasUsd;
  const cpaReferidoOk = muestraCpaReferido(a);
  const propagacion = propagacionReferidoPct(a);
  const sinCpaReferido =
    `Solo el ${fmtPct(propagacion)} de las órdenes medidas trae código PM_ (mínimo ${PM_PROPAGACION_MIN}%): ` +
    "el CPA por Referido no es comparable.";

  const filasMeta: Fila[] = [
    {
      lente: "Pixel Meta",
      ayuda: "Compras que Meta se atribuye en sus campañas de Ventas, incluidas personas que vieron el anuncio sin hacer clic.",
      compras: meta.pixelVentas,
      cpa: cpa(gastoVentas, meta.pixelVentas),
      sinCpa: motivoSinCpa(gastoVentas, meta.pixelVentas),
    },
    {
      lente: "GA4 último clic",
      ayuda: "Órdenes cuya visita de compra llegó desde un anuncio de Meta, según GA4.",
      compras: meta.ga4,
      cpa: cpa(gastoVentas, meta.ga4),
      sinCpa: motivoSinCpa(gastoVentas, meta.ga4),
    },
    {
      lente: "Referido PM_MT",
      ayuda: "Órdenes que llegaron con el código PM_MT en el link.",
      compras: meta.referido,
      cpa: cpaReferidoOk ? cpa(gastoVentas, meta.referido) : null,
      sinCpa: cpaReferidoOk ? motivoSinCpa(gastoVentas, meta.referido) : sinCpaReferido,
    },
  ];

  const gastoGoogle = google.gastoUsd;
  const filasGoogle: Fila[] = [
    {
      lente: "GA4 último clic",
      ayuda: "Órdenes cuya visita de compra llegó desde un anuncio de Google Ads, según GA4 (incluye el auto-tag gclid).",
      compras: google.ga4,
      cpa: cpa(gastoGoogle, google.ga4),
      sinCpa: motivoSinCpa(gastoGoogle, google.ga4),
    },
    {
      lente: "Referido PM_GG",
      ayuda: "Órdenes que llegaron con el código PM_GG en el link.",
      compras: google.referido,
      cpa: cpaReferidoOk ? cpa(gastoGoogle, google.referido) : null,
      sinCpa: gastoGoogle <= 0 ? SIN_GASTO : cpaReferidoOk ? motivoSinCpa(gastoGoogle, google.referido) : sinCpaReferido,
    },
  ];

  const cobertura = fmtPct(pct(ordenes.vistas, medibles));

  return (
    <div className="min-w-0">
      <BloqueTitulo
        sub={
          <>
            Gasto Meta Ventas: <span className="font-bold text-black">{fmtUsd(gastoVentas)}</span>
            {otrosObjetivos > 0.05 && (
              <span
                className="block"
                title="Gasto Meta de campañas que no son de Ventas (cobertura, tráfico, interacción) en el mismo período. No entra en el CPA."
              >
                Cobertura y otros objetivos: {fmtUsd(otrosObjetivos)} · fuera del CPA
              </span>
            )}
          </>
        }
      >
        Paid Media · compras por lente
      </BloqueTitulo>

      <TablaLentes plataforma="Meta" filas={filasMeta} medibles={medibles} />

      <div className="mt-4">
        <TablaLentes plataforma="Google" filas={filasGoogle} medibles={medibles} />
        {gastoGoogle <= 0 && (
          <p className="font-mono-data text-xs text-black/60 mt-1">Sin gasto de Google Ads asignado a este evento.</p>
        )}
      </div>

      <details className="mt-3">
        <summary className="font-mono-data text-xs underline cursor-pointer">¿Cómo se calcula?</summary>
        <p className="font-mono-data text-xs text-black/70 mt-2 leading-relaxed">
          Las tres lentes miden lo mismo con reglas distintas. Pixel: las compras que Meta se atribuye,
          incluidas personas que vieron el anuncio sin hacer clic; por eso casi siempre es la cifra más
          alta. GA4 último clic: órdenes cuya visita de compra llegó desde un anuncio. Referido: órdenes
          que llegaron con el código PM_ en el link. CPA = gasto de las campañas de Ventas en el período
          ÷ compras de la lente (en Google, todo su gasto). GA4 ve {cobertura} de las órdenes web, así
          que su CPA es un techo: el real es menor.
        </p>
      </details>
    </div>
  );
}

function TablaLentes({ plataforma, filas, medibles }: { plataforma: string; filas: Fila[]; medibles: number }) {
  return (
    <table className="w-full border-4 border-black font-mono-data text-xs">
      <caption className="sr-only">Compras de {plataforma} por lente</caption>
      <thead>
        <tr className="bg-black text-white">
          <th scope="col" className="uppercase text-left px-1.5 py-1.5">
            {plataforma}
          </th>
          <th scope="col" className="uppercase text-right px-1.5 py-1.5">
            Compras
          </th>
          <th scope="col" className="uppercase text-right px-1.5 py-1.5" title="% de las órdenes web medidas">
            % órd.
          </th>
          <th scope="col" className="uppercase text-right px-1.5 py-1.5">
            CPA
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          const p = pct(f.compras, medibles);
          return (
            <tr key={f.lente} className="border-t-2 border-black">
              <th scope="row" className="text-left font-normal px-1.5 py-1.5 leading-tight" title={f.ayuda}>
                {f.lente}
              </th>
              <td className="text-right px-1.5 py-1.5 font-display text-lg leading-none tabular-nums">
                {fmtNum(f.compras)}
              </td>
              <td
                className="text-right px-1.5 py-1.5 tabular-nums"
                title={p == null ? "Sin órdenes medidas en el período." : `${fmtNum(f.compras)} de ${fmtNum(medibles)} órdenes medidas`}
              >
                {fmtPct(p)}
              </td>
              <td
                className="text-right px-1.5 py-1.5 font-display text-lg leading-none tabular-nums whitespace-nowrap"
                title={f.cpa == null ? f.sinCpa || undefined : undefined}
              >
                {fmtUsdOGuion(f.cpa)}
                {/* El motivo del "—" (D2, sin gasto, sin compras) también para lector de pantalla. */}
                {f.cpa == null && f.sinCpa && <span className="sr-only"> ({f.sinCpa})</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
