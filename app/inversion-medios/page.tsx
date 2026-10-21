import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getCategoriaEventos, getEventInfo } from "@/lib/queries/ticketing";
import { metasAbiertas, normDias, ultimoDiaEvento } from "@/lib/inversion-medios/evento";
import { puedeEjercer } from "@/lib/editores-capacidad";
import { anchoDesdeCookie, COL_CALENDARIO, COL_DRILL, type ColumnaNombre } from "@/lib/inversion-medios/col-nombre";
import { hoySantiago } from "@/lib/inversion-medios/holgura";
import { esIniciativaId } from "@/lib/inversion-medios/iniciativas";
import {
  buildDrillGrid,
  getAdsMetricasEvento,
  getBudgetPmMap,
  getCampanasRecientes,
  getCarddaConsumoMensual,
  getCarddaConsumoSemanal,
  getCarddaFeeMensual,
  getGcpGastoSemanal,
  getCargosExtra,
  getEtapas,
  getIniciativas,
  getPlanDiarioEvento,
  getPlanDiarioRango,
  getPlanExtent,
  getRealCorte,
  getRealDesgloseEvento,
  getRealDesgloseIniciativa,
  getRealDiarioEvento,
  getRealDiarioIniciativa,
  getRealDiarioRango,
  getRealExtentEvento,
  getRealExtentIniciativa,
  getRealMaxFecha,
  getRendimientoTicketsEvento,
  getSerieResultadoEvento,
  getSinEventoCampanasDiario,
  getTotalesEvento,
  getTotalesIniciativas,
  mergeGrid,
  type EventoMeta,
} from "@/lib/queries/inversion-medios";
import InversionMediosPanel from "./_components/InversionMediosPanel";
import EventoDrill from "./_components/EventoDrill";

export const dynamic = "force-dynamic";

/** Ancho guardado de una columna de nombres (cookie): leerlo en el servidor
 *  hace que el primer render ya salga con él, sin salto al hidratar. */
async function anchoColumna(col: ColumnaNombre): Promise<number> {
  return anchoDesdeCookie((await cookies()).get(col.cookie)?.value, col);
}

/** Primer día del mes de una fecha ISO. */
function mesInicio(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Último día del mes de una fecha ISO, corrido `meses` meses (0 = el mismo). */
function mesFin(iso: string, meses = 0): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m + meses, 0));
  return d.toISOString().slice(0, 10);
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
// Alfanumérico (GLO203) o numérico Fever (660905) — como en categoriaEvento.
const EVENTO_RE = /^([A-Z]{2,4}\d{2,4}|\d{5,6})$/;
// Filtro de país del calendario (categoriaEvento.Pais). Lo aplica el cliente;
// acá solo se valida el valor inicial que viene en la URL.
const PAISES = new Set(["CL", "PE"]);

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
  // Superadmin es el único que corrige el plan de días pasados (el resto los ve
  // bloqueados: son la vara del desvío). Las actions lo revalidan server-side.
  const isSuperadmin = session.user.role === "superadmin";
  const sp = await searchParams;

  const evento = typeof sp.evento === "string" ? sp.evento.toUpperCase() : "";

  // ---------- Modo drill (un evento o una iniciativa) ----------
  if (EVENTO_RE.test(evento)) {
    return esIniciativaId(evento) ? (
      <IniciativaDrillView iniciativaId={evento} canEdit={canEdit} isSuperadmin={isSuperadmin} />
    ) : (
      <DrillView
        eventoId={evento}
        canEdit={canEdit}
        isSuperadmin={isSuperadmin}
        userId={session.user.userId ?? null}
      />
    );
  }

  // ---------- Modo calendario libre ----------
  const hoy = hoySantiago();
  const [catalogo, planExtent, realMaxFecha, iniciativas] = await Promise.all([
    getCategoriaEventos("all"),
    getPlanExtent(),
    getRealMaxFecha(),
    getIniciativas(),
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

  // `sinEvento`: gasto por campaña sin evento. El cliente lo reparte entre las
  // iniciativas (campañas asignadas) y "No atribuido" (el resto).
  const [plan, real, sinEvento] = await Promise.all([
    getPlanDiarioRango(desde, hasta),
    getRealDiarioRango(desde, hasta),
    getSinEventoCampanasDiario(desde, hasta),
  ]);
  // El plan de las iniciativas vive en la misma tabla (evento_id = INI001…);
  // el filtro por catálogo de abajo lo deja fuera de las filas de evento.
  const iniIds = new Set(iniciativas.map((i) => i.id));
  const planIniciativas = plan.filter((p) => iniIds.has(p.eventoId));

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
    // `dias` viaja hasta la fila para que el calendario marque TODOS los días del
    // evento en ámbar, no solo el primero (Bocas Moradas dura 2, FDS 3, Yein
    // Fonda 4). Ver lib/inversion-medios/evento.ts.
    return { eventoId: id, nombre: c.nombre, fecha: c.fecha, dias: normDias(c.dias), pais: c.pais };
  });

  // `campanasRecientes` no depende del rango cargado: es "qué corre ahora",
  // anclado a la última fecha del mart.
  const [budgetPm, totales, cargos, carddaConsumo, carddaConsumoSem, carddaFee, campanasRecientes, gcpSemanal, totalesIniciativas] =
    await Promise.all([
      getBudgetPmMap(ids),
      getTotalesEvento(ids),
      getCargosExtra(),
      getCarddaConsumoMensual(),
      getCarddaConsumoSemanal(),
      getCarddaFeeMensual(),
      getCampanasRecientes(),
      getGcpGastoSemanal(),
      getTotalesIniciativas(iniciativas),
    ]);

  const grid = mergeGrid({ eventos, from: desde, to: hasta, plan, real, budgetPm });
  const paisParam = typeof sp.pais === "string" ? sp.pais.toUpperCase() : "";
  const anchoNombreInicial = await anchoColumna(COL_CALENDARIO);

  return (
    <InversionMediosPanel
      desde={desde}
      hasta={hasta}
      grid={grid}
      totales={Object.fromEntries(totales)}
      sinEvento={sinEvento}
      iniciativas={iniciativas}
      planIniciativas={planIniciativas}
      totalesIniciativas={totalesIniciativas}
      campanasRecientes={campanasRecientes}
      realMaxFecha={realMaxFecha}
      hoy={hoy}
      cargos={cargos}
      carddaConsumo={carddaConsumo}
      carddaConsumoSem={carddaConsumoSem}
      carddaFee={carddaFee}
      gcpSemanal={gcpSemanal}
      canEdit={canEdit}
      paisInicial={PAISES.has(paisParam) ? paisParam : ""}
      cargosInicial={sp.cargos === "1"}
      anchoNombreInicial={anchoNombreInicial}
    />
  );
}

/**
 * Drill de una INICIATIVA (Club Glovox, Now Mag…): el mismo editor de plan que
 * un evento, sin fecha de evento ni tickets. Su real son las campañas
 * asignadas; su techo, la suma de todo su plan.
 */
async function IniciativaDrillView({
  iniciativaId,
  canEdit,
  isSuperadmin,
}: {
  iniciativaId: string;
  canEdit: boolean;
  isSuperadmin: boolean;
}) {
  const [iniciativas, realMaxFecha, realCorte, anchoNombreInicial] = await Promise.all([
    getIniciativas(),
    getRealMaxFecha(),
    getRealCorte(),
    anchoColumna(COL_DRILL),
  ]);
  const ini = iniciativas.find((i) => i.id === iniciativaId);
  if (!ini) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-12 text-center">
          <p className="font-sans text-sm text-[var(--ink-subtle)]">
            La iniciativa {iniciativaId} no existe.
          </p>
        </div>
      </div>
    );
  }

  // Ventana: sin fecha de evento que la acote. Va del primer dato (o el inicio
  // del mes en curso) al último dato o, como mínimo, el fin del mes
  // subsiguiente — así siempre hay columnas para planificar hacia adelante,
  // porque una iniciativa se activa en cualquier momento.
  const hoy = hoySantiago();
  const [planAll, realExtent] = await Promise.all([
    getPlanDiarioEvento(iniciativaId),
    getRealExtentIniciativa(ini),
  ]);
  const fechas = [
    ...planAll.map((p) => p.fecha),
    realExtent?.min,
    realExtent?.max,
  ].filter((x): x is string => !!x).sort();
  const from = [fechas[0], mesInicio(hoy)].filter(Boolean).sort()[0];
  const to = [fechas[fechas.length - 1] ?? "", mesFin(hoy, 2)].sort().reverse()[0];

  const [real, etapas, desgloseRows] = await Promise.all([
    getRealDiarioIniciativa(ini, from, to),
    getEtapas(iniciativaId),
    getRealDesgloseIniciativa(ini, from, to),
  ]);
  const drill = buildDrillGrid({ from, to, plan: planAll, real });

  return (
    <EventoDrill
      modo="iniciativa"
      campanasAsignadas={ini.campanas.length}
      iniciativaArchivada={!ini.activa}
      eventoId={iniciativaId}
      nombre={ini.nombre}
      venue=""
      fechaEvento=""
      diasEvento={1}
      // Techo de una iniciativa = la suma de su plan (la ventana cubre todo).
      techoUsd={drill.totalPlan}
      drill={drill}
      planRows={planAll}
      realMaxFecha={realMaxFecha}
      corte={realCorte || realMaxFecha}
      hoy={hoy}
      // Archivada = solo lectura: las actions la rechazan igual (validarIniciativa).
      canEdit={canEdit && ini.activa}
      isSuperadmin={isSuperadmin}
      etapas={etapas}
      desgloseRows={desgloseRows}
      ads={null}
      tickets={null}
      serieResultado={[]}
      anchoNombreInicial={anchoNombreInicial}
    />
  );
}

async function DrillView({
  eventoId,
  canEdit,
  isSuperadmin,
  userId,
}: {
  eventoId: string;
  canEdit: boolean;
  isSuperadmin: boolean;
  userId: string | null;
}) {
  const [info, realMaxFecha, realCorte, anchoNombreInicial, editorMetas] = await Promise.all([
    getEventInfo(eventoId),
    getRealMaxFecha(),
    getRealCorte(),
    anchoColumna(COL_DRILL),
    puedeEjercer("metas-evento", userId).catch(() => false),
  ]);
  if (!info) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-10 sm:px-8">
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-12 text-center">
          <p className="font-sans text-sm text-[var(--ink-subtle)]">
            El evento {eventoId} no existe en categoriaEvento.
          </p>
        </div>
      </div>
    );
  }

  // Ventana del calendario del evento:
  //  - LÍMITE SUPERIOR = el ÚLTIMO día del evento (categoriaEvento.Fecha +
  //    `dias` - 1), SIEMPRE (haya o no plan/gasto). Se extiende más allá SOLO si
  //    hay plan o gasto pasada esa fecha. Sin fecha declarada, cae al último
  //    dato / hoy.
  //    ⚠️ Antes el límite era la Fecha PELADA, o sea el PRIMER día. En un evento
  //    multi-día futuro eso dejaba los días 2..n SIN COLUMNA y no se podía ni
  //    planificar: GLO207 (Bocas Moradas 10, 2026-09-05, `dias`=2) no tenía el
  //    06-09. En los pasados la columna existía solo por accidente, porque había
  //    gasto ese día y `dataMax` estiraba la ventana.
  //  - LÍMITE INFERIOR = inicio de venta o primer dato; si no hay nada, hoy
  //    (así el calendario va de hoy → fecha del evento aunque esté vacío).
  const hoy = hoySantiago();
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

  let to = ultimoDiaEvento(info.fechaEvento, info.dias) || dataMax || hoy;
  if (dataMax && dataMax > to) to = dataMax; // plan/gasto pasada la fecha → extiende
  let from = info.fechaInicioVenta || dataMin || hoy;
  if (dataMin && dataMin < from) from = dataMin;
  if (from > to) from = to; // evento pasado sin datos → colapsa a su fecha

  // Las tres queries de rendimiento entran en esta MISMA ola y con la MISMA
  // ventana [from, to] que el gasto: así `ads.gastoUsd` reconcilia al centavo
  // con el stat "Invertido (real)" (verificado en 10 eventos) y los conteos de
  // ticket no quedan con un scope distinto del dinero. Latencia medida en el
  // peor caso (GLO198, 370 columnas): 637-973 ms, por debajo de la query más
  // lenta de la ola, así que no necesita Suspense propio.
  const [real, budgetPm, etapas, desgloseRows, ads, tickets, serieResultado] =
    await Promise.all([
      getRealDiarioEvento(eventoId, from, to),
      getBudgetPmMap([eventoId]),
      getEtapas(eventoId),
      getRealDesgloseEvento(eventoId, from, to),
      getAdsMetricasEvento(eventoId, from, to),
      getRendimientoTicketsEvento(eventoId, from, to),
      getSerieResultadoEvento(eventoId, from, to),
    ]);
  // Lápiz de metas: editor de `metas-evento` o superadmin (lectura fresca de la base) y
  // evento abierto. La hoja NO se lee acá: el input la lee al abrirse
  // (leerMetaEventoAction), así un render del drill no gasta cuota de Sheets.
  const editarMetas = editorMetas && metasAbiertas(info.fechaEvento, info.dias, hoy);

  const planVentana = planAll.filter((p) => p.fecha >= from && p.fecha <= to);
  const drill = buildDrillGrid({ from, to, plan: planVentana, real });

  return (
    <EventoDrill
      eventoId={eventoId}
      nombre={info.nombre}
      venue={info.venue}
      fechaEvento={info.fechaEvento}
      diasEvento={normDias(info.dias)}
      techoUsd={budgetPm.get(eventoId) ?? null}
      drill={drill}
      planRows={planVentana}
      realMaxFecha={realMaxFecha}
      corte={realCorte || realMaxFecha}
      hoy={hoy}
      canEdit={canEdit}
      isSuperadmin={isSuperadmin}
      etapas={etapas}
      desgloseRows={desgloseRows}
      ads={ads}
      tickets={tickets}
      serieResultado={serieResultado}
      anchoNombreInicial={anchoNombreInicial}
      editarMetas={editarMetas}
    />
  );
}
