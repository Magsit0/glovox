import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import {
  cargosExtraPm,
  inversionMediosDiario,
  inversionMediosEtapas,
  type CargoExtra,
  type EtapaCampana,
} from "@/db/schema";
import { query } from "@/lib/bigquery";
import { withNeonRetry } from "@/lib/neon-retry";

export type { EtapaCampana };

const P = process.env.BIGQUERY_PROJECT_ID;
// Mart gobernado: paidMedia.ads_performance + EventoID (derivado por el
// productor desde campaign_name) + montos en USD por fecha vía
// referencia.tipo_cambio. Este panel es su PRIMER consumidor — acá NO se
// re-deriva EventoID ni FX (eso es exactamente lo que el mart gobierna).
const MART = `\`${P}.marts.paidmedia_ads_performance\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;
// Marts gobernados de facturación Cardda (la tarjeta que paga los ads y SaaS):
// consumo real de la tarjeta por mes×canal y fee mensual de Cardda, ambos ya
// convertidos a USD por fecha vía referencia.tipo_cambio. Producidos por
// data-governance (pipelines/finanzas/cardda). Es FACTURACIÓN (lo cobrado a la
// tarjeta), distinta del GASTO declarado de ads que expone MART.
const CARDDA_CONSUMO = `\`${P}.marts.cardda_consumo_mensual\``;
const CARDDA_FEE = `\`${P}.marts.cardda_fee_mensual\``;

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

function b(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "object" && "value" in (v as object))
    return Boolean((v as { value: unknown }).value);
  return Boolean(v);
}

// ---------- Types ----------

export type PlanDiarioRow = {
  eventoId: string;
  fecha: string; // YYYY-MM-DD
  plataforma: string; // meta | google | tiktok
  montoUsd: number;
  nota: string | null;
};

export type RealDiarioRow = {
  eventoId: string;
  fecha: string; // YYYY-MM-DD
  gastoUsd: number;
  metaUsd: number;
  googleUsd: number;
  tiktokUsd: number;
  /** Gasto en una plataforma FUERA de meta/google/tiktok (4º canal, NULL, …).
   *  Garantiza meta+google+tiktok+otras == gastoUsd (la partición cierra). */
  otrasUsd: number;
  /** Algún FX del día vino de carry-forward (finde/feriado). */
  fxImputado: boolean;
  /** Filas con gasto en moneda local SIN conversión a USD (gap visible, no $0). */
  filasSinFx: number;
  /** Por plataforma: ¿hay gasto local sin FX? (solo lo puebla el drill). */
  metaSinFx?: boolean;
  googleSinFx?: boolean;
  tiktokSinFx?: boolean;
};

export type DayCell = {
  fecha: string;
  plan: number | null;
  planNota: string | null;
  real: number | null;
  metaUsd: number;
  googleUsd: number;
  tiktokUsd: number;
  otrasUsd: number;
  fxImputado: boolean;
  sinFx: boolean;
};

export type EventoGridRow = {
  eventoId: string;
  nombre: string;
  fechaEvento: string; // categoriaEvento.Fecha o ""
  /** Clave del orden vertical: Fecha del evento, o el último día con datos si no tiene. */
  ordenFecha: string;
  /** Techo presupuestario = categoriaEvento.budgetPm (se edita en /admin/eventos). */
  techoUsd: number | null;
  days: DayCell[];
  totalPlan: number;
  totalReal: number;
  /** SUM(plan) / techo, en % (0 si no hay techo). */
  pctPlanVsTecho: number;
  /** SUM(real) / techo, en % (0 si no hay techo). */
  pctRealVsTecho: number;
};

export type NoAtribuidoRow = {
  fecha: string;
  gastoUsd: number;
  metaUsd: number;
  googleUsd: number;
  tiktokUsd: number;
  otrasUsd: number;
  filasSinFx: number;
};

// ---------- PLAN (Neon) ----------

/** Plan diario de TODOS los eventos dentro del rango (grilla calendario). */
export async function getPlanDiarioRango(
  from: string,
  to: string,
): Promise<PlanDiarioRow[]> {
  const rows = await withNeonRetry(() =>
    db
      .select({
        eventoId: inversionMediosDiario.eventoId,
        fecha: inversionMediosDiario.fecha,
        plataforma: inversionMediosDiario.plataforma,
        montoUsd: inversionMediosDiario.montoUsd,
        nota: inversionMediosDiario.nota,
      })
      .from(inversionMediosDiario)
      .where(and(gte(inversionMediosDiario.fecha, from), lte(inversionMediosDiario.fecha, to)))
      .orderBy(asc(inversionMediosDiario.eventoId), asc(inversionMediosDiario.fecha)),
  );
  return rows;
}

/** Plan diario por plataforma de UN evento (modo drill), rango opcional. */
export async function getPlanDiarioEvento(
  eventoId: string,
  from?: string,
  to?: string,
): Promise<PlanDiarioRow[]> {
  const conds = [dsql`${inversionMediosDiario.eventoId} = ${eventoId}`];
  if (from) conds.push(gte(inversionMediosDiario.fecha, from));
  if (to) conds.push(lte(inversionMediosDiario.fecha, to));
  const rows = await withNeonRetry(() =>
    db
      .select({
        eventoId: inversionMediosDiario.eventoId,
        fecha: inversionMediosDiario.fecha,
        plataforma: inversionMediosDiario.plataforma,
        montoUsd: inversionMediosDiario.montoUsd,
        nota: inversionMediosDiario.nota,
      })
      .from(inversionMediosDiario)
      .where(and(...conds))
      .orderBy(asc(inversionMediosDiario.fecha)),
  );
  return rows;
}

/** Extensión del plan cargado: [min, max] de fecha (null si la tabla está vacía). */
export async function getPlanExtent(): Promise<{ min: string; max: string } | null> {
  const rows = await withNeonRetry(() =>
    db
      .select({
        min: dsql<string | null>`MIN(${inversionMediosDiario.fecha})::text`,
        max: dsql<string | null>`MAX(${inversionMediosDiario.fecha})::text`,
      })
      .from(inversionMediosDiario),
  );
  const r = rows[0];
  return r?.min && r?.max ? { min: r.min, max: r.max } : null;
}

// ---------- REAL (BigQuery, read-only) ----------

/**
 * Gasto real diario en USD por evento dentro del rango, para TODOS los
 * EventoID que existen en categoriaEvento (el resto vive en "no atribuido").
 * `gasto_usd` viene NULL cuando la moneda no tiene FX (gap VISIBLE por diseño
 * del mart): se agrega por separado (`filas_sin_fx`) y NUNCA se cuenta como $0.
 */
export async function getRealDiarioRango(
  from: string,
  to: string,
): Promise<RealDiarioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      m.EventoID                                              AS evento_id,
      FORMAT_DATE('%Y-%m-%d', m.fecha)                        AS fecha,
      SUM(m.gasto_usd)                                        AS gasto_usd,
      SUM(IF(m.plataforma = 'meta',   m.gasto_usd, 0))        AS meta_usd,
      SUM(IF(m.plataforma = 'google', m.gasto_usd, 0))        AS google_usd,
      SUM(IF(m.plataforma = 'tiktok', m.gasto_usd, 0))        AS tiktok_usd,
      -- Residual: cualquier plataforma fuera de las tres (o NULL) → la
      -- partición meta+google+tiktok+otras == gasto_usd cierra siempre.
      SUM(IF(m.plataforma IN ('meta','google','tiktok'), 0, m.gasto_usd)) AS otras_usd,
      LOGICAL_OR(IFNULL(m.fx_imputado, FALSE))                AS fx_imputado,
      COUNTIF(m.gasto_usd IS NULL AND IFNULL(m.gasto, 0) > 0) AS filas_sin_fx
    FROM ${MART} m
    WHERE m.fecha BETWEEN DATE(@from) AND DATE(@to)
      AND m.EventoID IS NOT NULL
      -- Mismo predicado que getCategoriaEventos (isCanceled IS NOT TRUE): un
      -- evento CANCELADO con gasto no puede quedar acá (la página no le da
      -- fila) — debe caer en "no atribuido" para que el total compañía cierre.
      AND EXISTS (
        SELECT 1 FROM ${CATEGORY} c
        WHERE c.EventoID = m.EventoID AND c.isCanceled IS NOT TRUE
      )
    GROUP BY evento_id, fecha
    ORDER BY evento_id, fecha
    `,
    { from, to },
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    fecha: s(r.fecha),
    gastoUsd: n(r.gasto_usd),
    metaUsd: n(r.meta_usd),
    googleUsd: n(r.google_usd),
    tiktokUsd: n(r.tiktok_usd),
    otrasUsd: n(r.otras_usd),
    fxImputado: b(r.fx_imputado),
    filasSinFx: n(r.filas_sin_fx),
  }));
}

/**
 * Real diario de UN evento (modo drill). Trae el "sin FX" POR PLATAFORMA (no
 * solo a nivel día) para que el badge se muestre solo en la plataforma que
 * realmente tiene el gap.
 */
export async function getRealDiarioEvento(
  eventoId: string,
  from: string,
  to: string,
): Promise<RealDiarioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      m.EventoID                                              AS evento_id,
      FORMAT_DATE('%Y-%m-%d', m.fecha)                        AS fecha,
      SUM(m.gasto_usd)                                        AS gasto_usd,
      SUM(IF(m.plataforma = 'meta',   m.gasto_usd, 0))        AS meta_usd,
      SUM(IF(m.plataforma = 'google', m.gasto_usd, 0))        AS google_usd,
      SUM(IF(m.plataforma = 'tiktok', m.gasto_usd, 0))        AS tiktok_usd,
      SUM(IF(m.plataforma IN ('meta','google','tiktok'), 0, m.gasto_usd)) AS otras_usd,
      LOGICAL_OR(IFNULL(m.fx_imputado, FALSE))                AS fx_imputado,
      COUNTIF(m.gasto_usd IS NULL AND IFNULL(m.gasto, 0) > 0) AS filas_sin_fx,
      COUNTIF(m.plataforma = 'meta'   AND m.gasto_usd IS NULL AND IFNULL(m.gasto,0) > 0) AS meta_sinfx,
      COUNTIF(m.plataforma = 'google' AND m.gasto_usd IS NULL AND IFNULL(m.gasto,0) > 0) AS google_sinfx,
      COUNTIF(m.plataforma = 'tiktok' AND m.gasto_usd IS NULL AND IFNULL(m.gasto,0) > 0) AS tiktok_sinfx
    FROM ${MART} m
    WHERE m.EventoID = @eventoId
      AND m.fecha BETWEEN DATE(@from) AND DATE(@to)
    GROUP BY evento_id, fecha
    ORDER BY fecha
    `,
    { eventoId, from, to },
  );
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    fecha: s(r.fecha),
    gastoUsd: n(r.gasto_usd),
    metaUsd: n(r.meta_usd),
    googleUsd: n(r.google_usd),
    tiktokUsd: n(r.tiktok_usd),
    otrasUsd: n(r.otras_usd),
    fxImputado: b(r.fx_imputado),
    filasSinFx: n(r.filas_sin_fx),
    metaSinFx: n(r.meta_sinfx) > 0,
    googleSinFx: n(r.google_sinfx) > 0,
    tiktokSinFx: n(r.tiktok_sinfx) > 0,
  }));
}

/**
 * Gasto SIN evento reconocible en categoriaEvento (campañas de temporada,
 * búsqueda genérica, naming fuera de convención, EventoIDs sin mapear) — la
 * fila "no atribuido" company-wide. Sin ella, la suma por evento subreporta
 * el gasto real de la compañía (~26% en 2026).
 */
export async function getNoAtribuidoDiario(
  from: string,
  to: string,
): Promise<NoAtribuidoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', fecha)                      AS fecha,
      SUM(gasto_usd)                                      AS gasto_usd,
      SUM(IF(plataforma = 'meta',   gasto_usd, 0))        AS meta_usd,
      SUM(IF(plataforma = 'google', gasto_usd, 0))        AS google_usd,
      SUM(IF(plataforma = 'tiktok', gasto_usd, 0))        AS tiktok_usd,
      SUM(IF(plataforma IN ('meta','google','tiktok'), 0, gasto_usd)) AS otras_usd,
      COUNTIF(gasto_usd IS NULL AND IFNULL(gasto, 0) > 0) AS filas_sin_fx
    FROM ${MART} m
    WHERE fecha BETWEEN DATE(@from) AND DATE(@to)
      AND (
        m.EventoID IS NULL
        -- Complemento EXACTO de getRealDiarioRango (incluye isCanceled): lo
        -- que no obtiene fila de evento cae acá — nada se pierde ni se duplica.
        OR NOT EXISTS (
          SELECT 1 FROM ${CATEGORY} c
          WHERE c.EventoID = m.EventoID AND c.isCanceled IS NOT TRUE
        )
      )
    GROUP BY fecha
    ORDER BY fecha
    `,
    { from, to },
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    gastoUsd: n(r.gasto_usd),
    metaUsd: n(r.meta_usd),
    googleUsd: n(r.google_usd),
    tiktokUsd: n(r.tiktok_usd),
    otrasUsd: n(r.otras_usd),
    filasSinFx: n(r.filas_sin_fx),
  }));
}

/** Extensión del gasto real de UN evento en el mart: [min, max] o null. */
export async function getRealExtentEvento(
  eventoId: string,
): Promise<{ min: string; max: string } | null> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', MIN(fecha)) AS min_fecha,
      FORMAT_DATE('%Y-%m-%d', MAX(fecha)) AS max_fecha
    FROM ${MART}
    WHERE EventoID = @eventoId
    `,
    { eventoId },
  );
  const min = s(rows[0]?.min_fecha);
  const max = s(rows[0]?.max_fecha);
  return min && max ? { min, max } : null;
}

/** Última fecha con datos en el mart ("real al <fecha>", freshness visible). */
export async function getRealMaxFecha(): Promise<string> {
  const rows = await query<Record<string, unknown>>(`
    SELECT FORMAT_DATE('%Y-%m-%d', MAX(fecha)) AS max_fecha FROM ${MART}
  `);
  return s(rows[0]?.max_fecha);
}

/**
 * Techo presupuestario por evento = categoriaEvento.budgetPm (USD). La tabla
 * madre es la fuente única del techo; se edita en la hoja de /admin/eventos.
 */
export async function getBudgetPmMap(
  eventoIds: string[],
): Promise<Map<string, number>> {
  if (eventoIds.length === 0) return new Map();
  const rows = await query<Record<string, unknown>>(
    `
    SELECT EventoID AS evento_id, ANY_VALUE(budgetPm) AS budget_pm
    FROM ${CATEGORY}
    WHERE EventoID IN UNNEST(@eventoIds)
    GROUP BY evento_id
    `,
    { eventoIds },
  );
  const out = new Map<string, number>();
  for (const r of rows) {
    const v = r.budget_pm;
    if (v != null) out.set(s(r.evento_id), n(v));
  }
  return out;
}

// ---------- MERGE plan × real ----------

export type EventoMeta = {
  eventoId: string;
  nombre: string;
  fecha: string;
};

export function listDays(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Une plan (Neon) y real (mart) por (eventoId, fecha) en la grilla que consume
 * la UI: una fila por evento con la serie densa de días del rango (celdas sin
 * plan ni real van con null, no 0 — la grilla distingue "sin plan" de "$0").
 * El techo es budgetPm. El ORDEN vertical es por fecha del evento (ascendente);
 * eventos sin Fecha en categoriaEvento se ordenan por su último día con datos.
 */
export function mergeGrid(args: {
  eventos: EventoMeta[];
  from: string;
  to: string;
  plan: PlanDiarioRow[];
  real: RealDiarioRow[];
  budgetPm: Map<string, number>;
}): EventoGridRow[] {
  const days = listDays(args.from, args.to);
  // El plan del grid es el TOTAL del día = suma de las plataformas.
  const planTot = new Map<string, number>();
  for (const p of args.plan) {
    const k = `${p.eventoId}|${p.fecha}`;
    planTot.set(k, (planTot.get(k) ?? 0) + p.montoUsd);
  }
  const realKey = new Map(args.real.map((r) => [`${r.eventoId}|${r.fecha}`, r]));

  const rows = args.eventos.map((ev) => {
    const techoUsd = args.budgetPm.get(ev.eventoId) ?? null;
    let totalPlan = 0;
    let totalReal = 0;
    let ultimaConDatos = "";
    const cells: DayCell[] = days.map((fecha) => {
      const pk = `${ev.eventoId}|${fecha}`;
      const plan = planTot.has(pk) ? planTot.get(pk)! : null;
      const r = realKey.get(pk);
      if (plan != null) totalPlan += plan;
      if (r) totalReal += r.gastoUsd;
      if (plan != null || r) ultimaConDatos = fecha;
      return {
        fecha,
        plan,
        planNota: null,
        real: r ? r.gastoUsd : null,
        metaUsd: r?.metaUsd ?? 0,
        googleUsd: r?.googleUsd ?? 0,
        tiktokUsd: r?.tiktokUsd ?? 0,
        otrasUsd: r?.otrasUsd ?? 0,
        fxImputado: r?.fxImputado ?? false,
        sinFx: (r?.filasSinFx ?? 0) > 0,
      };
    });
    return {
      eventoId: ev.eventoId,
      nombre: ev.nombre,
      fechaEvento: ev.fecha,
      // Clave de orden: fecha del evento; sin Fecha → último día con datos.
      ordenFecha: ev.fecha || ultimaConDatos || "9999-12-31",
      techoUsd,
      days: cells,
      totalPlan,
      totalReal,
      pctPlanVsTecho: techoUsd && techoUsd > 0 ? (totalPlan / techoUsd) * 100 : 0,
      pctRealVsTecho: techoUsd && techoUsd > 0 ? (totalReal / techoUsd) * 100 : 0,
    } satisfies EventoGridRow;
  });

  rows.sort(
    (a, b) =>
      a.ordenFecha.localeCompare(b.ordenFecha) || a.eventoId.localeCompare(b.eventoId),
  );
  return rows;
}

// ---------- Etapas de campaña (bandas del drill) ----------

/** Etapas de campaña de un evento (lista ordenada; [] si no hay). */
export async function getEtapas(eventoId: string): Promise<EtapaCampana[]> {
  const rows = await withNeonRetry(() =>
    db
      .select({ etapas: inversionMediosEtapas.etapas })
      .from(inversionMediosEtapas)
      .where(eq(inversionMediosEtapas.eventoId, eventoId))
      .limit(1),
  );
  return rows[0]?.etapas ?? [];
}

// ---------- Cargos extra (CARDDA) ----------

/** Cargos extra activos (pagos recurrentes de plataformas), por proveedor. */
export async function getCargosExtra(): Promise<CargoExtra[]> {
  return withNeonRetry(() =>
    db
      .select()
      .from(cargosExtraPm)
      .where(eq(cargosExtraPm.activo, true))
      .orderBy(desc(cargosExtraPm.montoUsd)),
  );
}

// computeEtapaSegments + tipos viven en @/lib/inversion-medios/etapas
// (client-safe) para que el drill cliente no arrastre BigQuery al bundle.

// ---------- Desglose real por tipo/campaña (drill: abrir un canal) ----------

/**
 * Gasto real crudo de UN evento por (fecha, plataforma, objective, campaña),
 * para desagregar un canal en tipos de campaña y campañas individuales. La
 * CLASIFICACIÓN (objetivo↔nombre) corre en el cliente (buildDesglose) para que
 * el toggle sea instantáneo. Tipo/importación en @/lib/inversion-medios/tipos.
 */
export async function getRealDesgloseEvento(
  eventoId: string,
  from: string,
  to: string,
): Promise<
  { fecha: string; plataforma: string; objective: string; campaignName: string; gastoUsd: number }[]
> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', fecha) AS fecha,
      plataforma                     AS plataforma,
      IFNULL(objective, '')          AS objective,
      IFNULL(campaign_name, '')      AS campaign_name,
      SUM(gasto_usd)                 AS gasto_usd
    FROM ${MART}
    WHERE EventoID = @eventoId
      AND fecha BETWEEN DATE(@from) AND DATE(@to)
      AND gasto_usd > 0
    GROUP BY fecha, plataforma, objective, campaign_name
    ORDER BY fecha
    `,
    { eventoId, from, to },
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    plataforma: s(r.plataforma),
    objective: s(r.objective),
    campaignName: s(r.campaign_name),
    gastoUsd: n(r.gasto_usd),
  }));
}

// ---------- Drill por plataforma (vista de un evento) ----------

export type DrillDayCell = {
  fecha: string;
  plan: number | null;
  real: number | null;
  fxImputado: boolean;
  sinFx: boolean;
};

export type DrillPlataformaRow = {
  plataforma: string; // meta | google | tiktok
  label: string;
  dias: DrillDayCell[];
  totalPlan: number;
  totalReal: number;
};

export type DrillGrid = {
  dias: string[];
  plataformas: DrillPlataformaRow[];
  /** Total diario (todas las plataformas) plan y real, por día. */
  totalDia: { fecha: string; plan: number; real: number }[];
  totalPlan: number;
  totalReal: number;
};

const PLATAFORMA_LABEL: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
  otras: "Otras",
};

/**
 * Sábana horizontal de UN evento: una fila por plataforma (Meta/Google/TikTok),
 * columnas = días. El plan sale de inversion_medios_diario (por plataforma) y el
 * real del mart (metaUsd/googleUsd/tiktokUsd por día). Si el mart trae gasto en
 * una plataforma fuera de las tres, se agrega una fila "Otras" para que la suma
 * de filas == gasto real total del día (la partición cierra por construcción).
 * El sin-FX se marca POR PLATAFORMA (no a nivel día).
 */
export function buildDrillGrid(args: {
  from: string;
  to: string;
  plan: PlanDiarioRow[]; // ya filtrado al evento
  real: RealDiarioRow[]; // ya filtrado al evento
}): DrillGrid {
  const dias = listDays(args.from, args.to);
  // "otras" solo se muestra si hay gasto residual en el rango.
  const hayOtras = args.real.some((r) => r.otrasUsd > 0);
  const plataformas = ["meta", "google", "tiktok", ...(hayOtras ? ["otras"] : [])] as const;

  // plan[plataforma][fecha] (solo meta/google/tiktok son planificables)
  const planKey = new Map<string, number>();
  for (const p of args.plan) {
    planKey.set(`${p.plataforma}|${p.fecha}`, (planKey.get(`${p.plataforma}|${p.fecha}`) ?? 0) + p.montoUsd);
  }
  const realByFecha = new Map(args.real.map((r) => [r.fecha, r]));

  const realDe = (r: RealDiarioRow | undefined, plat: string): number | null => {
    if (!r) return null;
    if (plat === "meta") return r.metaUsd;
    if (plat === "google") return r.googleUsd;
    if (plat === "tiktok") return r.tiktokUsd;
    return r.otrasUsd;
  };
  const sinFxDe = (r: RealDiarioRow | undefined, plat: string): boolean => {
    if (!r) return false;
    if (plat === "meta") return r.metaSinFx ?? false;
    if (plat === "google") return r.googleSinFx ?? false;
    if (plat === "tiktok") return r.tiktokSinFx ?? false;
    return (r.filasSinFx ?? 0) > 0; // "otras": no hay flag propio, usa el día
  };

  const filas: DrillPlataformaRow[] = plataformas.map((plat) => {
    let totalPlan = 0;
    let totalReal = 0;
    const cells: DrillDayCell[] = dias.map((fecha) => {
      const pk = `${plat}|${fecha}`;
      const plan = planKey.has(pk) ? planKey.get(pk)! : null;
      const r = realByFecha.get(fecha);
      const real = realDe(r, plat);
      if (plan != null) totalPlan += plan;
      if (real != null) totalReal += real;
      return {
        fecha,
        plan,
        real, // number | null (0 real se preserva como 0, no como null)
        fxImputado: r?.fxImputado ?? false,
        sinFx: sinFxDe(r, plat),
      };
    });
    return { plataforma: plat, label: PLATAFORMA_LABEL[plat], dias: cells, totalPlan, totalReal };
  });

  // Totales diarios AUTORITATIVOS desde gasto_usd (no la suma de columnas), para
  // que el drill reconcilie con el grid aunque exista residual no mostrado.
  const totalDia = dias.map((fecha, i) => {
    const plan = filas.reduce((a, f) => a + (f.dias[i].plan ?? 0), 0);
    const r = realByFecha.get(fecha);
    return { fecha, plan, real: r ? r.gastoUsd : 0 };
  });

  return {
    dias,
    plataformas: filas,
    totalDia,
    totalPlan: filas.reduce((a, f) => a + f.totalPlan, 0),
    totalReal: args.real.reduce((a, r) => a + r.gastoUsd, 0),
  };
}

/**
 * Totales del evento COMPLETO (fuera del rango visible): SUM(plan) histórico y
 * SUM(real) histórico, para el header (% ejecución vs techo del evento entero,
 * no solo del período en pantalla).
 */
export async function getTotalesEvento(
  eventoIds: string[],
): Promise<Map<string, { totalPlan: number; totalReal: number }>> {
  if (eventoIds.length === 0) return new Map();
  const [planRows, realRows] = await Promise.all([
    withNeonRetry(() =>
      db
        .select({
          eventoId: inversionMediosDiario.eventoId,
          montoUsd: inversionMediosDiario.montoUsd,
        })
        .from(inversionMediosDiario)
        .where(inArray(inversionMediosDiario.eventoId, eventoIds)),
    ),
    query<Record<string, unknown>>(
      `
      SELECT EventoID AS evento_id, SUM(gasto_usd) AS gasto_usd
      FROM ${MART}
      WHERE EventoID IN UNNEST(@eventoIds)
      GROUP BY evento_id
      `,
      { eventoIds },
    ),
  ]);
  const out = new Map<string, { totalPlan: number; totalReal: number }>();
  for (const id of eventoIds) out.set(id, { totalPlan: 0, totalReal: 0 });
  for (const p of planRows) {
    const t = out.get(p.eventoId);
    if (t) t.totalPlan += p.montoUsd;
  }
  for (const r of realRows) {
    const t = out.get(s(r.evento_id));
    if (t) t.totalReal = n(r.gasto_usd);
  }
  return out;
}

// ---------- Facturación Cardda (histórico, read-only desde marts) ----------

export type CarddaConsumoRow = {
  periodo: string; // YYYY-MM
  canal: string; // meta | google | tiktok | otras
  gastoUsd: number;
  gastoClp: number;
  n: number;
};

export type CarddaFeeRow = {
  periodo: string; // YYYY-MM
  status: string; // draft | issued
  feeUsd: number;
  feeClp: number;
  fiscalInvoiceId: string | null;
};

/**
 * Consumo de las tarjetas Cardda por mes×canal (solo cargos approved, ya en USD
 * por fecha). Agrega los comercios del mart al nivel de canal. Es la FACTURACIÓN
 * real a la tarjeta, distinta del gasto declarado de ads. Read-only.
 */
export async function getCarddaConsumoMensual(): Promise<CarddaConsumoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      periodo,
      canal,
      SUM(gasto_usd)        AS gasto_usd,
      SUM(gasto_clp)        AS gasto_clp,
      SUM(n_transacciones)  AS n
    FROM ${CARDDA_CONSUMO}
    GROUP BY periodo, canal
    ORDER BY periodo, canal
    `,
  );
  return rows.map((r) => ({
    periodo: s(r.periodo),
    canal: s(r.canal),
    gastoUsd: n(r.gasto_usd),
    gastoClp: n(r.gasto_clp),
    n: n(r.n),
  }));
}

/** Fee mensual de Cardda ("Uso de Cards"), en USD y CLP, por período. Read-only. */
export async function getCarddaFeeMensual(): Promise<CarddaFeeRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT periodo, status, fee_usd, fee_clp, fiscal_invoice_id
    FROM ${CARDDA_FEE}
    ORDER BY periodo
    `,
  );
  return rows.map((r) => ({
    periodo: s(r.periodo),
    status: s(r.status),
    feeUsd: n(r.fee_usd),
    feeClp: n(r.fee_clp),
    fiscalInvoiceId: r.fiscal_invoice_id == null ? null : s(r.fiscal_invoice_id),
  }));
}
