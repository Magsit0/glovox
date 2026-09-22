import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { isValidShareToken } from "@/lib/lacava/share-token";
import {
  getLaCavaEventos,
  getLaCavaMedios,
  getLaCavaPrecios,
  getLaCavaTipos,
  getLaCavaVentaDiaria,
  type LaCavaEvento,
} from "@/lib/queries/lacava";
import { getCurvasCompra } from "@/lib/queries/curvas";
import { buildCurvas } from "@/lib/marketing/curvas";
import { buildPlanTrayectorias } from "@/lib/lacava/proyeccion";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import { LACAVA } from "@/components/lacava/theme";
import LaCavaLogo from "@/components/lacava/LaCavaLogo";
import VentaDiariaChart from "@/components/lacava/VentaDiariaChart";
import CurvasEdicionesChart, {
  type CurvaVariant,
} from "@/components/lacava/CurvasEdicionesChart";
import TiposTicketCard from "@/components/lacava/TiposTicketCard";
import PlanVentaCard, { type PlanTarget } from "@/components/lacava/PlanVentaCard";
import PreciosCard from "@/components/lacava/PreciosCard";
import MediosPagoCard from "@/components/lacava/MediosPagoCard";

export const dynamic = "force-dynamic";

/**
 * Compromisos comerciales por edición (card "Plan de venta"). Son METAS
 * DECLARADAS por el negocio — no salidas del modelo — y así se presentan.
 * El goalTickets de la hoja de eventos se muestra aparte como "Meta".
 */
const PLAN_VENTA: Record<string, { minimo: number; objetivo: number }> = {
  GLO209: { minimo: 4500, objetivo: 5500 },
};

const compactClp = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});
const fechaLarga = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  // La fecha viene como YYYY-MM-DD y se parsea como UTC: formatear en UTC
  // evita el corrimiento de un día en zonas horarias negativas (Chile).
  timeZone: "UTC",
});

function fmtFecha(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return fechaLarga.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Dashboard La Cava (Jumbo): evolución de venta de tickets de los eventos con
 * `CategoriaEvento = 'JUMBO'`. Paleta e identidad propias del evento (verde
 * botella, burdeos, crema) — desvío deliberado de la guía Glovox, ver
 * components/lacava/theme.ts.
 */
export default async function LaCavaPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; k?: string }>;
}) {
  const params = await searchParams;

  // Modo público: con el link secreto (?k=LACAVA_SHARE_TOKEN) la página se ve
  // sin sesión — es la vista para el cliente externo. Sin token válido, el
  // control de acceso es el de siempre (sesión + grant del dashboard).
  const esLinkPublico = isValidShareToken(params.k);
  if (!esLinkPublico) {
    const session = await auth();
    if (!session?.user?.email) redirect("/login");
    const permissions = session.user.permissions ?? [];
    if (!canAccessPath(permissions, "/lacava")) redirect("/?unauthorized=1");
  }
  const eventos = await getLaCavaEventos();

  if (eventos.length === 0) {
    return (
      <Shell>
        <p className="font-sans text-sm" style={{ color: LACAVA.tintaSuave }}>
          No hay eventos con CategoriaEvento JUMBO en la base.
        </p>
      </Shell>
    );
  }

  // Default: la edición en venta más próxima; si no hay ninguna por venir, la
  // última realizada (la lista viene ordenada por fecha DESC).
  const proximos = eventos
    .filter((e) => e.diasParaEvento >= 0)
    .sort((a, b) => a.diasParaEvento - b.diasParaEvento);
  const defaultId = proximos[0]?.eventoId ?? eventos[0].eventoId;
  const selectedId = eventos.some((e) => e.eventoId === params.event)
    ? (params.event as string)
    : defaultId;
  const evento = eventos.find((e) => e.eventoId === selectedId) as LaCavaEvento;

  const [dias, tipos, precios, medios, curvaRows] = await Promise.all([
    getLaCavaVentaDiaria(selectedId),
    getLaCavaTipos(selectedId),
    getLaCavaPrecios(selectedId),
    getLaCavaMedios(selectedId),
    // Misma matemática que /marketing/curvas. Trae JUMBO (curvas del gráfico
    // comparativo) + FBM (Bocas Moradas: los comparables de las trayectorias
    // del plan de venta).
    getCurvasCompra({
      country: "all",
      categoriaEventos: ["FBM", "JUMBO"],
      comunidad: "todos",
      incluirDevueltos: false,
      incluirCortesias: false,
    }),
  ]);

  const jumboIds = new Set(eventos.map((e) => e.eventoId));
  const rowsJumbo = curvaRows.filter((r) => jumboIds.has(r.eventoId));

  // Cuatro variantes precalculadas (métrica × escala) para que el toggle del
  // gráfico de curvas no vuelva al servidor.
  const curvaEvents = eventos.map((e) => ({
    eventoId: e.eventoId,
    nombre: e.nombre,
    categoriaEvento: "JUMBO",
    categoriaEvento2: "",
    categoriaEvento3: "",
    temporada: e.temporada,
    fechaEvento: e.fechaEvento,
  }));
  const nombreById = new Map(eventos.map((e) => [e.eventoId, e.nombre || e.eventoId]));
  const shortLabel = (label: string) =>
    nombreById.get(label.split(" — ")[0]) ?? label;
  const variants: CurvaVariant[] = (["personas", "venta"] as const).flatMap(
    (metric) =>
      ([false, true] as const).map((normalizar) => {
        const c = buildCurvas({
          rows: rowsJumbo,
          events: curvaEvents,
          groupBy: "evento",
          metric,
          vista: "acumulado",
          normalizar,
          promedio: false,
          maxSeries: 10,
        });
        return {
          metric,
          normalizar,
          points: c.points,
          series: c.series.map((s) => ({
            key: s.key,
            label: shortLabel(s.label),
            total: s.total,
            enVenta: s.enVenta,
            diasCorte: s.diasCorte,
          })),
          minDias: c.minDias,
          maxDias: c.maxDias,
        };
      }),
  );

  // Compromisos comerciales de la edición (si están definidos), con la meta
  // de la hoja de eventos como tercer nivel.
  const plan = PLAN_VENTA[selectedId];
  const planTargets: PlanTarget[] = plan
    ? [
        { key: "minimo", label: "Mínimo", valor: plan.minimo, color: "#557F6B" },
        { key: "objetivo", label: "Objetivo", valor: plan.objetivo, color: LACAVA.burdeos },
        ...(evento.goalTickets > 0
          ? [{ key: "meta", label: "Meta", valor: evento.goalTickets, color: LACAVA.dorado }]
          : []),
      ]
    : [];

  // Abanico del plan: trayectorias desde la venta real de hoy hacia cada
  // compromiso, siguiendo la forma histórica de compra de los comparables.
  const trayectorias =
    plan && evento.diasParaEvento >= 0
      ? buildPlanTrayectorias({
          targetRows: curvaRows.filter((r) => r.eventoId === selectedId),
          comparableRows: curvaRows.filter((r) => r.eventoId !== selectedId),
          fechaEvento: evento.fechaEvento,
          minimo: plan.minimo,
          objetivo: plan.objetivo,
          meta: evento.goalTickets || undefined,
        })
      : null;

  const metaPct =
    evento.goalTickets > 0
      ? Math.round((evento.personas / evento.goalTickets) * 100)
      : null;
  const emitidas = evento.personas + evento.cortesias;
  const ticketPromedio =
    evento.transacciones > 0 ? evento.ventaNeta / evento.transacciones : 0;

  return (
    <Shell
      header={
        <Header
          eventos={eventos}
          selectedId={selectedId}
          evento={evento}
          shareK={esLinkPublico ? params.k : undefined}
        />
      }
    >
      {/* KPIs de la edición seleccionada */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Personas vendidas" value={formatNumber(evento.personas)}>
          {evento.goalTickets > 0 ? (
            <>
              <p className="mt-3 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
                Meta {formatNumber(evento.goalTickets)} · {metaPct}%
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: LACAVA.grid }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, metaPct ?? 0)}%`,
                    backgroundColor: LACAVA.jumbo,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
              Sin meta definida
            </p>
          )}
        </KpiCard>
        <KpiCard
          label="Venta neta tickets"
          value={`$${compactClp.format(Math.round(evento.ventaNeta))}`}
        >
          <p className="mt-3 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            + {formatCurrency(evento.cargoServicio)} de cargo por servicio
          </p>
        </KpiCard>
        <KpiCard label="Ticket promedio" value={formatCurrency(ticketPromedio)}>
          <p className="mt-3 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            {formatNumber(evento.transacciones)} transacciones · neto de descuentos
          </p>
        </KpiCard>
        <KpiCard label="Cortesías" value={formatNumber(evento.cortesias)}>
          <p className="mt-3 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            {emitidas > 0
              ? `${Math.round((evento.cortesias / emitidas) * 100)}% de lo emitido`
              : "Sin emisiones"}
            {evento.devueltos > 0 && ` · ${formatNumber(evento.devueltos)} devueltos`}
          </p>
        </KpiCard>
      </section>

      {/* Evolución de venta (como /marketing/weekly) */}
      <Card
        title="Evolución de venta"
        subtitle={`Venta diaria y acumulada de ${evento.nombre}. En venta desde el ${fmtFecha(evento.primeraOrden)}.`}
      >
        <VentaDiariaChart
          data={dias}
          goalTickets={evento.goalTickets || undefined}
          fechaEvento={evento.fechaEvento}
        />
      </Card>

      {/* Plan de venta: compromisos comerciales declarados (vista cliente) */}
      {planTargets.length > 0 && trayectorias?.disponible && (
        <Card
          title="Plan de venta"
          subtitle="Compromisos comerciales de la edición y avance real contra cada uno: banda entre el mínimo y la meta, trayectoria central hacia el objetivo."
        >
          <PlanVentaCard
            puntos={trayectorias.puntos}
            base={trayectorias.base}
            diasRestantes={trayectorias.diasRestantes}
            targets={planTargets}
          />
        </Card>
      )}


      {/* Curvas comparativas entre ediciones (como /marketing/curvas) */}
      <Card
        title="Curvas de venta por edición"
        subtitle="Acumulado de todas las ediciones de La Cava alineado por días de compra anticipada. La curva en venta se corta en el día de hoy."
      >
        <CurvasEdicionesChart variants={variants} />
      </Card>

      {/* Tipos + medios de pago */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Tickets por día"
          subtitle="Personas emitidas para cada jornada del evento, con su tipo y clase (venta pagada vs cortesía)."
        >
          <TiposTicketCard tipos={tipos} />
        </Card>
        <Card
          title="Medios de pago"
          subtitle="Venta neta por medio de pago (solo ventas pagadas)."
        >
          <MediosPagoCard medios={medios} />
        </Card>
      </section>

      {/* Tramos de precio */}
      <Card
        title="Tramos de precio y descuentos"
        subtitle="Personas por precio de lista (preventas / general), segmentadas por el descuento del beneficio Cencosud / Jumbo Prime."
      >
        <PreciosCard precios={precios} />
      </Card>

      {/* Comparativa entre ediciones */}
      <Card
        title="Ediciones"
        subtitle="Resumen de todas las ediciones de La Cava."
        noPadding
      >
        <EdicionesTable eventos={eventos} selectedId={selectedId} />
      </Card>
    </Shell>
  );
}

// ---------- Layout ----------

function Shell({
  header,
  children,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="min-h-screen">
      {header}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-8 sm:px-8">
        {children}
      </div>
    </main>
  );
}

function Header({
  eventos,
  selectedId,
  evento,
  shareK,
}: {
  eventos: LaCavaEvento[];
  selectedId: string;
  evento: LaCavaEvento;
  /** Presente en modo público (link secreto): se propaga en los tabs y se
   *  oculta la navegación interna. */
  shareK?: string;
}) {
  return (
    <header style={{ backgroundColor: LACAVA.verde }}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          {shareK ? (
            <span />
          ) : (
            <Link
              href="/"
              className="flex items-center gap-1.5 font-sans text-sm transition-opacity hover:opacity-100"
              style={{ color: LACAVA.marfil, opacity: 0.75 }}
            >
              <ArrowLeft className="h-4 w-4" />
              Inicio
            </Link>
          )}
          <span
            className="font-sans text-xs uppercase tracking-wide"
            style={{ color: LACAVA.marfil, opacity: 0.55 }}
          >
            Expo de vinos · Jumbo × Glovox
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-8">
          <div className="flex flex-wrap items-center gap-8">
            <LaCavaLogo />
            <div>
              <h1
                className="font-lacava text-3xl font-bold leading-tight"
                style={{ color: LACAVA.marfil }}
              >
                Evolución de venta
              </h1>
              <p
                className="mt-1 max-w-xl font-sans text-sm"
                style={{ color: LACAVA.marfil, opacity: 0.75 }}
              >
                Venta de tickets de las ediciones de La Cava: ritmo diario,
                curvas comparadas, tipos de ticket y medios de pago.
              </p>
            </div>
          </div>
          {/* ml-auto: cuando el flex-wrap lo baja a su propia línea, se queda
              anclado a la derecha en vez de caer al margen izquierdo. */}
          <div className="ml-auto">
            <Countdown evento={evento} />
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {eventos.map((e) => {
            const active = e.eventoId === selectedId;
            return (
              <Link
                key={e.eventoId}
                href={`/lacava?event=${e.eventoId}${shareK ? `&k=${encodeURIComponent(shareK)}` : ""}`}
                prefetch={false}
                className="rounded-full border px-4 py-1.5 font-sans text-sm font-medium transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: LACAVA.marfil,
                        borderColor: LACAVA.marfil,
                        color: LACAVA.verde,
                      }
                    : {
                        backgroundColor: "transparent",
                        borderColor: `${LACAVA.marfil}66`,
                        color: LACAVA.marfil,
                      }
                }
              >
                {e.nombre || e.eventoId}
                {e.diasParaEvento >= 0 && (
                  <span
                    className="ml-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                    style={{ backgroundColor: LACAVA.jumbo }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/**
 * Estado de la edición seleccionada, encuadrado con el mismo marco fino del
 * lock-up de La Cava para que el header se lea como un solo sistema.
 */
function CountdownFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-w-[190px] flex-col items-center rounded-md border px-6 pb-4 pt-3"
      style={{ borderColor: `${LACAVA.marfil}59`, borderWidth: 1.5 }}
    >
      {children}
    </div>
  );
}

function CountdownKicker({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-sans text-[11px] font-medium uppercase tracking-[0.3em]"
      style={{ color: LACAVA.marfil, opacity: 0.65, marginRight: "-0.3em" }}
    >
      {children}
    </span>
  );
}

function CountdownFecha({ fecha }: { fecha: string }) {
  return (
    <span
      className="mt-3 self-stretch border-t pt-2.5 text-center font-sans text-xs font-medium tracking-wide"
      style={{ borderColor: `${LACAVA.marfil}33`, color: LACAVA.marfil, opacity: 0.85 }}
    >
      {fmtFecha(fecha)}
    </span>
  );
}

function Countdown({ evento }: { evento: LaCavaEvento }) {
  const d = evento.diasParaEvento;

  if (d > 0) {
    return (
      <CountdownFrame>
        <CountdownKicker>Faltan</CountdownKicker>
        <span
          className="mt-1.5 font-lacava text-5xl font-bold leading-none tabular-nums"
          style={{ color: LACAVA.dorado }}
        >
          {formatNumber(d)}
        </span>
        <span
          className="mt-1.5 font-sans text-xs"
          style={{ color: LACAVA.marfil, opacity: 0.8 }}
        >
          {d === 1 ? "día para el evento" : "días para el evento"}
        </span>
        <CountdownFecha fecha={evento.fechaEvento} />
      </CountdownFrame>
    );
  }
  if (d === 0) {
    return (
      <CountdownFrame>
        <CountdownKicker>Es hoy</CountdownKicker>
        <span
          className="mt-1.5 font-lacava text-3xl font-bold leading-none"
          style={{ color: LACAVA.dorado }}
        >
          Día del evento
        </span>
        <CountdownFecha fecha={evento.fechaEvento} />
      </CountdownFrame>
    );
  }
  return (
    <CountdownFrame>
      <CountdownKicker>Realizada</CountdownKicker>
      <span
        className="mt-1.5 font-lacava text-3xl font-bold leading-none"
        style={{ color: LACAVA.marfil }}
      >
        {fmtFecha(evento.fechaEvento)}
      </span>
    </CountdownFrame>
  );
}

function KpiCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <article
      className="rounded-lg border bg-white p-6 shadow-sm"
      style={{ borderColor: LACAVA.borde }}
    >
      <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
        {label}
      </p>
      <p
        className="mt-2 font-lacava text-4xl font-bold leading-none"
        style={{ color: LACAVA.verde }}
      >
        {value}
      </p>
      {children}
    </article>
  );
}

function Card({
  title,
  subtitle,
  children,
  noPadding = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}) {
  return (
    <article
      className={`overflow-hidden rounded-lg border bg-white shadow-sm ${noPadding ? "" : "p-6"}`}
      style={{ borderColor: LACAVA.borde }}
    >
      <header className={noPadding ? "border-b px-6 py-4" : "mb-6"} style={noPadding ? { borderColor: LACAVA.borde } : undefined}>
        <h2 className="font-lacava text-xl font-bold" style={{ color: LACAVA.tinta }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 font-sans text-sm" style={{ color: LACAVA.tintaSuave }}>
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </article>
  );
}

function EdicionesTable({
  eventos,
  selectedId,
}: {
  eventos: LaCavaEvento[];
  selectedId: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse">
        <thead style={{ backgroundColor: LACAVA.crema }}>
          <tr className="border-b" style={{ borderColor: LACAVA.borde }}>
            <Th align="left">Edición</Th>
            <Th align="left">Fecha</Th>
            <Th align="left">Estado</Th>
            <Th align="right">Personas</Th>
            <Th align="right">Meta</Th>
            <Th align="right">Cortesías</Th>
            <Th align="right">Venta neta</Th>
            <Th align="right">Cargo servicio</Th>
            <Th align="right">Ticket promedio</Th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((e) => {
            const enVenta = e.diasParaEvento >= 0;
            const selected = e.eventoId === selectedId;
            return (
              <tr
                key={e.eventoId}
                className="border-b last:border-b-0"
                style={{
                  borderColor: LACAVA.borde,
                  backgroundColor: selected ? LACAVA.cremaClara : undefined,
                }}
              >
                <Td align="left">
                  <span className="font-medium">{e.nombre || e.eventoId}</span>
                  <span className="ml-2 font-sans text-xs" style={{ color: LACAVA.tintaSutil }}>
                    {e.eventoId}
                  </span>
                </Td>
                <Td align="left">{fmtFecha(e.fechaEvento)}</Td>
                <Td align="left">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 font-sans text-xs font-medium"
                    style={{ borderColor: LACAVA.borde, color: LACAVA.tinta }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: enVenta ? LACAVA.jumbo : LACAVA.tintaSutil,
                      }}
                    />
                    {enVenta ? "En venta" : "Realizada"}
                  </span>
                </Td>
                <Td align="right">{formatNumber(e.personas)}</Td>
                <Td align="right">
                  {e.goalTickets > 0
                    ? `${formatNumber(e.goalTickets)} (${Math.round((e.personas / e.goalTickets) * 100)}%)`
                    : "—"}
                </Td>
                <Td align="right">{formatNumber(e.cortesias)}</Td>
                <Td align="right">{formatCurrency(e.ventaNeta)}</Td>
                <Td align="right">{formatCurrency(e.cargoServicio)}</Td>
                <Td align="right">
                  {e.transacciones > 0
                    ? formatCurrency(e.ventaNeta / e.transacciones)
                    : "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <th
      className={`px-4 py-3 font-sans text-xs font-medium ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: LACAVA.tintaSuave }}
    >
      {children}
    </th>
  );
}

function Td({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <td
      className={`px-4 py-3 font-sans text-sm tabular-nums ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: LACAVA.tinta }}
    >
      {children}
    </td>
  );
}
