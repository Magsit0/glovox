import type {
  DetalleGastoRow,
  NegocioItemRow,
  VentaNegocioRow,
  VentasAggregateRaw,
} from "@/lib/unabase/types";

export interface CategoriaBreakdown {
  categoria: string;
  venta: number;
  presupuesto: number;
  gastoReal: number;
  diferencia: number;
  itemsCount: number;
}

export interface ProveedorBreakdown {
  proveedor: string;
  totalGasto: number;
  nFacturas: number;
  ruts: string[];
}

// Cómo se agrupan categorías/subcategorías en el desglose de gastos:
// "oficial" usa la tripleta del catálogo (resuelta por el seed
// finanzas.unabase_item_map); "original" usa los textos crudos del negocio.
export type CategoriaViewMode = "oficial" | "original";

export interface ItemDetail {
  llave_item: string;
  item: string;
  // Ítem oficial del catálogo ("" si el seed no resolvió a nivel ítem). En el
  // modo oficial se muestra como nombre principal y el texto crudo queda como
  // línea secundaria.
  itemOficial: string;
  descripcion: string;
  cantidad: number;
  presupuesto: number;
  gastoReal: number;
  diferencia: number;
  nFacturas: number;
}

export interface SubcategoriaNode {
  subcategoria: string;
  presupuesto: number;
  gastoReal: number;
  diferencia: number;
  itemsCount: number;
  items: ItemDetail[];
}

export interface CategoriaNode {
  categoria: string;
  presupuesto: number;
  gastoReal: number;
  diferencia: number;
  itemsCount: number;
  subcategorias: SubcategoriaNode[];
}

export interface TopCliente {
  cliente: string;
  rut: string;
  total: number;
  nDocs: number;
}

export interface ItemDescripcionBreakdown {
  descripcion: string;
  total: number;
  nDocs: number;
}

export interface VentasAggregate {
  ventaNeta: number;
  ivaTotal: number;
  ventaBrutaTotal: number;
  docsVenta: number;
  topClientes: TopCliente[];
  porTipoDoc: Record<string, number>;
  itemsDescripcion: ItemDescripcionBreakdown[];
}

export interface OcStatusCounts {
  porEstado: Record<string, number>;
  totalDocs: number;
  validados: number;
  justificados: number;
  porTipoDoc: Record<string, number>;
  porTipoGasto: Record<string, number>;
}

export interface NegocioAggregate {
  totalVenta: number;
  totalPresupuestoGasto: number;
  totalGastoReal: number;
  margenAbsoluto: number;
  margenPct: number;
  margenLibro: number;
  margenLibroPct: number;
  margenRealFacturado: number;
  margenRealFacturadoPct: number;
  avancePct: number;
  itemsTotales: number;
  itemsConOC: number;
  itemsSinOC: number;
  porCategoria: CategoriaBreakdown[];
  itemsConOcByCategoria: Record<string, number>;
  arbol: CategoriaNode[];
  topProveedores: ProveedorBreakdown[];
  ocStatus: OcStatusCounts;
  ventas: VentasAggregate;
}

const TOP_PROVEEDORES_LIMIT = 10;
const SIN_CAT = "SIN CATEGORÍA";
const SIN_SUB = "SIN SUBCATEGORÍA";

function n(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function s(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}


const ITEMS_DESCRIPCION_LIMIT = 8;

export function aggregateVentas(
  ventas: VentaNegocioRow[],
  precomputed?: VentasAggregateRaw,
): VentasAggregate {
  // Categóricos / clientes / ítems vienen del detalle (no se derivan del agregado).
  const porTipoDoc: Record<string, number> = {};
  const clienteMap = new Map<
    string,
    { cliente: string; rut: string; total: number; nDocs: number }
  >();
  const itemDescMap = new Map<string, { total: number; nDocs: number }>();

  for (const v of ventas) {
    const tipo = s(v.tipo_documento_abrev) || "SIN TIPO";
    porTipoDoc[tipo] = (porTipoDoc[tipo] ?? 0) + 1;

    const neto = n(v.monto_neto_atribuible) + n(v.monto_exento_atribuible);

    const rut = s(v.rut_cliente);
    const cliente = s(v.cliente) || "Cliente sin identificar";
    const key = rut || cliente;
    let row = clienteMap.get(key);
    if (!row) {
      row = { cliente, rut, total: 0, nDocs: 0 };
      clienteMap.set(key, row);
    }
    row.total += neto;
    row.nDocs += 1;

    // Atribuimos el neto del documento a cada descripción de ítem, repartido en
    // partes iguales para no inflar el total cuando hay varias por documento.
    const descripciones = Array.isArray(v.items_descripciones)
      ? v.items_descripciones.map((d) => s(d)).filter(Boolean)
      : [];
    const unicas = Array.from(new Set(descripciones));
    if (unicas.length > 0) {
      const share = neto / unicas.length;
      for (const desc of unicas) {
        let d = itemDescMap.get(desc);
        if (!d) {
          d = { total: 0, nDocs: 0 };
          itemDescMap.set(desc, d);
        }
        d.total += share;
        d.nDocs += 1;
      }
    }
  }

  // Totales monetarios: SUM() exacto de BigQuery (ya prorrateado al negocio);
  // sólo caer al cálculo en JS si no se entregó agregado precomputado.
  let ventaNeta = 0;
  let ventaBrutaTotal = 0;
  let ivaTotal = 0;
  let docsVenta = 0;

  if (precomputed) {
    ventaNeta = n(precomputed.ventaBrutaNeta);
    ventaBrutaTotal = n(precomputed.ventaBrutaTotal);
    ivaTotal = n(precomputed.ivaTotal);
    docsVenta = n(precomputed.docsVenta);
  } else {
    for (const v of ventas) {
      ventaNeta += n(v.monto_neto_atribuible) + n(v.monto_exento_atribuible);
      ventaBrutaTotal += n(v.monto_total_atribuible);
      ivaTotal += n(v.monto_iva_atribuible);
      docsVenta += 1;
    }
  }

  const topClientes = Array.from(clienteMap.values())
    .sort((a, b) => b.total - a.total);

  const itemsDescripcion: ItemDescripcionBreakdown[] = Array.from(itemDescMap.entries())
    .map(([descripcion, d]) => ({ descripcion, total: d.total, nDocs: d.nDocs }))
    .sort((a, b) => b.total - a.total)
    .slice(0, ITEMS_DESCRIPCION_LIMIT);

  return {
    ventaNeta,
    ivaTotal,
    ventaBrutaTotal,
    docsVenta,
    topClientes,
    porTipoDoc,
    itemsDescripcion,
  };
}

export function aggregateNegocio(
  items: NegocioItemRow[],
  gastos: DetalleGastoRow[],
  ventas: VentaNegocioRow[] = [],
  ventasPrecomputed?: VentasAggregateRaw,
  modo: CategoriaViewMode = "original",
): NegocioAggregate {
  const oficial = modo === "oficial";
  const totalVenta = items.reduce((sum, it) => sum + n(it.subtotal_venta), 0);
  const totalPresupuestoGasto = items.reduce(
    (sum, it) => sum + n(it.subtotal_gasto_pre),
    0,
  );
  const totalGastoReal = gastos.reduce((sum, g) => sum + n(g.costoempresa), 0);

  // Gastos agregados por llave_item: total y nº de documentos
  const gastoByLlave = new Map<string, { total: number; n: number }>();
  for (const g of gastos) {
    const key = s(g.llave_nv);
    if (!key) continue;
    let row = gastoByLlave.get(key);
    if (!row) {
      row = { total: 0, n: 0 };
      gastoByLlave.set(key, row);
    }
    row.total += n(g.costoempresa);
    row.n += 1;
  }

  // Detalle por item con su gasto real (sumado desde detalleGasto) y nº facturas.
  // En modo oficial la jerarquía viene de la tripleta del catálogo; el texto
  // crudo del ítem se conserva siempre (es la línea real del negocio).
  type ItemWithCat = ItemDetail & { categoria: string; subcategoria: string };
  const itemDetailsRaw: ItemWithCat[] = items.map((it) => {
    const llave = s(it.llave_item);
    const presupuesto = n(it.subtotal_gasto_pre);
    const data = gastoByLlave.get(llave);
    const gastoReal = data?.total ?? 0;
    return {
      categoria: oficial
        ? s(it.categoria_oficial) || SIN_CAT
        : s(it.categoria) || SIN_CAT,
      subcategoria: oficial
        ? s(it.subcategoria_oficial) || SIN_SUB
        : s(it.subcategoria) || SIN_SUB,
      llave_item: llave,
      item: s(it.item) || "(sin nombre)",
      itemOficial: s(it.item_oficial),
      descripcion: s(it.descripcion),
      cantidad: n(it.cantidad),
      presupuesto,
      gastoReal,
      diferencia: presupuesto - gastoReal,
      nFacturas: data?.n ?? 0,
    };
  });

  // Deduplica por llave_item: la tabla origen puede tener filas repetidas con la
  // misma llave (problema de datos en origen). Merge: suma presupuesto, conserva
  // gastoReal del primer registro encontrado (ya es el total consolidado desde
  // gastoByLlave — todas las filas duplicadas apuntarían al mismo valor).
  const dedupMap = new Map<string, ItemWithCat>();
  for (const det of itemDetailsRaw) {
    const existing = dedupMap.get(det.llave_item);
    if (existing) {
      existing.presupuesto += det.presupuesto;
      existing.diferencia = existing.presupuesto - existing.gastoReal;
    } else {
      dedupMap.set(det.llave_item, { ...det });
    }
  }
  const itemDetails = Array.from(dedupMap.values());
  const itemsTotales = itemDetails.length;

  const itemByLlave = new Set<string>(itemDetails.map((d) => d.llave_item).filter(Boolean));

  const itemsConOC = itemDetails.filter((d) => d.nFacturas > 0).length;
  const itemsSinOC = itemsTotales - itemsConOC;

  // Construye el árbol categoría -> subcategoría -> items
  const catMap = new Map<string, CategoriaBreakdown>();
  const treeMap = new Map<string, Map<string, ItemDetail[]>>();

  function ensureCat(categoria: string): CategoriaBreakdown {
    let row = catMap.get(categoria);
    if (!row) {
      row = {
        categoria,
        venta: 0,
        presupuesto: 0,
        gastoReal: 0,
        diferencia: 0,
        itemsCount: 0,
      };
      catMap.set(categoria, row);
    }
    return row;
  }

  for (const det of itemDetails) {
    const cat = ensureCat(det.categoria);
    cat.venta += 0; // se acumula desde items abajo
    cat.presupuesto += det.presupuesto;
    cat.gastoReal += det.gastoReal;
    cat.itemsCount += 1;

    let subs = treeMap.get(det.categoria);
    if (!subs) {
      subs = new Map();
      treeMap.set(det.categoria, subs);
    }
    let arr = subs.get(det.subcategoria);
    if (!arr) {
      arr = [];
      subs.set(det.subcategoria, arr);
    }
    arr.push({
      llave_item: det.llave_item,
      item: det.item,
      itemOficial: det.itemOficial,
      descripcion: det.descripcion,
      cantidad: det.cantidad,
      presupuesto: det.presupuesto,
      gastoReal: det.gastoReal,
      diferencia: det.diferencia,
      nFacturas: det.nFacturas,
    });
  }

  // Venta a nivel categoría (no asociada a items pero la guardamos por consistencia)
  for (const it of items) {
    const categoria = oficial
      ? s(it.categoria_oficial) || SIN_CAT
      : s(it.categoria) || SIN_CAT;
    ensureCat(categoria).venta += n(it.subtotal_venta);
  }

  // Gastos huérfanos (cuya llave_nv no aparece en items): se imputan a la categoría
  // que viene en el propio gasto, pero NO al árbol de items (no hay item al que colgar).
  for (const g of gastos) {
    const llave = s(g.llave_nv);
    if (itemByLlave.has(llave)) continue;
    const categoria = oficial
      ? s(g.categoria_oficial) || SIN_CAT
      : s(g.item_categoria) || SIN_CAT;
    ensureCat(categoria).gastoReal += n(g.costoempresa);
  }

  for (const cat of catMap.values()) {
    cat.diferencia = cat.presupuesto - cat.gastoReal;
  }

  const itemsConOcByCategoria: Record<string, number> = {};
  for (const det of itemDetails) {
    if (det.nFacturas > 0) {
      itemsConOcByCategoria[det.categoria] =
        (itemsConOcByCategoria[det.categoria] ?? 0) + 1;
    }
  }

  const porCategoria = Array.from(catMap.values()).sort(
    (a, b) => b.presupuesto + b.gastoReal - (a.presupuesto + a.gastoReal),
  );

  const arbol: CategoriaNode[] = porCategoria.map((cat) => {
    const subsMap = treeMap.get(cat.categoria) ?? new Map<string, ItemDetail[]>();
    const subcategorias: SubcategoriaNode[] = Array.from(subsMap.entries())
      .map(([subcategoria, subItems]) => {
        const presupuesto = subItems.reduce((sum, it) => sum + it.presupuesto, 0);
        const gastoReal = subItems.reduce((sum, it) => sum + it.gastoReal, 0);
        const sortedItems = [...subItems].sort((a, b) => {
          const aSize = a.gastoReal + a.presupuesto;
          const bSize = b.gastoReal + b.presupuesto;
          return bSize - aSize;
        });
        return {
          subcategoria,
          presupuesto,
          gastoReal,
          diferencia: presupuesto - gastoReal,
          itemsCount: subItems.length,
          items: sortedItems,
        };
      })
      .sort(
        (a, b) =>
          b.presupuesto + b.gastoReal - (a.presupuesto + a.gastoReal),
      );

    return {
      categoria: cat.categoria,
      presupuesto: cat.presupuesto,
      gastoReal: cat.gastoReal,
      diferencia: cat.diferencia,
      itemsCount: cat.itemsCount,
      subcategorias,
    };
  });

  // Top proveedores
  const provMap = new Map<string, { totalGasto: number; nFacturas: number; ruts: Set<string> }>();
  for (const g of gastos) {
    const provName = s(g.proveedor) || "Proveedor sin identificar";
    let row = provMap.get(provName);
    if (!row) {
      row = { totalGasto: 0, nFacturas: 0, ruts: new Set() };
      provMap.set(provName, row);
    }
    row.totalGasto += n(g.costoempresa);
    row.nFacturas += 1;
    if (g.rut) row.ruts.add(s(g.rut));
  }

  const provArr = Array.from(provMap.entries())
    .map(([proveedor, data]) => ({
      proveedor,
      totalGasto: data.totalGasto,
      nFacturas: data.nFacturas,
      ruts: Array.from(data.ruts),
    }))
    .sort((a, b) => b.totalGasto - a.totalGasto);

  const topProveedores: ProveedorBreakdown[] = [];
  if (provArr.length <= TOP_PROVEEDORES_LIMIT) {
    topProveedores.push(...provArr);
  } else {
    topProveedores.push(...provArr.slice(0, TOP_PROVEEDORES_LIMIT));
    const rest = provArr.slice(TOP_PROVEEDORES_LIMIT);
    const otrosTotal = rest.reduce((sum, p) => sum + p.totalGasto, 0);
    const otrosFacturas = rest.reduce((sum, p) => sum + p.nFacturas, 0);
    topProveedores.push({
      proveedor: `Otros (${rest.length})`,
      totalGasto: otrosTotal,
      nFacturas: otrosFacturas,
      ruts: [],
    });
  }

  // Estado de OCs
  const porEstado: Record<string, number> = {};
  const porTipoDoc: Record<string, number> = {};
  const porTipoGasto: Record<string, number> = {};
  let validados = 0;
  let justificados = 0;
  for (const g of gastos) {
    const estado = s(g.estado) || "SIN ESTADO";
    porEstado[estado] = (porEstado[estado] ?? 0) + 1;

    const tipoDoc = s(g.doc) || "SIN TIPO";
    porTipoDoc[tipoDoc] = (porTipoDoc[tipoDoc] ?? 0) + 1;

    const tipoGasto = s(g.item_tipo_gasto) || "SIN TIPO";
    porTipoGasto[tipoGasto] = (porTipoGasto[tipoGasto] ?? 0) + 1;

    if (s(g.validado).toLowerCase() === "true") validados += 1;
    if (s(g.item_justificado).toLowerCase() === "true") justificados += 1;
  }

  const ocStatus: OcStatusCounts = {
    porEstado,
    totalDocs: gastos.length,
    validados,
    justificados,
    porTipoDoc,
    porTipoGasto,
  };

  const ventasAgg = aggregateVentas(ventas, ventasPrecomputed);

  const margenAbsoluto = totalVenta - totalGastoReal;
  const margenPct = totalVenta > 0 ? margenAbsoluto / totalVenta : 0;
  const margenLibro = margenAbsoluto;
  const margenLibroPct = margenPct;
  const margenRealFacturado = ventasAgg.ventaNeta - totalGastoReal;
  const margenRealFacturadoPct =
    ventasAgg.ventaNeta > 0 ? margenRealFacturado / ventasAgg.ventaNeta : 0;
  const avancePct =
    totalPresupuestoGasto > 0 ? totalGastoReal / totalPresupuestoGasto : 0;

  return {
    totalVenta,
    totalPresupuestoGasto,
    totalGastoReal,
    margenAbsoluto,
    margenPct,
    margenLibro,
    margenLibroPct,
    margenRealFacturado,
    margenRealFacturadoPct,
    avancePct,
    itemsTotales,
    itemsConOC,
    itemsSinOC,
    porCategoria,
    itemsConOcByCategoria,
    arbol,
    topProveedores,
    ocStatus,
    ventas: ventasAgg,
  };
}
