"use client";

/**
 * Sección "Resultado del evento" del drill de /inversion-medios.
 *
 * El panel mostraba solo dinero (plan vs gasto real). Esto agrega el RESULTADO,
 * con dos decisiones de producto que mandan sobre el layout:
 *
 *  1. Las DOS unidades de ticket siempre visibles — transacciones como número
 *     principal, personas y órdenes debajo. En 58 de 61 eventos personas ==
 *     transacciones, así que la nota CAMBIA DE TEXTO en vez de esconderse:
 *     decir "sin packs de 2" es información; repetir el número sin explicación
 *     se lee como un error.
 *  2. Los DOS CPA visibles, con la brecha explicada. El numerador es EL MISMO en
 *     los dos (gasto de Ventas de Meta) y solo cambia el denominador, así que la
 *     razón entre los dos CPA ES la razón entre los dos conteos. Donde el
 *     referido no es interpretable, la card del pixel lleva el motivo escrito y
 *     la cifra imposible queda en el tooltip, nunca en la celda.
 *
 * FORMA (4ª iteración, la definitiva): **el mismo patrón que la fila de stats
 * financieros de arriba** — cards individuales en una grilla `md:grid-cols-5`,
 * misma estructura interna (label / valor / nota), y los dos CPA como dos cards
 * hermanas: la del referido lleva la brecha como línea delta con dot (el patrón
 * de KPI del style guide). La historia del numerador compartido va como LEYENDA
 * bajo la grilla, igual que la leyenda de la sábana.
 *
 * Historial de formas descartadas, todas verificadas en pantalla:
 *  - Grilla con una card de CPA a doble ancho → líneas base dispares y huecos.
 *  - Sección acotada a `max-w-3xl` → la única pieza de la página sin ancho
 *    completo; el conjunto quedaba rengo a la izquierda.
 *  - UNA card de ancho completo con franja + banda → zonas muertas DENTRO del
 *    borde (dos celdas y ~1.000 px de blanco encerrado, la pill de brecha
 *    huérfana en el extremo). El espacio entre cards se lee como lienzo; el
 *    espacio dentro de un borde se lee como vacío.
 */

import type { AdsMetricasEvento, EstadoReferido, TicketsEvento } from "@/lib/queries/inversion-medios";
import { BRECHA_SANA_MAX, PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";
import { div, fmtConv, fmtPct, formatInt, formatUnitCost, fmtUsd } from "./format";

/** Motivo CORTO, para la nota de la card degradada. */
const MOTIVO_CORTO: Record<EstadoReferido, string> = {
  sin_datos_ticketera: "este evento no tiene filas en la ticketera",
  cero_vendidos: "no quedó ningún ticket vendido",
  pre_esquema: "la venta cerró antes de que existiera la etiqueta PM_",
  sin_propagacion: "la ticketera no propaga el referido",
  referido_mutilado: "el referido llega sin el prefijo PM_",
  sin_pm: "ninguna venta llegó con etiqueta PM_",
  propagacion_baja: "la etiqueta PM_ solo llegó en {pct} de las órdenes",
  medible: "",
};

/** Motivo LARGO, para el tooltip. Es donde vive la cifra que no se muestra. */
const MOTIVO_LARGO: Record<EstadoReferido, string> = {
  sin_datos_ticketera:
    "Hay gasto de publicidad pero ninguna fila en la ticketera para este EventoID.",
  cero_vendidos:
    "Todos los tickets de la ticketera se devolvieron, así que no hay ninguna venta contra la que medir.",
  pre_esquema:
    "La venta de este evento cerró antes de que la ticketera empezara a propagar la etiqueta PM_.",
  sin_propagacion:
    "Ninguna venta de este evento llegó con referido de ningún tipo.",
  referido_mutilado:
    "El referido de este evento llega sin el prefijo PM_, así que no se puede saber qué campaña trajo la venta.",
  sin_pm:
    "La ticketera propaga referidos en este evento, pero ninguna venta llegó con una etiqueta PM_ de campaña de venta.",
  propagacion_baja: "",
  medible: "",
};

export default function RendimientoEvento({
  ads,
  tickets,
  hoyEnRango,
}: {
  ads: AdsMetricasEvento;
  tickets: TicketsEvento;
  hoyEnRango: boolean;
}) {
  const t = tickets;

  // Los dos CPA comparten numerador. `div` es el único que dice "no hay
  // denominador" (devuelve null → guion), nunca 0.
  const cpaPixel = div(ads.gastoVentasUsd, ads.conversionesVentas);
  const cpaRef = div(ads.gastoVentasUsd, t.pmOrdenes);
  const brecha = div(ads.conversionesVentas, t.pmOrdenes); // === cpaRef / cpaPixel

  const refInterpretable = t.estado === "medible" && t.propagacionPct >= PM_PROPAGACION_MIN;
  const sano = brecha != null && brecha <= BRECHA_SANA_MAX;

  const gastoSinPixel = ads.gastoUsd - ads.gastoVentasUsd;
  const pctSinPixel = div(gastoSinPixel, ads.gastoUsd);

  const pctMeta = t.goalTickets ? div(100 * t.personas, t.goalTickets) : null;
  const pctDevueltas = div(100 * t.devueltas, t.transacciones);

  const captionScope = `del período en pantalla${hoyEnRango ? " · hoy es parcial" : ""}`;

  const nota = notaBrecha(ads, t);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="font-display text-lg font-bold text-[#333333]">Resultado del evento</h2>
        <span className="font-sans text-xs text-[#999999]">{captionScope}</span>
      </div>

      {/* La MISMA grilla que la fila de stats financieros de arriba: cards del
          mismo tamaño, columnas alineadas verticalmente entre las dos filas.
          Los huecos por cards condicionales quedan en el LIENZO (gap de la
          grilla), que es donde el espacio vacío se lee como normal. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat
          label="Tickets vendidos"
          value={formatInt(t.transacciones)}
          title="Tickets vendidos, sin cortesías ni mesas VIP y sin devoluciones. Una fila de la ticketera es un ítem de ticket; una orden puede traer varios. Personas: el pack de 2 cuenta doble solo cuando la ticketera emitió una sola fila para las dos personas."
        >
          <p className="mt-1.5 font-sans text-[11px] leading-tight text-[#999999]">
            <span className="font-medium text-[#666666]">{formatInt(t.personas)}</span> personas ·{" "}
            <span className="font-medium text-[#666666]">{formatInt(t.ordenes)}</span> órdenes
          </p>
          {/* Sin venta, la nota de packs no informa nada. */}
          {t.transacciones > 0 && (
            <p className="mt-0.5 font-sans text-[11px] leading-tight text-[#999999]">
              {t.personas > t.transacciones ? "el pack de 2 cuenta doble" : "sin packs de 2"}
            </p>
          )}
        </Stat>

        <Stat
          label="% de la meta"
          value={fmtPct(pctMeta, 1)}
          hint={
            t.goalTickets
              ? `${formatInt(t.personas)} de ${formatInt(t.goalTickets)} personas`
              : "sin meta cargada"
          }
          title="Meta de tickets del evento (goalTickets, se carga en /admin/eventos junto con el techo). Está en personas, por eso se compara contra personas."
        />

        {t.devueltas > 0 && (
          <Stat
            label="Devueltos"
            value={formatInt(t.devueltas)}
            hint={pctDevueltas != null ? `${fmtPct(pctDevueltas, 1)} de los vendidos` : "sin vendidos"}
            tone="neg"
            title="Tickets devueltos, contados aparte y nunca restados de los vendidos. La ticketera no guarda cuándo se devolvió un ticket, así que restarlos reescribiría días ya pasados."
          />
        )}

        <Stat
          label="CPA pixel · Ventas"
          value={formatUnitCost(cpaPixel)}
          hint={
            refInterpretable
              ? `÷ ${fmtConv(ads.conversionesVentas)} compras que declara el pixel`
              : `sin CPA referido comparable: ${motivoCorto(t)}`
          }
          title={
            refInterpretable
              ? "Gasto de las campañas de Ventas de Meta dividido por las compras que declara su pixel. Es el techo optimista: la plataforma atribuye vista y clic con su propia ventana."
              : motivoLargo(ads, t, cpaRef)
          }
        />

        {refInterpretable && (
          <Stat
            label="CPA referido"
            value={formatUnitCost(cpaRef)}
            hint={`÷ ${formatInt(t.pmOrdenes)} órdenes con etiqueta PM_`}
            title="El mismo gasto de Ventas de Meta, dividido por las órdenes que la ticketera recibió con una etiqueta PM_ de campaña de venta. Es el piso conservador: exige que la etiqueta sobreviva todo el checkout."
          >
            <p className="mt-2 inline-flex items-center gap-1.5 font-sans text-[11px] font-medium text-[#333333]">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${sano ? "bg-[#B1D750]" : "bg-[#F6C544]"}`}
                aria-hidden="true"
              />
              brecha {brecha != null ? `${brecha.toFixed(2)}×` : "—"} vs pixel
            </p>
          </Stat>
        )}
      </div>

      {/* La historia de los dos CPA, como leyenda bajo la grilla — el mismo
          patrón que la leyenda de la sábana. Solo cuando hay dos CPA que leer. */}
      {refInterpretable && (
        <p className="font-sans text-xs leading-relaxed text-[#999999]">
          Los dos CPA dividen{" "}
          <span className="text-[#666666]">
            el mismo gasto de Ventas de Meta ({fmtUsd(ads.gastoVentasUsd, 0)})
          </span>
          {": "}
          {sano
            ? "y casi coinciden — el seguimiento está sano y las dos lecturas se pueden usar igual."
            : `el pixel es el techo optimista —atribuye vista y clic con la ventana de la plataforma— y el referido es el piso: exige que la etiqueta PM_ sobreviva todo el checkout, y llegó en ${fmtPct(t.propagacionPct, 1)} de las órdenes.`}
          {gastoSinPixel > 0 && (
            <>
              {" "}
              No incluyen {fmtUsd(gastoSinPixel, 0)} ·{" "}
              {fmtPct(pctSinPixel != null ? pctSinPixel * 100 : null)} en Cobertura, Tráfico y otros
              canales, que no tienen el pixel de compra.
            </>
          )}
        </p>
      )}

      {nota && <NotaBrecha texto={nota} />}
    </section>
  );
}

function motivoCorto(t: TicketsEvento): string {
  return MOTIVO_CORTO[t.estado].replace("{pct}", fmtPct(t.propagacionPct, 1));
}

function motivoLargo(ads: AdsMetricasEvento, t: TicketsEvento, cpaRef: number | null): string {
  const cpaTotal = formatUnitCost(div(ads.gastoUsd, ads.conversiones));
  const cola = ` Sobre el gasto total del evento (${fmtUsd(ads.gastoUsd, 0)}) el CPA pixel sería ${cpaTotal}.`;
  if (t.estado === "propagacion_baja") {
    return (
      `La etiqueta PM_ viajó en ${formatInt(t.pmOrdenes)} de ${formatInt(t.ordenes)} órdenes ` +
      `(${fmtPct(t.propagacionPct, 1)}). Con tan poca cobertura el CPA referido daría ` +
      `${formatUnitCost(cpaRef)}, que no mide la campaña sino el agujero del seguimiento.` +
      cola
    );
  }
  return MOTIVO_LARGO[t.estado] + cola;
}

/**
 * Card de stat, GEMELA de la de la fila financiera (`Stat` en EventoDrill.tsx):
 * mismo padding, misma escala, misma jerarquía — las dos filas tienen que leerse
 * como el mismo sistema. `children` agrega líneas de nota extra bajo el hint.
 */
function Stat({
  label,
  value,
  hint,
  tone,
  title,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neg";
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-4" title={title}>
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p
        className={`mt-1.5 font-display text-2xl font-bold leading-none ${
          tone === "neg" ? "text-[#ED75A0]" : "text-[#333333]"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 font-sans text-[11px] leading-tight text-[#999999]">{hint}</p>}
      {children}
    </div>
  );
}

/**
 * Callout, MÁXIMO UNO, por prioridad. Molde de FxGapNotice
 * (components/paid-media/KpiRow.tsx). Solo aparece cuando hay algo que un CPA no
 * puede decir por sí solo.
 */
function notaBrecha(ads: AdsMetricasEvento, t: TicketsEvento): string | null {
  if (!t.tieneTickets) {
    return (
      `Este evento gastó ${fmtUsd(ads.gastoUsd, 0)} en publicidad y no tiene ninguna fila en la ` +
      `ticketera, así que no hay resultado que medir. Revisa si se vendió en otra plataforma o si ` +
      `el EventoID de la campaña está mal escrito.`
    );
  }
  if (t.transacciones === 0 && t.devueltas > 0) {
    return (
      `Contra ${fmtUsd(ads.gastoUsd, 0)} de gasto no quedó ningún ticket vendido: los ` +
      `${formatInt(t.devueltas)} tickets de la ticketera se devolvieron completos. El pixel, en ` +
      `cambio, declara ${fmtConv(ads.conversionesVentas)} compras. Antes de leer cualquier CPA de ` +
      `este evento, revisa qué pasó con la venta.`
    );
  }
  if (t.estado === "referido_mutilado") {
    return (
      `El referido de este evento llega sin el prefijo PM_ en ${formatInt(t.pmMutilado)} tickets ` +
      `(solo ${formatInt(t.pmItems)} llegan completos). El CPA referido no significaría nada, así ` +
      `que se muestra un guion. Hay que arreglar cómo la ticketera propaga el parámetro del link.`
    );
  }
  const pctGoogle = div(ads.googleConversiones, ads.conversiones);
  if (ads.googleConversiones > 0 && pctGoogle != null && pctGoogle > 0.1) {
    return (
      `El ${fmtPct(pctGoogle * 100)} de las conversiones que declara este evento vienen de Google, ` +
      `cuya cuenta cuenta varias acciones por compra real. Esas conversiones no entran en el CPA de ` +
      `arriba, que solo usa el pixel de Ventas de Meta.`
    );
  }
  return null;
}

function NotaBrecha({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#F6C544] bg-white p-4">
      <span
        className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#F6C544]"
        aria-hidden="true"
      />
      <p className="font-sans text-sm text-[#333333]">{texto}</p>
    </div>
  );
}
