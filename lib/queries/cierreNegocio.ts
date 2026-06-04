import { query } from "@/lib/bigquery";
import { getMarcaIngresosAggByEvento } from "@/lib/queries/marca";
import type {
  CierreEventoRow,
  DetalleGastoRow,
  NegocioItemRow,
  NegocioOption,
  VentaNegocioRow,
  VentasAggregateRaw,
} from "@/lib/unabase/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const NEGOCIOS = `\`${P}.unabase.negocios\``;
const NEGOCIO_ITEM = `\`${P}.unabase.negocioItem\``;
const DETALLE_GASTO = `\`${P}.unabase.detalleGasto\``;
const VENTAS_NEGOCIO = `\`${P}.finanzas.unabase_ventas_por_negocio\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;

// Filtro común de ventas: documentos vivos del negocio, excluyendo anulados y
// (por ahora) notas de crédito/débito. tipo_documento es texto descriptivo
// ("FACTURA ELECTRONICA", "NOTA DE CREDITO ELECTRONICA"), así que filtramos por
// substring cubriendo variantes con y sin acento.
const VENTAS_WHERE = `
  WHERE CAST(id_negocio AS STRING) = @id
    AND LOWER(IFNULL(CAST(estado AS STRING), '')) NOT IN ('anulado', 'anulada')
    AND NOT (
      LOWER(IFNULL(CAST(tipo_documento AS STRING), '')) LIKE '%credito%'
      OR LOWER(IFNULL(CAST(tipo_documento AS STRING), '')) LIKE '%crédito%'
      OR LOWER(IFNULL(CAST(tipo_documento AS STRING), '')) LIKE '%debito%'
      OR LOWER(IFNULL(CAST(tipo_documento AS STRING), '')) LIKE '%débito%'
    )
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

const NEGOCIO_OPTIONS_SQL = `
  SELECT
    CAST(id AS STRING) AS external_id,
    CAST(referencia AS STRING) AS referencia,
    CAST(area_negocio AS STRING) AS area_negocio,
    CAST(estado AS STRING) AS estado,
    CAST(estadocierre AS STRING) AS estadocierre
  FROM ${NEGOCIOS}
  WHERE LOWER(CAST(estado AS STRING)) <> 'cotizacion'
    AND LOWER(CAST(estadonv AS STRING)) <> 'nulo'
    AND LOWER(CAST(area_negocio AS STRING)) <> 'glovox'
  ORDER BY SAFE_CAST(id AS INT64) DESC
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
  evento: CierreEventoRow | null;
  // Ingresos de marcas imputados en el ONEPAGER (Neon). Neto agregado por evento.
  // null cuando el negocio no es de producción de eventos propios.
  marcaIngresoNeto: number | null;
}

const EVENTO_SQL = `
  SELECT
    CAST(EventoID AS STRING) AS EventoID,
    CAST(NombreGlovox AS STRING) AS nombreGlovox,
    CAST(CategoriaEvento AS STRING) AS categoriaEvento,
    SAFE_CAST(TotalVentaTICKETS AS FLOAT64) AS totalVentaTickets,
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

const ITEMS_SQL = `
  SELECT *
  FROM ${NEGOCIO_ITEM}
  WHERE CAST(external_id AS STRING) = @id
`;

const GASTOS_SQL = `
  SELECT *
  FROM ${DETALLE_GASTO}
  WHERE CAST(negocio AS STRING) = @id
    AND LOWER(IFNULL(CAST(excluir_gasto AS STRING), '')) <> 'true'
`;

// Suma en BigQuery sobre montos ya prorrateados al negocio (atribuibles).
// NC/ND se excluyen vía VENTAS_WHERE, por eso ncNeta/ndNeta/docsNC/docsND van en 0.
const VENTAS_AGGREGATE_SQL = `
  SELECT
    IFNULL(SUM(IFNULL(SAFE_CAST(monto_neto_atribuible AS FLOAT64), 0) + IFNULL(SAFE_CAST(monto_exento_atribuible AS FLOAT64), 0)), 0) AS ventaBrutaNeta,
    0 AS ncNeta,
    0 AS ndNeta,
    IFNULL(SUM(IFNULL(SAFE_CAST(monto_total_atribuible AS FLOAT64), 0)), 0) AS ventaBrutaTotal,
    IFNULL(SUM(IFNULL(SAFE_CAST(monto_iva_atribuible AS FLOAT64), 0)), 0) AS ivaTotal,
    0 AS cobrado,
    0 AS porCobrar,
    COUNT(*) AS docsVenta,
    0 AS docsNC,
    0 AS docsND
  FROM ${VENTAS_NEGOCIO}
  ${VENTAS_WHERE}
`;

const VENTAS_SQL = `
  SELECT
    CAST(id_negocio AS STRING) AS id_negocio,
    CAST(id_documento AS STRING) AS id_documento,
    CAST(folio AS STRING) AS folio,
    CAST(fecha_emision AS STRING) AS fecha_emision,
    CAST(fecha_vencimiento AS STRING) AS fecha_vencimiento,
    estado,
    tipo_documento,
    tipo_documento_abrev,
    cliente,
    rut_cliente,
    IFNULL(SAFE_CAST(cantidad_items_atribuibles AS INT64), 0) AS cantidad_items_atribuibles,
    IFNULL(SAFE_CAST(monto_neto_atribuible AS FLOAT64), 0) AS monto_neto_atribuible,
    IFNULL(SAFE_CAST(monto_exento_atribuible AS FLOAT64), 0) AS monto_exento_atribuible,
    IFNULL(SAFE_CAST(monto_iva_atribuible AS FLOAT64), 0) AS monto_iva_atribuible,
    IFNULL(SAFE_CAST(monto_total_atribuible AS FLOAT64), 0) AS monto_total_atribuible,
    items_descripciones
  FROM ${VENTAS_NEGOCIO}
  ${VENTAS_WHERE}
  ORDER BY fecha_emision DESC, folio DESC
`;

export async function getNegocioDetail(externalId: string): Promise<NegocioDetail> {
  const now = Date.now();
  const cached = detailCache.get(externalId);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const [itemsRaw, gastosRaw, ventasRaw, ventasAggRaw, options] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(ITEMS_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(GASTOS_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(VENTAS_SQL, { id: externalId })),
    withTimeout(query<Record<string, unknown>>(VENTAS_AGGREGATE_SQL, { id: externalId })),
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
  const negocio = options.find((o) => o.external_id === externalId) ?? null;

  let evento: CierreEventoRow | null = null;
  let marcaIngresoNeto: number | null = null;
  if (negocio) {
    const area = (negocio.area_negocio ?? "").trim().toLowerCase();
    const eventoId = (negocio.referencia ?? "").trim().slice(0, 6);
    if (area === AREA_PRODUCCION && eventoId.length === 6) {
      const [eventoRaw, marcaAgg] = await Promise.all([
        withTimeout(query<Record<string, unknown>>(EVENTO_SQL, { eventoId })),
        getMarcaIngresosAggByEvento(eventoId),
      ]);
      evento = eventoRaw[0]
        ? (serialize(eventoRaw[0]) as unknown as CierreEventoRow)
        : null;
      marcaIngresoNeto = marcaAgg.ventaNeto;
    }
  }

  const detail: NegocioDetail = {
    negocio,
    items,
    gastos,
    ventas,
    ventasAggregate,
    evento,
    marcaIngresoNeto,
  };
  detailCache.set(externalId, { data: detail, timestamp: now });
  return detail;
}

export function invalidateCierreNegocioCache(externalId?: string): void {
  if (externalId) {
    detailCache.delete(externalId);
    return;
  }
  detailCache.clear();
  optionsCache = null;
}
