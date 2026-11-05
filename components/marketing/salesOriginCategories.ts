// Agrupación de orígenes de venta (campo Referido) en las categorías de la
// tabla "Origen de Venta". Compartido por la tabla y su exportación CSV para
// que ambas agrupen exactamente igual.

import type { SalesOriginDayRow, SalesOriginRow } from "@/lib/queries/marketing";

/**
 * Total por origen a partir de las filas origen × día. Orden: tickets desc y,
 * en empate, origen asc (el de la query de totales que reemplaza).
 */
export function sumByOrigin(rows: SalesOriginDayRow[]): SalesOriginRow[] {
  const map = new Map<string, SalesOriginRow>();
  for (const r of rows) {
    const acc = map.get(r.origin) ?? { origin: r.origin, tickets: 0, revenue: 0 };
    acc.tickets += r.tickets;
    acc.revenue += r.revenue;
    map.set(r.origin, acc);
  }
  return [...map.values()].sort((a, b) => b.tickets - a.tickets || a.origin.localeCompare(b.origin));
}

/** Tickets por día ("YYYY-MM-DD"; null = sin fecha de orden). */
export type TicketsPorDia = Map<string | null, number>;

/** Tickets por día de cada origen. */
export function ticketsPorDia(rows: SalesOriginDayRow[]): Map<string, TicketsPorDia> {
  const map = new Map<string, TicketsPorDia>();
  for (const r of rows) {
    if (!map.has(r.origin)) map.set(r.origin, new Map());
    const dias = map.get(r.origin)!;
    dias.set(r.dia, (dias.get(r.dia) ?? 0) + r.tickets);
  }
  return map;
}

/** Suma día a día varios orígenes (la fila de un grupo, o el total). */
export function sumarPorDia(listas: TicketsPorDia[]): TicketsPorDia {
  const out: TicketsPorDia = new Map();
  for (const dias of listas) {
    for (const [dia, tickets] of dias) out.set(dia, (out.get(dia) ?? 0) + tickets);
  }
  return out;
}

/**
 * Columnas de la matriz por día: TODOS los días entre la primera y la última
 * venta (también los que no tienen ventas, para que las columnas sean un
 * calendario continuo), del más antiguo al más reciente; null al final si hay
 * tickets sin fecha de orden.
 */
export function columnasDias(rows: SalesOriginDayRow[]): (string | null)[] {
  const fechas = rows.map((r) => r.dia).filter((d): d is string => d != null).sort();
  const cols: (string | null)[] = [];
  if (fechas.length > 0) {
    const fin = fechas[fechas.length - 1];
    for (let d = fechas[0]; d <= fin; d = diaSiguiente(d)) cols.push(d);
  }
  if (rows.some((r) => r.dia == null)) cols.push(null);
  return cols;
}

function diaSiguiente(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export const ORIGIN_CATEGORY_MAP: Record<string, string> = {
  PM_MT: "Paid Media Meta",
  PM_GG: "Paid Media Google",
  EMAIL: "Email",
  ORG_LT: "Linktree",
};

/** Prefijo de categoría de un origen, o null si no pertenece a ninguna. */
export function categorizeOrigin(origin: string): string | null {
  for (const prefix of Object.keys(ORIGIN_CATEGORY_MAP)) {
    if (origin.startsWith(prefix)) return prefix;
  }
  return null;
}
