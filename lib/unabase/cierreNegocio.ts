import type { DetalleGastoRow, NegocioItemRow } from "@/lib/unabase/types";

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

export interface ItemDetail {
  llave_item: string;
  item: string;
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
  avancePct: number;
  itemsTotales: number;
  itemsConOC: number;
  itemsSinOC: number;
  porCategoria: CategoriaBreakdown[];
  itemsConOcByCategoria: Record<string, number>;
  arbol: CategoriaNode[];
  topProveedores: ProveedorBreakdown[];
  ocStatus: OcStatusCounts;
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

export function aggregateNegocio(
  items: NegocioItemRow[],
  gastos: DetalleGastoRow[],
): NegocioAggregate {
  const totalVenta = items.reduce((sum, it) => sum + n(it.subtotal_venta), 0);
  const totalPresupuestoGasto = items.reduce(
    (sum, it) => sum + n(it.subtotal_gasto_pre),
    0,
  );
  const totalGastoReal = gastos.reduce((sum, g) => sum + n(g.costoempresa), 0);

  const itemsTotales = items.length;

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

  // Detalle por item con su gasto real (sumado desde detalleGasto) y nº facturas
  type ItemWithCat = ItemDetail & { categoria: string; subcategoria: string };
  const itemDetails: ItemWithCat[] = items.map((it) => {
    const llave = s(it.llave_item);
    const presupuesto = n(it.subtotal_gasto_pre);
    const data = gastoByLlave.get(llave);
    const gastoReal = data?.total ?? 0;
    return {
      categoria: s(it.categoria) || SIN_CAT,
      subcategoria: s(it.subcategoria) || SIN_SUB,
      llave_item: llave,
      item: s(it.item) || "(sin nombre)",
      descripcion: s(it.descripcion),
      cantidad: n(it.cantidad),
      presupuesto,
      gastoReal,
      diferencia: presupuesto - gastoReal,
      nFacturas: data?.n ?? 0,
    };
  });

  const itemByLlave = new Set<string>();
  for (const it of items) {
    const k = s(it.llave_item);
    if (k) itemByLlave.add(k);
  }

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
    const categoria = s(it.categoria) || SIN_CAT;
    ensureCat(categoria).venta += n(it.subtotal_venta);
  }

  // Gastos huérfanos (cuya llave_nv no aparece en items): se imputan a la categoría
  // que viene en el propio gasto, pero NO al árbol de items (no hay item al que colgar).
  for (const g of gastos) {
    const llave = s(g.llave_nv);
    if (itemByLlave.has(llave)) continue;
    const categoria = s(g.item_categoria) || SIN_CAT;
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

  const margenAbsoluto = totalVenta - totalGastoReal;
  const margenPct = totalVenta > 0 ? margenAbsoluto / totalVenta : 0;
  const avancePct =
    totalPresupuestoGasto > 0 ? totalGastoReal / totalPresupuestoGasto : 0;

  return {
    totalVenta,
    totalPresupuestoGasto,
    totalGastoReal,
    margenAbsoluto,
    margenPct,
    avancePct,
    itemsTotales,
    itemsConOC,
    itemsSinOC,
    porCategoria,
    itemsConOcByCategoria,
    arbol,
    topProveedores,
    ocStatus,
  };
}
