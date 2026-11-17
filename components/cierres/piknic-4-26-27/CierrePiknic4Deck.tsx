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
  Th,
} from "@/components/cierres/deck/primitives";
import {
  ANTICIPACION,
  ANTICIPACION_ESCALA,
  BANOS,
  BARRAS_TOP,
  CANALES,
  CANALES_TOTAL,
  CMP_RESULTADO,
  EQUILIBRIO,
  HITOS,
  INGRESOS,
  INGRESOS_CARGA,
  INGRESOS_TOTAL,
  MAPA_ALT,
  META,
  NOTAS_AREA,
  OC,
  OC_ANTES,
  OC_TOTAL,
  PENDIENTES,
  PERMISOS,
  PORTADA_FACTS,
  PUNTOS_CONTROL,
  SEGUIMIENTO_P3,
  TRAMOS_VENTA,
  ZONAS,
  ZONAS_TOTAL,
} from "@/lib/cierres/piknic-4-26-27";
import mapaVentas from "./mapa-ventas.jpg";

const TOTAL = 17;

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
                className="flex h-8 overflow-hidden rounded-md"
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

/** Escala de personas: las que entraron contra el equilibrio con y sin marcas. */
function EquilibrioBarra() {
  const max = 4500;
  const x = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-[calc(var(--spacing)*24)]">
        <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-[var(--ink)]" style={{ left: x(EQUILIBRIO.conMarcas) }}>
          Equilibrio con marcas: {fmtN(EQUILIBRIO.conMarcas)}
        </span>
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[var(--divider)]" />
        <div aria-hidden="true" className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-[#9F99F8]" style={{ width: x(EQUILIBRIO.entraron) }} />
        <div aria-hidden="true" className="absolute top-[calc(var(--spacing)*6)] bottom-[calc(var(--spacing)*6)] w-0.5 -translate-x-1/2 bg-[var(--ink)]" style={{ left: x(EQUILIBRIO.conMarcas) }} />
        <div aria-hidden="true" className="absolute top-[calc(var(--spacing)*6)] bottom-[calc(var(--spacing)*6)] w-0.5 -translate-x-1/2 bg-[var(--ink-subtle)]" style={{ left: x(EQUILIBRIO.sinMarcas) }} />
        <span className="absolute bottom-0 right-0 whitespace-nowrap text-xs text-[var(--ink-muted)]">
          Sin marcas: {fmtN(EQUILIBRIO.sinMarcas)}
        </span>
        <span className="absolute bottom-0 left-0 whitespace-nowrap text-xs text-[var(--ink)]">
          Entraron: <b>{fmtN(EQUILIBRIO.entraron)}</b> ({Math.round((EQUILIBRIO.entraron / EQUILIBRIO.conMarcas) * 100)}% del equilibrio con marcas)
        </span>
      </div>
      <div className="flex justify-between text-xs text-[var(--ink-subtle)]">
        <span>0</span>
        <span>{fmtN(max)} personas</span>
      </div>
    </div>
  );
}

/**
 * Presentación de cierre del Piknic 4 · 26-27 (GLO216): 14 láminas para la
 * reunión + 3 de anexo (permisos, tragos y anticipación por evento). Misma base
 * que la del Piknic 3 para compararlas, ajustada el 17-nov con lo que pidieron
 * las notas por área del Piknic 3: VIP contra general, punto de equilibrio, meta
 * de OC antes del evento y el seguimiento de esas notas. Datos en
 * lib/cierres/piknic-4-26-27.ts (foto al 9-nov; lo nuevo, al 17-nov). La mecánica
 * de láminas, navegación y PDF vive en components/cierres/deck. El control de
 * acceso lo hace la page.
 */
export default function CierrePiknic4Deck({ mapaHref }: { mapaHref?: string }) {
  const { max, marcas } = ANTICIPACION_ESCALA;

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
        label="Puntos de control"
        detail="los mismos 6 del Piknic 3"
      >
        <SlideTitle>Piknic 4 contra los seis puntos de control</SlideTitle>
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
                <Td className="py-2.5 align-top font-semibold">
                  {p.punto}
                  <CellSub>{p.area}</CellSub>
                </Td>
                <Td className="py-2.5 align-top whitespace-nowrap font-semibold">
                  {p.plazo}
                </Td>
                <Td className="py-2.5 align-top">{p.quePaso}</Td>
                <Td className="py-2.5 align-top">
                  <Pill tone={p.tone}>{p.estado}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Source>
          Rojo = pasó el plazo. Ámbar = el plazo vence mañana (D+3 es el 10-nov).
          Gris = no hay dato para medirlo: nunca pinta rojo. «Vencida» en el plan
          significa que nadie la marcó como cerrada, no que no se hizo.
        </Source>
      </Slide>

      {/* 3 · Anticipación (el detalle por evento va en el anexo) */}
      <Slide
        id="anticipacion"
        n={3}
        total={TOTAL}
        label="Anticipación"
        detail="cuántos días antes del evento pasó cada cosa"
      >
        <SlideTitle>
          Abrimos la venta antes que el Piknic 3, pero los tres hitos siguen tarde
        </SlideTitle>
        <PlazosTimeline hitos={HITOS} evento="Piknic 4" />
        <Source>
          Salida a la venta = primer día con 10 o más entradas pagadas. Negocio =
          fecha de asignación del negocio GLO en Unabase. Permisos = primer
          documento de gasto «Permisos y autoridades» (el pago; el plazo de 90
          días es para iniciar los trámites). Lo normal = mediana de los 12 Piknic
          de las temporadas 25-26 y 26-27. Detalle por evento en el anexo.
        </Source>
      </Slide>

      {/* 4 · Comparación con Piknic 3 */}
      <Slide
        id="piknic-3"
        n={4}
        total={TOTAL}
        label="Comparación"
        detail="Piknic 3 · sáb 3-oct"
      >
        <SlideTitle>
          Lo que el Piknic 4 vendió de más, lo vendió antes de las 3 semanas
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Resultado</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Indicador</Th>
                  <Th right>Piknic 3</Th>
                  <Th right>Piknic 4</Th>
                  <Th right>Cambio</Th>
                </tr>
              </thead>
              <tbody>
                {CMP_RESULTADO.map((r) => (
                  <tr key={r.indicador}>
                    <Td>{r.indicador}</Td>
                    <Td right>{r.p3}</Td>
                    <Td right>{r.p4}</Td>
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
              Es lo que pidió Marketing en el cierre del Piknic 3: con campañas más
              largas se vende más y se puede dimensionar la producción antes.
            </Note>
          </div>
        </div>
        <Source>
          Mismas fuentes y reglas en los dos eventos. Venta de tickets bruta = con
          cargo por servicio. Entradas pagadas por día de compra; «antes de 3
          semanas» = 21 días o más antes del evento.
        </Source>
      </Slide>

      {/* 5 · Venta y público */}
      <Slide
        id="venta"
        n={5}
        total={TOTAL}
        label="Venta y público"
        detail="canal según el código del link de compra"
      >
        <SlideTitle>Por dónde se vendió y quién entró</SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Ranking por canal de venta</SubTitle>
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
              de cualquier canal, incluida la pauta. /marketing/weekly la cruza con
              GA4 y atribuye más compras.
            </Note>
            <Note>
              <b>Cuándo se vendió:</b> en 33 días desde el 6-oct; 35% más de 3
              semanas antes, 14% entre 1 y 3 semanas, 28% la última semana y 22%
              el día del evento. Las 2.776 entradas incluyen 135 upgrades: son
              2.641 personas. <b>Pauta:</b> US$5.169 (Meta y Google).
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
              Personas distintas: de los 3.491 escaneos se descuentan 127 upgrades
              que se escanearon junto con la entrada de la misma persona. Pilates:
              entró 1 de cada 8 invitados.
            </Note>
          </div>
        </div>
      </Slide>

      {/* 6 · Mapa de ventas */}
      <Slide
        id="mapa"
        n={6}
        total={TOTAL}
        label="Operaciones · mapa de ventas"
        detail="Onfire sobre el layout rev3"
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
              Globos morados = bebidas · naranjo = comida · verde punteado =
              asistentes por zona. El área del globo es proporcional al monto.
            </Note>
            <Note>
              <b>La Barra Corchete concentra el 28% de la venta ($21,6 M).</b> Le
              siguen la 360 CDGA ($9,9 M) y la Barra VIP ($9,8 M).
            </Note>
            <Note>
              Heinz y Carl&apos;s Jr no registran venta en Onfire. El mapa
              interactivo (botón «Mapa de ventas» arriba) trae el detalle por punto
              y el ticket promedio.
            </Note>
          </figcaption>
        </figure>
        <Source>
          Venta por punto de Onfire dibujada sobre el layout rev3 del 28-oct. La
          ubicación de Mesas VIP es inferida; Cocktail VIP y JW VIP las informó el
          equipo. El mapa cuenta 3.491 escaneos; en el resto de la presentación
          son 3.364 personas distintas.
        </Source>
      </Slide>

      {/* 7 · VIP y general */}
      <Slide
        id="zonas"
        n={7}
        total={TOTAL}
        label="Operaciones · VIP y general"
        detail="consumo y baños por zona · al 17-nov"
      >
        <SlideTitle>
          Una de cada cuatro personas estuvo en VIP o mesa, y en VIP se consumió
          lo mismo que en general
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
                    <Td right className="font-semibold">{z.porPersona}</Td>
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
              VIP y mesa fueron el <b>26%</b> de las personas (Piknic 3: 28%). En
              VIP cada persona consumió casi lo mismo que en general; en el Piknic 3
              consumía más. En mesa VIP parte del consumo (las botellas del paquete)
              no pasa por Onfire.
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
              Es lo único por zona que queda registrado: <b>cuántos</b> baños,
              guardias y barras hubo en general y en VIP no está en ningún sistema,
              así que no se puede medir si sobró en general o faltó en VIP.
            </Note>
          </div>
        </div>
        <Source>
          Personas = escaneos menos upgrades. Consumo por zona = todo Onfire en las
          barras de esa zona (una persona de VIP también puede comprar en una barra
          general). Baños = gasto real en Unabase: baterías generales y accesibles
          contra trailers VIP.
        </Source>
      </Slide>

      {/* 8 · Resultado */}
      <Slide
        id="resultado"
        n={8}
        total={TOTAL}
        label="Resultado · ingresos"
        detail={META.corte}
      >
        <SlideTitle>El resultado todavía no se puede cerrar</SlideTitle>
        <SubTitle>Ingresos: qué está cargado</SubTitle>
        <ul className="flex flex-col">
          {INGRESOS_CARGA.map((r, i) => (
            <li
              key={i}
              className="grid grid-cols-[calc(var(--spacing)*24)_minmax(0,1fr)] items-baseline gap-3 border-b border-[var(--divider)] py-2.5 text-sm text-[var(--ink)] first:border-t"
            >
              <span>
                <Pill tone={r.tone}>{r.estado}</Pill>
              </span>
              <p className="leading-relaxed">{r.texto}</p>
            </li>
          ))}
        </ul>
        <Note>
          <b>Costos:</b> hay OC por el 53% del presupuesto ($97,7 M de $184,4 M).
          El detalle por categoría está en la lámina siguiente.
        </Note>
      </Slide>

      {/* 9 · Avance de OC */}
      <Slide
        id="oc"
        n={9}
        total={TOTAL}
        label="Compras"
        detail="OC emitidas en Unabase · al 9-nov"
      >
        <SlideTitle>
          Antes del evento había OC por el {OC_ANTES.pct}% del presupuesto; la meta
          es {OC_ANTES.meta}%
        </SlideTitle>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Categoría</Th>
              <Th right>Presupuesto</Th>
              <Th right>OC emitidas</Th>
              <Th right>N° OC</Th>
              <Th className="w-[34%]">Avance</Th>
              <Th right>
                <span className="sr-only">% de avance</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {OC.map((r) => {
              const flag = r.pct == null || r.pct > 100;
              return (
                <tr key={r.categoria}>
                  <Td>{r.categoria}</Td>
                  <Td right>{r.presupuesto}</Td>
                  <Td right>{r.emitido ?? "—"}</Td>
                  <Td right>{r.nOc}</Td>
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
              <Td right>{OC_TOTAL.nOc}</Td>
              <Td>
                <SpendBar pct={OC_TOTAL.pct} />
              </Td>
              <Td right>{OC_TOTAL.pct}%</Td>
            </tr>
          </tbody>
        </Table>
        <Note>
          <b>Meta del Piknic 3:</b> el {OC_ANTES.meta}% de las OC antes del evento. El
          Piknic 4 llegó al {OC_ANTES.pct}% (${OC_ANTES.monto} M); el Piknic 3, al{" "}
          {OC_ANTES.piknic3}%. Al 9-nov faltaban <b>$86,7 M</b> por emitir. Lo que más falta:{" "}
          <b>Operaciones ($34,1 M)</b>, <b>Artística ($25,3 M)</b> y{" "}
          <b>Venue ($14,0 M)</b>, que no tiene ninguna OC. Marketing pasó su
          presupuesto con una sola OC de radio por $18,8 M.
        </Note>
        <Source>
          Millones de pesos netos. OC = gastos del negocio GLO216 en Unabase (44
          folios; una OC puede cubrir más de una categoría). $4,0 M de esas OC
          aún no están validadas.
        </Source>
      </Slide>

      {/* 10 · Punto de equilibrio */}
      <Slide
        id="equilibrio"
        n={10}
        total={TOTAL}
        label="Punto de equilibrio"
        detail="estimación al 17-nov"
      >
        <SlideTitle>
          Con las marcas, el Piknic 4 quedó en su punto de equilibrio: necesitaba
          unas {fmtN(EQUILIBRIO.conMarcas)} personas y entraron {fmtN(EQUILIBRIO.entraron)}
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Cómo se calcula</SubTitle>
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
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-[var(--divider)] py-2.5 first:border-t ${i === arr.length - 1 ? "font-semibold" : ""}`}
                >
                  <span>
                    {concepto}
                    {detalle && <CellSub>{detalle}</CellSub>}
                  </span>
                  <span className="text-right font-display text-xl font-bold tabular-nums">{valor}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <SubTitle>Personas</SubTitle>
            <EquilibrioBarra />
            <Note>
              Sin las marcas harían falta <b>{fmtN(EQUILIBRIO.sinMarcas)}</b> personas:
              justo el «tope rentable de 4.000 a 4.500» que se mencionó en el cierre
              del Piknic 3.
            </Note>
            <Note>
              Cada <b>$1 M</b> más de artística son unas{" "}
              <b>{EQUILIBRIO.personasPorMillon}</b> personas más; la artística completa
              equivale a unas {EQUILIBRIO.personasArtistica}.
            </Note>
          </div>
        </div>
        <Source>
          Estimación con la misma mezcla de público del Piknic 4 y el gasto fijo
          (baños, guardias y barras en realidad suben con la gente). Gasto =
          presupuesto en Unabase (documentado al 17-nov: $105,9 M). Tickets = venta
          + 55% del cargo por servicio; barras = todo Onfire; ambos sin IVA. No
          incluye producto de marcas ($2,0 M), mesas VIP ni pases de temporada, que
          bajarían el número.
        </Source>
      </Slide>

      {/* 11 · Seguimiento de los acuerdos del Piknic 3 */}
      <Slide
        id="seguimiento"
        n={11}
        total={TOTAL}
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
              <p className="font-semibold">{r.acuerdo}</p>
              <span>
                <Pill tone={r.tone}>{r.estado}</Pill>
              </span>
              <p className="leading-relaxed text-[var(--ink-muted)]">{r.texto}</p>
            </li>
          ))}
        </ul>
        <Source>
          Gris = no queda en ningún sistema: se confirma en la reunión. Fuentes:
          onepager, Unabase y glovox-produccion al 9-nov.
        </Source>
      </Slide>

      {/* 12 y 13 · Seguimiento de las notas por área del Piknic 3 */}
      {[NOTAS_AREA.slice(0, 5), NOTAS_AREA.slice(5)].map((areas, i) => (
        <Slide
          key={i}
          id={i === 0 ? "notas-area" : "notas-area-2"}
          n={12 + i}
          total={TOTAL}
          label="Seguimiento"
          detail={`notas por área del Piknic 3 · ${i + 1} de 2 · al 17-nov`}
        >
          <SlideTitle>Qué pasó con las notas por área del Piknic 3</SlideTitle>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 deck:grid-cols-5">
            {areas.map((a) => (
              <AreaNotas key={a.area} {...a} />
            ))}
          </div>
          <Source>
            Gris = no queda en ningún sistema: lo confirma cada área en la reunión.
            Las notas nuevas de esta reunión se suman después, desde la transcripción.
          </Source>
        </Slide>
      ))}

      {/* 14 · Pendientes del Piknic 4 */}
      <Slide
        id="pendientes"
        n={14}
        total={TOTAL}
        label="Para salir de la reunión con esto resuelto"
      >
        <SlideTitle>Pendientes del Piknic 4</SlideTitle>
        <ol className="grid grid-cols-1 gap-x-10 gap-y-5 deck:grid-cols-2">
          {PENDIENTES.map((a, i) => (
            <li
              key={a.titulo}
              className="grid grid-cols-[calc(var(--spacing)*9)_minmax(0,1fr)] gap-3 border-t border-[var(--divider)] pt-4"
            >
              <span
                aria-hidden="true"
                className="font-display text-3xl font-bold leading-none text-[#9F99F8]"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-base font-semibold text-[var(--ink)]">{a.titulo}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
                  {a.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Slide>

      {/* 15 · Anexo: permisos */}
      <Slide
        id="permisos"
        n={15}
        total={TOTAL}
        label="Anexo"
        detail="permisos del Piknic 4 · en parque · sobre 3.000 personas"
      >
        <SlideTitle>Qué permisos tocaban, cuándo, y qué quedó registrado</SlideTitle>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Trámite</Th>
              <Th>Ante quién</Th>
              <Th>Plazo para el Piknic 4</Th>
              <Th>Qué quedó registrado</Th>
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map((p) => (
              <tr key={p.tramite}>
                <Td className={`text-sm ${p.destacado ? "font-semibold" : ""}`}>
                  {p.tramite}
                </Td>
                <Td className="text-sm">{p.anteQuien}</Td>
                <Td className="whitespace-nowrap text-sm font-semibold">
                  {p.plazo}
                  {p.plazoDetalle && <CellSub>{p.plazoDetalle}</CellSub>}
                </Td>
                <Td className="text-sm">
                  {"texto" in p.registro ? (
                    p.registro.texto
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <Pill tone={p.registro.tone}>{p.registro.estado}</Pill>
                      {p.registro.extra}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Source>
          Plazos de referencia del mapa de procesos (d02, validado con Producción
          el 1-oct-2026), contados hacia atrás desde el 7-nov; cambian según la
          municipalidad. Presupuesto de permisos: $4,7 M; documentado en
          Unabase: $0,6 M. Todo lo demás vive en Drive, correo y portales.
        </Source>
      </Slide>

      {/* 16 · Anexo: tragos más vendidos */}
      <Slide
        id="barras"
        n={16}
        total={TOTAL}
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
          <b>Mesa VIP ya se puede medir en parte:</b> Onfire registra 612 tragos
          (en el Piknic 3 fueron 30), porque la barra Cocktail VIP y los cobros a
          mesa pasaron por Onfire. <b>Promos:</b> 868 de los 1.608 Tropical Gin
          salieron en la promo «2 Tropical Gin».
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

      {/* 17 · Anexo: anticipación por evento */}
      <Slide
        id="anexo-anticipacion"
        n={17}
        total={TOTAL}
        label="Anexo"
        detail="detalle de la lámina 3"
      >
        <SlideTitle>Anticipación de cada Piknic</SlideTitle>
        <p className="text-sm text-[var(--ink-muted)]">
          Días antes del evento en que pasó cada hito. La barra más larga es mejor;
          la raya negra es el plazo propuesto.
        </p>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Evento</Th>
              <Th>Fecha</Th>
              <Th right>Pagadas</Th>
              <Th className="w-[23%]">Lanzamiento (días antes) · marca D−60</Th>
              <Th className="w-[23%]">Negocio Unabase · marca D−30</Th>
              <Th className="w-[23%]">1er pago permisos · marca D−90</Th>
            </tr>
          </thead>
          <tbody>
            {ANTICIPACION.map((r) => (
              <tr key={r.evento} className={r.actual ? "bg-[var(--purple-tint)]" : ""}>
                <Td className={r.actual ? "font-semibold" : ""}>{r.evento}</Td>
                <Td className="whitespace-nowrap">{r.fecha}</Td>
                <Td right>{r.pagadas}</Td>
                <Td>
                  <DaysBar value={r.lanzamiento} max={max} mark={marcas.lanzamiento} />
                </Td>
                <Td>
                  <DaysBar value={r.negocio} max={max} mark={marcas.negocio} />
                </Td>
                <Td>
                  <DaysBar value={r.permisos} max={max} mark={marcas.permisos} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Source>
          Lanzamiento = primer día con 10 o más entradas pagadas. Negocio = fecha
          de asignación del negocio GLO en Unabase. Permisos = primer documento
          de gasto «Permisos y autoridades» (el pago, no el ingreso del trámite).
          Días corridos. Sin el Piknic 2 26-27 (cancelado).
        </Source>
      </Slide>
    </Deck>
  );
}
