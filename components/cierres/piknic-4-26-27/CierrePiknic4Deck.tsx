import { Fragment } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import Deck from "@/components/cierres/deck/Deck";
import { FechaClaveInput } from "@/components/cierres/deck/FechaClaveInput";
import {
  CellSub,
  ConDiasAntes,
  Delta,
  Kpi,
  Note,
  Pill,
  Slide,
  SlideTitle,
  Source,
  SpendBar,
  SubTitle,
  Table,
  Td,
  TODAS_LAS_AREAS,
  Th,
  TramosCalor,
} from "@/components/cierres/deck/primitives";
import {
  CANALES_CLAVE,
  CMP_RESULTADO,
  EQUILIBRIO,
  EQUILIBRIO_CMP,
  EQUILIBRIO_CON_RADIO,
  INGRESO_HORA,
  INGRESO_RESUMEN,
  MAPA_ALT,
  META,
  OC,
  OC_ANTES,
  OC_ESTADOS,
  OC_PAGO,
  OC_TOTAL,
  PORTADA_FACTS,
  PROXIMOS,
  PUNTOS_CONTROL,
  TRAMOS_VENTA,
  ZONAS,
  ZONAS_TOTAL,
  type EstadoProximo,
} from "@/lib/cierres/piknic-4-26-27";
import { diasAntes, fechaCorta } from "@/lib/cierres/hitos";
import type { FechaClaveEvento } from "@/lib/produccion/fechas-clave";
import mapaVentas from "./mapa-ventas.jpg";

const TOTAL = 11;

const fmtN = (v: number) => new Intl.NumberFormat("es-CL").format(v);

const TRAMOS = [
  { key: "antes", label: "Antes de 3 semanas", color: "#9F99F8" },
  { key: "semanas1a3", label: "Entre 1 y 3 semanas", color: "#87DACD" },
  { key: "ultimaSemana", label: "Última semana", color: "#F6C544" },
  { key: "dia", label: "Día del evento", color: "#EF8C34" },
] as const;


type PuntoControl = (typeof PUNTOS_CONTROL)[number];

/**
 * Fila de un punto de control que sale de una fecha clave de la carta Gantt:
 * qué pasó (fecha y días antes), el plazo si la categoría lo tiene y el estado.
 * Sin tarea marcada, queda la fila tal como viene en los datos (sin dato).
 */
function conFechaClave(p: PuntoControl, fc: FechaClaveEvento | null): PuntoControl {
  const plazo = fc?.plazoDias ?? null;
  const conPlazo = plazo != null ? { plazo: `ideal ${plazo} días antes` } : {};
  if (!fc?.fecha) return { ...p, ...conPlazo };
  const dias = diasAntes(fc.fecha, META.fechaEvento);
  const cuando = dias === 0 ? "el mismo día del evento" : `${dias} ${dias === 1 ? "día" : "días"} antes`;
  const quePaso = `Se confirmó el ${fechaCorta(fc.fecha, Number(META.fechaEvento.slice(0, 4)))}, ${cuando}, según la carta Gantt.`;
  if (plazo == null) return { ...p, quePaso, estado: "plazo por definir", tone: "neutral" };
  return dias >= plazo
    ? { ...p, ...conPlazo, quePaso, estado: "a tiempo", tone: "success" }
    : { ...p, ...conPlazo, quePaso, estado: `${plazo - dias} días tarde`, tone: "error" };
}

/** Estado de un hito de un evento próximo: píldora + detalle. */
function EstadoCelda({ e }: { e: EstadoProximo }) {
  return (
    <>
      <Pill tone={e.tone}>{e.texto}</Pill>
      {e.detalle && <CellSub>{e.detalle}</CellSub>}
    </>
  );
}

/** Escaneos en el acceso por tramo de 30 minutos: este evento contra el anterior. */
function IngresoHora() {
  const max = Math.max(...INGRESO_HORA.map((s) => Math.max(s.p4, s.p3)));
  const h = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[#9F99F8]" />
          Piknic 4 ({INGRESO_RESUMEN.total} escaneos)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--ink-subtle)]" />
          Piknic 3 ({INGRESO_RESUMEN.totalP3})
        </span>
      </div>
      <div
        className="flex h-[calc(var(--spacing)*44)] items-end gap-1 border-b border-[var(--divider)] pt-5"
        role="img"
        aria-label={`Escaneos en el acceso cada 30 minutos. Piknic 4: ${INGRESO_HORA.map((s) => `${s.hora} ${s.p4}`).join(", ")}.`}
      >
        {INGRESO_HORA.map((s) => (
          <div key={s.hora} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            <div className="relative w-3/5 rounded-t-sm bg-[#9F99F8]" style={{ height: h(s.p4) }}>
              {s.p4 >= 300 && (
                <span className="absolute bottom-full left-1/2 hidden -translate-x-1/2 pb-0.5 text-xs font-semibold tabular-nums text-[var(--ink)] deck:block">
                  {s.p4}
                </span>
              )}
            </div>
            <div className="w-1/4 rounded-t-sm bg-[var(--ink-subtle)]" style={{ height: h(s.p3) }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-1 text-xs tabular-nums text-[var(--ink-subtle)]">
        {INGRESO_HORA.map((s) => (
          <span key={s.hora} className="min-w-0 flex-1 text-center">
            {s.hora.endsWith(":00") ? s.hora.slice(0, 2) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Personas que entraron contra el equilibrio, un evento por fila. */
function EquilibrioComparado() {
  const max = 6000;
  const x = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[#9F99F8]" />
          Entraron
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-[var(--ink)]" />
          Equilibrio con marcas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-[var(--ink-subtle)]" />
          Sin marcas
        </span>
      </div>
      {EQUILIBRIO_CMP.map((e) => (
        <div key={e.evento} className="grid grid-cols-[calc(var(--spacing)*16)_minmax(0,1fr)] items-center gap-x-3">
          <span className={`text-sm text-[var(--ink)] ${e.actual ? "font-semibold" : ""}`}>{e.evento}</span>
          <div
            className="relative h-6"
            role="img"
            aria-label={`${e.evento}: entraron ${fmtN(e.entraron)}; equilibrio con marcas ${fmtN(e.necesarias)}; sin marcas ${fmtN(e.sinMarcas)}.`}
          >
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[var(--divider)]" />
            <div aria-hidden="true" className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[#9F99F8]" style={{ width: x(e.entraron) }} />
            <div aria-hidden="true" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--ink)]" style={{ left: x(e.necesarias) }} />
            <div aria-hidden="true" className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--ink-subtle)]" style={{ left: x(e.sinMarcas) }} />
          </div>
          <span />
          <span className="text-xs tabular-nums text-[var(--ink-muted)]">
            <b className="font-semibold text-[var(--ink)]">
              {fmtN(e.entraron)} de {fmtN(e.necesarias)}
            </b>{" "}
            · {Math.round((e.entraron / e.necesarias) * 100)}% del equilibrio · {e.porPersona} por persona
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Presentación de cierre del Piknic 4 · 26-27 (GLO216): 11 láminas, sin anexo.
 * La lámina 2 (puntos de control, en orden de plazo) es el índice. Orden en
 * actos: tablero (1-2), llegamos antes (3-4), el día (5-7), la cuenta (8-10:
 * equilibrio, OC y pagos según el estado de la OC) y lo que viene (11). El 18-nov salieron la anticipación con línea de tiempo
 * (repetía la 2), los acuerdos y las notas por área del Piknic 3, los acuerdos
 * con Producción, los pendientes y los 5 anexos.
 * Misma base que la del Piknic 3 para compararlas.
 * Ajustada el 17-nov dos veces: con las notas por área del cierre del Piknic 3
 * y con la reunión con Producción Site, Técnica y Seguridad (próximos eventos,
 * ingreso por hora, acuerdos de Producción, Piknic 1 en la comparación, pagos
 * de Finanzas y mapa sobre el layout que se montó). Datos en
 * lib/cierres/piknic-4-26-27.ts (foto al 17-nov, D+10). La mecánica de
 * láminas, navegación y PDF vive en components/cierres/deck. El control de
 * acceso lo hace la page.
 */
export default function CierrePiknic4Deck({
  mapaHref,
  lineup,
  editarLineup = false,
}: {
  mapaHref?: string;
  /** Fecha clave «Line up confirmado» del plan en la carta Gantt (null si no se pudo leer). */
  lineup: FechaClaveEvento | null;
  /** Quien mira puede anotar la fecha real desde la lámina (escribe en la Gantt). */
  editarLineup?: boolean;
}) {
  const OC_P4 = OC_ESTADOS.find((e) => e.actual) ?? OC_ESTADOS[OC_ESTADOS.length - 1];
  const puntos = PUNTOS_CONTROL.map((p) => (p.fechaClave ? conFechaClave(p, lineup) : p));

  return (
    <Deck
      title={`Cierre ${META.evento}`}
      backHref="/cierres"
      backLabel="Cierres"
      pdfFilename={META.pdfFilename}
      mapaHref={mapaHref}
    >
      {/* 1 · Portada */}
      <Slide
        id="portada"
        n={1}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Reunión de cierre"
        detail={META.corte}
        className="justify-between"
      >
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-5xl font-bold leading-none tracking-tight text-[var(--ink)] deck:text-7xl">
            Cierre Piknic 4
          </h1>
          <p className="max-w-[62ch] text-lg leading-relaxed text-[var(--ink-muted)]">
            Sábado 7-nov · Parque Padre Hurtado · Guy Gerber, Tinlicker DJ y
            Rampue (live). Qué pasó con el evento, medido con los mismos puntos de
            control del Piknic 3.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 border-t border-[var(--divider)] pt-6 sm:grid-cols-2 deck:grid-cols-4">
          {PORTADA_FACTS.map((f) => (
            <Kpi
              key={f.value}
              value={f.value}
              caption={f.caption}
              valueClass={
                f.tone === "warn" ? "text-[var(--amber-ink)]" : "text-[var(--ink)]"
              }
            />
          ))}
        </div>
      </Slide>


      {/* 2 · Tarjeta de control */}
      <Slide
        id="control"
        n={2}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Puntos de control"
        detail="en orden de plazo · 5 del Piknic 3 y dos nuevos: line up y layout"
      >
        <SlideTitle>Piknic 4 contra los puntos de control</SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Punto de control</Th>
              <Th>Plazo propuesto</Th>
              <Th>Qué pasó en el Piknic 4</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.punto}>
                <Td className="align-top whitespace-nowrap font-semibold">
                  {p.punto}
                  <CellSub>{p.area}</CellSub>
                </Td>
                <Td className="align-top whitespace-nowrap font-semibold">
                  {p.plazo}
                </Td>
                <Td className="align-top">
                  <ConDiasAntes>{p.quePaso}</ConDiasAntes>
                  {p.fechaClave && editarLineup && (
                    <FechaClaveInput
                      slug="piknic-4-26-27"
                      fechaClaveId={p.fechaClave}
                      fecha={lineup?.fecha ?? null}
                      max={META.fechaEvento}
                      label="Fecha en que se confirmó el line up del Piknic 4"
                    />
                  )}
                </Td>
                <Td className="align-top">
                  <Pill tone={p.tone}>{p.estado}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Source>
          Rojo = pasó el plazo · amarillo = cumple el mínimo · gris = sin dato ·
          «vencida» = nadie la marcó como cerrada en la Gantt.
        </Source>
      </Slide>


      {/* 3 · Comparación con Piknic 1 y Piknic 3 */}
      <Slide
        id="piknic-3"
        n={3}
        total={TOTAL}
        areas={["Marketing"]}
        label="Comparación"
        detail="Piknic 1 · sáb 12-sep y Piknic 3 · sáb 3-oct"
      >
        <SlideTitle>
          Lo que el Piknic 4 vendió de más que el Piknic 3, lo vendió antes de
          las 3 semanas
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Resultado</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Indicador</Th>
                  <Th right>Piknic 1</Th>
                  <Th right>Piknic 3</Th>
                  <Th right>Piknic 4</Th>
                  <Th right>4 contra 3</Th>
                </tr>
              </thead>
              <tbody>
                {CMP_RESULTADO.map((r, i, arr) => (
                  <Fragment key={r.indicador}>
                    {r.grupo !== arr[i - 1]?.grupo && (
                      <tr>
                        <td
                          colSpan={5}
                          className="border-b border-[var(--divider)] bg-[var(--surface-sunken)] px-3 pt-2 pb-1 text-xs font-semibold text-[var(--ink-muted)]"
                        >
                          {r.grupo}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <Td>{r.indicador}</Td>
                      <Td right className="text-[var(--ink-muted)]">{r.p1}</Td>
                      <Td right>{r.p3}</Td>
                      <Td right className="font-semibold">{r.p4}</Td>
                      <Td right className="whitespace-nowrap">
                        <Delta tone={r.cambio.tone}>{r.cambio.texto}</Delta>
                      </Td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Cuándo se vendió</SubTitle>
            <TramosCalor tramos={TRAMOS} filas={TRAMOS_VENTA} />
            <Note>
              A 3 semanas del evento, el Piknic 4 ya tenía <b>970</b> entradas
              pagadas y el Piknic 3, <b>ninguna</b>. De ahí en adelante vendieron
              casi lo mismo: <b>1.806</b> contra <b>1.853</b>.
            </Note>
            <Note>
              <b>Más días ayudan, pero no bastan:</b> el Piknic 1 abrió 52 días
              antes y terminó en 2.035. Fue el primero de la temporada.
            </Note>
            <Note>
              <b>Por qué subió la venta por persona:</b> en cada tramo la entrada
              se pagó más (última semana: $39.593 contra $34.400) y hubo más
              upgrades (135 contra 45). El día del evento costó lo mismo.
            </Note>
          </div>
        </div>
        <Source>
          Mismas fuentes en los tres eventos. Venta de tickets bruta = con cargo
          por servicio. CPA Meta = gasto en Meta ÷ personas que entraron o que
          compraron (reparte el gasto entre todos, no es atribución; sin Google). «Antes de 3 semanas» = 21 días o más antes del evento.
          Piknic 1 y 3 = cifras publicadas en el cierre del Piknic 3 (8-oct); ahí
          las personas que entraron descuentan menos upgrades: con la regla del Piknic 4 serían
          3.104 y 3.021. Esta temporada no hubo Piknic 2.
        </Source>
      </Slide>


      {/* 4 · Venta: cómo llegó la gente a comprar */}
      <Slide
        id="venta"
        n={4}
        total={TOTAL}
        areas={["Marketing", "Ticketing y Comunidad"]}
        label="Venta"
        detail="por qué link llegó cada compra"
      >
        <SlideTitle>
          Cómo llegó la gente a comprar: sube Club Glovox, entra Google y baja
          Linktree
        </SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Cómo llegó</Th>
              <Th right>Piknic 1</Th>
              <Th right>Piknic 3</Th>
              <Th right>Piknic 4</Th>
              <Th right>% de las entradas</Th>
            </tr>
          </thead>
          <tbody>
            {CANALES_CLAVE.map((c) => (
              <tr key={c.canal}>
                <Td className="py-3 font-semibold">
                  {c.canal}
                  <CellSub>{c.que}</CellSub>
                </Td>
                <Td right className="py-3 text-[var(--ink-muted)]">{c.p1}</Td>
                <Td right className="py-3 text-[var(--ink-muted)]">{c.p3}</Td>
                <Td right className="py-3 font-display text-2xl font-bold">{c.p4}</Td>
                <Td right className="py-3 whitespace-nowrap">
                  <span className="text-[var(--ink-muted)]">
                    {c.pctP1} → {c.pctP3} →
                  </span>{" "}
                  <b className="font-semibold">{c.pctP4}</b>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Note>
          <b>Toda la compra ocurre en Punto Ticket:</b> el «canal» no es dónde se
          compra, sino el link por el que llegó la persona.{" "}
          <b>Club Glovox</b> va en 13% de las entradas; la meta conversada es
          llegar a 15% (por validar con Comunidad); falta explicarlo dentro del
          equipo.
        </Note>
        <Note>
          <b>Más de la mitad sigue sin código:</b> 56% en el Piknic 3 y en el 4
          (Piknic 1: 67%). /marketing/weekly cruza esas compras con GA4 y
          atribuye más.
        </Note>
        <Source>
          Entradas pagadas de la ticketera según el código del link de compra
          (2.776 en el Piknic 4, 1.853 en el Piknic 3 y 2.034 en el Piknic 1). El resto
          de los canales: sin código, boletería, Meta, social orgánico y email.
        </Source>
      </Slide>


      {/* 5 · Ingreso por hora */}
      <Slide
        id="ingreso"
        n={5}
        total={TOTAL}
        areas={["Seguridad", "Producción"]}
        label="Seguridad · ingreso por hora"
        detail="escaneos en el acceso cada 30 minutos"
      >
        <SlideTitle>
          En una hora, de {INGRESO_RESUMEN.horaPunta}, entró el{" "}
          {INGRESO_RESUMEN.horaPuntaPct} del público
        </SlideTitle>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Kpi
            value={INGRESO_RESUMEN.horaPuntaPersonas}
            caption={`escaneos en la hora punta. Piknic 3: ${INGRESO_RESUMEN.horaPuntaP3}`}
          />
          <Kpi
            value={`${INGRESO_RESUMEN.pico15PorMinuto} por minuto`}
            caption={`en el cuarto de hora más cargado, de ${INGRESO_RESUMEN.pico15} (${INGRESO_RESUMEN.pico15Personas} escaneos)`}
          />
          <Kpi
            value={INGRESO_RESUMEN.mitad}
            caption={`hora en que ya había entrado la mitad. El 90%, a las ${INGRESO_RESUMEN.noventa} (Piknic 3: ${INGRESO_RESUMEN.noventaP3})`}
          />
        </div>
        <IngresoHora />
        <Note>
          <b>Para preguntarle a Seguridad:</b> entre las 18:29 y las 18:40 no se
          escaneó ninguna entrada (11 minutos; desde las 18:23 ya casi ninguna).
          Al volver entraron 40 y 45 por minuto, los dos minutos más cargados
          del día. ¿Se cerró el acceso o se cayó el escaneo? El gráfico va cada
          media hora y no lo muestra. <b>Mesa VIP llega más tarde:</b>{" "}
          la mitad entró después de las {INGRESO_RESUMEN.mesaMitad}. Antes de las
          15:00 entraron {INGRESO_RESUMEN.antes15} ({INGRESO_RESUMEN.antes15Pct}).
        </Note>
        <Source>
          Hora de escaneo de cada ticket en el acceso (ticketera). Mide el flujo
          en la puerta, no el largo de la fila. Son escaneos: incluyen 127
          upgrades que se escanean aparte (40 en el Piknic 3). Hora punta = los
          60 minutos seguidos con más ingresos. La salida no se mide.
        </Source>
      </Slide>


      {/* 6 · Mapa de ventas */}
      <Slide
        id="mapa"
        n={6}
        total={TOTAL}
        areas={["Operaciones", "Producción"]}
        label="Operaciones · mapa de ventas"
        detail="Onfire sobre el layout que se montó"
      >
        <SlideTitle>Dónde se vendió: barras, comida y asistentes sobre el layout</SlideTitle>
        <figure className="m-0 grid min-h-0 flex-1 grid-cols-1 gap-6 deck:grid-cols-2">
          <div className="relative aspect-[2200/1960] min-h-0 deck:aspect-auto">
            <Image
              src={mapaVentas}
              alt={MAPA_ALT}
              fill
              loading="eager"
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain object-right-top"
            />
          </div>
          <figcaption className="flex flex-col gap-3">
            <Note>
              Globos morados = bebidas · naranja = comida · verde punteado =
              asistentes por zona. El área del globo es proporcional al monto.
            </Note>
            <Note>
              <b>La Barra Corchete y la 360 suman $31,5 M, el 40% de la venta.</b>{" "}
              Entel y Mistral suman $16,4 M (21%): pese a estar del lado de los
              baños, ese sector vendió la mitad.
            </Note>
            <Note>
              Heinz, Carl&apos;s Jr y BigTime no registran venta en Onfire. El
              mapa interactivo trae el detalle por punto y el ticket promedio.
            </Note>
            {mapaHref && (
              <a
                href={mapaHref}
                target="_blank"
                rel="noopener noreferrer"
                data-no-print="true"
                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[var(--ink)] print:hidden"
              >
                Abrir el mapa interactivo en otra pestaña
                <ExternalLink aria-hidden="true" className="h-4 w-4 text-[var(--ink-muted)]" />
              </a>
            )}
          </figcaption>
        </figure>
        <Source>
          Mapa rehecho el 17-nov sobre el layout que se montó (versión del 3-nov,
          que Producción subió el 17-nov). Contra la rev3: Épica y Carpano pasaron
          al sector oriente y BigTime quedó en el borde sur. Cocktail VIP y JW VIP
          no están rotuladas en el layout: su ubicación la informó el equipo. El
          mapa cuenta 3.491 escaneos; en el resto de la presentación son 3.364
          personas distintas.
        </Source>
      </Slide>


      {/* 7 · VIP y general */}
      <Slide
        id="zonas"
        n={7}
        total={TOTAL}
        areas={["Operaciones", "Producción"]}
        label="Operaciones · VIP y general"
        detail="consumo por zona · al 17-nov"
      >
        <SlideTitle>
          Una de cada cuatro personas estuvo en VIP o mesa, y en VIP no se
          consumió más que en general
        </SlideTitle>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Kpi value="$78,6 M" caption="vendido en barras (bruto). Piknic 3: $57,5 M · Piknic 1: $53,2 M" />
          <Kpi value="$23.371" caption="por persona. Piknic 3: $18.941 · Piknic 1: $17.098" />
          <Kpi value="25%" caption="de la venta salió en promos 2x ($19,7 M)" />
        </div>
        <div className="grid grid-cols-1 items-start gap-10">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Personas y consumo por zona</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Zona</Th>
                  <Th right>Personas</Th>
                  <Th right>%</Th>
                  <Th right>Consumo</Th>
                  <Th right>Por persona</Th>
                  <Th right>Piknic 1</Th>
                  <Th right>Piknic 3</Th>
                </tr>
              </thead>
              <tbody>
                {ZONAS.map((z) => (
                  <tr key={z.zona}>
                    <Td>{z.zona}</Td>
                    <Td right>{z.personas}</Td>
                    <Td right>{z.pct}</Td>
                    <Td right>{z.consumo}</Td>
                    <Td right className={z.parcial ? "text-[var(--ink-muted)]" : "font-semibold"}>
                      {z.porPersona}
                      {z.parcial && " · parcial"}
                    </Td>
                    <Td right className="text-[var(--ink-muted)]">{z.porPersonaP1}</Td>
                    <Td right className="text-[var(--ink-muted)]">{z.porPersonaP3}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right>{ZONAS_TOTAL.personas}</Td>
                  <Td right>100%</Td>
                  <Td right>{ZONAS_TOTAL.consumo}</Td>
                  <Td right>{ZONAS_TOTAL.porPersona}</Td>
                  <Td right className="font-normal text-[var(--ink-muted)]">{ZONAS_TOTAL.porPersonaP1}</Td>
                  <Td right className="font-normal text-[var(--ink-muted)]">{ZONAS_TOTAL.porPersonaP3}</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              En VIP cada persona consumió un poco menos que en general; en el
              Piknic 3 consumía más y en el 1, lo mismo. <b>¿Cómo incentivamos el
              consumo en VIP?</b> Mesa VIP es parcial: las botellas del paquete no
              pasan por Onfire. «Sin barra»: en el Piknic 1 no hubo barra de mesas
              en Onfire y en el 3 pasaron solo 30 tragos.
            </Note>
            <Note>
              <b>Por confirmar:</b> en la reunión con Producción se dijo que en
              VIP hubo más gente (unas 700) por los upgrades. De los 127 upgrades
              escaneados, la ticketera registra solo 4 a VIP (los otros 123 son
              a general); si entraron por otra vía, el consumo por persona en VIP
              sería todavía menor.
            </Note>
          </div>
        </div>
        <Source>
          Personas = escaneos menos upgrades, según el tipo de ticket. Consumo por
          zona = todo Onfire en las barras de esa zona (una persona de VIP también
          puede comprar en una barra general).
        </Source>
      </Slide>


      {/* 8 · Punto de equilibrio */}
      <Slide
        id="equilibrio"
        n={8}
        total={TOTAL}
        areas={["Dirección", "Finanzas", "Programación Artística"]}
        label="Punto de equilibrio"
        detail="estimación al 17-nov"
      >
        <SlideTitle>
          Con las marcas, el Piknic 4 quedó en su punto de equilibrio: necesitaba
          unas {fmtN(Math.round(EQUILIBRIO.conMarcas / 100) * 100)} personas y entraron{" "}
          {fmtN(EQUILIBRIO.entraron)}
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Cómo se calcula (Piknic 4)</SubTitle>
            <ul className="flex flex-col text-sm text-[var(--ink)]">
              {[
                ["Presupuesto de gasto", EQUILIBRIO.presupuesto, `incluye artística por ${EQUILIBRIO.artistica}`],
                ["− Marcas (supuesto)", EQUILIBRIO.marcas, "aporte supuesto de ciertas marcas"],
                ["= Por cubrir con público", EQUILIBRIO.porCubrir, ""],
                ["÷ Ingreso neto por persona", EQUILIBRIO.porPersona, `tickets ${EQUILIBRIO.porPersonaTickets} + barras ${EQUILIBRIO.porPersonaBarras}`],
                ["= Personas necesarias", fmtN(EQUILIBRIO.conMarcas), `entraron ${fmtN(EQUILIBRIO.entraron)}`],
              ].map(([concepto, valor, detalle], i, arr) => (
                <li
                  key={concepto}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-[var(--divider)] py-2 first:border-t ${i === arr.length - 1 ? "font-semibold" : ""}`}
                >
                  <span>
                    {concepto}
                    {detalle && <CellSub>{detalle}</CellSub>}
                  </span>
                  <span className="text-right font-display text-xl font-bold tabular-nums">{valor}</span>
                </li>
              ))}
            </ul>
            <Note>
              <b>Las marcas pagan la artística:</b> con un aporte supuesto de{" "}
              {EQUILIBRIO.marcas}, cubren la artística ({EQUILIBRIO.artistica}). Sin marcas harían falta{" "}
              <b>{fmtN(EQUILIBRIO.sinMarcas)}</b> personas. Cada <b>$1 M</b> más de
              artística son unas {EQUILIBRIO.personasPorMillon} personas más.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <SubTitle>Los tres Piknic de la temporada</SubTitle>
            <EquilibrioComparado />
            <Note>
              El Piknic 1 y el 3 quedaron a unas <b>1.100</b> y <b>1.200</b>{" "}
              personas del equilibrio. La diferencia con el Piknic 4 es el{" "}
              <b>ingreso por persona</b>; ahí también pesa que en esos dos
              entraron 185 y 177 personas con pase de temporada, que aquí no
              suman tickets.
            </Note>
            <Note>
              <b>La radio decide:</b> los tres van sin la radio de{" "}
              {EQUILIBRIO_CON_RADIO.radio} (Megamedia), que en el Piknic 4 es una
              OC fuera de presupuesto. Si es compra y no canje, el Piknic 4
              necesitaba unas <b>{fmtN(EQUILIBRIO_CON_RADIO.necesarias)}</b>{" "}
              personas y llegó al {EQUILIBRIO_CON_RADIO.pct}%.
            </Note>
          </div>
        </div>
        <Source>
          Estimación con la mezcla de público de cada evento y el gasto fijo
          (baños, guardias y barras en realidad suben con la gente). Gasto =
          presupuesto de hoy en Unabase, no gasto real. Marcas = supuesto de $40 M
          en los tres eventos. Tickets = venta + 55% del
          cargo por servicio; barras = todo Onfire; ambos sin IVA. No incluye
          producto de marcas, mesas VIP, pases de temporada ni el negocio BTL
          (montaje de activaciones), que en Unabase va aparte.
        </Source>
      </Slide>


      {/* 9 · Avance de OC */}
      <Slide
        id="oc"
        n={9}
        total={TOTAL}
        areas={["Finanzas", "cada área con presupuesto"]}
        label="Compras"
        detail="OC y facturas en Unabase · al 17-nov"
      >
        <SlideTitle>
          Antes del evento había OC por el {OC_ANTES.pct}% del presupuesto; la meta
          es {OC_ANTES.meta}%
        </SlideTitle>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Categoría · responsable</Th>
              <Th right>Presupuesto</Th>
              <Th right>OC emitidas</Th>
              <Th right>Con respaldo</Th>
              <Th className="w-[30%]">OC contra presupuesto</Th>
              <Th right>
                <span className="sr-only">% del presupuesto con OC</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {OC.map((r) => {
              const flag = r.pct == null || r.pct > 100;
              return (
                <tr key={r.categoria}>
                  <Td>
                    {r.categoria}
                    {r.responsable && (
                      <span className="text-[var(--ink-muted)]"> · {r.responsable}</span>
                    )}
                  </Td>
                  <Td right>{r.presupuesto}</Td>
                  <Td right>{r.emitido ?? "—"}</Td>
                  <Td right className="text-[var(--ink-muted)]">{r.conFactura ?? "—"}</Td>
                  <Td>
                    <SpendBar pct={r.pct} />
                  </Td>
                  <Td right className="whitespace-nowrap">
                    {flag ? (
                      <Delta tone="bad">{r.pct == null ? "sin OC" : `${r.pct}%`}</Delta>
                    ) : (
                      `${r.pct}%`
                    )}
                  </Td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <Td>Total</Td>
              <Td right>{OC_TOTAL.presupuesto}</Td>
              <Td right>{OC_TOTAL.emitido}</Td>
              <Td right>{OC_TOTAL.conFactura}</Td>
              <Td>
                <SpendBar pct={OC_TOTAL.pct} />
              </Td>
              <Td right>{OC_TOTAL.pct}%</Td>
            </tr>
          </tbody>
        </Table>
        <Note>
          <b>OC:</b> el {OC_ANTES.pct}% (Piknic 3: {OC_ANTES.piknic3}%) no cuenta
          la OC de radio de $18,8 M, que no está en el presupuesto; con ella, el
          total de hoy es {OC_TOTAL.pct}% y sin ella, {OC_ANTES.hoySinRadio}%.
          Quedan <b>{OC_ANTES.sinOc}</b> del presupuesto sin OC. Con respaldo
          registrado: <b>{OC_PAGO.conFactura}</b> ({OC_PAGO.pctFactura}%); faltan
          los de {OC_PAGO.ocSinFactura} OC por {OC_PAGO.sinFactura}. Lo pagado,
          en la lámina siguiente.
        </Note>
        <Source>
          Millones de pesos netos, GLO216 en Unabase ({OC_TOTAL.nOc} OC). Con
          respaldo = con factura, boleta o rendición registrada.
        </Source>
      </Slide>

      {/* 10 · Pagos según el estado de la OC */}
      <Slide
        id="pagos"
        n={10}
        total={TOTAL}
        areas={["Finanzas"]}
        label="Pagos"
        detail="estado de cada OC en Unabase · al 17-nov"
      >
        <SlideTitle>
          De {OC_P4.total.monto} en OC del Piknic 4, Unabase registra pagados{" "}
          {OC_P4.pagado}: ninguna OC está cerrada
        </SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Estado de la OC</Th>
              {OC_ESTADOS.map((e) => (
                <Th key={e.evento} right>
                  {e.evento}
                  <span className="block font-normal text-[var(--ink-subtle)]">{e.dias} días después</span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["cerrada", "Cerrada", "pagada completa"],
                ["pagada", "Pagada", "rendiciones"],
                ["emitida", "Emitida", "por pagar; puede tener abonos"],
              ] as const
            ).map(([k, estado, que]) => (
              <tr key={k}>
                <Td className="font-semibold">
                  {estado}
                  <CellSub>{que}</CellSub>
                </Td>
                {OC_ESTADOS.map((e) => (
                  <Td key={e.evento} right className={e.actual ? "font-semibold" : ""}>
                    {e[k].n} OC · {e[k].monto}
                    {e[k].abonado && <CellSub>abonado {e[k].abonado}</CellSub>}
                  </Td>
                ))}
              </tr>
            ))}
            <tr>
              <Td>Total, sin anuladas</Td>
              {OC_ESTADOS.map((e) => (
                <Td key={e.evento} right>
                  {e.total.n} OC · {e.total.monto}
                </Td>
              ))}
            </tr>
            <tr className="font-semibold">
              <Td>Pagado</Td>
              {OC_ESTADOS.map((e) => (
                <Td key={e.evento} right>
                  <span className="font-display text-2xl font-bold">{e.pct}</span>
                  <CellSub>{e.pagado}</CellSub>
                </Td>
              ))}
            </tr>
          </tbody>
        </Table>
        <Note>
          <b>Por el plazo de cada OC</b> tocaría pagar, en montos netos,{" "}
          {OC_PAGO.calendario.map((c, i, arr) => (
            <span key={c.cuando}>
              <b>{c.monto}</b> {c.cuando}
              {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " y " : "."}
            </span>
          ))}{" "}
          El Piknic 1 y el 3 ya tienen OC cerradas; el Piknic 4, ninguna.
        </Note>
        <Source>
          Estado de cada OC en Unabase (carga del 17-nov, 09:15). Montos con IVA,
          que es lo que se paga. Pagado = OC cerradas y pagadas más los abonos a
          OC emitidas. El calendario es una estimación (fecha de la OC más su plazo
          de pago): Unabase no guarda la fecha de pago.
        </Source>
      </Slide>


      {/* 11 · Lo que viene */}
      <Slide
        id="proximos"
        n={11}
        total={TOTAL}
        areas={["Dirección", "Marketing", "Producción", "Finanzas"]}
        label="Lo que viene"
        detail="próximos eventos contra los mismos plazos · al 17-nov"
      >
        <SlideTitle>
          El Piknic 5 está a 19 días, sin negocio en Unabase y sin carta Gantt
        </SlideTitle>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Evento</Th>
              <Th right>Faltan</Th>
              <Th>Salida a la venta · mínimo 30 días antes</Th>
              <Th>Negocio en Unabase · 30 días antes</Th>
              <Th>Carta Gantt</Th>
            </tr>
          </thead>
          <tbody>
            {PROXIMOS.map((p) => (
              <tr key={p.evento}>
                <Td className="font-semibold">
                  {p.evento}
                  <CellSub>{p.fecha}</CellSub>
                </Td>
                <Td right className="whitespace-nowrap">
                  {p.faltan} días
                </Td>
                <Td>
                  <EstadoCelda e={p.venta} />
                </Td>
                <Td>
                  <EstadoCelda e={p.negocio} />
                </Td>
                <Td>
                  <EstadoCelda e={p.gantt} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Note>
          <b>Piknic 5 es domingo:</b> en el cierre del Piknic 3 se dijo que los
          domingos se vende menos; lleva 939 entradas pagadas.{" "}
          <b>Bocas Moradas:</b> el 17-nov se dijo que ya salió a la venta, pero
          todavía no aparece en la ticketera; en la planilla de eventos no tiene
          GLO y figura dos veces (5-dic y 19-dic).
        </Note>
        <Source>
          Eventos propios de la planilla de eventos hasta el Piknic 7 (sin
          corporativos ni eventos de marca; los Piknic 8, 9 y 10 aún están en
          plazo). Venta = primer día con 10 o más entradas pagadas. Negocio =
          asignación en Unabase (al 16-nov). Verde = a tiempo; amarillo = vence
          pronto o hay algo que revisar; rojo = ya pasó; gris = aún no vence. En
          la carta Gantt nadie ha marcado tareas como cerradas: no significa que
          no se hicieron.
        </Source>
      </Slide>
    </Deck>
  );
}
