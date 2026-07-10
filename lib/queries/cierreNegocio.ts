import { query } from "@/lib/bigquery";
import {
  getMarcaIngresosAggByEvento,
  getMarcaIngresosDetalleByEvento,
} from "@/lib/queries/marca";
import {
  getMesasVipAggByEvento,
  getMesasVipDetalleByEvento,
} from "@/lib/queries/mesasVip";
import { getMediosAggByEvento, getMediosDetalleByEvento } from "@/lib/queries/medios";
import type {
  CierreEventoRow,
  DetalleGastoRow,
  IngresoDetalleRow,
  NegocioItemRow,
  NegocioOption,
  NegocioResumenRow,
  VentaNegocioRow,
  VentasAggregateRaw,
} from "@/lib/unabase/types";

const P = process.env.BIGQUERY_PROJECT_ID;

// Migrado 3-jul-2026 a las vistas curadas marts.finanzas_* (antes leía las
// tablas raw finanzas.unabase_*). Las columnas se alias-an al shape antiguo
// (NegocioItemRow / DetalleGastoRow / VentaNegocioRow) para no tocar la UI.
const NEGOCIOS = `\`${P}.marts.finanzas_negocios\``;
const PRESUPUESTO_ITEMS = `\`${P}.marts.finanzas_presupuesto_items\``;
const GASTOS = `\`${P}.marts.finanzas_gastos\``;
const VENTAS = `\`${P}.marts.finanzas_ventas\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;
const CATEGORIA_EVENTO = `\`${P}.glovox.categoriaEvento\``;

export type MontoMode = "neto" | "bruto";

/** Columna de gasto por modo (switch neto/bruto). Mapa fijo: NUNCA interpolar
 *  input del usuario. Las ventas no necesitan modo: la UI ya muestra neto, IVA
 *  y bruto a la vez (ventaBrutaNeta / ivaTotal / ventaBrutaTotal). */
const GASTO_COL: Record<MontoMode, string> = {
  neto: "IFNULL(gasto_neto, 0)",
  bruto: "gasto_bruto",
};

// Filtro común de ventas: documentos vivos del negocio. `incluir_en_venta`
// (= NOT anulado AND NOT nota de crédito/débito) es el mismo predicado que
// antes se replicaba acá con LIKEs sobre tipo_documento.
const VENTAS_WHERE = `
  WHERE CAST(negocio_id AS STRING) = @id
    AND incluir_en_venta
`;

const AREA_PRODUCCION = "produccion de eventos propios";

const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 22_000;

function serialize(row: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === null || val === undefined) {
      obj[key] = null;
      continue;
    }
    if (typeof val === "object") {
      const anyVal = val as { value?: unknown; constructor?: { name?: string }; toString(): string };
      if (typeof anyVal.value === "string") {
        obj[key] = anyVal.value;
      } else if (anyVal.constructor?.name === "Big") {
        obj[key] = parseFloat(anyVal.toString());
      } else {
        obj[key] = val;
      }
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

function withTimeout<T>(p: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Intentá de nuevo.`)),
      ms,
    ),
  );
  return Promise.race([p, timeoutPromise]);
}

// --- Selector options (lista global de negocios) ---

// estadocierre se deriva de compras_cerradas (cierre de compras), normalizado
// a 'true'/'false' para conservar la semántica histórica.
const NEGOCIO_OPTIONS_SQL = `
  SELECT
    CAST(negocio_id AS STRING) AS external_id,
    referencia,
    area_negocio,
    estado,
    LOWER(compras_cerradas) AS estadocierre
  FROM ${NEGOCIOS}
  WHERE LOWER(estado) <> 'cotizacion'
    AND LOWER(estadonv) <> 'nulo'
    AND LOWER(area_negocio) <> 'glovox'
  ORDER BY negocio_id DESC
`;

let optionsCache: { data: NegocioOption[]; timestamp: number } | null = null;

export async function getNegocioOptions(): Promise<NegocioOption[]> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.timestamp < CACHE_TTL_MS) {
    return optionsCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(NEGOCIO_OPTIONS_SQL));
  const clean = rows.map((r) => serialize(r) as unknown as NegocioOption);
  optionsCache = { data: clean, timestamp: now };
  return clean;
}

// --- Detail por negocio ---

export interface NegocioDetail {
  negocio: NegocioOption | null;
  items: NegocioItemRow[];
  gastos: DetalleGastoRow[];
  ventas: VentaNegocioRow[];
  ventasAggregate: VentasAggregateRaw;
  // Resumen del negocio (marts.finanzas_negocios): cifras maestro + documentado
  // + flags de reconciliación. null si el negocio no aparece en la vista.
  resumen: NegocioResumenRow | null;
  evento: CierreEventoRow | null;
  // EventoID (primeros 6 chars de la referencia) cuando el negocio es de
  // producción de eventos propios; null en el resto.
  eventoId: string | null;
  // Ingresos imputados en el ONEPAGER (Neon), agregados por evento. Neto y
  // bruto. null cuando el negocio no es de producción de eventos propios.
  marcaIngresoNeto: number | null;
  marcaIngresoBruto: number | null;
  mesasVipNeto: number | null;
  mesasVipBruto: number | null;
  mediosNeto: number | null;
  mediosBruto: number | null;
  // Detalle por cliente (neto) para el tooltip de cada card. [] si no aplica.
  marcaDetalle: IngresoDetalleRow[];
  mesasVipDetalle: IngresoDetalleRow[];
  mediosDetalle: IngresoDetalleRow[];
  // NOTA: el % de rebate NO vive acá a propósito — el detalle se cachea 5 min
  // por proceso y el % es editable en la propia página; se lee fresco en cada
  // render desde page.tsx (getRebatePorcentaje) para que el guardado se vea
  // de inmediato en cualquier instancia.
}

const EVENTO_SQL = `
  SELECT
    CAST(EventoID AS STRING) AS EventoID,
    CAST(NombreGlovox AS STRING) AS nombreGlovox,
    CAST(CategoriaEvento AS STRING) AS categoriaEvento,
    SAFE_CAST(TotalVentaTICKETS AS FLOAT64) AS totalVentaTickets,
    SAFE_CAST(TotalCargoServicio AS FLOAT64) AS totalCargoServicio,
    SAFE_CAST(TotalVentaFFBB AS FLOAT64) AS totalVentaFfbb,
    SAFE_CAST(TotalAsistentes AS FLOAT64) AS totalAsistentes
  FROM ${CIERRE_EVENTOS}
  WHERE CAST(EventoID AS STRING) = @eventoId
  LIMIT 1
`;

const EMPTY_VENTAS_AGGREGATE: VentasAggregateRaw = {
  ventaBrutaNeta: 0,
  ncNeta: 0,
  ndNeta: 0,
  ventaBrutaTotal: 0,
  ivaTotal: 0,
  cobrado: 0,
  porCobrar: 0,
  docsVenta: 0,
  docsNC: 0,
  docsND: 0,
};

const detailCache = new Map<string, { data: NegocioDetail; timestamp: number }>();

// Líneas HOJA del presupuesto, ya planas y con la subcategoría resuelta por la
// vista (el self-join por llaveSubCat que antes vivía acá). Columnas alias-adas
// al shape antiguo (NegocioItemRow) para no tocar la agregación.
const ITEMS_SQL = `
  SELECT
    CAST(num_item AS STRING) AS row_id,
    CAST(negocio_id AS STRING) AS external_id,
    categoria,
    IFNULL(subcategoria, '') AS subcategoria,
    item,
    descripcion,
    cantidad,
    precio_unitario_venta AS pu_venta,
    venta_presupuestada AS subtotal_venta,
    precio_unitario_gasto AS pu_gasto_presupuestado,
    gasto_presupuestado AS subtotal_gasto_pre,
    gasto_real_item AS gasto_real,
    diferencia,
    CAST(porc_diferencia AS STRING) AS porc_diferencia,
    llave_item
  FROM ${PRESUPUESTO_ITEMS}
  WHERE CAST(negocio_id AS STRING) = @id
`;

// Gastos documentados del negocio. `costoempresa` conserva el nombre histórico
// pero su valor depende del switch neto/bruto (gasto_neto | gasto_bruto).
const gastosSql = (monto: MontoMode) => `
  SELECT
    CAST(negocio_id AS STRING) AS negocio,
    CAST(gasto_id AS STRING) AS id,
    llave_item AS llave_nv,
    proveedor,
    proveedor_rut AS rut,
    tipo_documento AS doc,
    folio,
    CAST(fecha AS STRING) AS fecha,
    CAST(vencimiento AS STRING) AS vencimiento,
    descripcion_gasto AS referencia,
    estado_documento AS estado,
    CAST(validado AS STRING) AS validado,
    CAST(NOT incluir_en_totales AS STRING) AS excluir_gasto,
    ${GASTO_COL[monto]} AS costoempresa,
    categoria_raw AS item_categoria,
    subcategoria_raw AS item_sub_categoria,
    item_nombre,
    item_nombre_gasto AS item_nombreGasto,
    negocio_nombre AS item_text_negocio,
    tipo_documento_item AS item_tipo_documento,
    tipo_gasto_item AS item_tipo_gasto,
    CAST(pago_realizado AS STRING) AS item_estado_ops,
    CAST(justificado AS STRING) AS item_justificado
  FROM ${GASTOS}
  WHERE CAST(negocio_id AS STRING) = @id
    AND incluir_en_totales
`;

// Suma en BigQuery sobre montos ya prorrateados al negocio (atribuibles).
// NC/ND se excluyen vía incluir_en_venta, por eso ncNeta/ndNeta/docsNC/docsND van en 0.
const VENTAS_AGGREGATE_SQL = `
  SELECT
    IFNULL(SUM(SAFE_CAST(venta_neta AS FLOAT64)), 0) AS ventaBrutaNeta,
    0 AS ncNeta,
    0 AS ndNeta,
    IFNULL(SUM(SAFE_CAST(venta_bruta AS FLOAT64)), 0) AS ventaBrutaTotal,
    IFNULL(SUM(SAFE_CAST(venta_iva AS FLOAT64)), 0) AS ivaTotal,
    0 AS cobrado,
    0 AS porCobrar,
    COUNT(*) AS docsVenta,
    0 AS docsNC,
    0 AS docsND
  FROM ${VENTAS}
  ${VENTAS_WHERE}
`;

// Resumen del negocio (marts.finanzas_negocios): cifras maestro (API Unabase)
// + su contraparte documentada en BQ + flags de reconciliación entre ambas.
// Reemplaza a agg.ventas/agg.margenRealFacturado como fuente de ResumenKpis.
const RESUMEN_SQL = `
  SELECT
    SAFE_CAST(venta_neta AS FLOAT64) AS ventaNeta,
    SAFE_CAST(venta_bruta AS FLOAT64) AS ventaBruta,
    SAFE_CAST(venta_facturada AS FLOAT64) AS ventaFacturada,
    SAFE_CAST(venta_neta_documentada AS FLOAT64) AS ventaNetaDocumentada,
    SAFE_CAST(venta_bruta_documentada AS FLOAT64) AS ventaBrutaDocumentada,
    SAFE_CAST(venta_iva_documentada AS FLOAT64) AS ventaIvaDocumentada,
    SAFE_CAST(docs_venta AS FLOAT64) AS docsVentaResumen,
    SAFE_CAST(gasto_real AS FLOAT64) AS gastoReal,
    SAFE_CAST(gasto_neto_documentado AS FLOAT64) AS gastoNetoDocumentado,
    SAFE_CAST(gasto_bruto_documentado AS FLOAT64) AS gastoBrutoDocumentado,
    SAFE_CAST(gasto_iva_documentado AS FLOAT64) AS gastoIvaDocumentado,
    SAFE_CAST(gasto_otros_impuestos_documentado AS FLOAT64) AS gastoOtrosImpuestosDocumentado,
    SAFE_CAST(gasto_retencion_honorarios_documentado AS FLOAT64) AS gastoRetencionHonorariosDocumentado,
    SAFE_CAST(lineas_gasto AS FLOAT64) AS lineasGasto,
    SAFE_CAST(utilidad_real AS FLOAT64) AS utilidadReal,
    SAFE_CAST(utilidad_final AS FLOAT64) AS utilidadFinal,
    flag_venta_no_reconcilia AS flagVentaNoReconcilia,
    flag_gasto_no_reconcilia AS flagGastoNoReconcilia
  FROM ${NEGOCIOS}
  WHERE CAST(negocio_id AS STRING) = @id
  LIMIT 1
`;

const VENTAS_SQL = `
  SELECT
    CAST(negocio_id AS STRING) AS id_negocio,
    CAST(documento_id AS STRING) AS id_documento,
    folio,
    CAST(fecha_emision AS STRING) AS fecha_emision,
    CAST(fecha_vencimiento AS STRING) AS fecha_vencimiento,
    estado_documento AS estado,
    tipo_documento,
    tipo_documento_abrev,
    cliente,
    cliente_rut AS rut_cliente,
    IFNULL(SAFE_CAST(cantidad_items_atribuibles AS INT64), 0) AS cantidad_items_atribuibles,
    SAFE_CAST(venta_neta_afecta AS FLOAT64) AS monto_neto_atribuible,
    SAFE_CAST(venta_exenta AS FLOAT64) AS monto_exento_atribuible,
    SAFE_CAST(venta_iva AS FLOAT64) AS monto_iva_atribuible,
    SAFE_CAST(venta_bruta AS FLOAT64) AS monto_total_atribuible,
    items_descripciones
  FROM ${VENTAS}
  ${VENTAS_WHERE}
  ORDER BY fecha_emision DESC, folio DESC
`;

export async function getNegocioDetail(
  externalId: string,
  monto: MontoMode = "neto",
): Promise<NegocioDetail> {
  const now = Date.now();
  const cacheKey = `${externalId}|${monto}`;
  const cached = detailCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const [itemsRaw, gastosRaw, ventasRaw, ventasAggRaw, resumenRaw, options] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(ITEMS_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(gastosSql(monto), { id: externalId })),
    withTimeout(query<Record<string, unknown>>(VENTAS_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(VENTAS_AGGREGATE_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(RESUMEN_SQL, { id: externalId })),
    getNegocioOptions(),
  ]);

  const items = itemsRaw.map((r) => serialize(r) as unknown as NegocioItemRow);
  const gastos = gastosRaw.map((r) => serialize(r) as unknown as DetalleGastoRow);
  const ventas = ventasRaw.map((r) => {
    const row = serialize(r) as unknown as VentaNegocioRow;
    // BigQuery devuelve el campo repeated como array; normalizamos a string[].
    row.items_descripciones = Array.isArray(row.items_descripciones)
      ? row.items_descripciones.map((d) => String(d)).filter(Boolean)
      : [];
    return row;
  });
  const ventasAggregate: VentasAggregateRaw = ventasAggRaw[0]
    ? (serialize(ventasAggRaw[0]) as unknown as VentasAggregateRaw)
    : EMPTY_VENTAS_AGGREGATE;
  const resumen: NegocioResumenRow | null = resumenRaw[0]
    ? (serialize(resumenRaw[0]) as unknown as NegocioResumenRow)
    : null;
  const negocio = options.find((o) => o.external_id === externalId) ?? null;

  let evento: CierreEventoRow | null = null;
  let eventoIdDetail: string | null = null;
  let marcaIngresoNeto: number | null = null;
  let marcaIngresoBruto: number | null = null;
  let mesasVipNeto: number | null = null;
  let mesasVipBruto: number | null = null;
  let mediosNeto: number | null = null;
  let mediosBruto: number | null = null;
  let marcaDetalle: IngresoDetalleRow[] = [];
  let mesasVipDetalle: IngresoDetalleRow[] = [];
  let mediosDetalle: IngresoDetalleRow[] = [];
  if (negocio) {
    const area = (negocio.area_negocio ?? "").trim().toLowerCase();
    const eventoId = (negocio.referencia ?? "").trim().slice(0, 6).toUpperCase();
    if (area === AREA_PRODUCCION && eventoId.length === 6) {
      const [
        eventoRaw,
        marcaAgg,
        mesasVipAgg,
        mediosAgg,
        marcaDet,
        mesasVipDet,
        mediosDet,
      ] = await Promise.all([
        withTimeout(query<Record<string, unknown>>(EVENTO_SQL, { eventoId })),
        getMarcaIngresosAggByEvento(eventoId),
        getMesasVipAggByEvento(eventoId),
        getMediosAggByEvento(eventoId),
        getMarcaIngresosDetalleByEvento(eventoId),
        getMesasVipDetalleByEvento(eventoId),
        getMediosDetalleByEvento(eventoId),
      ]);
      evento = eventoRaw[0]
        ? (serialize(eventoRaw[0]) as unknown as CierreEventoRow)
        : null;
      eventoIdDetail = eventoId;
      marcaIngresoNeto = marcaAgg.ventaNeto;
      marcaIngresoBruto = marcaAgg.ventaBruto;
      mesasVipNeto = mesasVipAgg.ventaNeto;
      mesasVipBruto = mesasVipAgg.ventaBruto;
      mediosNeto = mediosAgg.ventaNeto;
      mediosBruto = mediosAgg.ventaBruto;
      marcaDetalle = marcaDet;
      mesasVipDetalle = mesasVipDet;
      mediosDetalle = mediosDet;
    }
  }

  const detail: NegocioDetail = {
    negocio,
    items,
    gastos,
    ventas,
    ventasAggregate,
    resumen,
    evento,
    eventoId: eventoIdDetail,
    marcaIngresoNeto,
    marcaIngresoBruto,
    mesasVipNeto,
    mesasVipBruto,
    mediosNeto,
    mediosBruto,
    marcaDetalle,
    mesasVipDetalle,
    mediosDetalle,
  };
  detailCache.set(cacheKey, { data: detail, timestamp: now });
  return detail;
}

// Mapa EventoID → CategoriaEvento2 (tabla glovox.categoriaEvento). Se usa para
// agrupar los negocios de Producción por categoría. EventoID = primeros 6
// caracteres de la referencia del negocio.
let categoriaEventoCache: { data: Map<string, string>; timestamp: number } | null = null;

const CATEGORIA_EVENTO_SQL = `
  SELECT
    CAST(EventoID AS STRING) AS eventoId,
    CAST(CategoriaEvento2 AS STRING) AS categoria
  FROM ${CATEGORIA_EVENTO}
`;

export async function getCategoriaEventoMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (categoriaEventoCache && now - categoriaEventoCache.timestamp < CACHE_TTL_MS) {
    return categoriaEventoCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(CATEGORIA_EVENTO_SQL));
  const map = new Map<string, string>();
  for (const r of rows) {
    const row = serialize(r) as { eventoId?: string | null; categoria?: string | null };
    const eid = (row.eventoId ?? "").trim().toUpperCase();
    const cat = (row.categoria ?? "").trim();
    if (eid && cat) map.set(eid, cat);
  }
  categoriaEventoCache = { data: map, timestamp: now };
  return map;
}

export function invalidateCierreNegocioCache(externalId?: string): void {
  if (externalId) {
    detailCache.delete(`${externalId}|neto`);
    detailCache.delete(`${externalId}|bruto`);
    return;
  }
  detailCache.clear();
  optionsCache = null;
  categoriaEventoCache = null;
}
