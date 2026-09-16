/**
 * Proyección de venta al día del evento para La Cava (`/lacava`).
 *
 * Modelo "base cierta + cola comparable":
 *
 *   Final = Vendido hoy (dato) + Cola proyectada (días restantes)
 *
 * La cola se modela con el comportamiento de los eventos comparables (las 10
 * ediciones de Bocas Moradas, CategoriaEvento='FBM', más las ediciones
 * cerradas de La Cava): ferias de vino cuya demanda es fuertemente
 * back-loaded — la mediana vende ~25% del total a 21 días, ~53% a 7 días y
 * ~7% el mismo día del evento, con cero venta posterior.
 *
 * Por eso NO se extrapola el ritmo diario reciente (proyectaría el "valle"
 * entre la preventa y el ramp-up final) ni se aplica el perfil por ratio
 * directo (la preventa barata de 2026 adelantó demanda que los comparables no
 * tenían adelantada, y el ratio explota).
 *
 * Componentes:
 *  - FORMA de la cola: share diario mediano (venta del día / total del
 *    evento) de los comparables cuya venta estaba abierta ese día relativo,
 *    con un ajuste suave de día de semana (renormalizado: solo redistribuye,
 *    no cambia el total).
 *  - TAMAÑO de la cola: ancla = total de la última edición cerrada de La
 *    Cava, ajustada por jornadas nuevas (2026 agrega el domingo) y por el
 *    factor de escenario (canibalización de la preventa / momentum).
 *  - TRACKING: el ritmo observado de los últimos 14 días se compara con lo
 *    que el escenario realista predijo para esos mismos días; el ratio,
 *    amortiguado y ponderado por cuánta señal había, corrige los tres
 *    escenarios. Con poca señal (lejos del evento) el factor tiende a 1.
 *
 * Módulo puro (sin IO) para que el cálculo sea verificable sin BigQuery.
 * El backtest vive en `scripts/lacava-backtest-proyeccion.ts`.
 */
import type { CurvaRow } from "@/lib/queries/curvas";
import type { LaCavaTipoRow } from "@/lib/queries/lacava";

// ---------- Parámetros del modelo ----------

export type EscenarioKey = "pesimista" | "realista" | "optimista";

/**
 * Factor de escenario sobre el ancla. Racional:
 *  - realista 0,85: canibalización moderada (~15% de la cola ya se adelantó
 *    a la preventa barata).
 *  - pesimista 0,50 / optimista 1,35: anchos calibrados con el backtest sobre
 *    la cadena Bocas Moradas (scripts/lacava-backtest-proyeccion.ts): una
 *    edición varía mucho contra la anterior (hasta ×2,8 en un outlier), y con
 *    bandas más angostas la cobertura empírica caía bajo el 50%. Con estas,
 *    la banda cubre 86% de los casos a d-14 y d-7 (el único que queda fuera
 *    es el outlier ×2,8), y el realista tiene error mediano 19% a d-21, 16% a
 *    d-14 y 11% a d-7. Lejos del evento (d-30+) manda el ancla y el error es
 *    mayor (~34%) — por diseño el modelo gana confianza al acercarse.
 * El tracking corrige los tres factores a medida que entra venta real.
 */
export const ESCENARIOS: readonly {
  key: EscenarioKey;
  label: string;
  factor: number;
}[] = [
  { key: "pesimista", label: "Pesimista", factor: 0.5 },
  { key: "realista", label: "Realista", factor: 0.85 },
  { key: "optimista", label: "Optimista", factor: 1.35 },
] as const;

/** Ventana del tracking: días observados que se comparan contra el modelo. */
const TRACKING_VENTANA = 14;
/** Amortiguación del ratio del tracking (exponente; 1 = sin amortiguar). */
const TRACKING_ALPHA = 0.5;
/** Personas esperadas en la ventana para confianza plena del tracking. */
const TRACKING_UMBRAL = 150;
const TRACKING_MIN = 0.5;
const TRACKING_MAX = 1.6;

/** Ventana (días antes del evento) para estimar el efecto día-de-semana. */
const DOW_DESDE = 28;
const DOW_HASTA = 1;

/** Mínimo de comparables cerrados para que la proyección tenga sustento. */
const MIN_COMPARABLES = 3;

/**
 * Mínimo de comparables con venta abierta en un día relativo para que ese día
 * cuente en el tracking. Lejos del evento suele haber 1 solo comparable de
 * ventana larga: una "expectativa" basada en un evento no es recalibración,
 * es ruido (y la cola de la preventa del objetivo la infla).
 */
const MIN_COMPARABLES_TRACKING = 3;

// ---------- Tipos ----------

export type EscenarioProyeccion = {
  key: EscenarioKey;
  label: string;
  /** Factor de escenario (sin tracking) sobre el ancla ajustada. */
  factor: number;
  colaPersonas: number;
  finalPersonas: number;
  /** CLP: venta actual + cola × ticket promedio reciente. */
  finalVenta: number;
  /** % de la meta (null si el evento no tiene meta). */
  pctMeta: number | null;
};

export type PuntoProyeccion = {
  fecha: string; // YYYY-MM-DD
  dias: number; // días de anticipación (positivo antes del evento)
  realAcum: number | null;
  realista: number | null;
  /** [pesimista, optimista] para el área de banda. */
  banda: [number, number] | null;
};

export type TrackingInfo = {
  ventanaDias: number;
  observado: number;
  /** Personas que el realista (pre-tracking) esperaba en la ventana. */
  esperado: number;
  /** observado / esperado, sin amortiguar. null = sin señal. */
  ratio: number | null;
  /** Factor efectivamente aplicado a los tres escenarios. */
  factorAplicado: number;
  /** 0..1 — cuánta señal había (esperado vs umbral). */
  confianza: number;
};

export type Proyeccion =
  | { disponible: false; motivo: string }
  | {
      disponible: true;
      /** Personas ya vendidas (la parte cierta). */
      base: number;
      /** CLP ya vendidos. */
      ventaBase: number;
      diasRestantes: number;
      comparables: number;
      anchorTotal: number;
      factorJornadas: number;
      /** CLP por persona usado para proyectar la recaudación de la cola. */
      ticketPromedioCola: number;
      tracking: TrackingInfo;
      escenarios: EscenarioProyeccion[];
      puntos: PuntoProyeccion[];
    };

export type BuildProyeccionInput = {
  /** Venta diaria del evento objetivo (grano evento × día relativo). */
  targetRows: CurvaRow[];
  /** Venta diaria de los comparables (FBM + otras ediciones JUMBO). */
  comparableRows: CurvaRow[];
  /** YYYY-MM-DD del evento objetivo. */
  fechaEvento: string;
  /** Personas de la última edición cerrada de La Cava (el ancla). */
  anchorTotal: number;
  /** Ajuste por jornadas nuevas (ver `factorJornadasDesdeTipos`). */
  factorJornadas: number;
  goalTickets?: number;
  /**
   * Solo backtest: simula que "hoy" es este día relativo — trunca la venta
   * observada del objetivo a `dias >= congelarEnDia`.
   */
  congelarEnDia?: number;
};

// ---------- Helpers ----------

type Curve = {
  daily: Map<number, number>; // dias → personas
  venta: Map<number, number>; // dias → CLP
  total: number;
  primerDia: number; // mayor `dias` con venta (apertura)
  diasHoy: number;
};

function buildCurves(rows: CurvaRow[]): Map<string, Curve> {
  const curves = new Map<string, Curve>();
  for (const r of rows) {
    let c = curves.get(r.eventoId);
    if (!c) {
      c = { daily: new Map(), venta: new Map(), total: 0, primerDia: r.dias, diasHoy: r.diasHoy };
      curves.set(r.eventoId, c);
    }
    c.daily.set(r.dias, (c.daily.get(r.dias) ?? 0) + r.personas);
    c.venta.set(r.dias, (c.venta.get(r.dias) ?? 0) + r.venta);
    c.total += r.personas;
    c.primerDia = Math.max(c.primerDia, r.dias);
  }
  return curves;
}

function mediana(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Suma `delta` días a una fecha YYYY-MM-DD (aritmética UTC, sin TZ). */
function addDias(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

/** Día de la semana (0=domingo … 6=sábado) de una fecha YYYY-MM-DD. */
function dow(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Comparables con venta abierta en el día relativo `d`. */
function abiertosEnDia(comparables: Curve[], d: number): Curve[] {
  return comparables.filter((c) => c.primerDia >= d);
}

/**
 * Forma de la curva: share diario mediano de los comparables abiertos en cada
 * día relativo, NORMALIZADO para que la suma sobre todo el horizonte sea 1.
 *
 * La normalización importa: los comparables de ventana corta (Bocas Moradas
 * abre a ~25 días) concentran su 100% cerca del evento, y los de ventana
 * larga (La Cava) lo reparten. La mediana por día mezcla ambos perfiles y su
 * suma cruda supera 1 (~1,15), lo que inflaría la cola. Normalizada, shape(d)
 * se lee como "fracción del total que un comparable típico vende el día d".
 *
 * Devuelve un arreglo indexado por día relativo (0..horizonte).
 */
function shapeNormalizada(comparables: Curve[]): number[] {
  const horizonte = Math.max(...comparables.map((c) => c.primerDia));
  const raw: number[] = new Array(horizonte + 1).fill(0);
  for (let d = 0; d <= horizonte; d++) {
    const shares = abiertosEnDia(comparables, d).map(
      (c) => (c.daily.get(d) ?? 0) / c.total,
    );
    raw[d] = mediana(shares);
  }
  const suma = raw.reduce((a, b) => a + b, 0);
  return suma > 0 ? raw.map((v) => v / suma) : raw;
}

/**
 * Multiplicadores por día de semana (0..6), estimados de la venta de los
 * comparables en su ventana activa [DOW_HASTA..DOW_DESDE] y amortiguados con
 * raíz cuadrada para no sobreajustar. Promedio ≈ 1; solo redistribuyen.
 */
function multiplicadoresDow(
  comparables: Curve[],
  fechaEventoPorCurva: Map<Curve, string>,
): number[] {
  const porDow = new Array(7).fill(0);
  let total = 0;
  for (const c of comparables) {
    const fecha = fechaEventoPorCurva.get(c);
    if (!fecha) continue;
    for (let d = DOW_HASTA; d <= DOW_DESDE; d++) {
      const v = c.daily.get(d) ?? 0;
      if (v <= 0) continue;
      porDow[dow(addDias(fecha, -d))] += v;
      total += v;
    }
  }
  if (total <= 0) return new Array(7).fill(1);
  // Cada día de la ventana [1..28] aporta su dow exactamente 4 veces, así que
  // el peso esperado por dow es 1/7 y el multiplicador crudo es share × 7.
  return porDow.map((v) => Math.sqrt(((v / total) * 7) || 1));
}

/**
 * Ajuste por jornadas nuevas: si la edición objetivo tiene más días de evento
 * que el ancla (2026 agrega el domingo), el ancla subestima el total. Se
 * asume que las jornadas nuevas son las de menor venta actual, y se infla el
 * ancla por 1/(1 − share de esas jornadas). Acotado a [1, 1.5].
 */
export function factorJornadasDesdeTipos(
  tiposTarget: LaCavaTipoRow[],
  tiposAnchor: LaCavaTipoRow[],
): number {
  const ventasPorDia = (tipos: LaCavaTipoRow[]) => {
    const map = new Map<string, number>();
    for (const t of tipos) {
      if (t.clase !== "VENTA") continue;
      map.set(t.diaEvento, (map.get(t.diaEvento) ?? 0) + t.personas);
    }
    return map;
  };
  const target = ventasPorDia(tiposTarget);
  const anchor = ventasPorDia(tiposAnchor);
  const nuevas = target.size - anchor.size;
  if (nuevas <= 0) return 1;

  const total = [...target.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return 1;
  const shareNuevas = [...target.values()]
    .sort((a, b) => a - b)
    .slice(0, nuevas)
    .reduce((a, b) => a + b, 0) / total;
  if (shareNuevas >= 1) return 1;
  return clamp(1 / (1 - shareNuevas), 1, 1.5);
}

// ---------- Modelo ----------

export function buildProyeccion(input: BuildProyeccionInput): Proyeccion {
  const {
    fechaEvento,
    anchorTotal,
    factorJornadas,
    goalTickets,
    congelarEnDia,
  } = input;

  if (input.targetRows.length === 0) {
    return { disponible: false, motivo: "El evento no tiene ventas registradas." };
  }
  if (anchorTotal <= 0) {
    return { disponible: false, motivo: "No hay una edición anterior cerrada que sirva de ancla." };
  }

  // "Hoy" del objetivo: real, o simulado en el backtest.
  const diasHoyReal = input.targetRows[0].diasHoy;
  const diasHoy = congelarEnDia ?? diasHoyReal;
  if (diasHoy < 0) {
    return { disponible: false, motivo: "El evento ya se realizó: no hay nada que proyectar." };
  }
  const targetRows =
    congelarEnDia == null
      ? input.targetRows
      : input.targetRows.filter((r) => r.dias >= congelarEnDia);

  const target = buildCurves(targetRows).get(input.targetRows[0].eventoId);
  if (!target || target.total <= 0) {
    return { disponible: false, motivo: "El evento no tiene ventas registradas." };
  }

  // Comparables: solo eventos con venta cerrada (su curva completa es la
  // evidencia). Su fecha de evento se reconstruye desde diasHoy, que BigQuery
  // calcula contra CURRENT_DATE: fecha = hoy_real + diasHoy_c.
  const hoyReal = addDias(fechaEvento, -diasHoyReal);
  const curvasComparables = [...buildCurves(input.comparableRows).values()].filter(
    (c) => c.diasHoy < 0 && c.total > 0,
  );
  if (curvasComparables.length < MIN_COMPARABLES) {
    return {
      disponible: false,
      motivo: `Se necesitan al menos ${MIN_COMPARABLES} eventos comparables cerrados.`,
    };
  }
  const fechaPorCurva = new Map(
    curvasComparables.map((c) => [c, addDias(hoyReal, c.diasHoy)]),
  );

  const mDow = multiplicadoresDow(curvasComparables, fechaPorCurva);
  const shape = shapeNormalizada(curvasComparables);
  const shapeEn = (d: number) => shape[d] ?? 0;

  // Escala pre-tracking de cada escenario: "total equivalente" del evento si
  // se comportara como un comparable típico.
  const ePre = new Map<EscenarioKey, number>(
    ESCENARIOS.map((e) => [e.key, anchorTotal * factorJornadas * e.factor]),
  );

  // ----- Tracking: observado vs esperado (realista) en los últimos 14 días.
  // Se excluye hoy (día parcial), los días previos a la apertura de venta y
  // los días donde menos de MIN_COMPARABLES_TRACKING comparables tenían venta
  // abierta (sin expectativa confiable no hay recalibración — esto además
  // deja fuera la cola de la preventa temprana, que no es comparable).
  const eRealista = ePre.get("realista") ?? 0;
  let observado = 0;
  let esperado = 0;
  for (let d = diasHoy + 1; d <= diasHoy + TRACKING_VENTANA; d++) {
    if (d > target.primerDia) break;
    if (abiertosEnDia(curvasComparables, d).length < MIN_COMPARABLES_TRACKING)
      continue;
    observado += target.daily.get(d) ?? 0;
    esperado += shapeEn(d) * eRealista;
  }
  const confianza = clamp(esperado / TRACKING_UMBRAL, 0, 1);
  const ratio = esperado > 0 ? observado / esperado : null;
  const factorTracking =
    ratio == null || ratio <= 0
      ? 1
      : clamp(Math.pow(ratio, TRACKING_ALPHA * confianza), TRACKING_MIN, TRACKING_MAX);
  const tracking: TrackingInfo = {
    ventanaDias: TRACKING_VENTANA,
    observado: Math.round(observado),
    esperado: Math.round(esperado),
    ratio,
    factorAplicado: factorTracking,
    confianza,
  };

  // ----- Cola diaria por escenario, días diasHoy-1 → 0 (el día del evento
  // incluido: los comparables venden ~5-11% del total ese mismo día).
  const diasCola: number[] = [];
  for (let d = diasHoy - 1; d >= 0; d--) diasCola.push(d);

  const shareCola = diasCola.map((d) => shapeEn(d));
  // Ajuste dow renormalizado: redistribuye dentro de la ventana sin cambiar
  // el total (el tamaño lo deciden ancla + escenario + tracking).
  const ajusteDow = diasCola.map((d, i) => shareCola[i] * mDow[dow(addDias(fechaEvento, -d))]);
  const sumShare = shareCola.reduce((a, b) => a + b, 0);
  const sumAjuste = ajusteDow.reduce((a, b) => a + b, 0);
  const reescala = sumAjuste > 0 ? sumShare / sumAjuste : 1;

  const colaDiaria = new Map<EscenarioKey, number[]>();
  for (const esc of ESCENARIOS) {
    const e = (ePre.get(esc.key) ?? 0) * factorTracking;
    colaDiaria.set(esc.key, ajusteDow.map((a) => a * reescala * e));
  }

  // ----- Ticket promedio para proyectar recaudación: el mix de precios de
  // los últimos 14 días observados (refleja el tramo de preventa vigente).
  // La cola se venderá a tramos iguales o más caros, así que es conservador.
  let ventaReciente = 0;
  let personasRecientes = 0;
  for (let d = diasHoy; d <= diasHoy + TRACKING_VENTANA; d++) {
    ventaReciente += target.venta.get(d) ?? 0;
    personasRecientes += target.daily.get(d) ?? 0;
  }
  const ventaBase = [...target.venta.values()].reduce((a, b) => a + b, 0);
  const ticketPromedioCola =
    personasRecientes > 0 ? ventaReciente / personasRecientes : ventaBase / target.total;

  // ----- Escenarios finales.
  const escenarios: EscenarioProyeccion[] = ESCENARIOS.map((esc) => {
    const cola = (colaDiaria.get(esc.key) ?? []).reduce((a, b) => a + b, 0);
    const finalPersonas = Math.round(target.total + cola);
    return {
      key: esc.key,
      label: esc.label,
      factor: esc.factor,
      colaPersonas: Math.round(cola),
      finalPersonas,
      finalVenta: Math.round(ventaBase + cola * ticketPromedioCola),
      pctMeta:
        goalTickets && goalTickets > 0
          ? Math.round((finalPersonas / goalTickets) * 100)
          : null,
    };
  });

  // ----- Puntos del gráfico: acumulado real hasta hoy, abanico hacia el
  // evento. El día "hoy" lleva ambos (base) para que las curvas empalmen.
  const puntos: PuntoProyeccion[] = [];
  let acumReal = 0;
  for (let d = target.primerDia; d >= diasHoy; d--) {
    acumReal += target.daily.get(d) ?? 0;
    puntos.push({
      fecha: addDias(fechaEvento, -d),
      dias: d,
      realAcum: Math.round(acumReal),
      realista: d === diasHoy ? Math.round(acumReal) : null,
      banda: d === diasHoy ? [Math.round(acumReal), Math.round(acumReal)] : null,
    });
  }
  const acum = new Map<EscenarioKey, number>(
    ESCENARIOS.map((e) => [e.key, target.total]),
  );
  diasCola.forEach((d, i) => {
    for (const esc of ESCENARIOS) {
      acum.set(esc.key, (acum.get(esc.key) ?? 0) + (colaDiaria.get(esc.key)?.[i] ?? 0));
    }
    puntos.push({
      fecha: addDias(fechaEvento, -d),
      dias: d,
      realAcum: null,
      realista: Math.round(acum.get("realista") ?? 0),
      banda: [
        Math.round(acum.get("pesimista") ?? 0),
        Math.round(acum.get("optimista") ?? 0),
      ],
    });
  });

  return {
    disponible: true,
    base: target.total,
    ventaBase,
    diasRestantes: diasHoy,
    comparables: curvasComparables.length,
    anchorTotal,
    factorJornadas,
    ticketPromedioCola,
    tracking,
    escenarios,
    puntos,
  };
}
