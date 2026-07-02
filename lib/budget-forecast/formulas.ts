/**
 * Fórmulas puras del constructor de presupuesto de evento.
 *
 * SIN React ni DB: única fuente de la matemática del forecast, importada tanto
 * en el cliente (feedback en vivo al editar) como en el servidor. No duplicar.
 *
 * Cadena:
 *   ingresoTickets = asistentes × ticketPerCapita
 *   ingresoFB      = asistentes × fbPerCapita
 *   ingresoOtros   = ingresoMarcasOtros            (manual)
 *   ingresoTotal   = tickets + fb + otros          (todo BRUTO, IVA incluido)
 *   techo          = ingresoTotal / (1 + margen)   (markup sobre costo, decisión v1)
 *                    ó ingresoTotal × (1 − margen) (share, disponible)
 *   monto[cat]     = montoOverride ?? techo × pct[cat]
 */
import { ingresoNeto } from "@/lib/ticketing-pricing/formulas";
import type { CategoriaPresupuesto, MarginMode } from "./config";

export type BudgetParams = { targetMargin: number };
export const DEFAULT_BUDGET_PARAMS: BudgetParams = { targetMargin: 0.2 };

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// ---------- Ingreso proyectado ----------

export type RevenueInput = {
  asistentes: number | null;
  ticketPerCapita: number | null;
  fbPerCapita: number | null;
  ingresoMarcasOtros: number | null;
};

export type RevenueBreakdown = {
  tickets: number;
  fb: number;
  otros: number;
  total: number;
};

/** Ingreso proyectado bruto a partir de asistentes × per-cápitas + otros. */
export function projectRevenue(i: RevenueInput): RevenueBreakdown {
  const a = num(i.asistentes);
  const tickets = a * num(i.ticketPerCapita);
  const fb = a * num(i.fbPerCapita);
  const otros = num(i.ingresoMarcasOtros);
  return { tickets, fb, otros, total: tickets + fb + otros };
}

// ---------- Margen → techo presupuestario ----------

/**
 * Techo presupuestario desde el ingreso total y el margen objetivo.
 * - "markup": techo = ingreso / (1 + margen). `ingresoNeto` reutilizado, porque
 *   bruto/(1+iva) es algebraicamente idéntico a ingreso/(1+margen).
 * - "share":  techo = ingreso × (1 − margen).
 */
export function budgetCeiling(
  revenueTotal: number,
  mode: MarginMode,
  margin: number,
): number {
  const r = num(revenueTotal);
  const m = num(margin);
  return mode === "share" ? r * (1 - m) : ingresoNeto(r, m);
}

/** Ganancia implícita (ingreso − techo) y su ratio sobre ingreso y sobre costo. */
export type MarginSummary = {
  ceiling: number;
  profit: number;
  profitOverRevenue: number; // ganancia / ingreso
  profitOverCost: number; // ganancia / techo (= markup)
};

export function marginSummary(
  revenueTotal: number,
  mode: MarginMode,
  margin: number,
): MarginSummary {
  const r = num(revenueTotal);
  const ceiling = budgetCeiling(r, mode, margin);
  const profit = r - ceiling;
  return {
    ceiling,
    profit,
    profitOverRevenue: r > 0 ? profit / r : 0,
    profitOverCost: ceiling > 0 ? profit / ceiling : 0,
  };
}

// ---------- Cascada del techo por categoría ----------

export type CategoriaComputed = {
  key: string;
  label: string;
  pct: number;
  monto: number; // techo × pct (o montoOverride si != null)
  esOverride: boolean;
};

export type CascadeTotals = {
  ceiling: number;
  asignado: number; // suma de montos
  restante: number; // ceiling − asignado (negativo = sobre-asignado)
  pctAsignado: number; // asignado / ceiling
  sobreAsignado: boolean;
  rows: CategoriaComputed[];
};

/**
 * Distribuye el techo en categorías. `montoOverride` manda sobre `pct`. No
 * re-normaliza los pct automáticamente: el restante/sobre-asignado es la
 * guardarraíl (re-normalizar mientras el usuario edita sorprende).
 */
export function cascade(
  ceiling: number,
  categorias: CategoriaPresupuesto[],
): CascadeTotals {
  const c = num(ceiling);
  const rows: CategoriaComputed[] = categorias.map((cat) => {
    const esOverride = cat.montoOverride != null;
    const monto = esOverride ? num(cat.montoOverride) : c * num(cat.pct);
    return { key: cat.key, label: cat.label, pct: num(cat.pct), monto, esOverride };
  });
  const asignado = rows.reduce((s, r) => s + r.monto, 0);
  const restante = c - asignado;
  return {
    ceiling: c,
    asignado,
    restante,
    pctAsignado: c > 0 ? asignado / c : 0,
    sobreAsignado: restante < 0,
    rows,
  };
}
