/**
 * Fórmulas puras del constructor de planes de pricing de tickets.
 *
 * Reproduce la lógica de la planilla Excel "Plan Ticketing Piknic":
 *   CPS         = precio × cpsPct            (cargo por servicio, 15%)
 *   total       = precio + CPS               (precio final al cliente)
 *   ingresos    = precio × stock             (venta bruta proyectada)
 *   rebate      = (CPS × stock) × rebatePct  (comisión recuperada, 60%)
 *   ingresoTot  = ingresos + rebate
 *
 * SIN React ni acceso a DB: este módulo es la ÚNICA fuente de las fórmulas y
 * se importa tanto en el cliente (feedback en vivo al editar) como en el
 * servidor (recalcTotalsAction = fuente de verdad). No duplicar estas
 * fórmulas en otro lado — eso reintroduce el drift que ya existe entre
 * ticketing.ts y onepager.ts.
 */

// Eje canónico de etapas de venta. DEBE mantenerse en sync con la vista
// BigQuery `marts.ticketing_etapa_map` (mismos nombres y orden).
export const ETAPAS = [
  "CORTESIA",
  "EARLY_BIRD",
  "PREVENTA_1",
  "PREVENTA_2",
  "PREVENTA_3",
  "GENERAL",
  "FINAL",
  "ATRASO",
  "OTRO",
] as const;

export type Etapa = (typeof ETAPAS)[number];

export const ETAPA_ORDEN: Record<Etapa, number> = {
  CORTESIA: 0,
  EARLY_BIRD: 1,
  PREVENTA_1: 2,
  PREVENTA_2: 3,
  PREVENTA_3: 4,
  GENERAL: 5,
  FINAL: 6,
  ATRASO: 7,
  OTRO: 9,
};

export const ETAPA_LABEL: Record<Etapa, string> = {
  CORTESIA: "Cortesía",
  EARLY_BIRD: "Early bird",
  PREVENTA_1: "Preventa 1",
  PREVENTA_2: "Preventa 2",
  PREVENTA_3: "Preventa 3",
  GENERAL: "General",
  FINAL: "Precio final",
  ATRASO: "Atraso",
  OTRO: "Otro",
};

/** Parámetros de fórmula de un plan (default = los del Excel). */
export type FormulaParams = {
  cpsPct: number;
  rebatePct: number;
};

export const DEFAULT_PARAMS: FormulaParams = {
  cpsPct: 0.15,
  rebatePct: 0.6,
};

/** Lo mínimo que una fila necesita para calcularse. */
export type FilaInput = {
  precio: number | null;
  stock: number | null;
};

/** Resultado calculado de una fila (todo derivado, nada persistido). */
export type FilaComputed = {
  precio: number;
  stock: number;
  cps: number;
  total: number;
  ingresos: number;
  rebate: number;
  ingresoTotal: number;
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Calcula las columnas derivadas de una fila a partir de precio y stock.
 * Robusto ante null (Excel deja celdas vacías → se tratan como 0).
 */
export function computeFila(
  input: FilaInput,
  params: FormulaParams = DEFAULT_PARAMS,
): FilaComputed {
  const precio = num(input.precio);
  const stock = num(input.stock);
  const cps = precio * params.cpsPct;
  const total = precio + cps;
  const ingresos = precio * stock;
  const rebate = cps * stock * params.rebatePct;
  const ingresoTotal = ingresos + rebate;
  return { precio, stock, cps, total, ingresos, rebate, ingresoTotal };
}

/** Totales del plan (suma de stock e ingresos sobre todas las filas). */
export type PlanTotals = {
  stock: number;
  ingresos: number;
  rebate: number;
  ingresoTotal: number;
  /** Promedio ponderado del precio (ingresos / stock). */
  precioPromedio: number;
};

export function computeTotals(
  filas: FilaInput[],
  params: FormulaParams = DEFAULT_PARAMS,
): PlanTotals {
  let stock = 0;
  let ingresos = 0;
  let rebate = 0;
  let ingresoTotal = 0;
  for (const fila of filas) {
    const c = computeFila(fila, params);
    stock += c.stock;
    ingresos += c.ingresos;
    rebate += c.rebate;
    ingresoTotal += c.ingresoTotal;
  }
  return {
    stock,
    ingresos,
    rebate,
    ingresoTotal,
    precioPromedio: stock > 0 ? ingresos / stock : 0,
  };
}

/**
 * Ingreso neto (sin IVA) a partir del bruto: neto = bruto / (1 + iva). Los
 * precios se imputan BRUTOS (IVA incluido, como en el Excel); el neto es solo
 * referencia para la factura. `ivaPct` 0.19 = 19%.
 */
export function ingresoNeto(bruto: number, ivaPct: number): number {
  const iva = Number.isFinite(ivaPct) ? ivaPct : 0;
  return iva > -1 ? bruto / (1 + iva) : bruto;
}

/**
 * Precio de una variante de descuento, derivado del precio base.
 * `pct` es la fracción de descuento (0.20 = 20%). Espeja la fórmula del Excel
 * `B - (B * $J$)`. Se redondea al entero (precios en CLP/PEN sin decimales).
 */
export function derivePrecioVariante(precioBase: number | null, pct: number): number {
  const base = num(precioBase);
  const p = Number.isFinite(pct) ? pct : 0;
  return Math.round(base * (1 - p));
}

/**
 * Infiere la etapa canónica desde el nombre del tipo de ticket.
 * Misma prioridad de patrones que la vista `marts.ticketing_etapa_map`: la
 * etiqueta es la señal primaria. Normaliza acentos y mayúsculas antes de
 * matchear. Devuelve "OTRO" si nada calza.
 */
export function parseEtapaFromNombre(nombre: string | null | undefined): Etapa {
  const c = (nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  if (/CORTESIA|LINK CANJE|CANJE|INVITAC/.test(c)) return "CORTESIA";
  if (/EARLY|BLIND|PRE.?REGISTRO/.test(c)) return "EARLY_BIRD";
  if (/PREVENTA 3|PRE.?VENTA 3|FASE 3/.test(c)) return "PREVENTA_3";
  if (/PREVENTA 2|PRE.?VENTA 2|FASE 2/.test(c)) return "PREVENTA_2";
  if (/PREVENTA 1|PRE.?VENTA 1|PREVENTA|PRE.?VENTA|FASE 1|FASE/.test(c))
    return "PREVENTA_1";
  if (/ATRASO|RECARGO/.test(c)) return "ATRASO";
  if (/FINAL|PUERTA|BOLETERIA/.test(c)) return "FINAL";
  if (/GENERAL|NORMAL/.test(c)) return "GENERAL";
  return "OTRO";
}
