import type { DemandaRow } from "@/lib/queries/ticketing";

export type ProyeccionMetodo = "ninguna" | "lineal" | "holt";

/** Punto proyectado con banda de incertidumbre (~80 %, P10–P90). */
export type Banda = { value: number; low: number; high: number };

type SerieKey =
  | "general" | "vip" | "earlyEntry" | "free" | "upgrade" | "total"
  | "generalVenta" | "vipVenta" | "earlyEntryVenta" | "freeVenta" | "upgradeVenta" | "totalVenta";

export type DemandaProyeccion = Record<SerieKey, Banda>;

// z para un intervalo bilateral ~80 % (percentiles P10–P90).
const Z80 = 1.2816;

/**
 * Pronóstico de un paso por regresión lineal de mínimos cuadrados. sigma = desvío
 * estándar de los residuos in-sample (raíz de SSE/(n−2)), base de la banda.
 */
function linealForecast(ys: number[]): { value: number; sigma: number } {
  const n = ys.length;
  if (n === 0) return { value: 0, sigma: 0 };
  if (n === 1) return { value: Math.max(0, ys[0]), sigma: 0 };
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += ys[i];
    sxy += i * ys[i];
    sxx += i * i;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { value: Math.max(0, ys[n - 1]), sigma: 0 };
  const pendiente = (n * sxy - sx * sy) / denom;
  const intercepto = (sy - pendiente * sx) / n;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const e = ys[i] - (intercepto + pendiente * i);
    sse += e * e;
  }
  const sigma = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;
  return { value: Math.max(0, intercepto + pendiente * n), sigma };
}

/**
 * Pronóstico de un paso por suavizado exponencial doble (Holt): nivel + tendencia,
 * ponderando lo reciente. α y β se eligen por mini grid-search minimizando el SSE
 * de los pronósticos a un paso in-sample; sigma = RMSE de esos residuos.
 */
function holtForecast(ys: number[]): { value: number; sigma: number } {
  const n = ys.length;
  if (n === 0) return { value: 0, sigma: 0 };
  if (n === 1) return { value: Math.max(0, ys[0]), sigma: 0 };
  if (n === 2) return { value: Math.max(0, 2 * ys[1] - ys[0]), sigma: 0 };

  const grid = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  let best: { sse: number; value: number; residuos: number[] } = {
    sse: Infinity,
    value: ys[n - 1],
    residuos: [],
  };
  for (const alpha of grid) {
    for (const beta of grid) {
      let level = ys[0];
      let trend = ys[1] - ys[0];
      let sse = 0;
      const residuos: number[] = [];
      for (let t = 1; t < n; t++) {
        const f = level + trend; // pronóstico a un paso de y[t], hecho en t−1
        const e = ys[t] - f;
        sse += e * e;
        residuos.push(e);
        const prevLevel = level;
        level = alpha * ys[t] + (1 - alpha) * (level + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
      }
      if (sse < best.sse) best = { sse, value: level + trend, residuos };
    }
  }
  const m = best.residuos.length;
  const sigma = m > 1 ? Math.sqrt(best.residuos.reduce((s, e) => s + e * e, 0) / m) : 0;
  return { value: Math.max(0, best.value), sigma };
}

function forecastSerie(ys: number[], metodo: ProyeccionMetodo): { value: number; sigma: number } {
  return metodo === "holt" ? holtForecast(ys) : linealForecast(ys);
}

function banda(value: number, sigma: number, round: boolean): Banda {
  const half = Z80 * sigma;
  const lo = Math.max(0, value - half);
  const hi = value + half;
  return round
    ? { value: Math.round(value), low: Math.round(lo), high: Math.round(hi) }
    : { value, low: lo, high: hi };
}

const TICKET_KEYS = ["general", "vip", "earlyEntry", "free", "upgrade"] as const;
const VENTA_KEYS = ["generalVenta", "vipVenta", "earlyEntryVenta", "freeVenta", "upgradeVenta"] as const;

/**
 * Proyecta el siguiente punto de demanda a partir del historial graficado, con el
 * método elegido, ajustando una recta/curva por producto (tickets y recaudación
 * por separado). Cada producto trae su banda P10–P90. El total es la suma de las
 * partes (su banda combina las varianzas asumiendo independencia entre productos).
 * Devuelve null si el método es "ninguna" o si no hay al menos 2 puntos.
 */
export function proyectarDemanda(
  rows: DemandaRow[],
  metodo: ProyeccionMetodo,
): DemandaProyeccion | null {
  if (metodo === "ninguna" || rows.length < 2) return null;
  const col = (k: keyof DemandaRow) => rows.map((r) => r[k] as number);
  const out = {} as DemandaProyeccion;

  let totVal = 0;
  let totVar = 0;
  for (const k of TICKET_KEYS) {
    const { value, sigma } = forecastSerie(col(k), metodo);
    out[k] = banda(value, sigma, true);
    totVal += value;
    totVar += (Z80 * sigma) ** 2;
  }
  const totHalf = Math.sqrt(totVar);
  out.total = {
    value: Math.round(totVal),
    low: Math.round(Math.max(0, totVal - totHalf)),
    high: Math.round(totVal + totHalf),
  };

  let totVentaVal = 0;
  let totVentaVar = 0;
  for (const k of VENTA_KEYS) {
    const { value, sigma } = forecastSerie(col(k), metodo);
    out[k] = banda(value, sigma, false);
    totVentaVal += value;
    totVentaVar += (Z80 * sigma) ** 2;
  }
  const totVentaHalf = Math.sqrt(totVentaVar);
  out.totalVenta = {
    value: totVentaVal,
    low: Math.max(0, totVentaVal - totVentaHalf),
    high: totVentaVal + totVentaHalf,
  };

  return out;
}
