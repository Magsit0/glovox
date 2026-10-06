import { query } from "@/lib/bigquery";
import type {
  FdsEventOption,
  FdsGastoBucket,
  FdsGastoEdicion,
  FdsGastosData,
  FdsHistoricoRow,
  FdsRankingData,
  FdsRankingEdicion,
  FdsStand,
} from "@/lib/fds/types";

const P = process.env.BIGQUERY_PROJECT_ID;

const CATEGORIA_EV = `\`${P}.glovox.categoriaEvento\``;
const TICKETS = `\`${P}.glovox.tickets\``;
const SOLD_ITEMS = `\`${P}.onfire.soldItems\``;
const CIERRE_EVENTOS = `\`${P}.ticketsAndAABB.cierreEventos\``;
// Migrado 3-jul-2026 a las vistas curadas (antes: finanzas.unabase_negocios +
// finanzas.unabase_detalle_gasto crudas, con el crosswalk de categorías
// implementado en TypeScript — hoy vive en el seed finanzas.unabase_categoria_map
// y la vista lo resuelve en `categoria_oficial`).
const NEGOCIOS = `\`${P}.marts.finanzas_negocios\``;
const GASTOS = `\`${P}.marts.finanzas_gastos\``;
const CATALOGO = `\`${P}.finanzas.unabase_catalogo\``;

export type MontoMode = "neto" | "bruto";

// Negocio de producción del evento (mismo criterio histórico que /cierre-negocio
// y estadoNegocio); la vista ya deriva `evento_id` y `es_produccion_propia`.
const NEGOCIO_PRODUCCION_WHERE = `
  es_produccion_propia
  AND LOWER(IFNULL(estado, '')) <> 'cotizacion'
`;

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
      const anyVal = val as {
        value?: unknown;
        constructor?: { name?: string };
        toString(): string;
      };
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

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function boolish(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() === "true";
}

function safePerCapita(total: number, asistentes: number | null): number | null {
  if (!asistentes || asistentes <= 0) return null;
  return total / asistentes;
}

function withTimeout<T>(p: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(`BigQuery tardó demasiado (>${Math.floor(ms / 1000)}s). Intentá de nuevo.`),
        ),
      ms,
    ),
  );
  return Promise.race([p, timeoutPromise]);
}

// --- Selector de ediciones -------------------------------------------------

const EVENT_OPTIONS_SQL = `
  WITH fds AS (
    SELECT EventoID,
           ANY_VALUE(NombreGlovox) AS nombre,
           IFNULL(ANY_VALUE(Temporada), '') AS temporada
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  ),
  fe AS (
    SELECT EventoID, FORMAT_DATE('%Y-%m-%d', DATE(MIN(FechaEvento))) AS fecha
    FROM ${TICKETS}
    WHERE EventoID IN (SELECT EventoID FROM fds) AND FechaEvento IS NOT NULL
    GROUP BY EventoID
  ),
  ce AS (
    SELECT EventoID, MAX(TotalPersonasAsistentes) AS asistentes
    FROM ${CIERRE_EVENTOS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  ff AS (
    SELECT EventoID, COUNT(*) AS filas
    FROM ${SOLD_ITEMS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  fin AS (
    SELECT evento_id AS eid
    FROM ${NEGOCIOS}
    WHERE ${NEGOCIO_PRODUCCION_WHERE}
      AND evento_id IN (SELECT EventoID FROM fds)
    GROUP BY 1
  )
  SELECT
    f.EventoID           AS eventoId,
    f.nombre             AS nombre,
    f.temporada          AS temporada,
    fe.fecha             AS fechaEvento,
    ce.asistentes        AS asistentes,
    IFNULL(ff.filas, 0) > 0        AS tieneFfbb,
    fin.eid IS NOT NULL            AS tieneFinanzas
  FROM fds f
  LEFT JOIN fe ON fe.EventoID = f.EventoID
  LEFT JOIN ce ON ce.EventoID = f.EventoID
  LEFT JOIN ff ON ff.EventoID = f.EventoID
  LEFT JOIN fin ON fin.eid = f.EventoID
  ORDER BY fe.fecha DESC NULLS LAST, f.EventoID DESC
`;

let optionsCache: { data: FdsEventOption[]; timestamp: number } | null = null;

export async function getFdsEventOptions(): Promise<FdsEventOption[]> {
  const now = Date.now();
  if (optionsCache && now - optionsCache.timestamp < CACHE_TTL_MS) {
    return optionsCache.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(EVENT_OPTIONS_SQL));
  const data: FdsEventOption[] = rows.map((r) => {
    const s = serialize(r);
    return {
      eventoId: str(s.eventoId),
      nombre: str(s.nombre) || str(s.eventoId),
      fechaEvento: strOrNull(s.fechaEvento),
      temporada: str(s.temporada),
      asistentes: s.asistentes == null ? null : num(s.asistentes),
      tieneFfbb: boolish(s.tieneFfbb),
      tieneFinanzas: boolish(s.tieneFinanzas),
    };
  });
  optionsCache = { data, timestamp: now };
  return data;
}

// --- Histórico entre ediciones ---------------------------------------------

/** Columnas de venta/gasto por modo. Mapa fijo: NUNCA interpolar input del usuario.
 *  Nota bruto: la venta bruta sale del maestro (total_nv = neto + IVA); el gasto
 *  bruto sale del detalle documentado (`gasto_bruto_documentado`) porque el
 *  maestro de Unabase no desglosa IVA del costo. */
const FIN_COLS: Record<MontoMode, { venta: string; gasto: string }> = {
  neto: { venta: "venta_neta", gasto: "gasto_real" },
  bruto: { venta: "venta_bruta", gasto: "gasto_bruto_documentado" },
};

const historicoSql = (monto: MontoMode) => `
  WITH fds AS (
    SELECT EventoID,
           ANY_VALUE(NombreGlovox) AS nombre,
           IFNULL(ANY_VALUE(Temporada), '') AS temporada
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  ),
  fe AS (
    SELECT EventoID, FORMAT_DATE('%Y-%m-%d', DATE(MIN(FechaEvento))) AS fecha
    FROM ${TICKETS}
    WHERE EventoID IN (SELECT EventoID FROM fds) AND FechaEvento IS NOT NULL
    GROUP BY EventoID
  ),
  tk AS (
    SELECT EventoID, SUM(Precio - IFNULL(Descuento, 0)) AS venta
    FROM ${TICKETS}
    WHERE EventoID IN (SELECT EventoID FROM fds) AND EsDevuelto IS NOT TRUE
    GROUP BY EventoID
  ),
  ff AS (
    SELECT EventoID, SUM(IFNULL(SubTotal, 0)) AS venta
    FROM ${SOLD_ITEMS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  ce AS (
    SELECT EventoID, MAX(TotalPersonasAsistentes) AS asistentes
    FROM ${CIERRE_EVENTOS}
    WHERE EventoID IN (SELECT EventoID FROM fds)
    GROUP BY EventoID
  ),
  fin AS (
    SELECT evento_id AS eid,
           SUM(IFNULL(${FIN_COLS[monto].venta}, 0)) AS facturado,
           SUM(IFNULL(${FIN_COLS[monto].gasto}, 0)) AS costoReal
    FROM ${NEGOCIOS}
    WHERE ${NEGOCIO_PRODUCCION_WHERE}
      AND evento_id IN (SELECT EventoID FROM fds)
    GROUP BY 1
  )
  SELECT
    f.EventoID AS eventoId, f.nombre AS nombre, f.temporada AS temporada,
    fe.fecha AS fechaEvento, ce.asistentes AS asistentes,
    IFNULL(tk.venta, 0) AS ventaTickets, IFNULL(ff.venta, 0) AS ventaFfbb,
    fin.facturado AS facturado, fin.costoReal AS costoReal
  FROM fds f
  LEFT JOIN fe ON fe.EventoID = f.EventoID
  LEFT JOIN tk ON tk.EventoID = f.EventoID
  LEFT JOIN ff ON ff.EventoID = f.EventoID
  LEFT JOIN ce ON ce.EventoID = f.EventoID
  LEFT JOIN fin ON fin.eid = f.EventoID
  ORDER BY fe.fecha ASC NULLS LAST, f.EventoID ASC
`;

const historicoCache = new Map<
  MontoMode,
  { data: FdsHistoricoRow[]; timestamp: number }
>();

export async function getFdsHistorico(
  monto: MontoMode = "neto",
): Promise<FdsHistoricoRow[]> {
  const now = Date.now();
  const cached = historicoCache.get(monto);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(historicoSql(monto)));
  const data: FdsHistoricoRow[] = rows.map((r) => {
    const s = serialize(r);
    const asistentes = s.asistentes == null ? null : num(s.asistentes);
    const ventaFfbb = num(s.ventaFfbb);
    const facturado = s.facturado == null ? null : num(s.facturado);
    const costoReal = s.costoReal == null ? null : num(s.costoReal);
    return {
      eventoId: str(s.eventoId),
      nombre: str(s.nombre) || str(s.eventoId),
      temporada: str(s.temporada),
      fechaEvento: strOrNull(s.fechaEvento),
      asistentes,
      ventaTickets: num(s.ventaTickets),
      ventaFfbb,
      perCapitaFfbb: safePerCapita(ventaFfbb, asistentes),
      facturado,
      costoReal,
      margen: facturado != null && costoReal != null ? facturado - costoReal : null,
    };
  });
  historicoCache.set(monto, { data, timestamp: now });
  return data;
}

// --- Gastos del negocio por categoría (baseline de presupuesto) ------------
//
// Fuente: marts.finanzas_gastos. `gasto_neto` (= item_costo_empresa, la métrica
// canónica que reconcilia con el costo_real del maestro) o `gasto_bruto` según
// el switch. La categoría YA viene resuelta en `categoria_oficial` (17 del
// catálogo) vía el seed finanzas.unabase_categoria_map — el crosswalk que antes
// vivía acá en TypeScript (FDS_ALIAS_RAW + getFdsCatalogoLookup); corregir un
// mapeo hoy = editar el CSV del seed en data-governance y recargarlo.
// Universo = mismo histórico: negocios de producción con estadonv<>nulo y
// estado<>cotizacion, gastos con incluir_en_totales (= NOT excluir_gasto).
const OTRAS_LABEL = "Otras / sin clasificar";
// La vista marca lo no mapeado como 'SIN CLASIFICAR'; en la UI se muestra con
// el label histórico de FDS.
const SIN_CLASIFICAR = "SIN CLASIFICAR";

const gastosCategoriaSql = (monto: MontoMode) => `
  WITH universo AS (
    SELECT EventoID
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  )
  SELECT
    evento_id,
    categoria_oficial,
    SUM(${monto === "bruto" ? "gasto_bruto" : "IFNULL(gasto_neto, 0)"}) AS monto
  FROM ${GASTOS}
  WHERE incluir_en_totales
    AND es_produccion_propia
    AND LOWER(IFNULL(negocio_estadonv, '')) <> 'nulo'
    AND LOWER(IFNULL(negocio_estado, '')) <> 'cotizacion'
    AND evento_id IN (SELECT EventoID FROM universo)
  GROUP BY evento_id, categoria_oficial
  HAVING monto > 0
`;

// Top de textos crudos que el seed aún no mapea (para revisarlos y agregarlos
// al CSV). Independiente del modo neto/bruto: se reporta en neto.
const SIN_MAPEAR_SQL = `
  WITH universo AS (
    SELECT EventoID
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  )
  SELECT
    UPPER(TRIM(IFNULL(categoria_raw, '(sin categoría)'))) AS categoria,
    SUM(IFNULL(gasto_neto, 0)) AS monto
  FROM ${GASTOS}
  WHERE incluir_en_totales
    AND es_produccion_propia
    AND flag_categoria_sin_mapear
    AND LOWER(IFNULL(negocio_estadonv, '')) <> 'nulo'
    AND LOWER(IFNULL(negocio_estado, '')) <> 'cotizacion'
    AND evento_id IN (SELECT EventoID FROM universo)
  GROUP BY 1
  HAVING monto > 0
  ORDER BY monto DESC
  LIMIT 12
`;

/** Presentación Title Case de una categoría del catálogo (viene en MAYÚSCULAS). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s/&(-])([a-záéíóúñ])/g, (_, p, c) => p + c.toUpperCase());
}

let catalogoOrdenCache: { data: string[]; timestamp: number } | null = null;

/** Categorías top-level del catálogo oficial en orden de código (para ordenar
 *  las columnas del desglose). El mapeo texto→categoría ya NO vive acá: lo
 *  resuelve la vista vía el seed finanzas.unabase_categoria_map. */
async function getCatalogoOrden(): Promise<string[]> {
  const now = Date.now();
  if (catalogoOrdenCache && now - catalogoOrdenCache.timestamp < CACHE_TTL_MS) {
    return catalogoOrdenCache.data;
  }
  const raw = await withTimeout(
    query<Record<string, unknown>>(
      `SELECT categoria, MIN(codigo) AS cod
       FROM ${CATALOGO}
       WHERE categoria IS NOT NULL
       GROUP BY categoria
       ORDER BY cod`,
    ),
  );
  const data = raw.map((r) => str(serialize(r).categoria)).filter(Boolean);
  catalogoOrdenCache = { data, timestamp: now };
  return data;
}

function tierForOtras(otrasPct: number): FdsGastoEdicion["tier"] {
  if (otrasPct < 0.15) return "A";
  if (otrasPct < 0.35) return "B";
  return "C";
}

const gastosCache = new Map<MontoMode, { data: FdsGastosData; timestamp: number }>();

export async function getFdsGastosPorCategoria(
  monto: MontoMode = "neto",
): Promise<FdsGastosData> {
  const now = Date.now();
  const cached = gastosCache.get(monto);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const [rows, sinMapearRows, options, catalogoOrden] = await Promise.all([
    withTimeout(query<Record<string, unknown>>(gastosCategoriaSql(monto))),
    withTimeout(query<Record<string, unknown>>(SIN_MAPEAR_SQL)),
    getFdsEventOptions(),
    getCatalogoOrden(),
  ]);

  const optById = new Map(options.map((o) => [o.eventoId, o]));

  // Filas ya clasificadas por la vista → montos por categoría oficial por edición.
  const perEdition = new Map<string, Map<string, number>>();
  const seenCategorias = new Set<string>();
  for (const r of rows) {
    const s = serialize(r);
    const eventoId = str(s.evento_id);
    const oficial = str(s.categoria_oficial);
    const montoFila = num(s.monto);
    if (!eventoId) continue;
    // 'SIN CLASIFICAR' de la vista → label histórico de FDS.
    const categoria = oficial === SIN_CLASIFICAR || !oficial ? OTRAS_LABEL : oficial;
    seenCategorias.add(categoria);
    let byCat = perEdition.get(eventoId);
    if (!byCat) {
      byCat = new Map();
      perEdition.set(eventoId, byCat);
    }
    byCat.set(categoria, (byCat.get(categoria) ?? 0) + montoFila);
  }

  // Keys canónicas: categorias del catálogo que aparecen (en orden del catálogo)
  // + "Otras" al final si hubo gasto sin clasificar.
  const bucketKeys = catalogoOrden.filter((c) => seenCategorias.has(c));
  if (seenCategorias.has(OTRAS_LABEL)) bucketKeys.push(OTRAS_LABEL);
  const bucketLabels: Record<string, string> = {};
  for (const k of bucketKeys) bucketLabels[k] = k === OTRAS_LABEL ? OTRAS_LABEL : titleCase(k);

  const editions: FdsGastoEdicion[] = [];
  for (const [eventoId, byCat] of perEdition) {
    const total = [...byCat.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    const buckets: FdsGastoBucket[] = bucketKeys.map((key) => {
      const monto = byCat.get(key) ?? 0;
      return { key, label: bucketLabels[key], monto, pct: total > 0 ? monto / total : 0 };
    });
    const otrasPct = (byCat.get(OTRAS_LABEL) ?? 0) / total;
    const opt = optById.get(eventoId);
    editions.push({
      eventoId,
      nombre: opt?.nombre ?? eventoId,
      fechaEvento: opt?.fechaEvento ?? null,
      asistentes: opt?.asistentes ?? null,
      totalReal: total,
      otrasPct,
      tier: tierForOtras(otrasPct),
      buckets,
    });
  }

  editions.sort((a, b) => {
    if (a.fechaEvento && b.fechaEvento) return a.fechaEvento.localeCompare(b.fechaEvento);
    if (a.fechaEvento !== b.fechaEvento) return a.fechaEvento ? -1 : 1;
    return a.eventoId.localeCompare(b.eventoId, "es", { numeric: true });
  });

  const sinMapear = sinMapearRows.map((r) => {
    const s = serialize(r);
    return { categoria: str(s.categoria), monto: num(s.monto) };
  });

  const data: FdsGastosData = { editions, bucketKeys, bucketLabels, sinMapear };
  gastosCache.set(monto, { data, timestamp: now });
  return data;
}

// --- Ranking de sangucherías -----------------------------------------------

const RANKING_SQL = `
  WITH fds AS (
    SELECT EventoID, ANY_VALUE(NombreGlovox) AS nombre
    FROM ${CATEGORIA_EV}
    WHERE UPPER(IFNULL(CategoriaEvento, '')) = 'FDS' AND EventoID IS NOT NULL
    GROUP BY EventoID
  )
  SELECT
    s.EventoID                                      AS eventoId,
    ANY_VALUE(f.nombre)                             AS nombre,
    FORMAT_DATE('%Y-%m-%d', DATE(MIN(s.HoraPedido))) AS fecha,
    TRIM(s.NombrePunto)                             AS punto,
    SUM(IFNULL(s.SubTotal, 0))                      AS venta,
    COUNT(DISTINCT s.NumeroOrden)                   AS ordenes
  FROM ${SOLD_ITEMS} s
  JOIN fds f ON f.EventoID = s.EventoID
  WHERE s.NombrePunto IS NOT NULL
  GROUP BY s.EventoID, punto
`;

// Puntos que no son stands de sangucheros: barras/carros de tragos y cerveza
// de producción, barra de vinos, y puntos internos de Onfire (cover, puerta,
// abonos, bingo). "Barra de Pickles / By María" sí es un stand de comida.
const NO_STAND_RE =
  /^(barra|carro|combi|ambulantes)\b(?!.*pickles)|bocas moradas|^bingo$|^cover\b|^puerta\b|^abonos\b|plant store/;

// Mismo stand con otro nombre entre ediciones (clave ya normalizada).
const STAND_ALIAS: Record<string, string> = {
  "bestias burger": "bestias",
  "helados timaukel": "timaukel",
  "barra de pickles by maria": "by maria",
  "tukuy sonqo cafe especialida": "tukuy sonqo",
  "tuku y sonqo": "tukuy sonqo",
  "cara de pezkao": "cara de pezcado",
};

function standKey(nombre: string): string {
  const k = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return STAND_ALIAS[k] ?? k;
}

let rankingCache: { data: FdsRankingData; timestamp: number } | null = null;

export async function getFdsRankingSangucherias(): Promise<FdsRankingData> {
  const now = Date.now();
  if (rankingCache && now - rankingCache.timestamp < CACHE_TTL_MS) {
    return rankingCache.data;
  }

  const rows = await withTimeout(query<Record<string, unknown>>(RANKING_SQL));

  const edMap = new Map<string, FdsRankingEdicion & { fecha: string }>();
  const excluidos = new Set<string>();
  const porEdicion = new Map<string, { key: string; nombre: string; venta: number; ordenes: number }[]>();

  for (const r of rows) {
    const s = serialize(r);
    const eventoId = str(s.eventoId);
    const punto = str(s.punto).replace(/\*/g, "").trim();
    if (!punto) continue;
    if (NO_STAND_RE.test(punto.toLowerCase())) {
      excluidos.add(punto);
      continue;
    }
    const venta = num(s.venta);
    if (venta <= 0) continue;
    if (!edMap.has(eventoId)) {
      edMap.set(eventoId, { eventoId, nombre: str(s.nombre) || eventoId, totalStands: 0, fecha: str(s.fecha) });
    }
    edMap.get(eventoId)!.totalStands += venta;
    // Dos puntos que normalizan al mismo stand en una edición se suman.
    const key = standKey(punto);
    const list = porEdicion.get(eventoId) ?? [];
    const prev = list.find((p) => p.key === key);
    if (prev) {
      prev.venta += venta;
      prev.ordenes += num(s.ordenes);
    } else {
      list.push({ key, nombre: punto, venta, ordenes: num(s.ordenes) });
    }
    porEdicion.set(eventoId, list);
  }

  const editions = [...edMap.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Recorre en orden cronológico para que el nombre visible quede el de la
  // edición más reciente en que participó el stand.
  const stands = new Map<string, FdsStand>();
  for (const ed of editions) {
    const list = (porEdicion.get(ed.eventoId) ?? []).sort((a, b) => b.venta - a.venta);
    list.forEach((p, i) => {
      const st = stands.get(p.key) ?? { key: p.key, nombre: p.nombre, porEdicion: {} };
      st.porEdicion[ed.eventoId] = { venta: p.venta, ordenes: p.ordenes, rank: i + 1 };
      st.nombre = p.nombre;
      stands.set(p.key, st);
    });
  }

  const data: FdsRankingData = {
    editions: editions.map(({ eventoId, nombre, totalStands }) => ({ eventoId, nombre, totalStands })),
    stands: [...stands.values()],
    excluidos: [...excluidos].sort((a, b) => a.localeCompare(b, "es")),
  };
  rankingCache = { data, timestamp: now };
  return data;
}

export function invalidateFdsCache(): void {
  optionsCache = null;
  historicoCache.clear();
  gastosCache.clear();
  catalogoOrdenCache = null;
  rankingCache = null;
}
