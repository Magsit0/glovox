/**
 * Matemática de las curvas de compra anticipada (`/marketing/curvas`).
 *
 * `lib/queries/curvas.ts` devuelve el grano mínimo (evento × día relativo,
 * venta diaria). Acá se arma la serie que consume el gráfico: acumulado por
 * evento, agrupación en series, normalización y curva promedio. Módulo puro
 * (sin IO) para que el cálculo sea verificable sin tocar BigQuery.
 *
 * Convención del eje: `dias` = días de compra anticipada. Positivo = antes del
 * evento, 0 = día del evento, negativo = después. El eje se dibuja invertido
 * para que el tiempo avance de izquierda a derecha.
 *
 * Regla central: una curva NUNCA se dibuja más allá del día que ya ocurrió.
 * Para un evento con venta en curso eso es HOY (`diasHoy`); pasado ese punto el
 * futuro no se inventa (ver `diasCorte`).
 */
import type { CurvaEventOption, CurvaRow } from "@/lib/queries/curvas";

/** Dimensión que define cada curva del gráfico. */
export type CurvaGroupBy =
  | "evento"
  | "categoria"
  | "categoria2"
  | "categoria3"
  | "temporada";

/** Magnitud que se acumula. */
export type CurvaMetric = "tickets" | "personas" | "venta";

/** Acumulado (curva) o venta del día (ritmo). */
export type CurvaVista = "acumulado" | "diario";

/** % del total de la serie en un hito; `null` = el hito todavía no es medible. */
export type CurvaHitos = {
  d30: number | null;
  d7: number | null;
  d0: number | null;
};

export type CurvaSerie = {
  /** dataKey en el gráfico (`s0`, `s1`, …). Estable dentro de un render. */
  key: string;
  label: string;
  /** Total acumulado de la serie en la métrica elegida. Si la serie está en
   *  venta, es lo vendido HASTA HOY, no el total final. */
  total: number;
  /** Cuántos eventos componen la serie. */
  eventos: number;
  /**
   * La serie tiene al menos un evento que todavía está vendiendo. Su curva se
   * corta en `diasCorte`, su `total` es parcial y sus hitos no son medibles.
   */
  enVenta: boolean;
  /** Día relativo hasta el que la serie es observable (mayor = más temprano). */
  diasCorte: number;
  /**
   * % del total de la serie ya vendido a N días del evento. Siempre sobre el
   * acumulado, sin importar la vista. `null` en las series en venta: el
   * denominador (total final) todavía no existe.
   */
  hitos: CurvaHitos;
};

export type CurvaPoint = { dias: number } & Record<string, number | null>;

export type CurvasChart = {
  points: CurvaPoint[];
  /** Series visibles, ordenadas por total descendente. */
  series: CurvaSerie[];
  /** Series que quedaron fuera del tope `maxSeries`. */
  seriesOcultas: number;
  /** Series totales que producen los filtros (visibles + ocultas). */
  seriesTotales: number;
  /** Series (de todas, no solo visibles) con algún evento aún en venta. */
  seriesEnVenta: number;
  /** Eventos con al menos una fila de venta. */
  eventos: number;
  minDias: number;
  maxDias: number;
  /** dataKey de la curva promedio, o null si no se puede calcular. */
  promedioKey: string | null;
  /** Cuántas series cerradas promedia `promedioKey`. */
  promedioBase: number;
};

export const PROMEDIO_KEY = "prom";

/** Mínimo de series cerradas para que el promedio sea un benchmark. */
const PROMEDIO_MIN_SERIES = 2;

const GROUP_FIELD: Record<
  Exclude<CurvaGroupBy, "evento">,
  keyof CurvaEventOption
> = {
  categoria: "categoriaEvento",
  categoria2: "categoriaEvento2",
  categoria3: "categoriaEvento3",
  temporada: "temporada",
};

/** Días de anticipación en los que se mide el avance de cada curva. */
const HITOS = [30, 7, 0] as const;

function metricValue(row: CurvaRow, metric: CurvaMetric): number {
  if (metric === "venta") return row.venta;
  if (metric === "personas") return row.personas;
  return row.tickets;
}

/** Etiqueta de la serie a la que pertenece un evento. */
function groupLabel(
  event: CurvaEventOption | undefined,
  eventoId: string,
  groupBy: CurvaGroupBy,
): string {
  if (groupBy === "evento") {
    if (!event) return eventoId;
    return event.nombre ? `${eventoId} — ${event.nombre}` : eventoId;
  }
  const raw = event?.[GROUP_FIELD[groupBy]];
  return raw && String(raw).trim() ? String(raw) : "Sin clasificar";
}

type EventCurve = {
  /** Venta del día, indexada por día relativo. */
  daily: Map<number, number>;
  /** Primer día con venta (el mayor, más anticipado). */
  primerDia: number;
  /** Último día con venta (el menor, más cercano/posterior al evento). */
  ultimoDia: number;
  /** Día relativo que corresponde a HOY. >= 0 → el evento sigue vendiendo. */
  diasHoy: number;
  total: number;
};

export type BuildCurvasInput = {
  rows: CurvaRow[];
  events: CurvaEventOption[];
  groupBy: CurvaGroupBy;
  metric: CurvaMetric;
  vista: CurvaVista;
  /** Expresar cada punto como % del total de su serie. */
  normalizar: boolean;
  /** Dibujar la curva promedio de las series con venta cerrada. */
  promedio: boolean;
  /** Tope de curvas dibujadas; el resto se reporta en `seriesOcultas`. */
  maxSeries: number;
};

/**
 * Arma los puntos del gráfico.
 *
 * El acumulado de un evento se calcula sobre su propia ventana de venta: antes
 * de su primer día el valor es `null` (la curva no arranca) y después se
 * arrastra el total (forward-fill), de modo que agrupar varios eventos suma
 * curvas completas y no escalones falsos.
 *
 * Ese forward-fill se corta en `diasCorte` = el mayor `diasHoy` de los eventos
 * de la serie: más allá de ese día al menos uno de sus eventos todavía no llegó,
 * así que el acumulado del conjunto no existe todavía y se emite `null`. Para
 * series 100% cerradas `diasCorte` es negativo y queda fuera del dominio, así
 * que no las toca. La vista "por día" no necesita el corte: su límite natural
 * (`ultimoDia`, el último día CON venta) nunca puede ser posterior a hoy.
 */
export function buildCurvas({
  rows,
  events,
  groupBy,
  metric,
  vista,
  normalizar,
  promedio,
  maxSeries,
}: BuildCurvasInput): CurvasChart {
  const eventById = new Map(events.map((e) => [e.eventoId, e]));

  // 1. Curva diaria por evento + dominio global del eje.
  const curves = new Map<string, EventCurve>();
  let minDias = Number.POSITIVE_INFINITY;
  let maxDias = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = metricValue(row, metric);
    let curve = curves.get(row.eventoId);
    if (!curve) {
      curve = {
        daily: new Map(),
        primerDia: row.dias,
        ultimoDia: row.dias,
        diasHoy: row.diasHoy,
        total: 0,
      };
      curves.set(row.eventoId, curve);
    }
    curve.daily.set(row.dias, (curve.daily.get(row.dias) ?? 0) + value);
    curve.primerDia = Math.max(curve.primerDia, row.dias);
    curve.ultimoDia = Math.min(curve.ultimoDia, row.dias);
    curve.total += value;
    if (row.dias < minDias) minDias = row.dias;
    if (row.dias > maxDias) maxDias = row.dias;
  }

  if (curves.size === 0) {
    return {
      points: [],
      series: [],
      seriesOcultas: 0,
      seriesTotales: 0,
      seriesEnVenta: 0,
      eventos: 0,
      minDias: 0,
      maxDias: 0,
      promedioKey: null,
      promedioBase: 0,
    };
  }

  // 2. Agrupación de eventos en series.
  const groups = new Map<string, string[]>();
  for (const eventoId of curves.keys()) {
    const label = groupLabel(eventById.get(eventoId), eventoId, groupBy);
    const bucket = groups.get(label);
    if (bucket) bucket.push(eventoId);
    else groups.set(label, [eventoId]);
  }

  // 3. Series ordenadas por total descendente (las más grandes primero).
  //    `diasCorte` = el mayor `diasHoy` del grupo: el miembro que va más atrás
  //    en el calendario manda hasta dónde el acumulado del conjunto es real.
  const ordered = [...groups.entries()]
    .map(([label, eventoIds]) => {
      let total = 0;
      let diasCorte = Number.NEGATIVE_INFINITY;
      for (const id of eventoIds) {
        const curve = curves.get(id);
        if (!curve) continue;
        total += curve.total;
        diasCorte = Math.max(diasCorte, curve.diasHoy);
      }
      return { label, eventoIds, total, diasCorte, enVenta: diasCorte >= 0 };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));

  const visibles = ordered.slice(0, Math.max(1, maxSeries));
  const series: CurvaSerie[] = visibles.map((g, i) => ({
    key: `s${i}`,
    label: g.label,
    total: g.total,
    eventos: g.eventoIds.length,
    enVenta: g.enVenta,
    diasCorte: g.diasCorte,
    // Los hitos son "% del total FINAL". En una serie en venta ese total no
    // existe todavía (el denominador es parcial), así que no se reportan.
    hitos: g.enVenta
      ? { d30: null, d7: null, d0: null }
      : hitosDeSerie(g.eventoIds, curves, g.total),
  }));
  const keyByLabel = new Map(visibles.map((g, i) => [g.label, `s${i}`]));

  // 4. Promedio = benchmark. Solo series con venta cerrada, así no salta cuando
  //    un evento en curso deja de ser observable. Usa TODAS las cerradas, no
  //    solo las visibles, para que no dependa del tope de curvas.
  const cerradas = ordered.filter((g) => !g.enVenta);
  const usaPromedio = promedio && cerradas.length >= PROMEDIO_MIN_SERIES;

  // 5. Recorrido del dominio de días de mayor a menor, arrastrando el acumulado
  //    de cada evento.
  const running = new Map<string, number>();
  for (const id of curves.keys()) running.set(id, 0);

  const points: CurvaPoint[] = [];

  for (let dias = maxDias; dias >= minDias; dias--) {
    const point: CurvaPoint = { dias };
    let sumaPromedio = 0;

    for (const group of ordered) {
      let valor = 0;
      let iniciada = false;
      for (const id of group.eventoIds) {
        const curve = curves.get(id);
        if (!curve) continue;
        const hoy = curve.daily.get(dias) ?? 0;
        // Cada evento pertenece a una sola serie, así que su acumulado avanza
        // exactamente una vez por día.
        const acumulado = (running.get(id) ?? 0) + hoy;
        running.set(id, acumulado);
        if (dias > curve.primerDia) continue; // el evento todavía no vendía
        if (vista === "acumulado") {
          valor += acumulado;
          iniciada = true;
        } else if (dias >= curve.ultimoDia) {
          // En vista diaria la serie solo existe dentro de su ventana de venta.
          valor += hoy;
          iniciada = true;
        }
      }

      const escalado =
        normalizar && group.total > 0 ? (valor / group.total) * 100 : valor;

      // El corte por día observable es exclusivo del acumulado: la vista diaria
      // ya está limitada por `ultimoDia`, que nunca es posterior a hoy.
      const observable = vista === "acumulado" ? dias >= group.diasCorte : true;
      const key = keyByLabel.get(group.label);
      if (key) point[key] = iniciada && observable ? escalado : null;

      // En el promedio, una serie cerrada que todavía no arrancó aporta 0: en
      // ese día efectivamente habia vendido cero. Así el divisor es constante y
      // la curva queda definida en todo el dominio, sin saltos de composición.
      if (usaPromedio && !group.enVenta) sumaPromedio += iniciada ? escalado : 0;
    }

    if (usaPromedio) point[PROMEDIO_KEY] = sumaPromedio / cerradas.length;
    points.push(point);
  }

  return {
    points,
    series,
    seriesOcultas: ordered.length - visibles.length,
    seriesTotales: ordered.length,
    seriesEnVenta: ordered.filter((g) => g.enVenta).length,
    eventos: curves.size,
    minDias,
    maxDias,
    promedioKey: usaPromedio ? PROMEDIO_KEY : null,
    promedioBase: usaPromedio ? cerradas.length : 0,
  };
}

/** % del total de la serie ya vendido en cada hito de anticipación. */
function hitosDeSerie(
  eventoIds: string[],
  curves: Map<string, EventCurve>,
  total: number,
): CurvaHitos {
  const [d30, d7, d0] = HITOS.map((dia) => {
    if (total <= 0) return 0;
    let acumulado = 0;
    for (const id of eventoIds) {
      const curve = curves.get(id);
      if (!curve) continue;
      for (const [d, v] of curve.daily) if (d >= dia) acumulado += v;
    }
    return (acumulado / total) * 100;
  });
  return { d30, d7, d0 };
}

export type CurvasResumen = {
  /** Total de la métrica vendido, TODOS los eventos (incluye los en venta). */
  total: number;
  eventos: number;
  /** Eventos que todavía están vendiendo (excluidos de los % de abajo). */
  eventosEnVenta: number;
  /** Total de la métrica solo en eventos cerrados: la base de los %. */
  totalCerrados: number;
  /** % de la métrica vendido antes del día del evento (dias >= 1). */
  pctAnticipado: number;
  /** % vendido el día del evento (dias = 0). */
  pctDiaEvento: number;
  /** % vendido después del evento (dias < 0). */
  pctPosterior: number;
  /**
   * Día en que la venta acumulada cruza el 50%: "la mitad de la venta ocurre a
   * N días del evento". null si no hay eventos cerrados.
   */
  medianaDias: number | null;
};

/**
 * Resumen agregado del conjunto seleccionado (alimenta las KPI cards).
 *
 * Los porcentajes de anticipación y la mediana se calculan SOLO sobre eventos
 * cerrados: un evento a 100 días de su fecha aporta 0% de venta el día del
 * evento y 0% posterior por construcción, y ensuciaría el promedio.
 */
export function resumirCurvas(
  rows: CurvaRow[],
  metric: CurvaMetric,
): CurvasResumen {
  const porDia = new Map<number, number>();
  const eventos = new Set<string>();
  const enVenta = new Set<string>();
  let total = 0;
  let totalCerrados = 0;
  let anticipado = 0;
  let diaEvento = 0;
  let posterior = 0;

  for (const row of rows) {
    const value = metricValue(row, metric);
    eventos.add(row.eventoId);
    total += value;
    if (row.diasHoy >= 0) {
      enVenta.add(row.eventoId);
      continue; // venta en curso: fuera de los % de anticipación
    }
    porDia.set(row.dias, (porDia.get(row.dias) ?? 0) + value);
    totalCerrados += value;
    if (row.dias > 0) anticipado += value;
    else if (row.dias === 0) diaEvento += value;
    else posterior += value;
  }

  let medianaDias: number | null = null;
  if (totalCerrados > 0) {
    let acumulado = 0;
    for (const dias of [...porDia.keys()].sort((a, b) => b - a)) {
      acumulado += porDia.get(dias) ?? 0;
      if (acumulado >= totalCerrados / 2) {
        medianaDias = dias;
        break;
      }
    }
  }

  const pct = (v: number) => (totalCerrados > 0 ? (v / totalCerrados) * 100 : 0);
  return {
    total,
    eventos: eventos.size,
    eventosEnVenta: enVenta.size,
    totalCerrados,
    pctAnticipado: pct(anticipado),
    pctDiaEvento: pct(diaEvento),
    pctPosterior: pct(posterior),
    medianaDias,
  };
}
