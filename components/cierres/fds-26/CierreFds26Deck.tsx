import Image from "next/image";
import { ExternalLink } from "lucide-react";
import Deck from "@/components/cierres/deck/Deck";
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
} from "@/components/cierres/deck/primitives";
import {
  BARRAS,
  CMP_DIAS,
  CONVENIOS,
  CONVENIOS_TOTAL,
  INGRESO_HORA,
  INGRESO_RESUMEN,
  MAPA_ALT,
  META,
  MONTAJE,
  MONTAJE_RESUMEN,
  OC,
  OC_ANTES,
  OC_TOTAL,
  ONFIRE_GRUPOS,
  ONFIRE_TOTAL,
  POR_DIA,
  PORTADA_FACTS,
  PUNTOS_CONTROL,
  RANKING,
  RANKING_RESUMEN,
  RESULTADO_ANTERIORES,
  RESULTADO_F26,
  TIPOS_F26,
} from "@/lib/cierres/fds-26";
import { aplicarFechaClave } from "@/lib/cierres/hitos";
import type { FechaClaveEvento } from "@/lib/produccion/fechas-clave";
import { FechaClaveInput } from "@/components/cierres/deck/FechaClaveInput";
import mapaVentas from "./mapa-ventas.jpg";
import ComparacionPorDia from "./ComparacionPorDia";

const TOTAL = 11;

const TRAMOS = [
  { key: "antes", label: "Antes de 3 semanas", color: "#9F99F8" },
  { key: "semanas1a3", label: "Entre 1 y 3 semanas", color: "#87DACD" },
  { key: "ultimaSemana", label: "Última semana", color: "#F6C544" },
  { key: "dia", label: "El mismo día", color: "#EF8C34" },
] as const;


/** Personas escaneadas por hora en un día: FDS 26 (morado) contra FDS 25 (gris). */
function IngresoDia({ dia, k26, k25 }: { dia: string; k26: "vie26" | "sab26" | "dom26"; k25: "vie25" | "sab25" | "dom25" }) {
  const max = Math.max(...INGRESO_HORA.map((s) => Math.max(s.vie26, s.vie25, s.sab26, s.sab25, s.dom26, s.dom25)));
  const h = (v: number) => `${(v / max) * 100}%`;
  // Solo se rotula la hora punta del día: con más etiquetas los números chocan.
  const punta = Math.max(...INGRESO_HORA.map((s) => s[k26]));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SubTitle>{dia}</SubTitle>
      <div
        className="flex h-[calc(var(--spacing)*40)] items-end gap-1 border-b border-[var(--divider)] pt-5"
        role="img"
        aria-label={`${dia}, personas que entraron por hora. FDS 26: ${INGRESO_HORA.map((s) => `${s.hora}:00 ${s[k26]}`).join(", ")}. FDS 25: ${INGRESO_HORA.map((s) => `${s.hora}:00 ${s[k25]}`).join(", ")}.`}
      >
        {INGRESO_HORA.map((s) => (
          <div key={s.hora} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            <div className="relative w-3/5 rounded-t-sm bg-[#9F99F8]" style={{ height: h(s[k26]) }}>
              {s[k26] === punta && (
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
 * Presentación de cierre de la Feria del Sánguche 2026 (FDS 26 · GLO213): 11
 * láminas, sin anexo. Orden en actos, como la del Piknic 4: tablero (1-2),
 * llegamos antes (3-4), el día (5-9) y la cuenta (10-11: resultado y OC). La
 * lámina de pagos salió el 18-nov: es información delicada para esta reunión. El 18-nov salieron la anticipación con línea de
 * tiempo, los acuerdos del 17-nov, «Lo que viene» y los 4 anexos. Se compara
 * solo con la FDS 25
 * (GLO181). Datos en lib/cierres/fds-26.ts (foto al 17-nov). La mecánica de
 * láminas, navegación y PDF vive en components/cierres/deck. El control de
 * acceso lo hace la page.
 */
export default function CierreFds26Deck({
  mapaHref,
  informeMarcas = null,
  editarFechasClave = false,
}: {
  mapaHref?: string;
  /** Fecha clave «Informe de marcas» del plan en la carta Gantt (null si no se pudo leer). */
  informeMarcas?: FechaClaveEvento | null;
  /** Quien mira puede anotar la fecha real desde la lámina (escribe en la Gantt). */
  editarFechasClave?: boolean;
}) {
  // Informe de marcas: plazo contado desde el último día de la feria. Sin fecha
  // anotada, la fila queda como viene en los datos («vence el 20-nov»).
  const puntos = PUNTOS_CONTROL.map((p) =>
    p.fechaClave === "informe_marcas"
      ? aplicarFechaClave(p, informeMarcas, { verbo: "Se entregó", base: META.fechaFin })
      : p,
  );
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
        detail="en orden de plazo · los mismos de los cierres del Piknic"
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
            {puntos.map((p) => (
              <tr key={p.punto}>
                <Td className="align-top whitespace-nowrap font-semibold">
                  {p.punto}
                  <CellSub>{p.area}</CellSub>
                </Td>
                <Td className="align-top font-semibold">{p.plazo}</Td>
                <Td className="align-top">
                  <ConDiasAntes>{p.quePaso}</ConDiasAntes>
                  {p.fechaClave === "informe_marcas" && editarFechasClave && informeMarcas && (
                    <FechaClaveInput
                      slug="fds-26"
                      fechaClaveId="informe_marcas"
                      fecha={informeMarcas.fecha}
                      min={META.fechaFin}
                      max="2100-12-31"
                      label="Fecha en que se entregó el informe a las marcas de la FDS 26"
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
          Rojo = pasó el plazo · amarillo = vence pronto o falta algo · gris = sin
          dato · «vencida» = nadie la marcó como cerrada en la Gantt.
        </Source>
      </Slide>

      {/* 3 · Comparación con la FDS 25 */}
      <Slide
        id="fds-25"
        n={3}
        total={TOTAL}
        areas={["Marketing"]}
        label="Comparación"
        detail="FDS 24 (15 al 17-nov-2024) y FDS 25 (21 al 23-nov-2025), mismo parque"
      >
        <ComparacionPorDia dias={CMP_DIAS} porDia={POR_DIA} tramos={TRAMOS} />
        <Source>
          Personas = las que cubre cada entrada (pack para 2 = 2), sin upgrades. Venta
          bruta = con cargo por servicio. Entraron = escaneadas (el viernes de 2026 casi
          no se escanearon niños). CPA Meta = gasto en Meta ÷ personas, sin Google; 2024
          sin pauta registrada.
        </Source>
      </Slide>

      {/* 4 · Venta: convenios y precio por persona */}
      <Slide
        id="venta"
        n={4}
        total={TOTAL}
        areas={["Marketing", "Ticketing y Comunidad", "Comercial y Marcas"]}
        label="Venta"
        detail="convenios y tipos de entrada"
      >
        <SlideTitle>
          Dos de cada tres personas entraron con 20% de descuento, y el pack para 2
          bajó el precio por persona
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Personas por convenio</SubTitle>
            <Table className="text-sm">
              <thead>
                <tr>
                  <Th>Convenio</Th>
                  <Th right>FDS 25</Th>
                  <Th right>FDS 26</Th>
                  <Th right>% de las personas</Th>
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
              67% de las personas, igual que en la FDS 25. Las dos marcas pagan para estar:
              $25,0 M y $15,0 M según la planilla de Comercial.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>Qué se vendió</SubTitle>
            <Table className="text-xs">
              <thead>
                <tr>
                  <Th>FDS 26</Th>
                  <Th right>Personas</Th>
                  <Th right>%</Th>
                  <Th right>Precio por persona</Th>
                </tr>
              </thead>
              <tbody>
                {TIPOS_F26.map((t) => (
                  <tr key={t.tipo}>
                    <Td>{t.tipo}</Td>
                    <Td right className="font-semibold">{t.personas}</Td>
                    <Td right className="text-[var(--ink-muted)]">{t.pct}</Td>
                    <Td right className="whitespace-nowrap text-[var(--ink-muted)]">{t.precio}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              <b>Por persona se pagó $5.668</b> (FDS 25: $7.175). En 2025 la entrada
              individual costaba de $5.000 a $11.000 según la hora y la etapa; en
              2026 el 72% de las personas entró con el pack para 2 ($5.000 a $6.500 por
              persona) y se sumaron 1.011 niños a $3.000 o $4.000.
            </Note>
          </div>
        </div>
        <Source>
          Personas con entrada pagada de la ticketera (el pack para 2 cuenta 2 y el
          pase familiar 4), sin devueltas ni upgrades. «Sin descuento» incluye
          boletería y Club Glovox Prime.
        </Source>
      </Slide>

      {/* 5 · Ingreso por hora */}
      <Slide
        id="ingreso"
        n={5}
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
        <div className="grid grid-cols-1 gap-6 deck:grid-cols-3">
          <IngresoDia dia="Viernes" k26="vie26" k25="vie25" />
          <IngresoDia dia="Sábado" k26="sab26" k25="sab25" />
          <IngresoDia dia="Domingo" k26="dom26" k25="dom25" />
        </div>
        <Note>
          <b>Viernes:</b> abrió de tarde; entraron {INGRESO_RESUMEN.viernesTotal}{" "}
          (FDS 25: {INGRESO_RESUMEN.viernesTotal25}), con la hora más cargada a las
          19:00 ({INGRESO_RESUMEN.puntaVie} contra {INGRESO_RESUMEN.puntaVie25}).{" "}
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
          de la fila ni cuánta gente había adentro: la salida no se mide.
          Se cuenta por el día del escaneo: el viernes suma 615, y no 671 como en la
          lámina 3, porque algunas entradas del viernes se usaron otro día.
        </Source>
      </Slide>

      {/* 6 · Mapa de ventas */}
      <Slide
        id="mapa"
        n={6}
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
              El mapa interactivo trae el detalle por punto y se puede ver por día y en venta por persona.
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
          Layout «FDS REV 3 modificación + agregados 15 nov», que Producción subió el
          domingo 15-nov con los cambios hechos durante la feria. La barra que se
          cambió el sábado está por confirmar.
        </Source>
      </Slide>

      {/* 7 · Onfire por tipo de puesto */}
      <Slide
        id="onfire"
        n={7}
        total={TOTAL}
        areas={["Operaciones", "Comercial y Marcas"]}
        label="Operaciones · Onfire"
        detail="venta bruta de los tres días"
      >
        <SlideTitle>
          Onfire bajó dos años seguidos; por persona, la FDS 26 gastó 3% menos que la
          25 y 8% más que la 24
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <Table className="text-sm">
              <thead>
                <tr>
                  <Th>Tipo de puesto</Th>
                  <Th right>FDS 24</Th>
                  <Th right>FDS 25</Th>
                  <Th right>FDS 26</Th>
                  <Th right className="whitespace-nowrap">26 contra 25</Th>
                  <Th right>Por persona · 24 · 25 → 26</Th>
                </tr>
              </thead>
              <tbody>
                {ONFIRE_GRUPOS.map((g) => (
                  <tr key={g.grupo}>
                    <Td className="py-3 font-semibold">
                      {g.grupo}
                      <CellSub>{g.que}</CellSub>
                    </Td>
                    <Td right className="py-3 whitespace-nowrap text-[var(--ink-subtle)]">{g.f24}</Td>
                    <Td right className="py-3 whitespace-nowrap text-[var(--ink-muted)]">{g.f25}</Td>
                    <Td right className="py-3 whitespace-nowrap font-display text-lg font-bold">{g.f26}</Td>
                    <Td right className="py-3 whitespace-nowrap">
                      <Delta tone={g.cambio.tone}>{g.cambio.texto}</Delta>
                    </Td>
                    <Td right className="py-3 whitespace-nowrap">
                      <span className="text-[var(--ink-subtle)]">{g.porPersona24} ·</span>{" "}
                      <span className="text-[var(--ink-muted)]">{g.porPersona25} →</span>{" "}
                      <b className="font-semibold">{g.porPersona26}</b>
                    </Td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <Td>Total</Td>
                  <Td right className="whitespace-nowrap font-normal text-[var(--ink-subtle)]">{ONFIRE_TOTAL.f24}</Td>
                  <Td right className="whitespace-nowrap font-normal text-[var(--ink-muted)]">{ONFIRE_TOTAL.f25}</Td>
                  <Td right className="whitespace-nowrap">{ONFIRE_TOTAL.f26}</Td>
                  <Td right>
                    <Delta tone="bad">−11%</Delta>
                  </Td>
                  <Td right className="whitespace-nowrap">
                    <span className="font-normal text-[var(--ink-subtle)]">{ONFIRE_TOTAL.porPersona24} ·</span>{" "}
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
              En 2025 había 4 barras (Kross, 360, Cocktail y Pepsi); en 2024, barras y
              carros Kunstmann, Red Bull, Campanario, la Laguna y Bocas Moradas. <b>Los
              juegos son nuevos</b>: los botes en la laguna (uso de Caja Los Andes) y
              Entretenciones Krusty.
            </Note>
          </div>
        </div>
        <Source>
          Onfire, venta bruta. Por persona = entre las personas que entraron (8.973,
          7.713 y 7.080). Barras = barras y carros de Glovox; la Barra de Pickles es
          un expositor. Juegos = bingo, botes y Krusty (en 2024 no hubo).
        </Source>
      </Slide>

      {/* 8 · Ranking de expositores */}
      <Slide
        id="ranking"
        n={8}
        total={TOTAL}
        areas={["Operaciones", "Comercial y Marcas"]}
        label="Operaciones · expositores"
        detail="los 10 que más vendieron"
      >
        <SlideTitle>
          Tres de los cinco que más vendieron llegaron este año; Mr Tex, el primero en
          2024 y en 2025, vendió la mitad que en 2024
        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-8 deck:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <Table className="text-xs">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Expositor</Th>
                <Th right>Venta</Th>
                <Th right className="whitespace-nowrap">Ticket promedio · 24 · 25 → 26</Th>
                <Th right>En la FDS 24</Th>
                <Th right>En la FDS 25</Th>
              </tr>
            </thead>
            <tbody>
              {RANKING.map((r) => (
                <tr key={r.nombre}>
                  <Td className="text-[var(--ink-muted)]">{r.n}</Td>
                  <Td className="font-semibold">{r.nombre}</Td>
                  <Td right className="whitespace-nowrap font-semibold">{r.venta}</Td>
                  <Td right className="whitespace-nowrap">
                    {(r.ticket24 !== "—" || r.ticket25 !== "—") && (
                      <>
                        <span className="text-[var(--ink-subtle)]">{r.ticket24} ·</span>{" "}
                        <span className="text-[var(--ink-muted)]">{r.ticket25} →</span>{" "}
                      </>
                    )}
                    <b className="font-semibold">{r.ticket}</b>
                  </Td>
                  <Td right className="whitespace-nowrap text-[var(--ink-subtle)]">{r.f24}</Td>
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
              caption={`de expositores con venta en Onfire (FDS 24: ${RANKING_RESUMEN.puntos24}; FDS 25: ${RANKING_RESUMEN.puntos25}); ${RANKING_RESUMEN.nuevos} no estaban en 2025`}
            />
            <Note>
              <b>No volvieron</b> y vendían bien: {RANKING_RESUMEN.noVolvieron}.
            </Note>
          </div>
        </div>
        <Source>
          Onfire, venta bruta de los tres días por punto de venta. Ticket promedio =
          venta ÷ órdenes, del mismo expositor en cada año. Los nombres se cruzan entre años a mano (Bestias = Bestias
          Burger, Marraqueta Rústica = Rustik). «—» = no estuvo ese año.
        </Source>
      </Slide>

      {/* 9 · Montaje y desmontaje día a día */}
      <Slide
        id="montaje"
        n={9}
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
              className="grid grid-cols-1 items-baseline gap-x-4 gap-y-1 border-b border-[var(--divider)] py-2 text-sm text-[var(--ink)] first:border-t deck:grid-cols-[calc(var(--spacing)*40)_calc(var(--spacing)*28)_calc(var(--spacing)*24)_minmax(0,1fr)]"
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

      {/* 10 · La cuenta */}
      <Slide
        id="resultado"
        n={10}
        total={TOTAL}
        areas={["Dirección", "Finanzas", "Comercial y Marcas"]}
        label="La cuenta"
        detail="Unabase y onepager al 17-nov"
      >
        <SlideTitle>
          El resultado de la FDS 26 todavía no se puede cerrar; las dos anteriores
          terminaron en negativo

        </SlideTitle>
        <div className="grid grid-cols-1 items-start gap-10 deck:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>FDS 24 y FDS 25, según Unabase hoy</SubTitle>
            <Table className="text-sm">
              <thead>
                <tr>
                  <Th>Concepto</Th>
                  <Th right>FDS 24</Th>
                  <Th right>FDS 25</Th>
                </tr>
              </thead>
              <tbody>
                {RESULTADO_ANTERIORES.map((r) => (
                  <tr key={r.concepto} className={r.total ? "font-semibold" : ""}>
                    <Td>
                      {r.concepto}
                      {r.detalle && <CellSub>{r.detalle}</CellSub>}
                    </Td>
                    <Td right className="whitespace-nowrap font-display text-lg font-bold">{r.f24}</Td>
                    <Td right className="whitespace-nowrap font-display text-lg font-bold">{r.f25}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Note>
              En 2025 parte de las marcas y la venta de expositores se manejaron en
              negocios aparte en Unabase; en 2024 casi todo fue en el negocio GLO145. <b>Para la FDS 26 hay que decidir</b> si van
              en el negocio GLO213 o aparte, antes de facturar.
            </Note>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <SubTitle>FDS 26, lo que hay hoy</SubTitle>
            <div className="grid grid-cols-2 gap-6">
              <Kpi value={RESULTADO_F26.utilidadPresupuestada} caption={`utilidad presupuestada: venta ${RESULTADO_F26.ventaPresupuestada} − gasto ${RESULTADO_F26.gastoPresupuestado}`} />
              <Kpi value="$0" caption="facturado en Unabase" valueClass="text-[var(--amber-ink)]" />
            </div>
            <Note>
              Las marcas cerradas están en la planilla de Comercial: <b>el onepager
              no tiene ninguna</b>. Su monto no se muestra en esta presentación. Tickets: {RESULTADO_F26.ticketsNeto} sin cargo por servicio.
            </Note>
          </div>
        </div>
        <Source>
          Millones de pesos netos. FDS 24 = negocio 6848 más Lipton (6955) y Ventas
          FDS (6877). FDS 25 = negocio 7950 más Copec Pay (8052), Kross
          (8030 y 8132), Entel (8050) y Ventas FDS 2025 (8194). FDS 26 = negocio 8897;
          el presupuesto de venta no tiene detalle por ítem. Sin punto de equilibrio
          hasta confirmar la base de la venta de sanguchería.
        </Source>
      </Slide>

      {/* 11 · OC y respaldo */}
      <Slide
        id="oc"
        n={11}
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
          {OC_ANTES.respaldo} con factura o boleta. Lo pagado, en la lámina siguiente.
        </Note>
        <Source>
          Millones de pesos netos, negocio 8897 en Unabase ({OC_TOTAL.nOc} OC).
          Categoría oficial del catálogo de gasto. FDS 25 = gasto real final del
          negocio 7950, como referencia de lo que falta por llegar.
        </Source>
      </Slide>
    </Deck>
  );
}
