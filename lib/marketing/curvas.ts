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

export type CurvaSerie = {
  /** dataKey en el gráfico (`s0`, `s1`, …). Estable dentro de un render. */
  key: string;
  label: string;
  /** Total final de la serie en la métrica elegida. */
  total: number;
  /** Cuántos eventos componen la serie. */
  eventos: number;
  /**
   * % del total de la serie ya vendido a N días del evento (hitos de
   * anticipación). Siempre sobre el acumulado, sin importar la vista elegida.
   */
  hitos: { d30: number; d7: number; d0: number };
};

/** Días de anticipación en los que se mide el avance de cada curva. */
const HITOS = [30, 7, 0] as const;

export type CurvaPoint = { dias: number } & Record<string, number | null>;

export type CurvasChart = {
  points: CurvaPoint[];
  /** Series visibles, ordenadas por total descendente. */
  series: CurvaSerie[];
  /** Series que quedaron fuera del tope `maxSeries`. */
  seriesOcultas: number;
  /** Series totales que producen los filtros (visibles + ocultas). */
  seriesTotales: number;
  /** Eventos con al menos una fila de venta. */
  eventos: number;
  minDias: number;
  maxDias: number;
  /** dataKey de la curva promedio, o null si no aplica. */
  promedioKey: string | null;
};

export const PROMEDIO_KEY = "prom";

const GROUP_FIELD: Record<
  Exclude<CurvaGroupBy, "evento">,
  keyof CurvaEventOption
> = {
  categoria: "categoriaEvento",
  categoria2: "categoriaEvento2",
  categoria3: "categoriaEvento3",
  temporada: "temporada",
};

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
  /** Dibujar la curva promedio de TODAS las series (incluidas las ocultas). */
  promedio: boolean;
  /** Tope de curvas dibujadas; el resto se reporta en `seriesOcultas`. */
  maxSeries: number;
};

/**
 * Arma los puntos del gráfico.
 *
 * El acumulado de un evento se calcula sobre su propia ventana de venta: antes
 * de su primer día el valor es `null` (la curva no arranca, como en el reporte
 * original) y después de su último día se arrastra el total (forward-fill), de
 * modo que agrupar varios eventos suma curvas completas y no escalones falsos.
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
      eventos: 0,
      minDias: 0,
      maxDias: 0,
      promedioKey: null,
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
  const ordered = [...groups.entries()]
    .map(([label, eventoIds]) => ({
      label,
      eventoIds,
      total: eventoIds.reduce((sum, id) => sum + (curves.get(id)?.total ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));

  const visibles = ordered.slice(0, Math.max(1, maxSeries));
  const series: CurvaSerie[] = visibles.map((g, i) => {
    const [d30, d7, d0] = HITOS.map((dia) => {
      if (g.total <= 0) return 0;
      let acumulado = 0;
      for (const id of g.eventoIds) {
        const curve = curves.get(id);
        if (!curve) continue;
        for (const [d, v] of curve.daily) if (d >= dia) acumulado += v;
      }
      return (acumulado / g.total) * 100;
    });
    return {
      key: `s${i}`,
      label: g.label,
      total: g.total,
      eventos: g.eventoIds.length,
      hitos: { d30, d7, d0 },
    };
  });
  const keyByLabel = new Map(visibles.map((g, i) => [g.label, `s${i}`]));

  // 4. Recorrido del dominio de días de mayor a menor, arrastrando el
  //    acumulado de cada evento. La curva promedio usa TODAS las series (no
  //    solo las visibles) para que el benchmark no dependa del tope.
  const running = new Map<string, number>();
  for (const id of curves.keys()) running.set(id, 0);

  const points: CurvaPoint[] = [];
  const usaPromedio = promedio && ordered.length >= 2;

  for (let dias = maxDias; dias >= minDias; dias--) {
    const point: CurvaPoint = { dias };
    const valoresParaPromedio: number[] = [];

    for (const group of ordered) {
      let valor = 0;
      let activa = false;
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
          activa = true;
        } else if (dias >= curve.ultimoDia) {
          // En vista diaria la serie solo existe dentro de su ventana de venta.
          valor += hoy;
          activa = true;
        }
      }

      const key = keyByLabel.get(group.label);
      let salida: number | null = activa ? valor : null;
      if (salida != null && normalizar) {
        salida = group.total > 0 ? (salida / group.total) * 100 : 0;
      }
      if (key) point[key] = salida;
      if (salida != null) valoresParaPromedio.push(salida);
    }

    if (usaPromedio) {
      point[PROMEDIO_KEY] = valoresParaPromedio.length
        ? valoresParaPromedio.reduce((a, b) => a + b, 0) /
          valoresParaPromedio.length
        : null;
    }

    points.push(point);
  }

  return {
    points,
    series,
    seriesOcultas: ordered.length - visibles.length,
    seriesTotales: ordered.length,
    eventos: curves.size,
    minDias,
    maxDias,
    promedioKey: usaPromedio ? PROMEDIO_KEY : null,
  };
}

export type CurvasResumen = {
  total: number;
  eventos: number;
  /** % de la métrica vendido antes del día del evento (dias >= 1). */
  pctAnticipado: number;
  /** % vendido el día del evento (dias = 0). */
  pctDiaEvento: number;
  /** % vendido después del evento (dias < 0). */
  pctPosterior: number;
  /**
   * Día en que la venta acumulada del conjunto cruza el 50%: "la mitad de la
   * venta ocurre a N días del evento". null si no hay dato.
   */
  medianaDias: number | null;
};

/** Resumen agregado del conjunto seleccionado (alimenta las KPI cards). */
export function resumirCurvas(
  rows: CurvaRow[],
  metric: CurvaMetric,
): CurvasResumen {
  const porDia = new Map<number, number>();
  const eventos = new Set<string>();
  let total = 0;
  let anticipado = 0;
  let diaEvento = 0;
  let posterior = 0;

  for (const row of rows) {
    const value = metricValue(row, metric);
    eventos.add(row.eventoId);
    porDia.set(row.dias, (porDia.get(row.dias) ?? 0) + value);
    total += value;
    if (row.dias > 0) anticipado += value;
    else if (row.dias === 0) diaEvento += value;
    else posterior += value;
  }

  let medianaDias: number | null = null;
  if (total > 0) {
    let acumulado = 0;
    for (const dias of [...porDia.keys()].sort((a, b) => b - a)) {
      acumulado += porDia.get(dias) ?? 0;
      if (acumulado >= total / 2) {
        medianaDias = dias;
        break;
      }
    }
  }

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  return {
    total,
    eventos: eventos.size,
    pctAnticipado: pct(anticipado),
    pctDiaEvento: pct(diaEvento),
    pctPosterior: pct(posterior),
    medianaDias,
  };
}
