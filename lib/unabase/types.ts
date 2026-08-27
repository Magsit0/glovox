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
  // negocio_id(s) agregados en esta fila. Normalmente 1 (108 de 110 eventos son
  // 1:1); >1 cuando varios negocios comparten EventoID (GLO042, GLO176) — ahí no
  // se puede enlazar a un informe único.
  negocioIds: string[];
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

// Cierre de negocio (informe individual)

export interface NegocioItemRow {
  row_id: string;
  external_id: string;
  categoria: string;
  subcategoria: string;
  item: string;
  descripcion: string;
  cantidad: number;
  pu_venta: number;
  subtotal_venta: number;
  pu_gasto_presupuestado: number;
  subtotal_gasto_pre: number;
  gasto_real: number;
  diferencia: number;
  porc_diferencia: string;
  llave_item: string;
  // Tripleta oficial del catálogo (resuelta por el seed finanzas.unabase_item_map
  // en marts.finanzas_presupuesto_items). "" cuando esa altura no resolvió.
  categoria_oficial: string;
  subcategoria_oficial: string;
  item_oficial: string;
}

export interface DetalleGastoRow {
  negocio: string;
  id: string;
  llave_nv: string;
  proveedor: string;
  rut: string;
  doc: string;
  folio: string;
  fecha: string | null;
  vencimiento: string | null;
  referencia: string;
  estado: string;
  validado: string;
  excluir_gasto: string;
  costoempresa: number;
  item_categoria: string;
  item_sub_categoria: string;
  item_nombre: string;
  item_nombreGasto: string;
  // Categoría oficial resuelta (herencia presupuesto → seed de ítems → seed de
  // categorías). Se usa para imputar gastos huérfanos en el modo oficial.
  categoria_oficial: string;
  item_text_negocio: string;
  item_tipo_documento: string;
  item_tipo_gasto: string;
  item_estado_ops: string;
  item_justificado: string;
}

export interface NegocioOption {
  external_id: string;
  referencia: string;
  area_negocio: string;
  estado: string;
  estadocierre: string;
}

// Cierre de eventos (ticketsAndAABB.cierreEventos) — solo para "produccion de eventos propios".
// EventoID se conecta con los primeros 6 caracteres de unabase.negocios.referencia.
// Detalle por cliente de un ingreso imputado (marcas, mesas VIP, medios) —
// alimenta el tooltip de las cards en el cierre. `monto` es NETO.
export interface IngresoDetalleRow {
  cliente: string;
  monto: number;
}

export interface CierreEventoRow {
  EventoID: string;
  nombreGlovox: string;
  categoriaEvento: string;
  totalVentaTickets: number | null;
  totalCargoServicio: number | null;
  totalVentaFfbb: number | null;
  totalAsistentes: number | null;
}

export interface VentasAggregateRaw {
  ventaBrutaNeta: number;
  ncNeta: number;
  ndNeta: number;
  ventaBrutaTotal: number;
  ivaTotal: number;
  cobrado: number;
  porCobrar: number;
  docsVenta: number;
  docsNC: number;
  docsND: number;
}

// Ventas prorrateadas por negocio (finanzas.unabase_ventas_por_negocio).
// Reemplaza a docsVenta: los montos ya vienen atribuidos al negocio (no inflados
// por facturas compartidas entre varios negocios). Se matchea por id_negocio.
export interface VentaNegocioRow {
  id_negocio: string;
  id_documento: string;
  folio: string;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  tipo_documento: string;
  tipo_documento_abrev: string;
  cliente: string;
  rut_cliente: string;
  cantidad_items_atribuibles: number;
  monto_neto_atribuible: number;
  monto_exento_atribuible: number;
  monto_iva_atribuible: number;
  monto_total_atribuible: number;
  items_descripciones: string[];
}

// Resumen a nivel negocio (marts.finanzas_negocios) — cifras "maestro" que
// vienen directo de la API de Unabase (finanzas.unabase_negocios), más su
// contraparte documentada en BigQuery (rollup de líneas) y flags de
// reconciliación entre ambas. Usado por ResumenKpis; distinto de
// NegocioAggregate (que agrega línea por línea desde items/gastos/ventas).
export interface NegocioResumenRow {
  ventaNeta: number | null;
  ventaBruta: number | null;
  ventaFacturada: number | null;
  ventaNetaDocumentada: number | null;
  ventaBrutaDocumentada: number | null;
  ventaIvaDocumentada: number | null;
  docsVentaResumen: number | null;
  gastoReal: number | null;
  gastoNetoDocumentado: number | null;
  gastoBrutoDocumentado: number | null;
  gastoIvaDocumentado: number | null;
  gastoOtrosImpuestosDocumentado: number | null;
  gastoRetencionHonorariosDocumentado: number | null;
  lineasGasto: number | null;
  utilidadReal: number | null;
  utilidadFinal: number | null;
  flagVentaNoReconcilia: boolean | null;
  flagGastoNoReconcilia: boolean | null;
}

export interface DocVentaRow {
  id: string;
  folio: string;
  descripcion: string;
  referencia: string;
  tipoDocumentoVentaAbrev: string;
  fechaEmision: string | null;
  rut: string;
  cliente: string;
  totalNeto_raw: number;
  totalExento_raw: number;
  iva_raw: number;
  totalFactura_raw: number;
  cobrado_raw: number;
  porCobrar_raw: number;
  exchange_monto_facturado: number;
  estado: string;
  responsable: string;
  nc: number;
  nd: number;
  is_nc: boolean;
  is_nd: boolean;
  id_ref: string;
}
