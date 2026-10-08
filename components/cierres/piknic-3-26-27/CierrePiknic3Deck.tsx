import Image from "next/image";
import Deck from "@/components/cierres/deck/Deck";
import {
  CellSub,
  Delta,
  DaysBar,
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
  Th,
} from "@/components/cierres/deck/primitives";
import {
  ACUERDOS,
  ANTICIPACION,
  ANTICIPACION_ESCALA,
  BARRAS_TOP,
  CANALES,
  CANALES_TOTAL,
  CMP_CONTROL,
  CMP_RESULTADO,
  INGRESOS,
  INGRESOS_CARGA,
  INGRESOS_TOTAL,
  MAPA_ALT,
  META,
  MONITOREO,
  OC,
  OBSERVACIONES,
  OC_TOTAL,
  PERMISOS,
  PORTADA_FACTS,
  PUNTOS_CONTROL,
} from "@/lib/cierres/piknic-3-26-27";
import mapaVentas from "./mapa-ventas.jpg";

const TOTAL = 14;

/** Destaca los offsets al Día D (D−60, M−3, D+3…) dentro de un texto. */
function withOffsets(text: string) {
  return text.split(/([DM][−+]\d+)/).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

const OBSERVACIONES_FUENTE =
  "Notas desde la transcripción automática de la reunión del 8-oct; sin atribución por persona.";

/** Notas de un área en la ronda final: nombre + viñetas (con estado opcional). */
function AreaNotes({
  area,
  nota,
  notas,
}: (typeof OBSERVACIONES)[number]) {
  return (
    <section className="flex min-w-0 flex-col gap-2 border-t border-[var(--ink)] pt-2">
      <h3 className="font-display text-base font-bold leading-tight text-[var(--ink)]">
        {area}
        {nota && (
          <span className="ml-1.5 font-sans text-xs font-normal text-[var(--ink-subtle)]">
            · {nota}
          </span>
        )}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {notas.map((n) => (
          <li
            key={n.texto}
            className="relative pl-3.5 text-sm leading-snug text-[var(--ink)] before:absolute before:left-0 before:top-[0.55em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--ink-subtle)]"
          >
            {n.tag && (
              <span className="mr-1.5 inline-block align-middle">
                <Pill tone={n.tag.tone}>{n.tag.label}</Pill>
              </span>
            )}
            {n.texto}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Presentación de la reunión de cierre del Piknic 3 · 26-27 (GLO211): 14
 * láminas. Contenido estático (foto al 8-oct, D+5) en
 * lib/cierres/piknic-3-26-27.ts; la mecánica de láminas, navegación y PDF vive
 * en components/cierres/deck. El control de acceso lo hace la page.
 */
export default function CierrePiknic3Deck() {
  const { max, marcas } = ANTICIPACION_ESCALA;

  return (
    <Deck
      title={`Cierre ${META.evento}`}
      backHref="/cierres"
      backLabel="Cierres"
      pdfFilename={META.pdfFilename}
    >
      {/* 1 · Portada */}
      <Slide
        id="portada"
        n={1}
        total={TOTAL}
        label="Reunión de cierre"
        detail={META.fechaReunion}
        className="justify-between"
      >
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-5xl font-bold leading-none tracking-tight text-[var(--ink)] deck:text-7xl">
            Cierre Piknic 3
          </h1>
          <p className="max-w-[62ch] text-lg leading-relaxed text-[var(--ink-muted)]">
            Sábado 3-oct · Parque Ciudad Empresarial · Apache, Curol y Mathias
            Kaden. Qué pasó con el evento, medido con los puntos de control que
            estamos proponiendo.
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
        label="El monitoreo que proponemos"
        detail="6 puntos de control del ciclo"
      >
        <SlideTitle>Piknic 3 contra los seis puntos de control</SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Punto de control</Th>
              <Th>Plazo propuesto</Th>
              <Th>Qué pasó en el Piknic 3</Th>
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
          Rojo = pasó el plazo. Gris = no hay dato para medirlo: nunca pinta rojo.
          «Vencida» en el plan significa que nadie la marcó como cerrada, no que
          no se hizo. Plazos propuestos para validar con cada área.
        </Source>
      </Slide>

      {/* 3 · Permisos */}
      <Slide
        id="permisos"
        n={3}
        total={TOTAL}
        label="Permisos"
        detail="Piknic 3 · en parque · sobre 3.000 personas"
      >
        <SlideTitle>Qué permisos tocaban, cuándo, y qué quedó registrado</SlideTitle>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Trámite</Th>
              <Th>Ante quién</Th>
              <Th>Plazo para el Piknic 3</Th>
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
          el 1-oct-2026); cambian según la municipalidad. Presupuesto de permisos:
          $5,4 M; documentado en Unabase: $0,6 M. Todo lo demás vive en Drive,
          correo y portales.
        </Source>
      </Slide>

      {/* 4 · Anticipación */}
      <Slide
        id="anticipacion"
        n={4}
        total={TOTAL}
        label="Anticipación"
        detail="Piknic 3 frente a los 10 Piknic anteriores"
      >
        <SlideTitle>
          Lanzamos, abrimos el negocio y pagamos permisos más tarde que nunca
        </SlideTitle>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Kpi
            value="18 días"
            caption="Lanzamiento del Piknic 3. Mediana de los 11 Piknic: 37 días. El ciclo dice M−2 (≈60)."
          />
          <Kpi
            value="8 días"
            caption="Negocio en Unabase. Mediana: 5 días. Regla de Finanzas: ≥5 días hábiles."
          />
          <Kpi
            value="8 días"
            caption="Primer pago de permisos. Mediana: 8 días. El área dice iniciar en M−3 (≈90)."
          />
        </div>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Evento</Th>
              <Th>Fecha</Th>
              <Th right>Pagadas</Th>
              <Th className="w-[23%]">Lanzamiento (días antes) · marca D−60</Th>
              <Th className="w-[23%]">Negocio Unabase · marca D−30 (propuesta)</Th>
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
          Lanzamiento = primer día con 10 o más entradas pagadas (glovox.tickets).
          Negocio = fecha de asignación del negocio GLO en Unabase (Unabase no
          publica la fecha de creación). Permisos = fecha del primer documento de
          gasto «Permisos y autoridades»: es el pago, no el ingreso del trámite.
          Días corridos.
        </Source>
      </Slide>

      {/* 5 · Comparación con Piknic 1 */}
      <Slide
        id="piknic-1"
        n={5}
        total={TOTAL}
        label="Comparación"
        detail="Piknic 1 · sáb 12-sep"
      >
        <SlideTitle>
          Con un tercio del tiempo de venta, el Piknic 3 llegó al 91% de las
          personas que compraron en el Piknic 1
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Resultado</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Indicador</Th>
                  <Th right>Piknic 1</Th>
                  <Th right>Piknic 3</Th>
                  <Th right>Cambio</Th>
                </tr>
              </thead>
              <tbody>
                {CMP_RESULTADO.map((r) => (
                  <tr key={r.indicador}>
                    <Td>{r.indicador}</Td>
                    <Td right>{r.p1}</Td>
                    <Td right>{r.p3}</Td>
                    <Td right className="whitespace-nowrap">
                      <Delta tone={r.cambio.tone}>{r.cambio.texto}</Delta>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              A 3 semanas del evento, el Piknic 1 ya tenía <b>849</b> entradas
              pagadas y el Piknic 3, <b>ninguna</b>. En esas últimas 3 semanas, el
              Piknic 3 vendió <b>1.853</b> contra <b>1.186</b> del Piknic 1.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Puntos de control</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Punto</Th>
                  <Th right>Piknic 1</Th>
                  <Th right>Piknic 3</Th>
                </tr>
              </thead>
              <tbody>
                {CMP_CONTROL.map((r) => (
                  <tr key={r.punto}>
                    <Td>{r.punto}</Td>
                    <Td right>{r.p1}</Td>
                    <Td right className="whitespace-nowrap">
                      <Delta tone={r.p3.tone}>{r.p3.texto}</Delta>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              Ninguno de los dos llegó a los plazos propuestos (D−60 venta, D−30
              negocio, M−3 permisos). En el Piknic 1, 4 de las 5 mesas VIP siguen
              sin pagar.
            </Note>
          </div>
        </div>
        <Source>
          Mismas fuentes y reglas que el resto de la presentación; datos al 8-oct.
          El gasto documentado se mide en momentos distintos (Piknic 1 lleva 26
          días de cierre). En los dos eventos, los negocios de marca de Unabase no
          llevan el GLO en la referencia: en el Piknic 1 las marcas se cargaron a
          mano en el onepager.
        </Source>
      </Slide>

      {/* 6 · Venta, pauta y público */}
      <Slide
        id="venta"
        n={6}
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
              de cualquier canal, incluida la pauta. Por eso lo pagado aparece
              bajo; /marketing/weekly lo cruza con GA4 y atribuye más compras.
            </Note>
            <Note>
              <b>Cuándo se vendió:</b> en 18 días desde el 15-sep; 40% entre 1 y 3
              semanas antes, 37% la última semana y 23% el día del evento. Las
              1.853 entradas incluyen 45 upgrades: son 1.808 personas.{" "}
              <b>Pauta:</b> US$5.525 (Meta y Google).
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
              Personas distintas: se descuentan 24 upgrades que se escanearon junto
              con la entrada de la misma persona.
            </Note>
          </div>
        </div>
      </Slide>

      {/* 7 · Mapa de ventas */}
      <Slide
        id="mapa"
        n={7}
        total={TOTAL}
        label="Operaciones · mapa de ventas"
        detail="Onfire sobre el layout REV6"
      >
        <SlideTitle>
          Dónde se vendió: barras, comida y asistentes sobre el layout
        </SlideTitle>
        <figure className="m-0 grid min-h-0 flex-1 grid-cols-1 gap-4 deck:grid-cols-[minmax(0,1fr)_calc(var(--spacing)*60)]">
          <div className="relative aspect-[2200/1215] min-h-0 deck:aspect-auto">
            <Image
              src={mapaVentas}
              alt={MAPA_ALT}
              fill
              loading="eager"
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="object-contain object-left-top"
            />
          </div>
          <figcaption className="flex flex-col gap-3">
            <Note>
              Globos morados = bebidas · naranjo = comida · verde punteado =
              asistentes por zona. El área del globo es proporcional al monto.
            </Note>
            <Note>
              <b>La Barra General Glovox concentra el 38% de la venta ($21,8 M).</b>{" "}
              Heinz y Carl&apos;s Jr no registran venta en Onfire.
            </Note>
          </figcaption>
        </figure>
        <Source>
          Venta por punto de Onfire ($56,8 M en bebidas y comida; sin guardarropía,
          abonos ni merch) dibujada sobre el layout REV6 del 28-sep. La ubicación de
          Barra General Glovox, JW VIP y Mesa VIP es inferida. El mapa cuenta 3.061
          ingresos escaneados; en el resto de la presentación son 3.037 personas
          distintas.
        </Source>
      </Slide>

      {/* 8 · Barras */}
      <Slide
        id="barras"
        n={8}
        total={TOTAL}
        label="Operaciones · barras"
        detail="Onfire · 6.989 tragos"
      >
        <SlideTitle>Los tragos más vendidos, en total y por sector</SlideTitle>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Kpi value="$57,5 M" caption="vendido en barras (bruto)" />
          <Kpi
            value="$18.941"
            caption="por persona. Piknic 1: $17.098 · año pasado: $18.807"
          />
          <Kpi value="2 de 3" caption="tragos del top dependen de una promo 2x" />
        </div>
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
          <b>Mesa VIP no se puede medir hoy:</b> Onfire registra 30 tragos, todos
          por app, y entraron 425 personas con entrada de mesa. Ese consumo (por
          ejemplo, las botellas del paquete) no pasa por Onfire. <b>Promos:</b>{" "}
          894 de los 1.413 Tropical Gin salieron en la promo «2 Tropical Gin»; si
          cada promo cuenta como una venta, como la muestra Onfire, el primero es
          Mistral 35° + bebida (1.173).
        </Note>
        <Source>
          General = barras CDGA 360, Entel, Glovox, Mistral, Red Bull y Heineken,
          más las de activación (Carpano, Épica, Casa Entel). VIP = Barra VIP y
          Barra JW VIP. Promos 2x cuentan como dos tragos; variantes con bebida y
          con Pepsi, juntas. Sin agua, bebidas, Red Bull solo, agregados ni
          versiones sin alcohol.
        </Source>
      </Slide>

      {/* 9 · Resultado */}
      <Slide
        id="resultado"
        n={9}
        total={TOTAL}
        label="Resultado · ingresos"
        detail="datos al 8-oct · D+5"
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
          <b>Costos:</b> hay OC por el 53% del presupuesto ($93,2 M de $174,3 M).
          El detalle por categoría está en la lámina siguiente.
        </Note>
      </Slide>

      {/* 10 · Avance de OC */}
      <Slide
        id="oc"
        n={10}
        total={TOTAL}
        label="Compras"
        detail="OC emitidas en Unabase · al 8-oct"
      >
        <SlideTitle>OC emitidas: 53% del presupuesto</SlideTitle>
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
          Faltan <b>$81,2 M</b> por emitir. Lo que más falta:{" "}
          <b>Operaciones ($41,0 M)</b> y <b>Artística ($16,5 M)</b>. Venue y
          Sueldos no tienen ninguna OC. Producción técnica, Producción site y
          Contenidos ya pasaron su presupuesto.
        </Note>
        <Source>
          Millones de pesos netos. OC = gastos del negocio GLO211 en Unabase (63
          folios; una OC puede cubrir más de una categoría). $1,2 M de esas OC aún
          no están validadas.
        </Source>
      </Slide>

      {/* 11 · Cómo se monitorea */}
      <Slide
        id="monitoreo"
        n={11}
        total={TOTAL}
        label="El monitoreo que proponemos"
        detail="un aviso diario por Slack, con el mismo cálculo de la torre de control"
      >
        <SlideTitle>Cada punto de control, con dueño y con dato</SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Punto de control</Th>
              <Th>Cuándo avisa</Th>
              <Th>A quién</Th>
              <Th>De dónde sale</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {MONITOREO.map((m) => (
              <tr key={m.punto}>
                <Td className="py-2.5 align-top font-semibold">{m.punto}</Td>
                <Td className="py-2.5 align-top text-[var(--ink-muted)]">
                  {withOffsets(m.cuando)}
                </Td>
                <Td className="py-2.5 align-top">{m.aQuien}</Td>
                <Td className="py-2.5 align-top">{m.fuente}</Td>
                <Td className="py-2.5 align-top">
                  <Pill tone={m.tone}>{m.estado}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Source>
          Lo que no está declarado se pinta gris, nunca rojo: el rojo es solo para
          un plazo declarado y vencido.
        </Source>
      </Slide>

      {/* 12 · Acuerdos */}
      <Slide
        id="acuerdos"
        n={12}
        total={TOTAL}
        label="Para salir de la reunión con esto resuelto"
      >
        <SlideTitle>Pendientes del Piknic 3 y acuerdos</SlideTitle>
        <ol className="grid grid-cols-1 gap-x-10 gap-y-5 deck:grid-cols-2">
          {ACUERDOS.map((a, i) => (
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

      {/* 13 y 14 · Observaciones por área (5 áreas por lámina: en una no caben) */}
      {[OBSERVACIONES.slice(0, 5), OBSERVACIONES.slice(5)].map((areas, i) => (
        <Slide
          key={i}
          id={i === 0 ? "observaciones" : "observaciones-2"}
          n={13 + i}
          total={TOTAL}
          label="Ronda final"
          detail={`qué funcionó y qué cambiamos para el próximo Piknic · ${i + 1} de 2`}
        >
          <SlideTitle>Observaciones por área</SlideTitle>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 deck:grid-cols-5">
            {areas.map((o) => (
              <AreaNotes key={o.area} {...o} />
            ))}
          </div>
          <Source>{OBSERVACIONES_FUENTE}</Source>
        </Slide>
      ))}
    </Deck>
  );
}
