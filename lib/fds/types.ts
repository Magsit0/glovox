/** Una edición de la Feria del Sanguche (para el histórico y el baseline). */
export interface FdsEventOption {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  temporada: string;
  asistentes: number | null;
  tieneFfbb: boolean;
  tieneFinanzas: boolean;
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

// --- Gastos del negocio por categoría (baseline de presupuesto) ------------

export type FdsGastoTier = "A" | "B" | "C";

export interface FdsGastoBucket {
  key: string; // categoría canónica de finanzas.unabase_catalogo
  label: string;
  monto: number; // gasto real CLP (item_costo_empresa) en esa categoría/edición
  pct: number; // share intra-edición 0..1 (monto / total de la edición)
}

export interface FdsGastoEdicion {
  eventoId: string;
  nombre: string;
  fechaEvento: string | null;
  asistentes: number | null;
  totalReal: number; // SUM(item_costo_empresa) de la edición
  otrasPct: number; // share del bucket "Otras" — mide qué tan confiable es la categorización
  tier: FdsGastoTier; // A limpia · B con reserva · C solo total (no estructura)
  buckets: FdsGastoBucket[]; // categorías del catálogo que aparecen, en orden del catálogo
}

export interface FdsGastosData {
  editions: FdsGastoEdicion[]; // cronológico asc; solo ediciones con negocio de finanzas
  bucketKeys: string[]; // categorías canónicas presentes, en orden del catálogo
  bucketLabels: Record<string, string>;
  sinMapear: { categoria: string; monto: number }[]; // categorías crudas sin match (van a "Otras")
}
