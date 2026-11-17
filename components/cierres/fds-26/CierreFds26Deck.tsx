import Image from "next/image";
import Deck from "@/components/cierres/deck/Deck";
import {
  AreaNotas,
  CellSub,
  Delta,
  Kpi,
  Note,
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
  ACUERDOS_MEDIDOS,
  BARRAS,
  CANALES,
  CANALES_TOTAL,
  CMP_RESULTADO,
  CONVENIOS,
  CONVENIOS_TOTAL,
  HITOS,
  INGRESO_HORA,
  INGRESO_RESUMEN,
  MAPA_ALT,
  MARCAS,
  META,
  MONTAJE,
  MONTAJE_RESUMEN,
  NOTAS_POR_CONFIRMAR,
  OC,
  OC_ANTES,
  OC_TOTAL,
  ONFIRE_GRUPOS,
  ONFIRE_TOTAL,
  PARA_FDS27,
  PENDIENTES,
  POR_DIA,
  PORTADA_FACTS,
  PUNTOS_CONTROL,
  RANKING,
  RANKING_COMPLETO,
  RANKING_RESUMEN,
  RESULTADO_F25,
  RESULTADO_F26,
  TIPOS_F25,
  TIPOS_F26,
  TRAMOS_VENTA,
} from "@/lib/cierres/fds-26";
import mapaVentas from "./mapa-ventas.jpg";

const TOTAL = 18;

const fmtN = (v: number) => new Intl.NumberFormat("es-CL").format(v);

const TRAMOS = [
  { key: "antes", label: "Antes de 3 semanas", color: "bg-[#9F99F8]" },
  { key: "semanas1a3", label: "Entre 1 y 3 semanas", color: "bg-[#87DACD]" },
  { key: "ultimaSemana", label: "Última semana", color: "bg-[#F6C544]" },
  { key: "dia", label: "El mismo día", color: "bg-[#EF8C34]" },
] as const;

/** Barras apiladas: personas con entrada pagada según cuándo compraron. */
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
          <div key={e.evento} className="grid grid-cols-[calc(var(--spacing)*16)_minmax(0,1fr)] items-center gap-3">
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

/** Personas escaneadas por hora en un día: FDS 26 (morado) contra FDS 25 (gris). */
function IngresoDia({ dia, k26, k25 }: { dia: string; k26: "sab26" | "dom26"; k25: "sab25" | "dom25" }) {
  const max = Math.max(...INGRESO_HORA.map((s) => Math.max(s.sab26, s.sab25, s.dom26, s.dom25)));
  const h = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SubTitle>{dia}</SubTitle>
      <div
        className="flex h-[calc(var(--spacing)*44)] items-end gap-1 border-b border-[var(--divider)] pt-5"
        role="img"
        aria-label={`${dia}, personas que entraron por hora. FDS 26: ${INGRESO_HORA.map((s) => `${s.hora}:00 ${s[k26]}`).join(", ")}. FDS 25: ${INGRESO_HORA.map((s) => `${s.hora}:00 ${s[k25]}`).join(", ")}.`}
      >
        {INGRESO_HORA.map((s) => (
          <div key={s.hora} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            <div className="relative w-3/5 rounded-t-sm bg-[#9F99F8]" style={{ height: h(s[k26]) }}>
              {s[k26] >= 500 && (
                <span className="absolute bottom-full left-1/2 hidden -translate-x-1/2 pb-0.5 text-xs font-semibold tabular-nums text-[var(--ink)] deck:block">
                  {s[k26]}
                </span>
              )}
            </div>
            <div className="w-1/4 rounded-t-sm bg-[var(--ink-subtle)]" style={{ height: h(s[k25]) }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-1 text-xs tabular-nums text-[var(--ink-subtle)]">
        {INGRESO_HORA.map((s) => (
          <span key={s.hora} className="min-w-0 flex-1 text-center">
            {s.hora}
          </span>
        ))}
      </div>
    </div>
  );
}

const FASE_TONE = { Montaje: "info", Feria: "success", Desmontaje: "pending" } as const;

/**
 * Presentación de cierre de la Feria del Sánguche 2026 (FDS 26 · GLO213): 14
 * láminas para la reunión + 4 de anexo. Orden en actos, como la del Piknic 4:
 * tablero (1-2), llegamos antes (3-5), el día (6-10), la cuenta (11-12), lo
 * que acordamos (13) y lo que viene (14). Se compara solo con la FDS 25
 * (GLO181). Datos en lib/cierres/fds-26.ts (foto al 17-nov). La mecánica de
 * láminas, navegación y PDF vive en components/cierres/deck. El control de
 * acceso lo hace la page.
 */
export default function CierreFds26Deck({ mapaHref }: { mapaHref?: string }) {
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
            Cierre Feria del Sánguche 2026
          </h1>
          <p className="max-w-[62ch] text-lg leading-relaxed text-[var(--ink-muted)]">
            Viernes 13 a domingo 15 de noviembre · Parque Padre Hurtado. Qué pasó,
            medido contra la Feria del Sánguche 2025 y contra los puntos de control
            de los cierres.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 border-t border-[var(--divider)] pt-6 sm:grid-cols-2 deck:grid-cols-4">
          {PORTADA_FACTS.map((f) => (
            <Kpi
              key={f.value}
              value={f.value}
              caption={f.caption}
              valueClass={f.tone === "warn" ? "text-[var(--amber-ink)]" : "text-[var(--ink)]"}
            />
          ))}
        </div>
      </Slide>

      {/* 2 · Puntos de control */}
      <Slide
        id="control"
        n={2}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Puntos de control"
        detail="los mismos de los cierres del Piknic, con los plazos acordados el 17-nov"
      >
        <SlideTitle>La FDS 26 contra los puntos de control</SlideTitle>
        <Table className="text-sm">
          <thead>
            <tr>
              <Th>Punto de control</Th>
              <Th>Plazo</Th>
              <Th>Qué pasó en la FDS 26</Th>
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
                <Td className="align-top font-semibold">{p.plazo}</Td>
                <Td className="align-top">{p.quePaso}</Td>
                <Td className="align-top">
                  <Pill tone={p.tone}>{p.estado}</Pill>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Source>
          Rojo = pasó el plazo. Amarillo = vence pronto o falta algo. Gris = no hay
          dato para medirlo: nunca pinta rojo. «Vencida» en la carta Gantt significa
          que nadie la marcó como cerrada, no que no se hizo.
        </Source>
      </Slide>

      {/* 3 · Anticipación */}
      <Slide
        id="anticipacion"
        n={3}
        total={TOTAL}
        areas={["Dirección", "Marketing", "Producción", "Finanzas"]}
        label="Anticipación"
        detail="cuántos días antes del primer día pasó cada cosa"
      >
        <SlideTitle>
          La venta abrió 29 días más tarde que en la FDS 25, y el negocio en Unabase
          llegó un día después del plazo
        </SlideTitle>
        <PlazosTimeline
          hitos={HITOS}
          evento="FDS 26"
          normal={{ leyenda: "FDS 25", etiqueta: "FDS 25" }}
        />
        <Note>
          <b>Salida a la venta:</b> 60 días antes es el ideal, 45 bueno y 30 el
          mínimo (umbrales propuestos el 17-nov, por validar con Dirección y
          Marketing). La FDS 26 quedó justo en «bueno»; la FDS 25 pasó el ideal.
        </Note>
        <Source>
          Salida a la venta = primer día con 10 o más entradas pagadas (29-sep-2026 y
          8-sep-2025). Negocio = fecha de asignación del negocio GLO en Unabase
          (15-oct-2026 y 16-oct-2025). Días contados hasta el viernes de cada feria.
        </Source>
      </Slide>

      {/* 4 · Comparación con la FDS 25 */}
      <Slide
        id="fds-25"
        n={4}
        total={TOTAL}
        areas={["Dirección", "Marketing", "Operaciones"]}
        label="Comparación"
        detail="FDS 25 · 21 al 23-nov-2025, mismo parque"
      >
        <SlideTitle>
          Pagaron 3% más personas, pero la venta de tickets bajó 19% y entraron 8%
          menos
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,10fr)_minmax(0,9fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Resultado</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Indicador</Th>
                  <Th right>FDS 25</Th>
                  <Th right>FDS 26</Th>
                  <Th right>Cambio</Th>
                </tr>
              </thead>
              <tbody>
                {CMP_RESULTADO.map((r) => (
                  <tr key={r.indicador}>
                    <Td>{r.indicador}</Td>
                    <Td right className="text-[var(--ink-muted)]">{r.f25}</Td>
                    <Td right className="font-semibold">{r.f26}</Td>
                    <Td right className="whitespace-nowrap">
                      <Delta tone={r.cambio.tone}>{r.cambio.texto}</Delta>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Cuándo compraron</SubTitle>
            <TramosVenta />
            <Note>
              Antes de 3 semanas la FDS 26 llevaba <b>1.609</b> personas con entrada
              (FDS 25: 1.022). La diferencia se perdió durante la feria: ese fin de
              semana compraron <b>3.097</b>, contra <b>4.005</b> en 2025.
            </Note>
            <SubTitle>Por día</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Día</Th>
                  <Th right>Pagaron</Th>
                  <Th right>Entraron</Th>
                  <Th right>Onfire</Th>
                </tr>
              </thead>
              <tbody>
                {POR_DIA.map((d) => (
                  <tr key={d.dia}>
                    <Td>{d.dia}</Td>
                    {[d.pagaron, d.entraron, d.onfire].map(([a, b], i) => (
                      <Td key={i} right className="whitespace-nowrap">
                        <span className="text-[var(--ink-muted)]">{a} →</span> <b className="font-semibold">{b}</b>
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
        <Source>
          Personas = las que cubre cada entrada (el pack para 2 cuenta 2, el pase
          familiar 4), sin upgrades. Venta de tickets bruta = con cargo por
          servicio. Entraron = escaneadas en el acceso: el viernes de 2026 casi no se
          escanearon las entradas de niños (lámina 6). Pauta de la FDS 25 solo con
          Meta medido.
        </Source>
      </Slide>

      {/* 5 · Venta: convenios y precio por persona */}
      <Slide
        id="venta"
        n={5}
        total={TOTAL}
        areas={["Marketing", "Ticketing y Comunidad", "Comercial y Marcas"]}
        label="Venta"
        detail="convenios y tipos de entrada · canales en el anexo"
      >
        <SlideTitle>
          Casi dos de cada tres entradas se vendieron con 20% de descuento, y el pack
          para 2 bajó el precio por persona
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Entradas por convenio</SubTitle>
            <Table className="text-sm">
              <thead>
                <tr>
                  <Th>Convenio</Th>
                  <Th right>FDS 25</Th>
                  <Th right>FDS 26</Th>
                  <Th right>% de las entradas</Th>
                </tr>
              </thead>
              <tbody>
                {CONVENIOS.map((c) => (
                  <tr key={c.convenio}>
                    <Td className="font-semibold">{c.convenio}</Td>
                    <Td right className="text-[var(--ink-muted)]">{c.f25}</Td>
                    <Td right className="font-semibold">{c.f26}</Td>
                    <Td right className="whitespace-nowrap">
                      <span className="text-[var(--ink-muted)]">{c.pct25} →</span>{" "}
                      <b className="font-semibold">{c.pct26}</b>
                    </Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right>{CONVENIOS_TOTAL.f25}</Td>
                  <Td right>{CONVENIOS_TOTAL.f26}</Td>
                  <Td right>100%</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              <b>Copec Pay sube y Caja Los Andes baja,</b> pero juntos siguen siendo
              63% de las entradas (FDS 25: 65%). Las dos marcas pagan para estar:
              $25,0 M y $15,0 M según la planilla de Comercial.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Qué se vendió</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>FDS 26</Th>
                  <Th right>Entradas</Th>
                  <Th right>Precio</Th>
                </tr>
              </thead>
              <tbody>
                {TIPOS_F26.map((t) => (
                  <tr key={t.tipo}>
                    <Td>{t.tipo}</Td>
                    <Td right className="font-semibold">{t.entradas}</Td>
                    <Td right className="whitespace-nowrap text-[var(--ink-muted)]">{t.precio}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              <b>Por persona se pagó $5.668</b> (FDS 25: $7.175). En 2025 la entrada
              individual costaba de $5.000 a $11.000 según la hora y la etapa; en
              2026 la mayoría compró el pack para 2 ($5.000 a $6.500 por persona) y
              se sumaron 1.011 entradas de niños a $3.000 o $4.000.
            </Note>
          </div>
        </div>
        <Source>
          Entradas pagadas de la ticketera, sin devueltas; incluyen upgrades (53 en
          2026 y 75 «Diferencial» en 2025). «Sin descuento» incluye boletería, Club
          Glovox Prime y upgrades. El detalle de tipos de entrada de 2025 y los
          canales están en el anexo.
        </Source>
      </Slide>

      {/* 6 · Ingreso por hora */}
      <Slide
        id="ingreso"
        n={6}
        total={TOTAL}
        areas={["Seguridad", "Producción", "Ticketing y Comunidad"]}
        label="Seguridad · ingreso por hora"
        detail="personas escaneadas en el acceso por hora"
      >
        <SlideTitle>
          El sábado entraron {INGRESO_RESUMEN.puntaSab} personas entre las 14:00 y las
          15:00, la hora más cargada de las dos ferias
        </SlideTitle>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[#9F99F8]" />
            FDS 26
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--ink-subtle)]" />
            FDS 25
          </span>
        </div>
        <div className="grid grid-cols-1 gap-8 deck:grid-cols-2">
          <IngresoDia dia="Sábado" k26="sab26" k25="sab25" />
          <IngresoDia dia="Domingo" k26="dom26" k25="dom25" />
        </div>
        <Note>
          <b>Sábado:</b> de 13:00 a 16:00 entró el {INGRESO_RESUMEN.sabTramo} del día
          (FDS 25: {INGRESO_RESUMEN.sabTramo25}). <b>Domingo:</b> la hora punta fue
          la misma (14:00, {INGRESO_RESUMEN.puntaDom} contra{" "}
          {INGRESO_RESUMEN.puntaDom25}), pero desde las 16:00 entró menos gente que
          en 2025.
        </Note>
        <Note>
          <b>Para preguntarle a Ticketing y Seguridad:</b> el viernes se vendieron{" "}
          {INGRESO_RESUMEN.ninosViernes} entradas de niños y se escanearon{" "}
          {INGRESO_RESUMEN.ninosViernesEsc}; en los tres días, {INGRESO_RESUMEN.ninosTotalEsc}{" "}
          de {INGRESO_RESUMEN.ninosTotal}. ¿Los niños entraron sin escanear o no
          vinieron? El viernes el acceso se escaneó desde las{" "}
          {INGRESO_RESUMEN.viernesDesde}, como en 2025.
        </Note>
        <Source>
          Hora de escaneo de cada ticket en el acceso (ticketera), en personas: el
          pack para 2 cuenta 2. Sin upgrades. Mide el flujo en la puerta, no el largo
          de la fila ni cuánta gente había adentro: la salida no se mide (ver la
          lámina 13).
        </Source>
      </Slide>

      {/* 7 · Mapa de ventas */}
      <Slide
        id="mapa"
        n={7}
        total={TOTAL}
        areas={["Operaciones", "Producción Site"]}
        label="Operaciones · mapa de ventas"
        detail="Onfire sobre el layout final (15-nov)"
      >
        <SlideTitle>Dónde se vendió: barras, expositores y juegos sobre el layout</SlideTitle>
        <figure className="m-0 grid min-h-0 flex-1 grid-cols-1 gap-6 deck:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="relative aspect-[4/3] min-h-0 deck:aspect-auto">
            <Image
              src={mapaVentas}
              alt={MAPA_ALT}
              fill
              loading="eager"
              sizes="(min-width: 1024px) 75vw, 100vw"
              className="object-contain object-left-top"
            />
          </div>
          <figcaption className="flex flex-col gap-3">
            <Note>
              Globos morados = barras de Glovox · naranja = expositores · verde =
              juegos. El área del globo es proporcional al monto.
            </Note>
            <Note>
              <b>La Barra Corchete y la Cervezera suman $41,1 M</b>, el 64% de lo
              que vendieron las barras.
            </Note>
            <Note>
              El mapa interactivo (botón «Mapa de ventas» arriba) trae el detalle por
              punto y el ticket promedio.
            </Note>
          </figcaption>
        </figure>
        <Source>
          Layout «FDS REV 3 modificación + agregados 15 nov», que Producción subió el
          domingo 15-nov con los cambios hechos durante la feria. La barra que se
          cambió el sábado está por confirmar.
        </Source>
      </Slide>

      {/* 8 · Onfire por tipo de puesto */}
      <Slide
        id="onfire"
        n={8}
        total={TOTAL}
        areas={["Operaciones", "Comercial y Marcas"]}
        label="Operaciones · Onfire"
        detail="venta bruta de los tres días"
      >
        <SlideTitle>
          Cada persona gastó 3% menos: las barras de Glovox bajaron 10% por persona y
          los expositores, 4%
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Table className="text-sm">
              <thead>
                <tr>
                  <Th>Tipo de puesto</Th>
                  <Th right>FDS 25</Th>
                  <Th right>FDS 26</Th>
                  <Th right>Cambio</Th>
                  <Th right>Por persona</Th>
                </tr>
              </thead>
              <tbody>
                {ONFIRE_GRUPOS.map((g) => (
                  <tr key={g.grupo}>
                    <Td className="py-3 font-semibold">
                      {g.grupo}
                      <CellSub>{g.que}</CellSub>
                    </Td>
                    <Td right className="py-3 text-[var(--ink-muted)]">{g.f25}</Td>
                    <Td right className="py-3 font-display text-xl font-bold">{g.f26}</Td>
                    <Td right className="py-3 whitespace-nowrap">
                      <Delta tone={g.cambio.tone}>{g.cambio.texto}</Delta>
                    </Td>
                    <Td right className="py-3 whitespace-nowrap">
                      <span className="text-[var(--ink-muted)]">{g.porPersona25} →</span>{" "}
                      <b className="font-semibold">{g.porPersona26}</b>
                    </Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right className="font-normal text-[var(--ink-muted)]">{ONFIRE_TOTAL.f25}</Td>
                  <Td right>{ONFIRE_TOTAL.f26}</Td>
                  <Td right>
                    <Delta tone="bad">−11%</Delta>
                  </Td>
                  <Td right className="whitespace-nowrap">
                    <span className="font-normal text-[var(--ink-muted)]">{ONFIRE_TOTAL.porPersona25} →</span>{" "}
                    {ONFIRE_TOTAL.porPersona26}
                  </Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              <b>La venta de sanguchería que se conversó el 17-nov ($29,6 M)</b> no
              cuadra con Onfire: los expositores registran $131,1 M en los tres días.
              Falta confirmar qué mide esa cifra (pendiente 1).
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Barras de Glovox</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Barra</Th>
                  <Th right>Venta</Th>
                  <Th right>%</Th>
                </tr>
              </thead>
              <tbody>
                {BARRAS.map((b) => (
                  <tr key={b.barra}>
                    <Td>{b.barra}</Td>
                    <Td right className="font-semibold">{b.venta}</Td>
                    <Td right className="text-[var(--ink-muted)]">{b.pct}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              En 2025 había 4 barras (Kross, 360, Cocktail y Pepsi). <b>Los juegos
              crecieron</b>: los botes en la laguna (uso de Caja Los Andes) y
              Entretenciones Krusty son nuevos.
            </Note>
          </div>
        </div>
        <Source>
          Onfire, venta bruta. Por persona = entre las personas que entraron (7.713 y
          7.080). Barras = puntos «Barra» de Glovox; la Barra de Pickles es un
          expositor. Juegos = bingo, botes y Krusty.
        </Source>
      </Slide>

      {/* 9 · Ranking de expositores */}
      <Slide
        id="ranking"
        n={9}
        total={TOTAL}
        areas={["Operaciones", "Comercial y Marcas"]}
        label="Operaciones · expositores"
        detail="los 10 que más vendieron · ranking completo en el anexo"
      >
        <SlideTitle>
          Tres de los cinco que más vendieron llegaron este año; Mr Tex, el primero de
          2025, vendió 46% menos
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Table className="text-sm">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Expositor</Th>
                <Th right>Venta</Th>
                <Th right>Ticket promedio</Th>
                <Th right>En la FDS 25</Th>
              </tr>
            </thead>
            <tbody>
              {RANKING.map((r) => (
                <tr key={r.nombre}>
                  <Td className="text-[var(--ink-muted)]">{r.n}</Td>
                  <Td className="font-semibold">{r.nombre}</Td>
                  <Td right className="font-semibold">{r.venta}</Td>
                  <Td right>{r.ticket}</Td>
                  <Td right className="whitespace-nowrap">
                    {r.f25 === "nuevo" ? <Pill tone="info">nuevo</Pill> : <span className="text-[var(--ink-muted)]">{r.f25}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex min-w-0 flex-col gap-4">
            <Kpi
              value={RANKING_RESUMEN.top10Pct}
              caption={`de la venta de expositores la hicieron estos 10 (${RANKING_RESUMEN.top10})`}
            />
            <Kpi
              value={`${RANKING_RESUMEN.puntos26} puntos`}
              caption={`de expositores con venta en Onfire (FDS 25: ${RANKING_RESUMEN.puntos25}); ${RANKING_RESUMEN.nuevos} no estaban en 2025`}
            />
            <Note>
              <b>No volvieron</b> y vendían bien: {RANKING_RESUMEN.noVolvieron}.
            </Note>
          </div>
        </div>
        <Source>
          Onfire, venta bruta de los tres días por punto de venta. Ticket promedio =
          venta ÷ órdenes. Los nombres se cruzan entre años a mano (Bestias = Bestias
          Burger, Marraqueta Rústica = Rustik).
        </Source>
      </Slide>

      {/* 10 · Montaje y desmontaje día a día */}
      <Slide
        id="montaje"
        n={10}
        total={TOTAL}
        areas={["Producción Site", "Producción Técnica", "Logística y bodega"]}
        label="Producción · montaje y desmontaje"
        detail="carta Gantt del plan 1240, al 17-nov"
      >
        <SlideTitle>
          Cinco días de montaje con {MONTAJE_RESUMEN.cerradas} de {MONTAJE_RESUMEN.tareas}{" "}
          tareas cerradas; el desmontaje no quedó registrado
        </SlideTitle>
        <ul className="flex flex-col">
          {MONTAJE.map((m) => (
            <li
              key={m.fecha}
              className="grid grid-cols-1 items-baseline gap-x-4 gap-y-1 border-b border-[var(--divider)] py-2.5 text-sm text-[var(--ink)] first:border-t deck:grid-cols-[calc(var(--spacing)*40)_calc(var(--spacing)*28)_calc(var(--spacing)*24)_minmax(0,1fr)]"
            >
              <p className="font-semibold">
                {m.dia}
                <CellSub>{m.fecha}</CellSub>
              </p>
              <span>
                <Pill tone={FASE_TONE[m.fase]}>{m.fase}</Pill>
              </span>
              <span className="tabular-nums text-[var(--ink-muted)]">
                <b className="font-semibold text-[var(--ink)]">{m.cerradas}</b> de {m.tareas} cerradas
              </span>
              <p className="leading-relaxed">
                <b className="font-semibold">{m.hito}.</b>{" "}
                <span className="text-[var(--ink-muted)]">{m.que}</span>
              </p>
            </li>
          ))}
        </ul>
        <Source>
          Tareas e hitos de la carta Gantt según su día de inicio. Cerrada = marcada
          como completada. Las fechas reales de término no se registran: la carta
          dice lo planificado y qué se marcó. Para la FDS 25 no hay carta Gantt
          (glovox-produccion partió en 2026).
        </Source>
      </Slide>

      {/* 11 · La cuenta */}
      <Slide
        id="resultado"
        n={11}
        total={TOTAL}
        areas={["Dirección", "Finanzas", "Comercial y Marcas"]}
        label="La cuenta"
        detail="Unabase y onepager al 17-nov"
      >
        <SlideTitle>
          El resultado de la FDS 26 todavía no se puede cerrar; la FDS 25 terminó en
          −$23,4 M
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>FDS 25, según Unabase hoy</SubTitle>
            <ul className="flex flex-col text-sm text-[var(--ink)]">
              {RESULTADO_F25.map((r) => (
                <li
                  key={r.concepto}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-b border-[var(--divider)] py-2 first:border-t ${r.total ? "font-semibold" : ""}`}
                >
                  <span>
                    {r.concepto}
                    {r.detalle && <CellSub>{r.detalle}</CellSub>}
                  </span>
                  <span className="text-right font-display text-xl font-bold tabular-nums">{r.monto}</span>
                </li>
              ))}
            </ul>
            <Note>
              En 2025 parte de las marcas y la venta de expositores se manejaron en
              negocios aparte en Unabase. <b>Para la FDS 26 hay que decidir</b> si van
              en el negocio GLO213 o aparte, antes de facturar.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>FDS 26, lo que hay hoy</SubTitle>
            <div className="grid grid-cols-2 gap-6">
              <Kpi value={RESULTADO_F26.utilidadPresupuestada} caption={`utilidad presupuestada: venta ${RESULTADO_F26.ventaPresupuestada} − gasto ${RESULTADO_F26.gastoPresupuestado}`} />
              <Kpi value="$0" caption="facturado en Unabase" valueClass="text-[var(--amber-ink)]" />
            </div>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Marca cerrada</Th>
                  <Th right>Valor</Th>
                </tr>
              </thead>
              <tbody>
                {MARCAS.map((m) => (
                  <tr key={m.marca}>
                    <Td>
                      {m.marca}
                      <span className="text-[var(--ink-muted)]"> · {m.categoria}</span>
                    </Td>
                    <Td right className="font-semibold">{m.valor}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right>{RESULTADO_F26.marcasCerradas}</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              Las marcas salen de la planilla de Comercial: <b>el onepager no tiene
              ninguna</b>. Tickets: {RESULTADO_F26.ticketsNeto} sin cargo por servicio.
            </Note>
          </div>
        </div>
        <Source>
          Millones de pesos netos. FDS 25 = negocio 7950 más Copec Pay (8052), Kross
          (8030 y 8132), Entel (8050) y Ventas FDS 2025 (8194). FDS 26 = negocio 8897;
          el presupuesto de venta no tiene detalle por ítem. Sin punto de equilibrio
          hasta confirmar la base de la venta de sanguchería.
        </Source>
      </Slide>

      {/* 12 · OC y respaldo */}
      <Slide
        id="oc"
        n={12}
        total={TOTAL}
        areas={["Finanzas", "cada área con presupuesto"]}
        label="Compras"
        detail="OC y respaldo en Unabase · al 17-nov"
      >
        <SlideTitle>
          Antes de la feria había OC por el {OC_ANTES.pct}% del presupuesto; la meta es{" "}
          {OC_ANTES.meta}%
        </SlideTitle>
        <Table className="text-xs">
          <thead>
            <tr>
              <Th>Categoría</Th>
              <Th right>Presupuesto</Th>
              <Th right>OC emitidas</Th>
              <Th className="w-[30%]">OC contra presupuesto</Th>
              <Th right>
                <span className="sr-only">% del presupuesto con OC</span>
              </Th>
              <Th right>Gasto real FDS 25</Th>
            </tr>
          </thead>
          <tbody>
            {OC.map((r) => {
              const flag = r.presupuesto !== "—" && (r.pct == null || r.pct > 100);
              return (
                <tr key={r.categoria}>
                  <Td>{r.categoria}</Td>
                  <Td right>{r.presupuesto}</Td>
                  <Td right>{r.emitido ?? "—"}</Td>
                  <Td>
                    <SpendBar pct={r.pct} />
                  </Td>
                  <Td right className="whitespace-nowrap">
                    {flag ? (
                      <Delta tone="bad">{r.pct == null ? "sin OC" : `${r.pct}%`}</Delta>
                    ) : r.pct == null ? (
                      "—"
                    ) : (
                      `${r.pct}%`
                    )}
                  </Td>
                  <Td right className="text-[var(--ink-muted)]">{r.real25}</Td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <Td>Total</Td>
              <Td right>{OC_TOTAL.presupuesto}</Td>
              <Td right>{OC_TOTAL.emitido}</Td>
              <Td>
                <SpendBar pct={OC_TOTAL.pct} />
              </Td>
              <Td right>{OC_TOTAL.pct}%</Td>
              <Td right className="font-normal text-[var(--ink-muted)]">{OC_TOTAL.real25}</Td>
            </tr>
          </tbody>
        </Table>
        <Note>
          <b>OC:</b> al 13-nov había {OC_ANTES.monto} (FDS 25: {OC_ANTES.fds25}%); quedan{" "}
          <b>{OC_ANTES.sinOc}</b> del presupuesto sin OC. Venue, Sueldos y Marcas no
          tienen OC; en la FDS 25 sumaron $47,8 M de gasto real. Artística tiene
          OC por $3,8 M contra $0,5 M presupuestados. <b>Respaldo:</b> solo{" "}
          {OC_ANTES.respaldo} con factura o boleta; ningún pago registrado.
        </Note>
        <Source>
          Millones de pesos netos, negocio 8897 en Unabase ({OC_TOTAL.nOc} OC).
          Categoría oficial del catálogo de gasto. FDS 25 = gasto real final del
          negocio 7950, como referencia de lo que falta por llegar.
        </Source>
      </Slide>

      {/* 13 · Acuerdos del 17-nov medidos en la FDS 26 */}
      <Slide
        id="acuerdos"
        n={13}
        total={TOTAL}
        areas={["Producción", "Seguridad", "Datos y Tecnología"]}
        label="Acuerdos"
        detail="reunión del 17-nov con Producción Site, Técnica y Seguridad"
      >
        <SlideTitle>Los acuerdos del 17-nov, medidos en la FDS 26</SlideTitle>
        <ul className="flex flex-col">
          {ACUERDOS_MEDIDOS.map((r) => (
            <li
              key={r.acuerdo}
              className="grid grid-cols-1 items-baseline gap-x-3 gap-y-1 border-b border-[var(--divider)] py-3 text-sm text-[var(--ink)] first:border-t deck:grid-cols-[calc(var(--spacing)*64)_calc(var(--spacing)*26)_minmax(0,1fr)]"
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
          No hubo reunión de cierre de la FDS 25 con acuerdos registrados: por eso se
          miden los acuerdos nuevos, que aplican a todos los eventos. Gris = no queda
          en ningún sistema.
        </Source>
      </Slide>

      {/* 14 · Lo que viene */}
      <Slide
        id="pendientes"
        n={14}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Lo que viene"
        detail="para la FDS 27 y para salir de la reunión con esto resuelto"
      >
        <SlideTitle>Para la FDS 27, y pendientes de la FDS 26</SlideTitle>
        <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 deck:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Para la FDS 27</SubTitle>
            <ul className="flex flex-col gap-3">
              {PARA_FDS27.map((a) => (
                <li key={a.titulo} className="border-t border-[var(--divider)] pt-2">
                  <p className="text-sm font-semibold text-[var(--ink)]">{a.titulo}</p>
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">{a.areas}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">{a.texto}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Pendientes de la FDS 26</SubTitle>
            <ol className="grid grid-cols-1 gap-x-6 gap-y-3 deck:grid-cols-2">
              {PENDIENTES.map((a, i) => (
                <li
                  key={a.titulo}
                  className="grid grid-cols-[calc(var(--spacing)*7)_minmax(0,1fr)] gap-2 border-t border-[var(--divider)] pt-2"
                >
                  <span aria-hidden="true" className="font-display text-2xl font-bold leading-none text-[#9F99F8]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{a.titulo}</p>
                    <p className="text-xs font-semibold text-[var(--ink-muted)]">{a.areas}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-muted)]">{a.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Slide>

      {/* 15 · Anexo: canales y tipos de entrada */}
      <Slide
        id="anexo-venta"
        n={15}
        total={TOTAL}
        areas={["Marketing", "Ticketing y Comunidad"]}
        label="Anexo"
        detail="por qué link llegó cada compra y tipos de entrada"
      >
        <SlideTitle>Por dónde llegó la venta y qué se vendió en cada feria</SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Canales de la FDS 26</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>Cómo llegó</Th>
                  <Th right>Entradas</Th>
                  <Th right>%</Th>
                  <Th right>Venta ($ M)</Th>
                </tr>
              </thead>
              <tbody>
                {CANALES.map((c) => (
                  <tr key={c.canal}>
                    <Td>{c.canal}</Td>
                    <Td right className="font-semibold">{c.entradas}</Td>
                    <Td right>{c.pct}</Td>
                    <Td right className="text-[var(--ink-muted)]">{c.venta}</Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right>{CANALES_TOTAL.entradas}</Td>
                  <Td right>{CANALES_TOTAL.pct}</Td>
                  <Td right>{CANALES_TOTAL.venta}</Td>
                </tr>
              </tbody>
            </Table>
            <Note>
              En la FDS 25 casi todas las compras llegaron sin código (4.920 de
              4.968): no se puede comparar canal por canal. Club Glovox pasó de 48 a
              636 entradas.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Tipos de entrada de la FDS 25</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>FDS 25</Th>
                  <Th right>Entradas</Th>
                  <Th right>Precio</Th>
                </tr>
              </thead>
              <tbody>
                {TIPOS_F25.map((t) => (
                  <tr key={t.tipo}>
                    <Td>{t.tipo}</Td>
                    <Td right className="font-semibold">{t.entradas}</Td>
                    <Td right className="whitespace-nowrap text-[var(--ink-muted)]">{t.precio}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              En 2025 el precio subía por etapa cuando se agotaba el cupo; en 2026 el
              precio fue fijo por tipo de entrada.
            </Note>
          </div>
        </div>
        <Source>
          Entradas pagadas de la ticketera, sin devueltas. Canal = código del link
          de compra (Referido); toda la compra ocurre en la ticketera.
        </Source>
      </Slide>

      {/* 16 · Anexo: ranking completo */}
      <Slide
        id="anexo-ranking"
        n={16}
        total={TOTAL}
        areas={["Operaciones", "Comercial y Marcas"]}
        label="Anexo"
        detail="venta Onfire de cada expositor, en millones"
      >
        <SlideTitle>Ranking completo de expositores</SlideTitle>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 deck:grid-cols-2">
          {[RANKING_COMPLETO.slice(0, 20), RANKING_COMPLETO.slice(20)].map((col, ci) => (
            <Table key={ci} className="text-xs">
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Expositor</Th>
                  <Th right>FDS 26</Th>
                  <Th right>Órdenes</Th>
                  <Th right>FDS 25</Th>
                </tr>
              </thead>
              <tbody>
                {col.map((r, i) => (
                  <tr key={r.nombre}>
                    <Td className="py-1 text-[var(--ink-muted)]">{ci * 20 + i + 1}</Td>
                    <Td className="py-1">{r.nombre}</Td>
                    <Td right className="py-1 font-semibold">{r.venta}</Td>
                    <Td right className="py-1">{r.ordenes}</Td>
                    <Td right className="py-1 text-[var(--ink-muted)]">{r.f25}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}
        </div>
        <Source>
          Onfire, venta bruta de los tres días. «—» = no estuvo en 2025. La Sazonería
          aparece con órdenes por $0 (revisar con Operaciones).
        </Source>
      </Slide>

      {/* 17 · Anexo: notas por confirmar */}
      <Slide
        id="anexo-notas"
        n={17}
        total={TOTAL}
        areas={[TODAS_LAS_AREAS]}
        label="Anexo"
        detail="lo que cada área tiene que confirmar"
      >
        <SlideTitle>Notas por confirmar con cada área</SlideTitle>
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 deck:grid-cols-4">
          {NOTAS_POR_CONFIRMAR.map((a) => (
            <AreaNotas key={a.area} {...a} />
          ))}
        </div>
        <Source>Fuentes: ticketera, Onfire, carta Gantt y reporte de Operaciones al 17-nov.</Source>
      </Slide>

      {/* 18 · Anexo: fuentes */}
      <Slide
        id="anexo-fuentes"
        n={18}
        total={TOTAL}
        areas={["Datos y Tecnología"]}
        label="Anexo"
        detail="de dónde sale cada cifra"
      >
        <SlideTitle>Fuentes y reglas de esta presentación</SlideTitle>
        <ul className="flex max-w-[110ch] flex-col gap-2 text-sm leading-relaxed text-[var(--ink)]">
          <li><b className="font-semibold">Entradas:</b> ticketera (GLO213 y GLO181), solo clase venta, sin devueltas. Personas = las que cubre cada entrada; sin upgrades ni la entrada de prueba.</li>
          <li><b className="font-semibold">Entraron:</b> tickets escaneados en el acceso, en personas, por el día de la entrada.</li>
          <li><b className="font-semibold">Onfire:</b> venta bruta por punto de venta y día. No trae el medio de pago (NFC y Copec Pay están en el reporte de Operaciones).</li>
          <li><b className="font-semibold">Unabase:</b> negocio 8897 (FDS 26) y 7950 más sus negocios aparte (FDS 25), montos netos, actualizado el 17-nov.</li>
          <li><b className="font-semibold">Pauta:</b> gasto atribuido al evento en Meta y Google, en dólares (la misma cuenta de /marketing/weekly).</li>
          <li><b className="font-semibold">Producción:</b> carta Gantt y layouts de glovox-produccion (plan 1240).</li>
          <li><b className="font-semibold">Marcas:</b> planilla «Estatus Marcas - Feria del Sánguche 2026» de Comercial; el onepager aún no tiene la FDS 26.</li>
        </ul>
      </Slide>
    </Deck>
  );
}
