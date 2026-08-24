import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getCategoriaEventos, getEventInfo } from "@/lib/queries/ticketing";
import {
  buildDrillGrid,
  getBudgetPmMap,
  getCarddaConsumoMensual,
  getCarddaConsumoSemanal,
  getCarddaFeeMensual,
  getCargosExtra,
  getEtapas,
  getNoAtribuidoCampanasDiario,
  getNoAtribuidoDiario,
  getPlanDiarioEvento,
  getPlanDiarioRango,
  getPlanExtent,
  getRealDesgloseEvento,
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
  // necesita grant. VER y EDITAR van con el MISMO grant — no hay perfil aparte.
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!canAccessPath(session.user.permissions ?? [], "/inversion-medios")) {
    redirect("/?unauthorized=1");
  }
  // El grant que abre el panel también habilita la edición del plan: este es el
  // tablero de trabajo del líder de Paid Media, y el acceso ya está acotado por
  // el grant. Cada Server Action revalida el mismo grant server-side.
  const canEdit = true;
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

  const [plan, real, noAtribuido, noAtribuidoCampanas] = await Promise.all([
    getPlanDiarioRango(desde, hasta),
    getRealDiarioRango(desde, hasta),
    getNoAtribuidoDiario(desde, hasta),
    getNoAtribuidoCampanasDiario(desde, hasta),
  ]);

  // Filas del calendario: eventos de la tabla madre con plan y/o gasto en el
  // rango cargado, MÁS todos los eventos futuros del catálogo dentro del rango
  // aunque aún no tengan nada — aparecer con plan $0 es la alerta de que falta
  // cargar el presupuesto diario. La visibilidad FINA (según el tramo que se
  // está mirando) la resuelve el cliente al hacer scroll.
  const proximos = catalogo
    .filter((e) => e.fecha && e.fecha >= hoy && e.fecha >= desde && e.fecha <= hasta)
    .map((e) => e.eventoId);
  const ids = Array.from(
    new Set([
      ...plan.map((p) => p.eventoId),
      ...real.map((r) => r.eventoId),
      ...proximos,
    ]),
  ).filter((id) => catalogoById.has(id));

  const eventos: EventoMeta[] = ids.map((id) => {
    const c = catalogoById.get(id)!;
    return { eventoId: id, nombre: c.nombre, fecha: c.fecha };
  });

  const [budgetPm, totales, cargos, carddaConsumo, carddaConsumoSem, carddaFee] =
    await Promise.all([
      getBudgetPmMap(ids),
      getTotalesEvento(ids),
      getCargosExtra(),
      getCarddaConsumoMensual(),
      getCarddaConsumoSemanal(),
      getCarddaFeeMensual(),
    ]);

  const grid = mergeGrid({ eventos, from: desde, to: hasta, plan, real, budgetPm });

  return (
    <InversionMediosPanel
      desde={desde}
      hasta={hasta}
      grid={grid}
      totales={Object.fromEntries(totales)}
      noAtribuido={noAtribuido}
      noAtribuidoCampanas={noAtribuidoCampanas}
      realMaxFecha={realMaxFecha}
      hoy={hoy}
      cargos={cargos}
      carddaConsumo={carddaConsumo}
      carddaConsumoSem={carddaConsumoSem}
      carddaFee={carddaFee}
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
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-12 text-center">
          <p className="font-sans text-sm text-[#999999]">
            El evento {eventoId} no existe en categoriaEvento.
          </p>
        </div>
      </div>
    );
  }

  // Ventana del calendario del evento:
  //  - LÍMITE SUPERIOR = la fecha declarada del evento (categoriaEvento.Fecha),
  //    SIEMPRE (haya o no plan/gasto). Se extiende más allá SOLO si hay plan o
  //    gasto pasada esa fecha. Sin fecha declarada, cae al último dato / hoy.
  //  - LÍMITE INFERIOR = inicio de venta o primer dato; si no hay nada, hoy
  //    (así el calendario va de hoy → fecha del evento aunque esté vacío).
  const hoy = hoyISO();
  const [planAll, realExtent] = await Promise.all([
    getPlanDiarioEvento(eventoId),
    getRealExtentEvento(eventoId),
  ]);
  const planFechas = planAll.map((p) => p.fecha).sort();
  const orden = (arr: (string | undefined)[]) => arr.filter((x): x is string => !!x).sort();
  const mins = orden([planFechas[0], realExtent?.min]);
  const maxs = orden([planFechas[planFechas.length - 1], realExtent?.max]);
  const dataMin = mins[0];
  const dataMax = maxs[maxs.length - 1];

  let to = info.fechaEvento || dataMax || hoy;
  if (dataMax && dataMax > to) to = dataMax; // plan/gasto pasada la fecha → extiende
  let from = info.fechaInicioVenta || dataMin || hoy;
  if (dataMin && dataMin < from) from = dataMin;
  if (from > to) from = to; // evento pasado sin datos → colapsa a su fecha

  const [real, budgetPm, etapas, desgloseRows] = await Promise.all([
    getRealDiarioEvento(eventoId, from, to),
    getBudgetPmMap([eventoId]),
    getEtapas(eventoId),
    getRealDesgloseEvento(eventoId, from, to),
  ]);

  const planVentana = planAll.filter((p) => p.fecha >= from && p.fecha <= to);
  const drill = buildDrillGrid({ from, to, plan: planVentana, real });

  return (
    <EventoDrill
      eventoId={eventoId}
      nombre={info.nombre}
      venue={info.venue}
      fechaEvento={info.fechaEvento}
      techoUsd={budgetPm.get(eventoId) ?? null}
      drill={drill}
      planRows={planVentana}
      realMaxFecha={realMaxFecha}
      hoy={hoy}
      canEdit={canEdit}
      etapas={etapas}
      desgloseRows={desgloseRows}
    />
  );
}
