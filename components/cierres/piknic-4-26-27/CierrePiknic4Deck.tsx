import Image from "next/image";
import Deck from "@/components/cierres/deck/Deck";
import {
  CellSub,
  Delta,
  DaysBar,
  Kpi,
  Note,
  AreaNotas,
  Pill,
  PlazosTimeline,
  Slide,
  SlideTitle,
  Source,
  SpendBar,
  SubTitle,
  Table,
  Td,
  TODAS_LAS_AREAS,
  Th,
} from "@/components/cierres/deck/primitives";
import {
  ACUERDOS_PRODUCCION,
  ANTICIPACION,
  ANTICIPACION_ESCALA,
  BANOS,
  BARRAS_TOP,
  CANALES,
  CANALES_CLAVE,
  CANALES_TOTAL,
  CMP_RESULTADO,
  EQUILIBRIO,
  EQUILIBRIO_CMP,
  EQUILIBRIO_CON_RADIO,
  HITOS,
  INGRESO_HORA,
  INGRESO_RESUMEN,
  INGRESOS,
  INGRESOS_CARGA,
  INGRESOS_TOTAL,
  MAPA_ALT,
  META,
  NOTAS_AREA,
  NOTAS_POR_CONFIRMAR,
  OC,
  OC_ANTES,
  OC_PAGO,
  OC_TOTAL,
  PENDIENTES,
  PORTADA_FACTS,
  PROXIMOS,
  PUNTOS_CONTROL,
  SEGUIMIENTO_P3,
  TRAMOS_VENTA,
  ZONAS,
  ZONAS_TOTAL,
  type EstadoProximo,
} from "@/lib/cierres/piknic-4-26-27";
import mapaVentas from "./mapa-ventas.jpg";

const TOTAL = 20;

const fmtN = (v: number) => new Intl.NumberFormat("es-CL").format(v);

const TRAMOS = [
  { key: "antes", label: "Antes de 3 semanas", color: "bg-[#9F99F8]" },
  { key: "semanas1a3", label: "Entre 1 y 3 semanas", color: "bg-[#87DACD]" },
  { key: "ultimaSemana", label: "Última semana", color: "bg-[#F6C544]" },
  { key: "dia", label: "Día del evento", color: "bg-[#EF8C34]" },
] as const;

/** Barras apiladas: entradas pagadas de cada evento según cuándo se compraron. */
function TramosVenta() {
  const max = Math.max(
    ...TRAMOS_VENTA.map((e) => Object.values(e.tramos).reduce((a, b) => a + b, 0)),
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
        {TRAMOS.map((t) => (
          <span key={t.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm ${t.color}`} />
            {t.label}
          </span>
        ))}
      </div>
      {TRAMOS_VENTA.map((e) => {
        const total = Object.values(e.tramos).reduce((a, b) => a + b, 0);
        return (
          <div key={e.evento} className="grid grid-cols-[calc(var(--spacing)*18)_minmax(0,1fr)] items-center gap-3">
            <span className="text-sm font-semibold text-[var(--ink)]">{e.evento}</span>
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 overflow-hidden rounded-md"
                style={{ width: `${(total / max) * 85}%` }}
                role="img"
                aria-label={`${e.evento}: ${TRAMOS.map((t) => `${t.label.toLowerCase()} ${e.tramos[t.key]}`).join(", ")}; total ${e.total}.`}
              >
                {TRAMOS.map((t) =>
                  e.tramos[t.key] > 0 ? (
                    <div
                      key={t.key}
                      className={`flex items-center justify-center text-xs font-semibold tabular-nums text-[var(--ink)] ${t.color}`}
                      style={{ width: `${(e.tramos[t.key] / total) * 100}%` }}
                    >
                      {fmtN(e.tramos[t.key])}
                    </div>
                  ) : null,
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">{e.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
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
 * Presentación de cierre del Piknic 4 · 26-27 (GLO216): 16 láminas para la
 * reunión + 4 de anexo (detalle de venta, tragos, anticipación por evento y
 * notas por confirmar). Misma base que la del Piknic 3 para compararlas.
 * Ajustada el 17-nov dos veces: con las notas por área del cierre del Piknic 3
 * y con la reunión con Producción Site, Técnica y Seguridad (próximos eventos,
 * ingreso por hora, acuerdos de Producción, Piknic 1 en la comparación, pagos
 * de Finanzas y mapa sobre el layout que se montó). Datos en
 * lib/cierres/piknic-4-26-27.ts (foto al 17-nov, D+10). La mecánica de
 * láminas, navegación y PDF vive en components/cierres/deck. El control de
 * acceso lo hace la page.
 */
export default function CierrePiknic4Deck({ mapaHref }: { mapaHref?: string }) {
  const { max, lanzamiento, negocio } = ANTICIPACION_ESCALA;

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
            Sábado 7-nov · Parque Padre Hurtado · Guy Gerber, Tinikicker DJ y
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
        detail="los 6 del Piknic 3 y uno nuevo de Producción"
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
            {PUNTOS_CONTROL.map((p) => (
              <tr key={p.punto}>
                <Td className="align-top font-semibold">
                  {p.punto}
                  <CellSub>{p.area}</CellSub>
                </Td>
                <Td className="align-top whitespace-nowrap font-semibold">
                  {p.plazo}
                </Td>
                <Td className="align-top">{p.quePaso}</Td>
                <Td className="align-top">
                  <Pill tone={p.tone}>{p.estado}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Source>
          Rojo = pasó el plazo. Amarillo = cumple el mínimo. Gris = no hay dato
          para medirlo: nunca pinta rojo. «Vencida» en la carta Gantt significa
          que nadie la marcó como cerrada, no que no se hizo.
        </Source>
      </Slide>

      {/* 3 · Anticipación (el detalle por evento va en el anexo) */}
      <Slide
        id="anticipacion"
        n={3}
        total={TOTAL}
        areas={["Dirección", "Marketing", "Producción", "Finanzas"]}
        label="Anticipación"
        detail="cuántos días antes del evento pasó cada cosa"
      >
        <SlideTitle>
          La venta abrió 32 días antes, sobre el mínimo propuesto de 30; el
          negocio en Unabase sigue tarde
        </SlideTitle>
        <PlazosTimeline hitos={HITOS} evento="Piknic 4" />
        <Note>
          <b>Salida a la venta (umbrales propuestos el 17-nov, por validar con
          Dirección y Marketing):</b> 60 días antes sería el ideal, 45 bueno y 30
          el mínimo. Ningún Piknic de las dos últimas temporadas llegó a 60: el
          mejor abrió 59 días antes.
        </Note>
        <Source>
          Salida a la venta = primer día con 10 o más entradas pagadas. Negocio =
          fecha de asignación del negocio GLO en Unabase. Lo normal = mediana de
          los 12 Piknic de las temporadas 25-26 y 26-27. Detalle por evento en el
          anexo.
        </Source>
      </Slide>

      {/* 4 · Lo que viene */}
      <Slide
        id="proximos"
        n={4}
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

      {/* 5 · Comparación con Piknic 1 y Piknic 3 */}
      <Slide
        id="piknic-3"
        n={5}
        total={TOTAL}
        areas={["Dirección", "Marketing"]}
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
                {CMP_RESULTADO.map((r) => (
                  <tr key={r.indicador}>
                    <Td>{r.indicador}</Td>
                    <Td right className="text-[var(--ink-muted)]">{r.p1}</Td>
                    <Td right>{r.p3}</Td>
                    <Td right className="font-semibold">{r.p4}</Td>
                    <Td right className="whitespace-nowrap">
                      <Delta tone={r.cambio.tone}>{r.cambio.texto}</Delta>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Cuándo se vendió</SubTitle>
            <TramosVenta />
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
          por servicio. «Antes de 3 semanas» = 21 días o más antes del evento.
          Piknic 1 y 3 = cifras publicadas en el cierre del Piknic 3 (8-oct); ahí
          las personas que entraron descuentan menos upgrades: con la regla del Piknic 4 serían
          3.104 y 3.021. Esta temporada no hubo Piknic 2.
        </Source>
      </Slide>

      {/* 6 · Venta: cómo llegó la gente a comprar */}
      <Slide
        id="venta"
        n={6}
        total={TOTAL}
        areas={["Marketing", "Ticketing y Comunidad"]}
        label="Venta"
        detail="por qué link llegó cada compra · ranking completo en el anexo"
      >
        <SlideTitle>
          Cómo llegó la gente a comprar: sube Club Glovox, y más de la mitad
          sigue sin código
        </SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Cómo llegó</Th>
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
                <Td right className="py-3 text-[var(--ink-muted)]">{c.p3}</Td>
                <Td right className="py-3 font-display text-2xl font-bold">{c.p4}</Td>
                <Td right className="py-3 whitespace-nowrap">
                  <span className="text-[var(--ink-muted)]">{c.pctP3} →</span>{" "}
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
          <b>Sin código</b> no bajó: 56% en los dos eventos. /marketing/weekly
          cruza esas compras con GA4 y atribuye más.
        </Note>
        <Source>
          Entradas pagadas de la ticketera según el código del link de compra
          (2.776 en el Piknic 4, 1.853 en el Piknic 3). El resto de los canales
          (boletería, Google, Meta, social orgánico y email) suma 20% y está en el
          anexo, junto con quién entró.
        </Source>
      </Slide>

      {/* 7 · Mapa de ventas */}
      <Slide
        id="mapa"
        n={7}
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
              mapa interactivo (botón «Mapa de ventas» arriba) trae el detalle
              por punto y el ticket promedio.
            </Note>
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

      {/* 8 · VIP y general */}
      <Slide
        id="zonas"
        n={8}
        total={TOTAL}
        areas={["Operaciones", "Producción"]}
        label="Operaciones · VIP y general"
        detail="consumo y baños por zona · al 17-nov"
      >
        <SlideTitle>
          Una de cada cuatro personas estuvo en VIP o mesa, y en VIP no se
          consumió más que en general
        </SlideTitle>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Kpi value="$78,6 M" caption="vendido en barras (bruto). Piknic 3: $57,5 M" />
          <Kpi value="$23.371" caption="por persona. Piknic 3: $18.941" />
          <Kpi value="25%" caption="de la venta salió en promos 2x ($19,7 M)" />
        </div>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
                    <Td right className="text-[var(--ink-muted)]">{z.porPersonaP3}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right>{ZONAS_TOTAL.personas}</Td>
                  <Td right>100%</Td>
                  <Td right>{ZONAS_TOTAL.consumo}</Td>
                  <Td right>{ZONAS_TOTAL.porPersona}</Td>
                  <Td right className="font-normal text-[var(--ink-muted)]">{ZONAS_TOTAL.porPersonaP3}</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              En VIP cada persona consumió un poco menos que en general; en el
              Piknic 3 consumía más. <b>¿Cómo incentivamos el consumo en VIP?</b>{" "}
              Mesa VIP es parcial: las botellas del paquete no pasan por Onfire.
            </Note>
            <Note>
              <b>Por confirmar:</b> en la reunión con Producción se dijo que en
              VIP hubo más gente (unas 700) por los upgrades. De los 127 upgrades
              escaneados, la ticketera registra solo 4 a VIP (los otros 123 son
              a general); si entraron por otra vía, el consumo por persona en VIP
              sería todavía menor.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Baños: gasto por persona</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th right>Piknic 3</Th>
                  <Th right>Piknic 4</Th>
                </tr>
              </thead>
              <tbody>
                {BANOS.map((b) => (
                  <tr key={b.tipo}>
                    <Td>{b.tipo}</Td>
                    <Td right>{b.p3}</Td>
                    <Td right className="font-semibold">{b.p4}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              El gasto en baños es lo único por zona que queda registrado.{" "}
              <b>Cuántos</b> baños, guardias y barras hubo en general y en VIP no
              está en ningún sistema, así que no se puede medir si sobró en general
              o faltó en VIP.
            </Note>
          </div>
        </div>
        <Source>
          Personas = escaneos menos upgrades, según el tipo de ticket. Consumo por
          zona = todo Onfire en las barras de esa zona (una persona de VIP también
          puede comprar en una barra general). Baños = gasto real en Unabase:
          baterías generales y accesibles contra trailers VIP.
        </Source>
      </Slide>

      {/* 9 · Ingreso por hora */}
      <Slide
        id="ingreso"
        n={9}
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
          60 minutos seguidos con más ingresos. La salida no se mide: ver el
          piloto de conteo en la lámina 15.
        </Source>
      </Slide>

      {/* 10 · Resultado */}
      <Slide
        id="resultado"
        n={10}
        total={TOTAL}
        areas={["Finanzas", "Comercial y Marcas", "Ticketing y Comunidad", "Datos y Tecnología"]}
        label="Resultado · ingresos"
        detail={META.corte}
      >
        <SlideTitle>El resultado todavía no se puede cerrar</SlideTitle>
        <SubTitle>Ingresos: qué está cargado</SubTitle>
        <ul className="flex flex-col">
          {INGRESOS_CARGA.map((r, i) => (
            <li
              key={i}
              className="grid grid-cols-[calc(var(--spacing)*28)_minmax(0,1fr)] items-baseline gap-3 border-b border-[var(--divider)] py-2 text-sm text-[var(--ink)] first:border-t"
            >
              <span>
                <Pill tone={r.tone}>{r.estado}</Pill>
              </span>
              <p className="leading-relaxed">{r.texto}</p>
            </li>
          ))}
        </ul>
        <Note>
          <b>Costos:</b> hay OC por el 57% del presupuesto ($105,8 M de $184,4 M).
          El detalle por categoría está en la lámina siguiente.
        </Note>
      </Slide>

      {/* 11 · Avance de OC y pagos */}
      <Slide
        id="oc"
        n={11}
        total={TOTAL}
        areas={["Finanzas", "cada área con presupuesto"]}
        label="Compras"
        detail="OC, facturas y pagos en Unabase · al 17-nov"
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
          Quedan <b>{OC_ANTES.sinOc}</b> del presupuesto sin OC. <b>Pagos:</b> en
          Unabase solo figuran abonados <b>{OC_PAGO.abonado}</b>, de dos
          rendiciones de fondo. Con respaldo registrado:{" "}
          <b>{OC_PAGO.conFactura}</b> ({OC_PAGO.pctFactura}%); faltan los de{" "}
          {OC_PAGO.ocSinFactura} OC por {OC_PAGO.sinFactura}. Por el plazo de cada
          OC tocaría pagar{" "}
          {OC_PAGO.calendario.map((c, i, arr) => (
            <span key={c.cuando}>
              <b>{c.monto}</b> {c.cuando}
              {i < arr.length - 2 ? ", " : i === arr.length - 2 ? " y " : "."}
            </span>
          ))}
        </Note>
        <Source>
          Millones de pesos netos, GLO216 en Unabase ({OC_TOTAL.nOc} OC). Con
          respaldo = con factura, boleta o rendición registrada. El calendario es
          una estimación (fecha de la OC más su plazo de pago): Unabase no guarda
          la fecha de pago. {OC_PAGO.referencia}
        </Source>
      </Slide>

      {/* 12 · Punto de equilibrio */}
      <Slide
        id="equilibrio"
        n={12}
        total={TOTAL}
        areas={["Dirección", "Finanzas", "Programación Artística"]}
        label="Punto de equilibrio"
        detail="estimación al 17-nov"
      >
        <SlideTitle>
          Con las marcas, el Piknic 4 quedó en su punto de equilibrio: necesitaba
          unas {fmtN(EQUILIBRIO.conMarcas)} personas y entraron {fmtN(EQUILIBRIO.entraron)}
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Cómo se calcula (Piknic 4)</SubTitle>
            <ul className="flex flex-col text-sm text-[var(--ink)]">
              {[
                ["Presupuesto de gasto", EQUILIBRIO.presupuesto, `incluye artística por ${EQUILIBRIO.artistica}`],
                ["− Marcas (fees)", EQUILIBRIO.marcas, "Entel, Banco de Chile, Heinz, Pepsi y Cupra"],
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
              <b>Las marcas pagan la artística:</b> aportan {EQUILIBRIO.marcas} y
              la artística cuesta {EQUILIBRIO.artistica}. Sin marcas harían falta{" "}
              <b>{fmtN(EQUILIBRIO.sinMarcas)}</b> personas. Cada <b>$1 M</b> más de
              artística son unas {EQUILIBRIO.personasPorMillon} personas más.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <SubTitle>Los tres Piknic de la temporada</SubTitle>
            <EquilibrioComparado />
            <Note>
              El Piknic 1 y el 3 quedaron a unas <b>1.000</b> y <b>1.100</b>{" "}
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
          presupuesto de hoy en Unabase, no gasto real. Tickets = venta + 55% del
          cargo por servicio; barras = todo Onfire; ambos sin IVA. No incluye
          producto de marcas, mesas VIP, pases de temporada ni el negocio BTL
          (montaje de activaciones), que en Unabase va aparte.
        </Source>
      </Slide>

      {/* 13 · Seguimiento de los acuerdos del Piknic 3 */}
      <Slide
        id="seguimiento"
        n={13}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Seguimiento"
        detail="acuerdos de la reunión del 8-oct"
      >
        <SlideTitle>Qué pasó con los acuerdos del Piknic 3</SlideTitle>
        <ul className="flex flex-col">
          {SEGUIMIENTO_P3.map((r) => (
            <li
              key={r.acuerdo}
              className="grid grid-cols-[calc(var(--spacing)*56)_calc(var(--spacing)*24)_minmax(0,1fr)] items-baseline gap-3 border-b border-[var(--divider)] py-3 text-sm text-[var(--ink)] first:border-t"
            >
              <p className="font-semibold">
                {r.acuerdo}
                <CellSub>{r.areas}</CellSub>
              </p>
              <span>
                <Pill tone={r.tone}>{r.estado}</Pill>
              </span>
              <p className="leading-relaxed text-[var(--ink-muted)]">{r.texto}</p>
            </li>
          ))}
        </ul>
        <Source>
          Gris = no queda en ningún sistema o no aplica a ese recinto. Fuentes:
          onepager, Unabase y glovox-produccion al 17-nov.
        </Source>
      </Slide>

      {/* 14 · Notas por área del Piknic 3 que hoy tienen dato */}
      <Slide
        id="notas-area"
        n={14}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Seguimiento"
        detail="notas por área del Piknic 3 · al 17-nov"
      >
        <SlideTitle>Qué pasó con las notas por área del Piknic 3</SlideTitle>
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 deck:grid-cols-4">
          {NOTAS_AREA.map((a) => (
            <AreaNotas key={a.area} {...a} />
          ))}
        </div>
        <Source>
          Solo las notas que hoy se pueden medir. Las que no quedan en ningún
          sistema (Comercial y Marcas, Producción y otras) están en el anexo: las
          confirma cada área.
        </Source>
      </Slide>

      {/* 15 · Lo acordado con Producción Site, Técnica y Seguridad */}
      <Slide
        id="produccion"
        n={15}
        total={TOTAL}
        areas={["Producción", "Seguridad", "Datos y Tecnología"]}
        label="Acuerdos nuevos"
        detail="reunión del 17-nov con Rodrigo Saavedra"
      >
        <SlideTitle>Lo acordado con Producción Site, Técnica y Seguridad</SlideTitle>
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 deck:grid-cols-3">
          {ACUERDOS_PRODUCCION.map((a) => (
            <AreaNotas key={a.area} {...a} />
          ))}
        </div>
        <Note>
          <b>Layout:</b> lo lleva Producción Site; Rodrigo planteó volver a
          tomarlo él directamente (por confirmar). Los plazos se empiezan a medir
          en el Piknic 5; hasta ahora no había registro de cuándo quedaba listo. <b>Seguridad</b> observó en el Piknic 4 público
          afectado más temprano y más trabajo de la ambulancia: por eso el
          registro.
        </Note>
        <Source>
          Sale de la reunión del 17-nov. Verde = acordado; morado = piloto por
          probar; amarillo = se hace en la práctica y falta dejarlo escrito. Por
          ratificar con las demás áreas en esta reunión.
        </Source>
      </Slide>

      {/* 16 · Pendientes del Piknic 4 */}
      <Slide
        id="pendientes"
        n={16}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Para salir de la reunión con esto resuelto"
      >
        <SlideTitle>Pendientes del Piknic 4</SlideTitle>
        <ol className="grid grid-cols-1 gap-x-10 gap-y-4 deck:grid-cols-2">
          {PENDIENTES.map((a, i) => (
            <li
              key={a.titulo}
              className="grid grid-cols-[calc(var(--spacing)*9)_minmax(0,1fr)] gap-3 border-t border-[var(--divider)] pt-3"
            >
              <span
                aria-hidden="true"
                className="font-display text-3xl font-bold leading-none text-[#9F99F8]"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-base font-semibold text-[var(--ink)]">{a.titulo}</p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--ink-muted)]">{a.areas}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {a.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Slide>

      {/* 17 · Anexo: venta y público (detalle) */}
      <Slide
        id="anexo-venta"
        n={17}
        total={TOTAL}
        areas={["Marketing", "Ticketing y Comunidad"]}
        label="Anexo"
        detail="detalle de la lámina 6 · canal según el código del link de compra"
      >
        <SlideTitle>Por dónde se vendió y quién entró</SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Ranking por canal</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Canal</Th>
                  <Th right>Entradas</Th>
                  <Th right>%</Th>
                  <Th right>Venta $M</Th>
                </tr>
              </thead>
              <tbody>
                {CANALES.map((c, i) => (
                  <tr key={c.canal}>
                    <Td className="text-[var(--ink-muted)]">{i + 1}</Td>
                    <Td>{c.canal}</Td>
                    <Td right>{c.entradas}</Td>
                    <Td right>{c.pct}</Td>
                    <Td right>{c.venta}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td />
                  <Td>Total</Td>
                  <Td right>{CANALES_TOTAL.entradas}</Td>
                  <Td right>{CANALES_TOTAL.pct}</Td>
                  <Td right>{CANALES_TOTAL.venta}</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              «Sin código» es la compra que llegó sin link rastreado: puede venir
              de cualquier canal, incluida la pauta. Las 2.776 entradas incluyen
              135 upgrades: son 2.641 personas. <b>Pauta:</b> US$5.169 (Meta y
              Google).
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Quién entró</SubTitle>
            <Table className="text-xs">
              <tbody>
                {INGRESOS.map((r) => (
                  <tr key={r.tipo}>
                    <Td>{r.tipo}</Td>
                    <Td right className="font-semibold">
                      {r.personas}
                    </Td>
                    <Td className="text-[var(--ink-muted)]">{r.nota}</Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">Total</Td>
                  <Td right className="font-semibold">
                    {INGRESOS_TOTAL.personas}
                  </Td>
                  <Td className="text-[var(--ink-muted)]">{INGRESOS_TOTAL.nota}</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              Personas distintas: de los 3.491 escaneos se descuentan 127
              upgrades, bajo el supuesto de que cada uno se escaneó aparte de la
              entrada de la misma persona. Pilates:
              entró 1 de cada 8 invitados.
            </Note>
          </div>
        </div>
      </Slide>

      {/* 18 · Anexo: tragos más vendidos */}
      <Slide
        id="barras"
        n={18}
        total={TOTAL}
        areas={["Operaciones", "Seguridad"]}
        label="Anexo"
        detail="Onfire · 9.516 tragos"
      >
        <SlideTitle>Los tragos más vendidos, en total y por sector</SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Sector</Th>
              <Th>1</Th>
              <Th>2</Th>
              <Th>3</Th>
            </tr>
          </thead>
          <tbody>
            {BARRAS_TOP.map((s) => (
              <tr key={s.sector}>
                <Td className="font-semibold">
                  {s.sector}
                  <CellSub>{s.tragos}</CellSub>
                </Td>
                {s.top.map((t, i) => (
                  <Td key={i}>
                    {t.nombre}
                    <CellSub>{t.detalle}</CellSub>
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        <Note>
          <b>Mistral 35° superó al Tropical Gin por 44 tragos</b> (en plata sigue
          ganando el Tropical Gin; en el Piknic 3 ganó con 1.413). Seguridad vio público afectado más temprano y
          más trabajo de la ambulancia: no hay registro para medir si se
          relaciona. <b>Mesa VIP:</b> Onfire registra 612 tragos (en el Piknic 3
          fueron 30). <b>Promos:</b> 868 de los 1.608 Tropical Gin salieron en la
          promo «2 Tropical Gin».
        </Note>
        <Source>
          General = barras Corchete, CDGA 360, Entel, Mistral, Heineken, Red Bull,
          Casa Entel y las de activación (Épica, Carpano). VIP = Barra VIP y JW
          VIP. Mesa VIP = barra de mesas, Cocktail VIP y cobros a mesa. Promos 2x
          cuentan como dos tragos; variantes con bebida y con Pepsi, juntas. Sin
          agua, bebidas, Red Bull solo, vasos, agregados ni versiones sin alcohol.
          «Pisco 35 + Bebida» de la Barra Entel (265) se cuenta aparte.
        </Source>
      </Slide>

      {/* 19 · Anexo: anticipación por evento */}
      <Slide
        id="anexo-anticipacion"
        n={19}
        total={TOTAL}
        areas={["Dirección", "Marketing", "Producción", "Finanzas"]}
        label="Anexo"
        detail="detalle de la lámina 3"
      >
        <SlideTitle>Anticipación de cada Piknic</SlideTitle>
        <p className="text-sm text-[var(--ink-muted)]">
          Días antes del evento en que pasó cada hito. La barra más larga es mejor.
          La raya negra es el plazo mínimo; en la salida a la venta, las grises son
          el nivel bueno (45) y el ideal (60).
        </p>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Evento</Th>
              <Th>Fecha</Th>
              <Th right>Pagadas</Th>
              <Th className="w-[32%]">Salida a la venta (días antes) · mínimo 30</Th>
              <Th className="w-[32%]">Negocio en Unabase · 30 días antes</Th>
            </tr>
          </thead>
          <tbody>
            {ANTICIPACION.map((r) => (
              <tr key={r.evento} className={r.actual ? "bg-[var(--purple-tint)]" : ""}>
                <Td className={r.actual ? "font-semibold" : ""}>{r.evento}</Td>
                <Td className="whitespace-nowrap">{r.fecha}</Td>
                <Td right>{r.pagadas}</Td>
                <Td>
                  <DaysBar value={r.lanzamiento} max={max} mark={lanzamiento.minimo} marks={lanzamiento.otros} />
                </Td>
                <Td>
                  <DaysBar value={r.negocio} max={max} mark={negocio} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Source>
          Salida a la venta = primer día con 10 o más entradas pagadas. Negocio =
          fecha de asignación del negocio GLO en Unabase. Días corridos. Sin el
          Piknic 2 26-27 (cancelado). El pago de permisos salió de esta tabla: no
          mide cuándo se ingresan los trámites.
        </Source>
      </Slide>

      {/* 20 · Anexo: notas del Piknic 3 por confirmar */}
      <Slide
        id="anexo-notas"
        n={20}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Anexo"
        detail="notas por área del Piknic 3 que no quedan en ningún sistema"
      >
        <SlideTitle>Notas del Piknic 3 por confirmar con cada área</SlideTitle>
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 deck:grid-cols-4">
          {NOTAS_POR_CONFIRMAR.map((a) => (
            <AreaNotas key={a.area} {...a} />
          ))}
        </div>
        <Source>
          No hay dato para medirlas: cada área dice si se hizo en el Piknic 4.
        </Source>
      </Slide>
    </Deck>
  );
}
