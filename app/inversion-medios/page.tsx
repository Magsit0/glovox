import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getCategoriaEventos, getEventInfo } from "@/lib/queries/ticketing";
import {
  buildDrillGrid,
  getBudgetPmMap,
  getNoAtribuidoDiario,
  getPlanDiarioEvento,
  getPlanDiarioRango,
  getPlanExtent,
  getRealDiarioEvento,
  getRealDiarioRango,
  getRealExtentEvento,
  getRealMaxFecha,
  getTotalesEvento,
  mergeGrid,
  type EventoMeta,
} from "@/lib/queries/inversion-medios";
import InversionMediosPanel from "./_components/InversionMediosPanel";
import EventoDrill from "./_components/EventoDrill";

export const dynamic = "force-dynamic";

/** Hoy en hora de Santiago (UTC voltearía el día a las ~20:00 locales). */
function hoyISO(): string {
  // en-CA formatea YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(
    new Date(),
  );
}

/** Primer día del mes de una fecha ISO. */
function mesInicio(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Último día del mes de una fecha ISO. */
function mesFin(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${iso.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
// Alfanumérico (GLO203) o numérico Fever (660905) — como en categoriaEvento.
const EVENTO_RE = /^([A-Z]{2,4}\d{2,4}|\d{5,6})$/;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function InversionMediosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Acceso por permiso de dashboard (no rol): superadmin ve todo; el resto
  // necesita grant. La EDICIÓN sigue siendo superadmin-only (in-action).
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!canAccessPath(session.user.permissions ?? [], "/inversion-medios")) {
    redirect("/?unauthorized=1");
  }
  // La edición es superadmin-only (igual que las actions). Un usuario con grant
  // pero sin rol ve el panel en READ-ONLY (sin inputs ni "rellenar rango").
  const canEdit = (session.user.role ?? "user") === "superadmin";
  const sp = await searchParams;

  const evento = typeof sp.evento === "string" ? sp.evento.toUpperCase() : "";

  // ---------- Modo drill (un evento) ----------
  if (EVENTO_RE.test(evento)) {
    return <DrillView eventoId={evento} canEdit={canEdit} />;
  }

  // ---------- Modo calendario libre ----------
  const hoy = hoyISO();
  const [catalogo, planExtent, realMaxFecha] = await Promise.all([
    getCategoriaEventos("all"),
    getPlanExtent(),
    getRealMaxFecha(),
  ]);

  // Rango por defecto: cubre todo el plan cargado, el mes actual y las fechas
  // de los eventos futuros del catálogo. El usuario lo extiende libremente por
  // los bordes (?desde / ?hasta, granularidad mes).
  const maxFechaEvento = catalogo.reduce(
    (acc, e) => (e.fecha && e.fecha >= hoy && e.fecha > acc ? e.fecha : acc),
    "",
  );
  let desde =
    typeof sp.desde === "string" && FECHA_RE.test(sp.desde)
      ? sp.desde
      : mesInicio(planExtent && planExtent.min < hoy ? planExtent.min : hoy);
  let hasta =
    typeof sp.hasta === "string" && FECHA_RE.test(sp.hasta)
      ? sp.hasta
      : mesFin(
          [planExtent?.max ?? "", maxFechaEvento, hoy].reduce((a, b) =>
            b > a ? b : a,
          ),
        );
  if (desde > hasta) [desde, hasta] = [hasta, desde];

  const catalogoById = new Map(catalogo.map((e) => [e.eventoId, e]));

  const [plan, real, noAtribuido] = await Promise.all([
    getPlanDiarioRango(desde, hasta),
    getRealDiarioRango(desde, hasta),
    getNoAtribuidoDiario(desde, hasta),
  ]);

  // Filas del calendario: eventos de la tabla madre con plan y/o gasto en el
  // rango cargado. La visibilidad FINA (según el tramo que se está mirando) la
  // resuelve el cliente al hacer scroll.
  const ids = Array.from(
    new Set([...plan.map((p) => p.eventoId), ...real.map((r) => r.eventoId)]),
  ).filter((id) => catalogoById.has(id));

  const eventos: EventoMeta[] = ids.map((id) => {
    const c = catalogoById.get(id)!;
    return { eventoId: id, nombre: c.nombre, fecha: c.fecha };
  });

  const [budgetPm, totales] = await Promise.all([
    getBudgetPmMap(ids),
    getTotalesEvento(ids),
  ]);

  const grid = mergeGrid({ eventos, from: desde, to: hasta, plan, real, budgetPm });

  // Eventos del catálogo sin fila todavía (picker para empezar a planificarlos).
  const enGrid = new Set(ids);
  const disponibles = catalogo
    .filter((e) => !enGrid.has(e.eventoId))
    .map((e) => ({ eventoId: e.eventoId, nombre: e.nombre, fecha: e.fecha }));

  return (
    <InversionMediosPanel
      desde={desde}
      hasta={hasta}
      grid={grid}
      totales={Object.fromEntries(totales)}
      noAtribuido={noAtribuido}
      disponibles={disponibles}
      realMaxFecha={realMaxFecha}
      hoy={hoy}
      canEdit={canEdit}
    />
  );
}

async function DrillView({ eventoId, canEdit }: { eventoId: string; canEdit: boolean }) {
  const [info, realMaxFecha] = await Promise.all([
    getEventInfo(eventoId),
    getRealMaxFecha(),
  ]);
  if (!info) {
    return (
      <div className="rounded-lg border border-[#E5E5E5] bg-white p-12 text-center">
        <p className="font-sans text-sm text-[#999999]">
          El evento {eventoId} no existe en categoriaEvento.
        </p>
      </div>
    );
  }

  // Ventana del evento: inicio de venta → fecha del evento, expandida por lo
  // que exista FUERA de esa heurística tanto en plan como en gasto real (si no,
  // los totales del drill no cuadrarían con el header de la grilla).
  const hoy = hoyISO();
  const [planAll, realExtent] = await Promise.all([
    getPlanDiarioEvento(eventoId),
    getRealExtentEvento(eventoId),
  ]);
  const fechas = planAll.map((p) => p.fecha).sort();
  let from = info.fechaInicioVenta || info.fechaEvento || hoy;
  let to = info.fechaEvento || hoy;
  if (fechas.length > 0) {
    if (fechas[0] < from) from = fechas[0];
    if (fechas[fechas.length - 1] > to) to = fechas[fechas.length - 1];
  }
  if (realExtent) {
    if (realExtent.min < from) from = realExtent.min;
    if (realExtent.max > to) to = realExtent.max;
  }
  if (to < hoy && !info.fechaEvento) to = hoy;
  if (from > to) [from, to] = [to, from];

  const [real, budgetPm] = await Promise.all([
    getRealDiarioEvento(eventoId, from, to),
    getBudgetPmMap([eventoId]),
  ]);

  const drill = buildDrillGrid({
    from,
    to,
    plan: planAll.filter((p) => p.fecha >= from && p.fecha <= to),
    real,
  });

  return (
    <EventoDrill
      eventoId={eventoId}
      nombre={info.nombre}
      venue={info.venue}
      fechaEvento={info.fechaEvento}
      techoUsd={budgetPm.get(eventoId) ?? null}
      drill={drill}
      from={from}
      to={to}
      realMaxFecha={realMaxFecha}
      hoy={hoy}
      canEdit={canEdit}
    />
  );
}
