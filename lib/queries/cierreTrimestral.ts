import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;

const CIERRE = `\`${P}.ticketsAndAABB.cierreEventos\``;
const TICKETS = `\`${P}.glovox.tickets\``;
// Migrado 3-jul-2026: antes leía la tabla LEGACY `unabase.negocios` (sin
// pipeline, desactualizada desde el 12-jun). La vista curada expone las etapas
// del ciclo con nombres claros (venta_neta / venta_bruta).
const NEGOCIOS = `\`${P}.marts.finanzas_negocios\``;
const RRSS = `\`${P}.marketing.rrss_fllws\``;

const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_TIMEOUT_MS = 25_000;

function n(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "object" && "value" in (v as object)) {
    const inner = (v as { value: unknown }).value;
    if (inner == null) return null;
    const num = Number(inner);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function s(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "object" && "value" in (v as object)) {
    const inner = (v as { value: unknown }).value;
    return inner == null ? null : String(inner);
  }
  return String(v);
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

export interface CierreEventoTrimestralRow {
  EventoID: string | null;
  NombreGlovox: string | null;
  NombreID: string | null;
  CategoriaEvento: string | null;
  CategoriaEvento2: string | null;
  TotalVentaFFBB: number | null;
  TotalVentaBB: number | null;
  TotalVentaFF: number | null;
  TotalVentaFFBBVIP: number | null;
  TotalVentaFFBBGRAL: number | null;
  TotalVentaTICKETS: number | null;
  TotalVentaTICKETScomunidadsinrebate: number | null;
  TotalVentaTICKETScomunidadconrebate: number | null;
  TotalTicketsVendidos: number | null;
  TotalTicketsVendidosComunidad: number | null;
  PorcentajeTicketsVendidosComunidad: number | null;
  TotalNominados: number | null;
  TotalAsistentes: number | null;
  TotalNominadosVIP: number | null;
  TotalAsistentesVIP: number | null;
  TotalNominadosGENERAL: number | null;
  TotalAsistentesGENERAL: number | null;
  TotalNominadosCOMUNIDAD: number | null;
  TotalAsistentesCOMUNIDAD: number | null;
  PorcentajeNominadosComunidad: number | null;
  PorcentajeAsistentesComunidad: number | null;
  PerCapitaFFyBB: number | null;
  PerCapitaFFyBBVIP: number | null;
  PerCapitaFFyBBGRAL: number | null;
  PerCapitaTicketsQuemados: number | null;
  PerCapitaTicketsNominados: number | null;
  PerCapitaTicketsVenta: number | null;
  GastoPM: number | null;
  GastoPMxTicket: number | null;
  FechaEvento: string | null;
}

const SQL = `
  WITH fechaEvento AS (
    SELECT EventoID, FORMAT_TIMESTAMP('%Y-%m-%d', MIN(FechaEvento)) AS FechaEvento
    FROM ${TICKETS}
    GROUP BY EventoID
  )
  SELECT a.*, b.FechaEvento
  FROM ${CIERRE} a
  LEFT JOIN fechaEvento b
    ON a.EventoID = b.EventoID
`;

function mapRow(r: Record<string, unknown>): CierreEventoTrimestralRow {
  return {
    EventoID: s(r.EventoID),
    NombreGlovox: s(r.NombreGlovox),
    NombreID: s(r.NombreID),
    CategoriaEvento: s(r.CategoriaEvento),
    CategoriaEvento2: s(r.CategoriaEvento2),
    TotalVentaFFBB: n(r.TotalVentaFFBB),
    TotalVentaBB: n(r.TotalVentaBB),
    TotalVentaFF: n(r.TotalVentaFF),
    TotalVentaFFBBVIP: n(r.TotalVentaFFBBVIP),
    TotalVentaFFBBGRAL: n(r.TotalVentaFFBBGRAL),
    TotalVentaTICKETS: n(r.TotalVentaTICKETS),
    TotalVentaTICKETScomunidadsinrebate: n(r.TotalVentaTICKETScomunidadsinrebate),
    TotalVentaTICKETScomunidadconrebate: n(r.TotalVentaTICKETScomunidadconrebate),
    TotalTicketsVendidos: n(r.TotalTicketsVendidos),
    TotalTicketsVendidosComunidad: n(r.TotalTicketsVendidosComunidad),
    PorcentajeTicketsVendidosComunidad: n(r.PorcentajeTicketsVendidosComunidad),
    TotalNominados: n(r.TotalNominados),
    TotalAsistentes: n(r.TotalAsistentes),
    TotalNominadosVIP: n(r.TotalNominadosVIP),
    TotalAsistentesVIP: n(r.TotalAsistentesVIP),
    TotalNominadosGENERAL: n(r.TotalNominadosGENERAL),
    TotalAsistentesGENERAL: n(r.TotalAsistentesGENERAL),
    TotalNominadosCOMUNIDAD: n(r.TotalNominadosCOMUNIDAD),
    TotalAsistentesCOMUNIDAD: n(r.TotalAsistentesCOMUNIDAD),
    PorcentajeNominadosComunidad: n(r.PorcentajeNominadosComunidad),
    PorcentajeAsistentesComunidad: n(r.PorcentajeAsistentesComunidad),
    PerCapitaFFyBB: n(r.PerCapitaFFyBB),
    PerCapitaFFyBBVIP: n(r.PerCapitaFFyBBVIP),
    PerCapitaFFyBBGRAL: n(r.PerCapitaFFyBBGRAL),
    PerCapitaTicketsQuemados: n(r.PerCapitaTicketsQuemados),
    PerCapitaTicketsNominados: n(r.PerCapitaTicketsNominados),
    PerCapitaTicketsVenta: n(r.PerCapitaTicketsVenta),
    GastoPM: n(r.GastoPM),
    GastoPMxTicket: n(r.GastoPMxTicket),
    FechaEvento: s(r.FechaEvento),
  };
}

let cache: { data: CierreEventoTrimestralRow[]; timestamp: number } | null = null;

export async function getCierreTrimestralRows(): Promise<CierreEventoTrimestralRow[]> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) return cache.data;
  const rows = await withTimeout(query<Record<string, unknown>>(SQL));
  const data = rows.map(mapRow);
  cache = { data, timestamp: now };
  return data;
}

export function invalidateCierreTrimestralCache(): void {
  cache = null;
}

export interface TrimestreOption {
  id: string; // "2025-Q3"
  label: string; // "Q3 2025"
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

function quarterFromDate(iso: string): { year: number; quarter: 1 | 2 | 3 | 4 } | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const quarter = (Math.ceil(month / 3) as 1 | 2 | 3 | 4);
  return { year, quarter };
}

export function getTrimestresDisponibles(
  rows: CierreEventoTrimestralRow[],
): TrimestreOption[] {
  const seen = new Map<string, TrimestreOption>();
  for (const r of rows) {
    if (!r.FechaEvento) continue;
    const q = quarterFromDate(r.FechaEvento);
    if (!q) continue;
    const id = `${q.year}-Q${q.quarter}`;
    if (!seen.has(id)) {
      seen.set(id, { id, label: `Q${q.quarter} ${q.year}`, year: q.year, quarter: q.quarter });
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.quarter - a.quarter,
  );
}

export interface NegocioVentaRow {
  id: string | null;
  areaNegocio: string | null;
  fechaAsignacion: string | null; // DD-MM-YYYY (formateada desde la DATE de la vista)
  totalNeto: number;
}

export type MontoMode = "neto" | "bruto";

/** Columna de venta por modo. Mapa fijo: NUNCA interpolar input del usuario. */
const VENTA_COL: Record<MontoMode, string> = {
  neto: "venta_neta",
  bruto: "venta_bruta",
};

// `fecha_asignacion` se re-formatea a DD-MM-YYYY para conservar el shape que
// parsea quarterFromDmy (la legacy la traía como string en ese formato; los
// sentinels '00-00-00' de la legacy hoy son NULL → quedan fuera igual).
const negociosSql = (monto: MontoMode) => `
  SELECT
    CAST(negocio_id AS STRING)                    AS id,
    area_negocio,
    FORMAT_DATE('%d-%m-%Y', fecha_asignacion)     AS fecha_asignacion,
    SAFE_CAST(${VENTA_COL[monto]} AS FLOAT64)     AS total_neto
  FROM ${NEGOCIOS}
`;

const negociosCache = new Map<
  MontoMode,
  { data: NegocioVentaRow[]; timestamp: number }
>();

export async function getNegociosVentas(
  monto: MontoMode = "neto",
): Promise<NegocioVentaRow[]> {
  const now = Date.now();
  const cached = negociosCache.get(monto);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const rows = await withTimeout(query<Record<string, unknown>>(negociosSql(monto)));
  const data: NegocioVentaRow[] = rows.map((r) => ({
    id: s(r.id),
    areaNegocio: s(r.area_negocio),
    fechaAsignacion: s(r.fecha_asignacion),
    totalNeto: n(r.total_neto) ?? 0,
  }));
  negociosCache.set(monto, { data, timestamp: now });
  return data;
}

// "DD-MM-YYYY" → { year, quarter }. Devuelve null si la fecha es placeholder ("00-00-00") o inválida.
function quarterFromDmy(raw: string): { year: number; quarter: 1 | 2 | 3 | 4 } | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (!m) return null;
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
    return null;
  }
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
  return { year, quarter };
}

export function filterNegociosByTrimestre(
  rows: NegocioVentaRow[],
  trimestreId: string,
): NegocioVentaRow[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(trimestreId);
  if (!m) return [];
  const year = Number(m[1]);
  const quarter = Number(m[2]);
  return rows.filter((r) => {
    if (!r.fechaAsignacion) return false;
    const q = quarterFromDmy(r.fechaAsignacion);
    return !!q && q.year === year && q.quarter === quarter;
  });
}

export function filterByTrimestre(
  rows: CierreEventoTrimestralRow[],
  trimestreId: string,
): CierreEventoTrimestralRow[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(trimestreId);
  if (!m) return [];
  const year = Number(m[1]);
  const quarter = Number(m[2]);
  return rows.filter((r) => {
    if (!r.FechaEvento) return false;
    const q = quarterFromDate(r.FechaEvento);
    return !!q && q.year === year && q.quarter === quarter;
  });
}

export interface RrssRow {
  date: string;
  network: string | null;
  label: string | null;
  totalFollowers: number | null;
}

const RRSS_SQL = `
  SELECT
    CAST(date AS STRING)                AS date,
    CAST(network AS STRING)             AS network,
    CAST(label AS STRING)               AS label,
    SAFE_CAST(total_followers AS INT64) AS total_followers
  FROM ${RRSS}
  ORDER BY date ASC
`;

let rrssCache: { data: RrssRow[]; timestamp: number } | null = null;

export async function getRrssFollowers(): Promise<RrssRow[]> {
  const now = Date.now();
  if (rrssCache && now - rrssCache.timestamp < CACHE_TTL_MS) return rrssCache.data;
  const rows = await withTimeout(query<Record<string, unknown>>(RRSS_SQL));
  const data: RrssRow[] = rows.map((r) => ({
    date: s(r.date) ?? "",
    network: s(r.network),
    label: s(r.label),
    totalFollowers: n(r.total_followers),
  }));
  rrssCache = { data, timestamp: now };
  return data;
}

export function invalidateRrssCache(): void {
  rrssCache = null;
}

export function getRrssNetworkOptions(rows: RrssRow[]): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.label) seen.add(r.label);
  }
  return Array.from(seen).sort();
}

export function filterRrssByTrimestre(
  rows: RrssRow[],
  trimestreId: string,
): RrssRow[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(trimestreId);
  if (!m) return [];
  const year = Number(m[1]);
  const quarter = Number(m[2]);
  return rows.filter((r) => {
    if (!r.date) return false;
    const q = quarterFromDate(r.date);
    return !!q && q.year === year && q.quarter === quarter;
  });
}

export function filterRrssByLabel(rows: RrssRow[], label: string): RrssRow[] {
  return rows.filter((r) => r.label === label);
}

export interface RrssKpis {
  initialFollowers: number | null;
  finalFollowers: number | null;
  growth: number | null;
  avgDailyGrowth: number | null;
}

export function computeRrssKpis(rows: RrssRow[]): RrssKpis {
  if (rows.length === 0) {
    return {
      initialFollowers: null,
      finalFollowers: null,
      growth: null,
      avgDailyGrowth: null,
    };
  }
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const initial = sorted[0].totalFollowers;
  const final = sorted[sorted.length - 1].totalFollowers;
  const growth = initial !== null && final !== null ? final - initial : null;
  const avgDailyGrowth =
    growth !== null && sorted.length > 1 ? growth / (sorted.length - 1) : null;
  return {
    initialFollowers: initial,
    finalFollowers: final,
    growth,
    avgDailyGrowth,
  };
}
