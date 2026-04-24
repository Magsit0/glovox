export type RawRow = Record<string, unknown>;

export interface BusinessRow {
  key: string;
  EventoID: string;
  nombre: string;
  area_negocio: string;
  cat2: string;
  cat1: string;
  estado: string;
  fechaNegocio: string;
  fechaAsignacion: string;
  principalCliente: string;
  ingreso: number;
  ingresoProrrateado: number;
  facturado: number;
  asistentes: number;
  gasto: number;
  presupuesto: number;
  categoriasGasto: Record<string, number>;
  subCategoriasGasto: Record<string, number>;
  documentos: number;
  margen: number;
  desviacion: number;
  margenPct: number;
  topCategoria: string;
}

export interface ExpenseRow {
  rowIndex: number;
  key: string;
  EventoID: string;
  nombre: string;
  nombreGlovox: string;
  area_negocio: string;
  cat2: string;
  cat1: string;
  estado: string;
  principalCliente: string;
  categoriaGasto: string;
  subCategoria: string;
  itemGasto: string;
  gasto: number;
  presupuesto: number;
  ingreso: number;
  facturado: number;
  asistentes: number;
  fechaAsignacion: string;
}

export interface FilterDefinition {
  name: string;
  label: string;
  getValue: (row: BusinessRow) => string;
  getLabel: (row: BusinessRow) => string;
}

export interface EventStat {
  key: string;
  eventName: string;
  nombreGlovox: string;
  estado: string;
  fechaAsignacion: string;
  asistentes: number;
  gasto: number;
  presupuesto: number;
}

export interface NegocioRow {
  area_negocio: string;
  costo_presupuestado: string;
  costo_real: string;
  costo_total_justificado: string;
  ejecutivo: string;
  estado: string;
  estadonv: string;
  estadocierre: string;
  fecha_asignacion: string;
  fecha_cierre_negocio: string;
  fecha_emision_oc_cliente: string;
  fecha_realizacion: string;
  folio: string;
  id: string;
  nro_oc_cliente: string;
  razon_cliente: string;
  referencia: string;
  rut_cliente: string;
  total_cobrado: string;
  total_facturado: string;
  total_neto: string;
  total_nv: string;
  total_oc_cliente: string;
  total_por_cobrar: string;
  total_por_facturar: string;
  total_venta: string;
  updated_at: string;
  user_name: string;
}
