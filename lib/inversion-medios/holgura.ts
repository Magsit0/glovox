/**
 * Holgura y desvío del plan de paid media de UN evento, y el bloqueo de los
 * días pasados. Módulo CLIENT-SAFE (sin imports de servidor): lo usan el drill
 * para pintar y las server actions para validar.
 *
 * Por qué existe (2026-10-09): para saber cuánto le quedaba por repartir, el
 * equipo borraba el plan pasado y cargaba el gasto real hasta el día anterior.
 * Funcionaba para el día a día, pero el plan terminaba igual al real y el
 * cumplimiento siempre daba 100%: se perdía la vara para medir la
 * planificación. Ahora el plan de los días pasados no se reescribe y la vista
 * calcula dos cifras distintas:
 *  - DESVÍO = plan − real de los días cerrados (qué tan bien se planificó);
 *  - POR ASIGNAR = techo − real cerrado − plan pendiente (cuánto se puede
 *    sumar o hay que recortar de aquí al evento para cerrar en el techo).
 * Coinciden solo si el plan cubría el techo completo. En GRID KIKI 2 no: antes
 * del re-plan el plan sumaba $6.858 de un techo de $12.000.
 */

/** Hoy en hora de Santiago, `YYYY-MM-DD` (UTC voltearía el día a las ~20:00 locales). */
export function hoySantiago(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

/**
 * ¿El plan de este día está bloqueado? Por CALENDARIO, no por el mart: todo
 * día anterior a hoy (Santiago) se bloquea, porque nadie planifica un día que
 * ya pasó y su plan es la vara del desvío. Hoy y el futuro se editan. Solo
 * superadmin corrige días pasados (typos, cargas atrasadas).
 */
export function esDiaBloqueado(fecha: string, hoy: string, isSuperadmin: boolean): boolean {
  return !isSuperadmin && fecha < hoy;
}

export const MSG_DIA_BLOQUEADO =
  "Los días anteriores a hoy no se editan: su plan es la base para medir el desvío. Si hay que corregir uno, pídeselo a un superadmin.";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** `2026-10-08` → `08-oct`. */
export function fmtDiaMes(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  return `${fecha.slice(8, 10)}-${MESES[Number(fecha.slice(5, 7)) - 1]}`;
}

/** Días de `desde` a `hasta`, ambos incluidos (0 si `hasta` < `desde`). Aritmética UTC. */
export function diasEntre(desde: string, hasta: string): number {
  if (!desde || !hasta || hasta < desde) return 0;
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

export type DiaPlanReal = { fecha: string; plan: number; real: number };

export type Holgura = {
  /** Último día CERRADO del mart (ver getRealCorte). '' = sin dato. */
  corte: string;
  /** Plan y real de los días cerrados (fecha ≤ corte). */
  planCerrado: number;
  realCerrado: number;
  /** planCerrado − realCerrado. Negativo = se gastó más de lo planificado. */
  desvio: number;
  /** Plan de los días posteriores al corte: lo que ya está comprometido. */
  planPendiente: number;
  /** techo − realCerrado − planPendiente. null si el evento no tiene techo. */
  porAsignar: number | null;
  /** De hoy al último día del evento, ambos incluidos. 0 si el evento ya pasó. */
  diasRestantes: number;
  /** porAsignar ÷ diasRestantes. null sin techo o sin días por delante. */
  porDia: number | null;
  /** Plan y real ACUMULADOS día a día hasta el corte (gráfico del desvío). */
  acumulado: DiaPlanReal[];
};

export function calcHolgura(args: {
  totalDia: DiaPlanReal[];
  corte: string;
  hoy: string;
  /** Último día del evento (ultimoDiaEvento). '' si no tiene fecha. */
  ultimoDia: string;
  techo: number | null;
}): Holgura {
  const { totalDia, corte, hoy, ultimoDia, techo } = args;
  let planCerrado = 0;
  let realCerrado = 0;
  let planPendiente = 0;
  const acumulado: DiaPlanReal[] = [];
  for (const d of totalDia) {
    if (corte && d.fecha <= corte) {
      planCerrado += d.plan;
      realCerrado += d.real;
      acumulado.push({ fecha: d.fecha, plan: planCerrado, real: realCerrado });
    } else {
      planPendiente += d.plan;
    }
  }
  const porAsignar = techo != null ? techo - realCerrado - planPendiente : null;
  const diasRestantes = diasEntre(hoy, ultimoDia);
  return {
    corte,
    planCerrado,
    realCerrado,
    desvio: planCerrado - realCerrado,
    planPendiente,
    porAsignar,
    diasRestantes,
    porDia: porAsignar != null && diasRestantes > 0 ? porAsignar / diasRestantes : null,
    acumulado,
  };
}

export type CanalDesvio = { plataforma: string; label: string; plan: number; real: number; desvio: number };

/**
 * Desvío por canal en los días cerrados. Va por CANAL y no por tipo: parte del
 * plan histórico está cargado como "Sin tipo" y no cruza con el tipo del real.
 * Omite los canales sin plan ni gasto en esos días.
 */
export function desvioPorCanal(
  plataformas: { plataforma: string; label: string; dias: { fecha: string; plan: number | null; real: number | null }[] }[],
  corte: string,
): CanalDesvio[] {
  if (!corte) return [];
  const out: CanalDesvio[] = [];
  for (const p of plataformas) {
    let plan = 0;
    let real = 0;
    for (const c of p.dias) {
      if (c.fecha > corte) continue;
      plan += c.plan ?? 0;
      real += c.real ?? 0;
    }
    if (plan === 0 && real === 0) continue;
    out.push({ plataforma: p.plataforma, label: p.label, plan, real, desvio: plan - real });
  }
  return out;
}
