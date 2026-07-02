import type {
  FfbbBarraRow,
  FfbbCategoriaRow,
  FfbbKpis,
  FfbbProductoRow,
} from "@/lib/ffbb/types";

export type FdsTabKey = "resumen" | "tickets" | "ffbb" | "finanzas";

/** Una edición de la Feria del Sanguche (para el selector y el histórico). */
export interface FdsEventOption {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  temporada: string;
  asistentes: number | null;
  tieneFfbb: boolean;
  tieneFinanzas: boolean;
}

/** Cabecera del tab Resumen: cifras clave de la edición. */
export interface FdsResumen {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  temporada: string;
  asistentes: number | null;
  tickets: number;
  ventaTickets: number;
  ventaFfbb: number;
  unidadesFfbb: number;
  cargoServicio: number;
  ventaTotal: number;
  perCapitaTickets: number | null;
  perCapitaFfbb: number | null;
  tieneFfbb: boolean;
  tieneFinanzas: boolean;
}

/** Tickets (glovox.tickets) — reusa los tipos del dashboard de ticketing. */
export interface FdsTicketsData {
  kpis: {
    tickets: number;
    venta: number;
    ticketPromedio: number;
    cortesias: number;
  };
  porTipo: { label: string; venta: number; qtty: number }[];
  porCategoria: { label: string; venta: number; qtty: number }[];
}

/** FF&BB (onfire.soldItems) — INCLUYE comida (a diferencia de /ffbb). */
export interface FdsFfbbData {
  kpis: FfbbKpis;
  perCapita: number | null;
  porCategoria: FfbbCategoriaRow[];
  topProductos: FfbbProductoRow[];
  porPunto: FfbbBarraRow[];
}

export interface FdsFinanzasItem {
  categoria: string;
  presupuestado: number;
  real: number;
  diferencia: number;
}

export interface FdsProveedor {
  proveedor: string;
  monto: number;
  docs: number;
}

/** Finanzas & admin (finanzas.unabase_*) — null si la edición no tiene negocio conectado. */
export interface FdsFinanzas {
  negocioId: string;
  referencia: string;
  estado: string;
  area: string;
  cliente: string;
  facturado: number;
  neto: number;
  costoPresupuestado: number;
  costoReal: number;
  margen: number;
  margenPct: number | null;
  itemsPorCategoria: FdsFinanzasItem[];
  topProveedores: FdsProveedor[];
}

// --- Gastos del negocio por categoría (baseline de presupuesto) ------------

export type FdsGastoTier = "A" | "B" | "C";

export interface FdsGastoBucket {
  key: string; // CategoriaKey canónica de lib/budget-forecast/config
  label: string;
  monto: number; // gasto real CLP en esa categoría/edición
  pct: number; // share intra-edición 0..1 (monto / total de la edición)
}

export interface FdsGastoEdicion {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  asistentes: number | null;
  totalReal: number; // SUM(item_costo_real) de la edición
  otrasPct: number; // share del bucket "otras" — mide qué tan confiable es la categorización
  tier: FdsGastoTier; // A limpia · B con reserva · C solo total (no estructura)
  buckets: FdsGastoBucket[]; // 7 buckets en orden canónico
}

export interface FdsGastosData {
  editions: FdsGastoEdicion[]; // cronológico asc; solo ediciones con negocio de finanzas
  bucketKeys: string[]; // orden canónico de las 7 keys
  bucketLabels: Record<string, string>;
  sinMapear: { categoria: string; monto: number }[]; // categorías crudas sin regla (van a "otras")
}

/** Una fila del histórico entre ediciones. */
export interface FdsHistoricoRow {
  eventoId: string;
  nombre: string;
  temporada: string;
  fechaEvento: string | null;
  asistentes: number | null;
  ventaTickets: number;
  ventaFfbb: number;
  perCapitaFfbb: number | null;
  facturado: number | null;
  costoReal: number | null;
  margen: number | null;
}
