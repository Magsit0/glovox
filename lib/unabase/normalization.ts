import { safeText, parseNumber } from "@/lib/unabase/formatting";
import { parseDateFlexible } from "@/lib/unabase/dates";
import { CLIENT_FIELD_CANDIDATES } from "@/lib/unabase/constants";
import type { CategoriaViewMode } from "@/lib/unabase/cierreNegocio";
import type { BusinessRow, ExpenseRow, RawRow } from "@/lib/unabase/types";

// Etiquetas del modo "Catálogo oficial" (mismas de /cierre-negocio, para que
// ambos dashboards cuenten la misma historia con los mismos nombres).
const SIN_SUB_OFICIAL = "SIN SUBCATEGORÍA";

/** Categoría de gasto de una línea según el modo de agrupación. */
const catDeLinea = (row: RawRow, modo: CategoriaViewMode): string =>
  modo === "oficial"
    ? safeText(row.categoria_oficial ?? "SIN CLASIFICAR")
    : safeText(row.categoria ?? row.itemNombreGasto ?? row.itemNombre);

/** Subcategoría de gasto de una línea según el modo de agrupación. */
const subDeLinea = (row: RawRow, modo: CategoriaViewMode): string => {
  if (modo === "oficial") {
    const sub = safeText(row.subcategoria_oficial);
    return sub === "Sin dato" ? SIN_SUB_OFICIAL : sub;
  }
  return safeText(
    row.subCategoria ??
      row.subcategoria ??
      row.clasificacionContable ??
      row.itemNombreGasto ??
      row.itemNombre,
  );
};

const getField = (row: RawRow, key: string): unknown => row[key];

export const getPrincipalClient = (row: RawRow): string => {
  for (const field of CLIENT_FIELD_CANDIDATES) {
    if (field in row && safeText(row[field]) !== "Sin dato") {
      return safeText(row[field]);
    }
  }
  return "Sin dato";
};

export const getBusinessKey = (row: RawRow): string => {
  const candidates = ["EventoID", "external_id", "NombreID", "nombre_negocio", "NombreNegocio"];
  for (const c of candidates) {
    const v = getField(row, c);
    if (v !== undefined && v !== null && String(v) !== "") return String(v);
  }
  return "sin-id";
};

export const getEventName = (row: RawRow): string =>
  safeText(
    row.NombreID ??
      row.NombreNegocio ??
      row.nombre_negocio ??
      row.NombreGlovox ??
      row.Nombre,
  );

export const getExpenseValue = (row: RawRow): number => parseNumber(row.gasto_real);
export const getBudgetValue = (row: RawRow): number => parseNumber(row.subtotal_gasto_pre);
export const getIncomeValue = (row: RawRow): number =>
  parseNumber(row.ingreso_total_neto_prorrateado ?? row.ingreso_total_neto);
export const getFacturadoValue = (row: RawRow): number =>
  parseNumber(row.ingreso ?? row.ingresoAPI);
export const getAssistantsValue = (row: RawRow): number =>
  parseNumber(
    row.totalAsistentes ?? row.total_asistentes ?? row.asistentes ?? row.cantidad_asistentes,
  );

export const normalizeExpenseRows = (
  rows: RawRow[],
  modo: CategoriaViewMode = "original",
): ExpenseRow[] =>
  rows.map((row, index) => ({
    rowIndex: index,
    key: getBusinessKey(row),
    EventoID: safeText(row.EventoID ?? row.external_id ?? row.NombreID),
    nombre: getEventName(row),
    nombreGlovox: safeText(row.NombreGlovox ?? row.NombreID ?? row.NombreNegocio),
    area_negocio: safeText(row.area_negocio),
    cat2: safeText(row.CategoriaEvento2),
    cat1: safeText(row.CategoriaEvento),
    estado: safeText(row.estadonv ?? row.estado),
    principalCliente: getPrincipalClient(row),
    categoriaGasto: catDeLinea(row, modo),
    subCategoria: subDeLinea(row, modo),
    // El ítem oficial manda cuando el seed lo resolvió; el texto crudo es el fallback.
    itemGasto:
      modo === "oficial" && safeText(row.item_oficial) !== "Sin dato"
        ? safeText(row.item_oficial)
        : safeText(row.item ?? row.itemNombreGasto ?? row.itemNombre ?? row.descripcion),
    gasto: getExpenseValue(row),
    presupuesto: getBudgetValue(row),
    ingreso: getIncomeValue(row),
    facturado: getFacturadoValue(row),
    asistentes: getAssistantsValue(row),
    fechaAsignacion: safeText(row.fechaAsignacion),
    fechaNegocio: safeText(row.fechaNegocio),
  }));

type WorkingBusiness = Omit<
  BusinessRow,
  "margen" | "desviacion" | "margenPct" | "topCategoria" | "negocioIds"
> & { negocioIdSet: Set<string> };

export const aggregateBusinesses = (
  rows: RawRow[],
  modo: CategoriaViewMode = "original",
): BusinessRow[] => {
  const map = new Map<string, WorkingBusiness>();

  rows.forEach((row) => {
    const key = getBusinessKey(row);

    if (!map.has(key)) {
      map.set(key, {
        key,
        EventoID: safeText(row.EventoID ?? row.external_id),
        nombre: getEventName(row),
        area_negocio: safeText(row.area_negocio),
        cat2: safeText(row.CategoriaEvento2),
        cat1: safeText(row.CategoriaEvento),
        estado: safeText(row.estadonv ?? row.estado),
        fechaNegocio: safeText(row.fechaNegocio),
        fechaAsignacion: safeText(row.fechaAsignacion),
        principalCliente: getPrincipalClient(row),
        ingreso: 0,
        ingresoProrrateado: 0,
        facturado: 0,
        asistentes: 0,
        gasto: 0,
        presupuesto: 0,
        categoriasGasto: {},
        subCategoriasGasto: {},
        documentos: 0,
        negocioIdSet: new Set<string>(),
      });
    }

    const item = map.get(key)!;
    // negocio_id real de la línea (external_id del SQL) para poder enlazar al
    // informe /cierre-negocio, que se abre por id y no por EventoID.
    const negocioId = safeText(row.external_id);
    if (negocioId && negocioId !== "Sin dato") item.negocioIdSet.add(negocioId);
    const ingresoEvento = getIncomeValue(row);
    const facturadoEvento = getFacturadoValue(row);
    const asistentesEvento = getAssistantsValue(row);
    const gastoLinea = getExpenseValue(row);
    const presupuestoLinea = getBudgetValue(row);

    item.ingreso = Math.max(item.ingreso, ingresoEvento);
    item.ingresoProrrateado = Math.max(item.ingresoProrrateado, ingresoEvento);
    item.facturado = Math.max(item.facturado, facturadoEvento);
    item.asistentes = Math.max(item.asistentes, asistentesEvento);
    item.gasto += gastoLinea;
    item.presupuesto += presupuestoLinea;
    item.documentos += row.idGastoVenta ? 1 : 0;

    const clientCandidate = getPrincipalClient(row);
    if (item.principalCliente === "Sin dato" && clientCandidate !== "Sin dato") {
      item.principalCliente = clientCandidate;
    }

    if (item.fechaAsignacion === "Sin dato" && safeText(row.fechaAsignacion) !== "Sin dato") {
      item.fechaAsignacion = safeText(row.fechaAsignacion);
    }

    const cat = catDeLinea(row, modo);
    if (gastoLinea > 0) {
      item.categoriasGasto[cat] = (item.categoriasGasto[cat] || 0) + gastoLinea;
      const subCat = subDeLinea(row, modo);
      const subKey = `${cat} › ${subCat}`;
      item.subCategoriasGasto[subKey] = (item.subCategoriasGasto[subKey] || 0) + gastoLinea;
    }
  });

  return Array.from(map.values())
    .map((item): BusinessRow => {
      const margen = item.ingreso - item.gasto;
      const desviacion = item.presupuesto ? item.gasto - item.presupuesto : 0;
      const margenPct = item.ingreso ? margen / item.ingreso : 0;
      const topCategoria =
        Object.entries(item.categoriasGasto).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin gasto";
      const { negocioIdSet, ...rest } = item;
      return {
        ...rest,
        negocioIds: Array.from(negocioIdSet).sort(),
        margen,
        desviacion,
        margenPct,
        topCategoria,
      };
    })
    .sort((a, b) => {
      const diff = parseDateFlexible(a.fechaAsignacion) - parseDateFlexible(b.fechaAsignacion);
      if (diff !== 0) return diff;
      return a.nombre.localeCompare(b.nombre, "es");
    });
};
