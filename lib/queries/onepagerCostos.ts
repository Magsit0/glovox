import { cache } from "react";
import { query } from "@/lib/bigquery";

// Costos y facturación del ONEPAGER, por EventoID.
//
// Origen: Unabase → BigQuery. El dato crudo es `finanzas.unabase_detalle_gasto`
// (sucesora de la tabla legacy `unabase.detalleGasto`, historia conservada) y
// `finanzas.unabase_documentos_venta`; acá se leen las vistas CURADAS
// `marts.finanzas_gastos` / `marts.finanzas_ventas` (regla de oro de
// data-governance: los consumidores leen de marts, no de las tablas crudas).
// Ventajas que se heredan gratis: `evento_id` ya resuelto (primeros 6 chars de
// la referencia del negocio: GLO/GLP/527), modelo neto/IVA/bruto, categoría
// oficial del catálogo, predicados de universo y proveedor efectivo.
//
// Universo — mismo criterio que /cierre-negocio, pero por EVENTO y sumando
// TODOS los negocios que cuelgan de él (GLO042 tiene 6; GLO176 tiene 2):
//   * `incluir_en_totales` (gastos) / `incluir_en_venta` (ventas: sin anulados
//     ni notas de crédito/débito).
//   * `NOT es_interno_glovox` — regla de consumo de marts (los negocios internos
//     GLOVOX sólo pueden verse en /interno).
//   * `es_negocio_vigente` — sin cotizaciones ni nulos (el mismo universo que el
//     selector de /cierre-negocio).
//   NO se filtra por `es_produccion_propia`: GLO175 vive en el área "Eventos de
//   Marcas" y sus costos son igualmente del evento.
//
// EventoID — NO se usa el `evento_id` de la vista: ese solo se puebla cuando la
// referencia empieza con GLO/GLP/527, así que eventos como 660905 (Bajo Cero) o
// PPR025 (Yein Fonda) quedaban con NULL y sus costos no conectaban. La
// convención real es "el EventoID va al inicio del nombre del negocio", así que
// acá se deriva UPPER(LEFT(referencia, 6)) y se VALIDA contra el catálogo
// glovox.categoriaEvento (evita que un negocio cualquiera cuyos 6 primeros
// caracteres no son un evento se cuele en los mapas).
const P = process.env.BIGQUERY_PROJECT_ID;
const GASTOS = `\`${P}.marts.finanzas_gastos\``;
const VENTAS = `\`${P}.marts.finanzas_ventas\``;
const CATEGORIA_EVENTO = `\`${P}.glovox.categoriaEvento\``;

// EventoID derivado de la referencia del negocio (los marts en este SELECT no
// exponen la referencia con otro nombre, así que la expresión es compartida).
const EVENTO_EXPR = `UPPER(LEFT(referencia, 6))`;

// Catálogo dedupe (categoriaEvento puede traer filas repetidas por EventoID).
const CAT_CTE = `
  cat AS (
    SELECT DISTINCT EventoID
    FROM ${CATEGORIA_EVENTO}
    WHERE EventoID IS NOT NULL
  )
`;

const GASTOS_WHERE = `
  WHERE incluir_en_totales
    AND NOT es_interno_glovox
    AND es_negocio_vigente
`;

const VENTAS_WHERE = `
  WHERE incluir_en_venta
    AND NOT es_interno_glovox
    AND es_negocio_vigente
`;

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

function b(v: unknown): boolean | null {
  if (v == null) return null;
  return Boolean(v);
}

// ---------- Types ----------

/** Agregado de gasto de un evento (todas sus líneas documentadas en Unabase). */
export type OnepagerCostoAgg = {
  gastoNeto: number;
  gastoBruto: number;
  lineas: number;
  negocios: number;
};

/** Agregado de venta DOCUMENTADA (facturas Unabase) de un evento. */
export type OnepagerFacturacionAgg = {
  ventaNeta: number;
  ventaBruta: number;
  docs: number;
  negocios: number;
};

export type OnepagerCostoNegocio = {
  negocioId: string;
  referencia: string;
  areaNegocio: string;
  estado: string;
  lineas: number;
  gastoNeto: number;
  gastoBruto: number;
};

export type OnepagerCostoCategoriaRow = {
  categoria: string;
  lineas: number;
  gastoNeto: number;
  gastoBruto: number;
};

/** Una línea de gasto (1 fila = 1 ítem de gasto documentado en Unabase). */
export type OnepagerGastoRow = {
  gastoId: string;
  negocioId: string;
  referenciaNegocio: string;
  folio: string;
  /** Nº de documento tributario (factura/boleta) asociado al gasto; "" si aún no tiene. */
  nroDoc: string;
  fecha: string; // YYYY-MM-DD o ""
  proveedor: string; // proveedor efectivo (re-atribución Riesco aplicada)
  proveedorRut: string;
  tipoDocumento: string;
  categoriaOficial: string;
  subcategoriaOficial: string;
  categoriaRaw: string;
  itemNombre: string;
  descripcion: string;
  estado: string;
  pagoRealizado: boolean | null;
  impuestoTipo: string;
  gastoNeto: number;
  gastoIva: number;
  gastoBruto: number;
};

export type OnepagerCostosEvento = {
  resumen: {
    gastoNeto: number;
    gastoIva: number;
    gastoOtrosImpuestos: number;
    gastoBruto: number;
    lineas: number;
  };
  negocios: OnepagerCostoNegocio[];
  porCategoria: OnepagerCostoCategoriaRow[];
  gastos: OnepagerGastoRow[];
};

/** Un documento de venta (factura) atribuido a un negocio del evento. */
export type OnepagerFacturaRow = {
  documentoId: string;
  negocioId: string;
  referenciaNegocio: string;
  folio: string;
  tipoDocumento: string;
  tipoDocumentoAbrev: string;
  fechaEmision: string; // YYYY-MM-DD o ""
  fechaPago: string; // YYYY-MM-DD o ""
  cliente: string;
  clienteRut: string;
  itemsDescripciones: string[];
  estado: string;
  ventaNeta: number;
  ventaIva: number;
  ventaBruta: number;
  /** TRUE si el doc se atribuyó entero al negocio primario (STOPGAP jun-2026). */
  flagStopgap: boolean;
};

// ---------- Multi-evento (vista índice) ----------

/**
 * Gasto agregado por evento para TODOS los eventos con negocio en Unabase.
 * Los eventos sin negocio no aparecen en el mapa (el caller muestra "—").
 */
export async function getOnepagerCostosMap(): Promise<Map<string, OnepagerCostoAgg>> {
  const rows = await query<Record<string, unknown>>(`
    WITH ${CAT_CTE}
    SELECT
      c.EventoID                   AS evento_id,
      SUM(IFNULL(gasto_neto, 0))   AS gasto_neto,
      SUM(IFNULL(gasto_bruto, 0))  AS gasto_bruto,
      COUNT(*)                     AS lineas,
      COUNT(DISTINCT negocio_id)   AS negocios
    FROM ${GASTOS}
    JOIN cat c ON c.EventoID = ${EVENTO_EXPR}
    ${GASTOS_WHERE}
    GROUP BY evento_id
  `);
  const map = new Map<string, OnepagerCostoAgg>();
  for (const r of rows) {
    map.set(s(r.evento_id), {
      gastoNeto: n(r.gasto_neto),
      gastoBruto: n(r.gasto_bruto),
      lineas: n(r.lineas),
      negocios: n(r.negocios),
    });
  }
  return map;
}

/**
 * Venta documentada (facturas Unabase) agregada por evento. Montos ya
 * ATRIBUIBLES al negocio (la vista resuelve las facturas multi-negocio).
 */
export async function getOnepagerFacturacionMap(): Promise<
  Map<string, OnepagerFacturacionAgg>
> {
  const rows = await query<Record<string, unknown>>(`
    WITH ${CAT_CTE}
    SELECT
      c.EventoID                   AS evento_id,
      SUM(IFNULL(venta_neta, 0))   AS venta_neta,
      SUM(IFNULL(venta_bruta, 0))  AS venta_bruta,
      COUNT(*)                     AS docs,
      COUNT(DISTINCT negocio_id)   AS negocios
    FROM ${VENTAS}
    JOIN cat c ON c.EventoID = ${EVENTO_EXPR}
    ${VENTAS_WHERE}
    GROUP BY evento_id
  `);
  const map = new Map<string, OnepagerFacturacionAgg>();
  for (const r of rows) {
    map.set(s(r.evento_id), {
      ventaNeta: n(r.venta_neta),
      ventaBruta: n(r.venta_bruta),
      docs: n(r.docs),
      negocios: n(r.negocios),
    });
  }
  return map;
}

// ---------- Por evento (vista detalle) ----------

/**
 * Costos de un evento: líneas de gasto + agregados (resumen, por negocio, por
 * categoría oficial). Una sola pasada a BigQuery; los agregados se arman acá.
 * `cache()`: KpiStrip y DetalleSection lo piden en el mismo render → 1 query.
 */
export const getOnepagerCostosByEvento = cache(async function getOnepagerCostosByEvento(
  eventoId: string,
): Promise<OnepagerCostosEvento> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      CAST(gasto_id AS STRING)          AS gasto_id,
      CAST(negocio_id AS STRING)        AS negocio_id,
      referencia                        AS referencia_negocio,
      area_negocio,
      negocio_estado,
      folio,
      nro_doc,
      CAST(fecha AS STRING)             AS fecha,
      proveedor_efectivo                AS proveedor,
      proveedor_efectivo_rut            AS proveedor_rut,
      tipo_documento,
      IFNULL(categoria_oficial, 'SIN CLASIFICAR') AS categoria_oficial,
      subcategoria_oficial,
      categoria_raw,
      item_nombre,
      descripcion_gasto                 AS descripcion,
      estado_documento                  AS estado,
      pago_realizado,
      impuesto_tipo,
      IFNULL(gasto_neto, 0)             AS gasto_neto,
      IFNULL(gasto_iva, 0)              AS gasto_iva,
      IFNULL(gasto_otros_impuestos, 0)  AS gasto_otros_impuestos,
      IFNULL(gasto_bruto, 0)            AS gasto_bruto
    FROM ${GASTOS}
    ${GASTOS_WHERE}
      AND ${EVENTO_EXPR} = UPPER(@eventoId)
    ORDER BY fecha DESC, folio DESC
    `,
    { eventoId },
  );

  const gastos: OnepagerGastoRow[] = [];
  const negociosMap = new Map<string, OnepagerCostoNegocio>();
  const categoriaMap = new Map<string, OnepagerCostoCategoriaRow>();
  const resumen = {
    gastoNeto: 0,
    gastoIva: 0,
    gastoOtrosImpuestos: 0,
    gastoBruto: 0,
    lineas: 0,
  };

  for (const r of rows) {
    const row: OnepagerGastoRow = {
      gastoId: s(r.gasto_id),
      negocioId: s(r.negocio_id),
      referenciaNegocio: s(r.referencia_negocio),
      folio: s(r.folio),
      nroDoc: s(r.nro_doc),
      fecha: s(r.fecha),
      proveedor: s(r.proveedor),
      proveedorRut: s(r.proveedor_rut),
      tipoDocumento: s(r.tipo_documento),
      categoriaOficial: s(r.categoria_oficial) || "SIN CLASIFICAR",
      subcategoriaOficial: s(r.subcategoria_oficial),
      categoriaRaw: s(r.categoria_raw),
      itemNombre: s(r.item_nombre),
      descripcion: s(r.descripcion),
      estado: s(r.estado),
      pagoRealizado: b(r.pago_realizado),
      impuestoTipo: s(r.impuesto_tipo),
      gastoNeto: n(r.gasto_neto),
      gastoIva: n(r.gasto_iva),
      gastoBruto: n(r.gasto_bruto),
    };
    gastos.push(row);

    resumen.gastoNeto += row.gastoNeto;
    resumen.gastoIva += row.gastoIva;
    resumen.gastoOtrosImpuestos += n(r.gasto_otros_impuestos);
    resumen.gastoBruto += row.gastoBruto;
    resumen.lineas += 1;

    let neg = negociosMap.get(row.negocioId);
    if (!neg) {
      neg = {
        negocioId: row.negocioId,
        referencia: row.referenciaNegocio,
        areaNegocio: s(r.area_negocio),
        estado: s(r.negocio_estado),
        lineas: 0,
        gastoNeto: 0,
        gastoBruto: 0,
      };
      negociosMap.set(row.negocioId, neg);
    }
    neg.lineas += 1;
    neg.gastoNeto += row.gastoNeto;
    neg.gastoBruto += row.gastoBruto;

    let cat = categoriaMap.get(row.categoriaOficial);
    if (!cat) {
      cat = { categoria: row.categoriaOficial, lineas: 0, gastoNeto: 0, gastoBruto: 0 };
      categoriaMap.set(row.categoriaOficial, cat);
    }
    cat.lineas += 1;
    cat.gastoNeto += row.gastoNeto;
    cat.gastoBruto += row.gastoBruto;
  }

  return {
    resumen,
    negocios: Array.from(negociosMap.values()).sort((a, b) => b.gastoNeto - a.gastoNeto),
    porCategoria: Array.from(categoriaMap.values()).sort((a, b) => b.gastoNeto - a.gastoNeto),
    gastos,
  };
});

/**
 * Facturas (documentos de venta) atribuidas a los negocios del evento.
 * Montos atribuibles al negocio; sin anulados ni NC/ND (`incluir_en_venta`).
 * `cache()`: compartida entre KpiStrip y DetalleSection en el mismo render.
 */
export const getOnepagerFacturasByEvento = cache(async function getOnepagerFacturasByEvento(
  eventoId: string,
): Promise<OnepagerFacturaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      CAST(documento_id AS STRING)   AS documento_id,
      CAST(negocio_id AS STRING)     AS negocio_id,
      referencia                     AS referencia_negocio,
      folio,
      tipo_documento,
      tipo_documento_abrev,
      CAST(fecha_emision AS STRING)  AS fecha_emision,
      CAST(fecha_pago AS STRING)     AS fecha_pago,
      cliente,
      cliente_rut,
      items_descripciones,
      estado_documento               AS estado,
      IFNULL(venta_neta, 0)          AS venta_neta,
      IFNULL(venta_iva, 0)           AS venta_iva,
      IFNULL(venta_bruta, 0)         AS venta_bruta,
      IFNULL(flag_atribucion_stopgap, FALSE) AS flag_stopgap
    FROM ${VENTAS}
    ${VENTAS_WHERE}
      AND ${EVENTO_EXPR} = UPPER(@eventoId)
    ORDER BY fecha_emision DESC, folio DESC
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    documentoId: s(r.documento_id),
    negocioId: s(r.negocio_id),
    referenciaNegocio: s(r.referencia_negocio),
    folio: s(r.folio),
    tipoDocumento: s(r.tipo_documento),
    tipoDocumentoAbrev: s(r.tipo_documento_abrev),
    fechaEmision: s(r.fecha_emision),
    fechaPago: s(r.fecha_pago),
    cliente: s(r.cliente),
    clienteRut: s(r.cliente_rut),
    itemsDescripciones: Array.isArray(r.items_descripciones)
      ? (r.items_descripciones as unknown[]).map((d) => s(d)).filter(Boolean)
      : [],
    estado: s(r.estado),
    ventaNeta: n(r.venta_neta),
    ventaIva: n(r.venta_iva),
    ventaBruta: n(r.venta_bruta),
    flagStopgap: Boolean(r.flag_stopgap),
  }));
});
