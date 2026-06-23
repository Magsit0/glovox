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

// Familias de producto (tipo de entrada). DEBE mantenerse en sync con el CASE
// `producto` de la vista `marts.ticketing_demand_by_stage`. Ortogonal a la etapa.
export const PRODUCTOS = [
  "GENERAL",
  "VIP",
  "EARLY_ENTRY",
  "HAPPY",
  "PACK",
  "PASE",
  "NINO",
] as const;

export type Producto = (typeof PRODUCTOS)[number];

export const PRODUCTO_LABEL: Record<Producto, string> = {
  GENERAL: "General",
  VIP: "VIP",
  EARLY_ENTRY: "Early entry",
  HAPPY: "Happy Piknic",
  PACK: "Pack",
  PASE: "Pase / Abono",
  NINO: "Niño",
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
 * Precio efectivo de una celda 3D: el precio base si es venta general, o el base
 * con el descuento del sponsor aplicado. `pctSponsor` = fracción de descuento
 * (0 = sin descuento / venta general).
 */
export function precioCelda3D(precioBase: number | null, pctSponsor: number): number {
  return pctSponsor > 0 ? derivePrecioVariante(precioBase, pctSponsor) : num(precioBase);
}

/**
 * Convierte celdas 3D (tipo × etapa × sponsor) + el catálogo de sponsors en filas
 * {precio, stock} listas para `computeTotals`/`computeFila`, usando el precio
 * efectivo de cada celda (base, o base con el descuento del sponsor). Es la forma
 * correcta de totalizar el ingreso descontando el split por sponsor.
 *
 * `precioBaseDe(tipo, etapa)` devuelve el precio base p_ij (de la celda general).
 */
export function filasDesdeCeldas3D(
  celdas: { tipo: string; etapa: string; sponsor: string; stock: number | null }[],
  sponsors: { nombre: string; pct: number }[],
  precioBaseDe: (tipo: string, etapa: string) => number | null,
): FilaInput[] {
  const pctDe = new Map(sponsors.map((s) => [s.nombre, s.pct]));
  return celdas.map((c) => ({
    precio: precioCelda3D(precioBaseDe(c.tipo, c.etapa), c.sponsor ? (pctDe.get(c.sponsor) ?? 0) : 0),
    stock: c.stock,
  }));
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
  if (/PREVENTA [3-9]|PRE.?VENTA [3-9]|FASE 3/.test(c)) return "PREVENTA_3";
  if (/PREVENTA 2|PRE.?VENTA 2|FASE 2/.test(c)) return "PREVENTA_2";
  if (/PREVENTA 1|PRE.?VENTA 1|PREVENTA|PRE.?VENTA|FASE 1|FASE/.test(c))
    return "PREVENTA_1";
  if (/ATRASO|RECARGO/.test(c)) return "ATRASO";
  if (/FINAL|PUERTA|BOLETERIA/.test(c)) return "FINAL";
  if (/GENERAL|NORMAL/.test(c)) return "GENERAL";
  return "OTRO";
}
