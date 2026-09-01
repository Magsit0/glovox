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
import { PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";
import { withNeonRetry } from "@/lib/neon-retry";

export type { EtapaCampana };

const P = process.env.BIGQUERY_PROJECT_ID;
// Mart gobernado: paidMedia.ads_performance + EventoID (derivado por el
// productor desde campaign_name) + montos en USD por fecha vía
// referencia.tipo_cambio. Este panel es su PRIMER consumidor — acá NO se
// re-deriva EventoID. El FX tampoco, con UNA excepción acotada: ver REAL_BASE
// (carry-forward del último FX conocido para el gasto de HOY que el mart aún
// deja sin convertir).
const MART = `\`${P}.marts.paidmedia_ads_performance\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;

// Carry-forward de FX del lado del CONSUMIDOR (decisión 2026-08-24): el mart
// deja `gasto_usd` NULL cuando el tipo de cambio del día aún no existe (en la
// práctica, SOLO el día en curso — el FX se publica después). Antes ese gasto
// se mostraba como hueco ("+sin FX"); ahora se convierte acá con el ÚLTIMO
// fx_units_per_usd conocido de esa moneda (mismo criterio de carry-forward que
// el mart usa para findes/feriados) y se marca `fx_carry` → la UI lo funde con
// `fx_imputado`. El mart NO se toca (sigue read-only y gobernando el FX final:
// cuando llega el FX real del día, la conversión del mart reemplaza a esta).
// `base` expone las MISMAS columnas del mart con `gasto_usd` ya efectivo.
const REAL_BASE = `
  WITH fx_last AS (
    SELECT currency, fx_units_per_usd
    FROM (
      SELECT
        currency,
        fx_units_per_usd,
        ROW_NUMBER() OVER (PARTITION BY currency ORDER BY fecha DESC) AS rn
      FROM ${MART}
      WHERE fx_units_per_usd IS NOT NULL AND currency IS NOT NULL
    )
    WHERE rn = 1
  ),
  base AS (
    SELECT
      m.* EXCEPT (gasto_usd),
      COALESCE(m.gasto_usd, SAFE_DIVIDE(m.gasto, f.fx_units_per_usd)) AS gasto_usd,
      (m.gasto_usd IS NULL AND IFNULL(m.gasto, 0) > 0 AND f.fx_units_per_usd IS NOT NULL) AS fx_carry
    FROM ${MART} m
    LEFT JOIN fx_last f ON f.currency = m.currency
  )
`;
// Marts gobernados de facturación Cardda (la tarjeta que paga los ads y SaaS):
// consumo real de la tarjeta por mes×canal y fee mensual de Cardda, ambos ya
// convertidos a USD por fecha vía referencia.tipo_cambio. Producidos por
// data-governance (pipelines/finanzas/cardda). Es FACTURACIÓN (lo cobrado a la
// tarjeta), distinta del GASTO declarado de ads que expone MART.
const CARDDA_CONSUMO = `\`${P}.marts.cardda_consumo_mensual\``;
const CARDDA_FEE = `\`${P}.marts.cardda_fee_mensual\``;
// Crudo de transacciones Cardda + FX de referencia — SOLO para la granularidad
// SEMANAL del consumo (el mart es mensual y no tiene hermano semanal).
const CARDDA_TX = `\`${P}.cardda.card_transactions\``;
const FX_REF = `\`${P}.referencia.tipo_cambio\``;

// ─────────────────────── Métricas de rendimiento (Fase 1) ───────────────────
// Fragmentos compartidos por las queries de resultado. Van acá, junto a MART /
// CATEGORY / REAL_BASE, porque son la definición ÚNICA de cada concepto.

const TICKETS = `\`${P}.glovox.tickets\``;

/**
 * Campañas de Ventas de Meta: la ÚNICA combinación plataforma×objetivo cuyas
 * `conversiones` se comportan como compras reales (ticket implícito ÷ ticket real
 * por orden = 1,03–1,29 en 11 eventos chilenos). Las de Google NO: la misma
 * cuenta declara ~5 acciones por compra (GLO172 gastó $833 y reporta 1.861
 * conversiones → CPA $0,45), así que un CPA "blended" quedaría contaminado.
 * Con este alcance, 58 de 61 eventos del universo tienen CPA pixel y cubre
 * $146.237 de $206.109 = 71,0% del gasto. Requiere el alias `m`.
 */
const META_VENTAS = `(m.plataforma = 'meta' AND m.objective = 'OUTCOME_SALES')`;

/**
 * Clase de ticket. ESPEJO EXACTO de TICKET_TYPE_FILTER
 * (lib/queries/marketing.ts:51-59) con alias `t`, para que los conteos de este
 * panel sean comparables con /marketing y /ticketing. Excluye CORTESIA (20,6% de
 * las filas del universo, hasta 64,6% en GLP002) y MESA VIP; CONSERVA VENTA y
 * PASE TEMPORADA.
 */
const CLASE_TICKET = `CASE
  WHEN t.MedioPago = 'Otro' AND (LOWER(t.TipoTicket) LIKE '%pase%' OR LOWER(t.TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
  WHEN t.MedioPago = 'Otro' AND LOWER(t.TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
  WHEN t.MedioPago = 'Otro' THEN 'CORTESIA'
  ELSE 'VENTA' END`;
const VENDIDO = `${CLASE_TICKET} IN ('VENTA','PASE TEMPORADA') AND t.EsDevuelto IS FALSE`;

/**
 * Ajuste de display ya vigente en el repo (lib/queries/marketing.ts:48). SIN
 * esto la ventana de venta de GLO198 arranca el 2025-05-10 en vez del 2026-03-18
 * (244 filas 'GENERAL DGTL' fechadas un año antes), la cobertura del esquema PM_
 * cae a 74/366 y el evento de mayor gasto del panel se clasifica mal.
 *
 * TZ: `DATE(...)` SIN zona horaria, a propósito. `FechaOrden` guarda hora local
 * ingenua etiquetada como UTC (la hora media cruda de la tarde no se mueve entre
 * verano e invierno pese al cambio UTC-4 → UTC-3), y es lo que ya hace todo el
 * repo (lib/queries/curvas.ts, lib/queries/ticketing.ts).
 * `DATE(FechaOrden, 'America/Santiago')` movería de día un 5,12% de las filas.
 * El `hoy` y los bordes del rango SÍ siguen en America/Santiago (page.tsx): esas
 * son preguntas de reloj de pared, no de imputación de una orden a un día.
 */
const FECHA_ORDEN = `DATE(CASE
  WHEN t.EventoID = 'GLO198' AND t.TipoTicket = 'GENERAL DGTL' THEN TIMESTAMP('2026-03-18')
  ELSE t.FechaOrden END)`;

/** Referido normalizado. El UPPER es OBLIGATORIO: FeverUp escribe los códigos en
 *  MINÚSCULA (pm_mt_kv_conv, pm_mt_exp_conv, pm_gg_pmax_mix) y sin esto se pierde
 *  toda la atribución de esa ticketera. */
const PM_NORM = `UPPER(TRIM(COALESCE(t.Referido, '')))`;
/** Pertenencia al esquema. REGEXP y no `LIKE 'PM_%'`: el `_` de LIKE es un
 *  COMODÍN de un carácter y matchearía 'PMX…' en silencio. */
const PM_IS = `REGEXP_CONTAINS(${PM_NORM}, r'^PM_')`;
/**
 * Código de campaña de VENTA. El mapeo es asimétrico a propósito: Meta lleva el
 * objetivo en el segmento 4 (`_CONV`), Google lleva el TIPO en el segmento 3
 * (`PMAX`) — en PM_GG_PMAX_MIX, 'MIX' no es un objetivo sino una mezcla de
 * audiencias. Acotar a códigos de venta baja el denominador entre 0,5% y 10,6%
 * según evento, y es lo que hace que numerador (gasto de Ventas) y denominador
 * midan el mismo universo.
 */
const PM_VENTA = `(REGEXP_CONTAINS(${PM_NORM}, r'^PM_MT_[A-Z0-9]+_CONV$')
  OR REGEXP_CONTAINS(${PM_NORM}, r'^PM_GG_(PMAX|SEARCH|SEA|SHOPPING)_'))`;
/** Paid media que llegó SIN el prefijo: sufijo suelto, o adset_id de Meta crudo.
 *  En 660905 son 1.077 tickets contra 6 con PM_ completo. */
const PM_MUT = `(${PM_NORM} IN ('CONV','MIX','ALC','TRF','SEA')
  OR REGEXP_CONTAINS(${PM_NORM}, r'^[0-9]{15,20}$'))`;

// PERSONAS y PACK_SPLIT_CTE se eliminaron: el heurístico de paridad (detectar si
// la ticketera ya había partido el pack, con piso de 20 órdenes) quedó obsoleto.
// `glovox.tickets` trae hoy la columna `PersonasPorTicket` (INT64), que es la
// fuente única de verdad para PERSONAS. Nueva invariante:
//   SUM(t.PersonasPorTicket) = personas · COUNT(*) = transacciones.
// Ojo: el heurístico marcaba el pack de GLO181 como "ya partido" y lo pesaba 1,
// así que este panel subestimaba las personas de ese evento (7.190 → 9.071).

/** Nacimiento del esquema PM_ por ticketera, DERIVADO del dato (no hardcodeado).
 *  Medido: PuntoTicket 2026-02-25, TeleTicket 2026-03-10, FeverUp 2026-07-02.
 *  Sirve para distinguir "no hubo venta por PM" de "el esquema no existía". */
const PRIMER_PM_CTE = `primer_pm AS (
  SELECT Ticketera, MIN(DATE(FechaOrden)) AS pm_desde
  FROM ${TICKETS}
  WHERE REGEXP_CONTAINS(UPPER(TRIM(COALESCE(Referido,''))), r'^PM_')
  GROUP BY Ticketera
)`;

// El umbral del referido vive en el módulo CLIENT-SAFE, porque lo necesitan las
// dos orillas: el SQL de abajo y el componente que decide si pinta los dos CPA.
// Se re-exporta para que los consumidores de servidor no cambien de import.
export { PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";

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
  /** Tipo de campaña (Ventas, Cobertura…). '' = "Sin tipo" (plan histórico). */
  tipo: string;
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
  /** Algún FX del día vino de carry-forward (finde/feriado del mart, o el
   *  último FX disponible aplicado acá para el gasto de hoy — REAL_BASE). */
  fxImputado: boolean;
  /** Filas con gasto local que NI SIQUIERA el carry-forward pudo convertir
   *  (moneda sin ningún FX conocido). Residual, en la práctica 0. */
  filasSinFx: number;
  /** Por plataforma: ¿hay gasto local inconvertible? (solo lo puebla el drill). */
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
  fechaEvento: string; // categoriaEvento.Fecha o "" = PRIMER día
  /** Cuántos días dura el evento. El calendario marca los `diasEvento` días. */
  diasEvento: number;
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
        tipo: inversionMediosDiario.tipo,
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
        tipo: inversionMediosDiario.tipo,
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
 * `gasto_usd` efectivo sale de REAL_BASE: lo convertido por el mart, más el
 * gasto de hoy convertido acá con el último FX disponible (marcado imputado).
 * Solo queda en `filas_sin_fx` lo que no tiene NINGÚN FX conocido (~0 filas).
 */
export async function getRealDiarioRango(
  from: string,
  to: string,
): Promise<RealDiarioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `${REAL_BASE}
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
      LOGICAL_OR(IFNULL(m.fx_imputado, FALSE) OR m.fx_carry)  AS fx_imputado,
      COUNTIF(m.gasto_usd IS NULL AND IFNULL(m.gasto, 0) > 0) AS filas_sin_fx
    FROM base m
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
    `${REAL_BASE}
    SELECT
      m.EventoID                                              AS evento_id,
      FORMAT_DATE('%Y-%m-%d', m.fecha)                        AS fecha,
      SUM(m.gasto_usd)                                        AS gasto_usd,
      SUM(IF(m.plataforma = 'meta',   m.gasto_usd, 0))        AS meta_usd,
      SUM(IF(m.plataforma = 'google', m.gasto_usd, 0))        AS google_usd,
      SUM(IF(m.plataforma = 'tiktok', m.gasto_usd, 0))        AS tiktok_usd,
      SUM(IF(m.plataforma IN ('meta','google','tiktok'), 0, m.gasto_usd)) AS otras_usd,
      LOGICAL_OR(IFNULL(m.fx_imputado, FALSE) OR m.fx_carry)  AS fx_imputado,
      COUNTIF(m.gasto_usd IS NULL AND IFNULL(m.gasto, 0) > 0) AS filas_sin_fx,
      COUNTIF(m.plataforma = 'meta'   AND m.gasto_usd IS NULL AND IFNULL(m.gasto,0) > 0) AS meta_sinfx,
      COUNTIF(m.plataforma = 'google' AND m.gasto_usd IS NULL AND IFNULL(m.gasto,0) > 0) AS google_sinfx,
      COUNTIF(m.plataforma = 'tiktok' AND m.gasto_usd IS NULL AND IFNULL(m.gasto,0) > 0) AS tiktok_sinfx
    FROM base m
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
    `${REAL_BASE}
    SELECT
      FORMAT_DATE('%Y-%m-%d', fecha)                      AS fecha,
      SUM(gasto_usd)                                      AS gasto_usd,
      SUM(IF(plataforma = 'meta',   gasto_usd, 0))        AS meta_usd,
      SUM(IF(plataforma = 'google', gasto_usd, 0))        AS google_usd,
      SUM(IF(plataforma = 'tiktok', gasto_usd, 0))        AS tiktok_usd,
      SUM(IF(plataforma IN ('meta','google','tiktok'), 0, gasto_usd)) AS otras_usd,
      COUNTIF(gasto_usd IS NULL AND IFNULL(gasto, 0) > 0) AS filas_sin_fx
    FROM base m
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

export type NoAtribuidoCampanaDia = {
  plataforma: string;
  campaignName: string;
  fecha: string; // YYYY-MM-DD
  gastoUsd: number;
};

/**
 * Gasto DIARIO por campaña del grupo "no atribuido" dentro del rango. Mismo
 * predicado que getNoAtribuidoDiario (mantener en sync): EventoID NULL o sin
 * match no-cancelado en categoriaEvento. Alimenta las sub-filas desplegables
 * de la fila "No atribuido" en la matriz (el cliente agrupa por campaña, se
 * queda con las de mayor gasto y agrega el resto en una fila "otras").
 */
export async function getNoAtribuidoCampanasDiario(
  from: string,
  to: string,
): Promise<NoAtribuidoCampanaDia[]> {
  const rows = await query<Record<string, unknown>>(
    `${REAL_BASE}
    SELECT
      IFNULL(m.plataforma, '(null)')           AS plataforma,
      IFNULL(m.campaign_name, '(sin nombre)')  AS campaign_name,
      FORMAT_DATE('%Y-%m-%d', m.fecha)         AS fecha,
      SUM(m.gasto_usd)                         AS gasto_usd
    FROM base m
    WHERE m.fecha BETWEEN DATE(@from) AND DATE(@to)
      AND (
        m.EventoID IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM ${CATEGORY} c
          WHERE c.EventoID = m.EventoID AND c.isCanceled IS NOT TRUE
        )
      )
    GROUP BY plataforma, campaign_name, fecha
    HAVING gasto_usd > 0
    ORDER BY fecha
    `,
    { from, to },
  );
  return rows.map((r) => ({
    plataforma: s(r.plataforma),
    campaignName: s(r.campaign_name),
    fecha: s(r.fecha),
    gastoUsd: n(r.gasto_usd),
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
  /** Cuántos días dura el evento (categoriaEvento.dias). 1 si no se sabe. */
  dias: number;
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
      diasEvento: ev.dias >= 1 ? ev.dias : 1,
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
    `${REAL_BASE}
    SELECT
      FORMAT_DATE('%Y-%m-%d', fecha) AS fecha,
      plataforma                     AS plataforma,
      IFNULL(objective, '')          AS objective,
      IFNULL(campaign_name, '')      AS campaign_name,
      SUM(gasto_usd)                 AS gasto_usd
    FROM base
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

  // plan[plataforma][fecha] — SUMA todas las filas de la plataforma (con la
  // dimensión tipo, cada plataforma-día puede tener varias: la fila del canal
  // muestra el total; el detalle por tipo lo arma el cliente con planRows).
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
      `${REAL_BASE}
      SELECT EventoID AS evento_id, SUM(gasto_usd) AS gasto_usd
      FROM base
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

/**
 * Consumo de las tarjetas Cardda por SEMANA (lunes ISO) × canal, en USD por
 * fecha. El mart gobernado es MENSUAL y no tiene hermano semanal, así que esta
 * query agrega el crudo `cardda.card_transactions` ESPEJANDO las reglas del
 * productor (validado el 2026-08-24 contra el mart, paridad exacta por canal
 * en jun-2026 — scripts en scratchpad de esa sesión):
 *   - solo status='approved';
 *   - canal: meta = Facebook/Facebook Ads/Metapay · google = SOLO "Google Ads"
 *     · tiktok = TikTok Ads/TikTok/Tiktok ("Tik Tok" con espacio queda en
 *     otras, igual que en el mart) · resto → otras;
 *   - USD = -monto_clp / units_per_usd(CLP, fecha) vía referencia.tipo_cambio
 *     (monto_clp viene NEGATIVO para cargos; el signo se invierte para que un
 *     reembolso reste). Si el productor cambia su mapping, actualizar acá.
 */
export async function getCarddaConsumoSemanal(): Promise<CarddaConsumoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(t.fecha, WEEK(MONDAY))) AS periodo,
      CASE
        WHEN t.cleaned_merchant_name IN ('Facebook', 'Facebook Ads', 'Metapay') THEN 'meta'
        WHEN t.cleaned_merchant_name = 'Google Ads' THEN 'google'
        WHEN t.cleaned_merchant_name IN ('TikTok Ads', 'TikTok', 'Tiktok') THEN 'tiktok'
        ELSE 'otras'
      END                                        AS canal,
      SUM(-t.monto_clp / fx.units_per_usd)       AS gasto_usd,
      SUM(-t.monto_clp)                          AS gasto_clp,
      COUNT(*)                                   AS n
    FROM ${CARDDA_TX} t
    LEFT JOIN ${FX_REF} fx ON fx.currency = 'CLP' AND fx.fecha = t.fecha
    WHERE t.status = 'approved'
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

// ═══════════ RENDIMIENTO DEL EVENTO (Fase 1) ════════════════════════════════
// Tres queries que le agregan RESULTADO al panel, que hasta ahora solo mostraba
// dinero. Todas acotadas a la MISMA ventana [from, to] del drill que el gasto,
// para que los números se puedan enfrentar sin asimetrías de scope.

/** Numeradores aditivos del mart para un evento. Ningún ratio: los calcula el
 *  cliente desde estas sumas. */
export type AdsMetricasEvento = {
  gastoUsd: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  valorUsd: number;
  /** Numerador del CPA pixel: gasto de las campañas de Ventas de Meta. */
  gastoVentasUsd: number;
  /** Denominador del CPA pixel: las compras que declara ese pixel. */
  conversionesVentas: number;
  valorVentasUsd: number;
  /** Para la nota de la UI: si Google declara conversiones, hay que decirlo. */
  googleConversiones: number;
};

/**
 * Métricas de ads del evento en la ventana del drill.
 *
 * ⚠️ Solo SUM() de columnas aditivas. Las columnas ctr/cpc/cpm/roas/cpc_usd/
 * cpm_usd del mart son ratios POR FILA y además mezclan unidades entre
 * plataformas: Google trae `ctr` como FRACCIÓN (0,6204) y Meta/TikTok como
 * PORCENTAJE (1,764) — un factor 100 de error —, y `cpm`/`cpm_usd` son NULL en el
 * 100% de las filas de Google. No se leen NUNCA.
 *
 * `alcance` tampoco se expone: es NULL en todo Google y no es aditivo en Meta
 * (sumar el diario de GLO198 da frecuencia 1,24 en 65 días, imposible).
 *
 * Usa REAL_BASE y el mismo from/to del drill, así que `gastoUsd` reconcilia al
 * centavo con el stat "Invertido (real)" que ya se muestra. Si difieren, la
 * ventana se pasó mal.
 */
export async function getAdsMetricasEvento(
  eventoId: string,
  from: string,
  to: string,
): Promise<AdsMetricasEvento> {
  const rows = await query<Record<string, unknown>>(
    `
    ${REAL_BASE}
    SELECT
      SUM(m.gasto_usd)                                   AS gasto_usd,
      SUM(m.impresiones)                                 AS impresiones,
      SUM(m.clics)                                       AS clics,
      SUM(m.conversiones)                                AS conversiones,
      SUM(m.valor_conversion_usd)                        AS valor_usd,
      SUM(IF(${META_VENTAS}, m.gasto_usd, 0))            AS gasto_ventas_usd,
      SUM(IF(${META_VENTAS}, m.conversiones, 0))         AS conversiones_ventas,
      SUM(IF(${META_VENTAS}, m.valor_conversion_usd, 0)) AS valor_ventas_usd,
      SUM(IF(m.plataforma = 'google', m.conversiones, 0)) AS google_conversiones
    FROM base m
    WHERE m.EventoID = @eventoId
      AND m.fecha BETWEEN DATE(@from) AND DATE(@to)
    `,
    { eventoId, from, to },
  );
  const r = rows[0] ?? {};
  return {
    gastoUsd: n(r.gasto_usd),
    impresiones: n(r.impresiones),
    clics: n(r.clics),
    conversiones: n(r.conversiones),
    valorUsd: n(r.valor_usd),
    gastoVentasUsd: n(r.gasto_ventas_usd),
    conversionesVentas: n(r.conversiones_ventas),
    valorVentasUsd: n(r.valor_ventas_usd),
    googleConversiones: n(r.google_conversiones),
  };
}

/**
 * Por qué el CPA referido de un evento no se puede leer. El ORDEN de la máquina
 * de estados importa (ver el CASE en la query).
 */
export type EstadoReferido =
  | "sin_datos_ticketera"
  | "cero_vendidos"
  | "pre_esquema"
  | "sin_propagacion"
  | "referido_mutilado"
  | "sin_pm"
  | "propagacion_baja"
  | "medible";

export type TicketsEvento = {
  tieneTickets: boolean;
  ticketera: string;
  /** Conteos de la VENTANA del drill (mismo scope que el gasto). */
  transacciones: number;
  ordenes: number;
  personas: number;
  devueltas: number;
  pmItems: number;
  pmOrdenes: number;
  pmPersonas: number;
  /** De la historia COMPLETA — alimentan la máquina de estados y la nota. */
  pmMutilado: number;
  conReferido: number;
  /** pmOrdenes / ordenes × 100, sobre la historia completa. */
  propagacionPct: number;
  ventaDesde: string;
  ventaHasta: string;
  pmDesdeTicketera: string;
  goalTickets: number | null;
  estado: EstadoReferido;
};

/**
 * Conteos de ticket del evento + el estado del referido.
 *
 * Los conteos que se MUESTRAN salen de `win` (la ventana del drill). La historia
 * completa (`hist`) alimenta solo la máquina de estados, que es donde hace falta:
 * un evento cuya venta cerró antes de que existiera el esquema PM_ no es un
 * evento "sin ventas por PM", y hay que decirlo distinto.
 */
export async function getRendimientoTicketsEvento(
  eventoId: string,
  from: string,
  to: string,
): Promise<TicketsEvento> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${PRIMER_PM_CTE},
    cat AS (
      -- categoriaEvento tiene 230 filas para 225 EventoID (GLO042 con 6). Ninguno
      -- está hoy en el universo del panel, pero el catálogo lo edita gente:
      -- agregar SIEMPRE a una fila por evento antes de joinear.
      SELECT EventoID, MAX(goalTickets) AS goal_tickets
      FROM ${CATEGORY} WHERE EventoID = @eventoId GROUP BY EventoID
    ),
    hist AS (
      SELECT
        t.EventoID                                      AS evento_id,
        ANY_VALUE(t.Ticketera)                          AS ticketera,
        COUNTIF(${VENDIDO})                             AS tx_hist,
        COUNT(DISTINCT IF(${VENDIDO}, t.OrdenID, NULL)) AS ord_hist,
        COUNTIF(${VENDIDO} AND ${PM_IS})                AS pm_items_hist,
        COUNT(DISTINCT IF(${VENDIDO} AND ${PM_VENTA}, t.OrdenID, NULL)) AS pm_ord_hist,
        COUNTIF(${VENDIDO} AND ${PM_MUT})               AS pm_mutilado,
        COUNTIF(${VENDIDO} AND ${PM_NORM} != '')        AS con_referido,
        MIN(IF(${VENDIDO}, ${FECHA_ORDEN}, NULL))       AS venta_desde,
        MAX(IF(${VENDIDO}, ${FECHA_ORDEN}, NULL))       AS venta_hasta
      FROM ${TICKETS} t
      WHERE t.EventoID = @eventoId
      GROUP BY evento_id
    ),
    win AS (
      SELECT
        -- transacciones / ordenes / devueltas / pm_items / pm_ordenes siguen en
        -- FILAS y ÓRDENES a propósito: son unidades de compra (pm_ordenes es el
        -- denominador del CPA referido). Solo *_personas usa PersonasPorTicket.
        COUNTIF(${VENDIDO})                             AS transacciones,
        COUNT(DISTINCT IF(${VENDIDO}, t.OrdenID, NULL)) AS ordenes,
        SUM(IF(${VENDIDO}, t.PersonasPorTicket, 0))     AS personas,
        COUNTIF(t.EsDevuelto IS TRUE)                   AS devueltas,
        COUNTIF(${VENDIDO} AND ${PM_IS})                AS pm_items,
        COUNT(DISTINCT IF(${VENDIDO} AND ${PM_VENTA}, t.OrdenID, NULL)) AS pm_ordenes,
        SUM(IF(${VENDIDO} AND ${PM_VENTA}, t.PersonasPorTicket, 0)) AS pm_personas
      FROM ${TICKETS} t
      WHERE t.EventoID = @eventoId
        AND ${FECHA_ORDEN} BETWEEN DATE(@from) AND DATE(@to)
    )
    SELECT
      h.evento_id IS NOT NULL AS tiene_tickets,
      h.ticketera,
      w.transacciones, w.ordenes, w.personas, w.devueltas,
      w.pm_items, w.pm_ordenes, w.pm_personas,
      h.pm_mutilado, h.con_referido,
      100 * SAFE_DIVIDE(h.pm_ord_hist, h.ord_hist) AS propagacion_pct,
      CAST(h.venta_desde AS STRING) AS venta_desde,
      CAST(h.venta_hasta AS STRING) AS venta_hasta,
      CAST(p.pm_desde AS STRING)    AS pm_desde_ticketera,
      c.goal_tickets,
      CASE
        -- El ORDEN importa. Las dos primeras son guardas contra fechas NULL.
        -- 'sin_pm' va ANTES de cualquier chequeo de cobertura: con el orden
        -- inverso, GLP007 y GLO193 (pm_ordenes = 0, $12.271 de gasto) salían
        -- clasificados como cobertura parcial y el cliente los trataba como
        -- medibles, dividiendo por cero.
        WHEN h.evento_id IS NULL      THEN 'sin_datos_ticketera'
        WHEN IFNULL(h.tx_hist, 0) = 0 THEN 'cero_vendidos'
        WHEN h.venta_hasta < IFNULL(p.pm_desde, DATE '2026-02-25') THEN 'pre_esquema'
        WHEN IFNULL(h.con_referido, 0) = 0 THEN 'sin_propagacion'
        -- Mutilado se detecta por 'mutilado > pm', NO por 'pm = 0': con '= 0' el
        -- evento 660905 se cuela como medible por sus 6 tickets buenos (contra
        -- 1.077 sin prefijo) y produce un CPA de $1.063.
        WHEN h.pm_mutilado > h.pm_items_hist THEN 'referido_mutilado'
        WHEN IFNULL(h.pm_ord_hist, 0) = 0 THEN 'sin_pm'
        WHEN 100 * SAFE_DIVIDE(h.pm_ord_hist, h.ord_hist) < ${PM_PROPAGACION_MIN}
                                          THEN 'propagacion_baja'
        ELSE 'medible'
      END AS estado
    FROM (SELECT @eventoId AS id) ids
    LEFT JOIN hist h ON h.evento_id = ids.id
    LEFT JOIN win  w ON TRUE
    LEFT JOIN cat  c ON c.EventoID  = ids.id
    LEFT JOIN primer_pm p ON p.Ticketera = h.ticketera
    `,
    { eventoId, from, to },
  );
  const r = rows[0] ?? {};
  return {
    tieneTickets: b(r.tiene_tickets),
    ticketera: s(r.ticketera),
    transacciones: n(r.transacciones),
    ordenes: n(r.ordenes),
    personas: n(r.personas),
    devueltas: n(r.devueltas),
    pmItems: n(r.pm_items),
    pmOrdenes: n(r.pm_ordenes),
    pmPersonas: n(r.pm_personas),
    pmMutilado: n(r.pm_mutilado),
    conReferido: n(r.con_referido),
    propagacionPct: n(r.propagacion_pct),
    ventaDesde: s(r.venta_desde),
    ventaHasta: s(r.venta_hasta),
    pmDesdeTicketera: s(r.pm_desde_ticketera),
    goalTickets: r.goal_tickets == null ? null : n(r.goal_tickets),
    estado: (s(r.estado) || "sin_datos_ticketera") as EstadoReferido,
  };
}

/** Una fila por día con datos, alineable a las columnas del calendario. */
export type SerieResultadoRow = {
  fecha: string; // YYYY-MM-DD
  transacciones: number;
  personas: number;
  pmOrdenes: number;
};

/**
 * Serie diaria de resultado, para las filas del bloque "Resultado del día" de la
 * sábana. Se imputa al día de la ORDEN, que es el único que la ticketera conoce.
 *
 * NO hay serie de CPA, ROAS ni conversiones por día, a propósito: la plataforma
 * imputa la conversión al día del CLIC, así que el ratio entre el CPA de un día y
 * el del evento va de 0,15 (p5) a 4,89 (p95) con máximo 14,52 sobre 884 días de
 * 2026. Caso real: GLO203 el 2026-08-18 gastó $27,15 y reporta 370 conversiones
 * → CPA $0,073. Un número así al lado del gasto del día es ruido, no señal.
 *
 * Tampoco hay serie de devueltos: `glovox.tickets` solo tiene el flag
 * `EsDevuelto` y no cuándo se devolvió (el lag CreatedAt − FechaOrden es 0 días
 * en todos los cuartiles), así que graficarla la pondría en el día equivocado.
 */
export async function getSerieResultadoEvento(
  eventoId: string,
  from: string,
  to: string,
): Promise<SerieResultadoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      FORMAT_DATE('%Y-%m-%d', ${FECHA_ORDEN})         AS fecha,
      -- transacciones = filas (debe cuadrar con la card "Tickets vendidos") y
      -- pm_ordenes = ordenes (denominador del CPA referido). Solo 'personas'
      -- pondera por PersonasPorTicket.
      COUNTIF(${VENDIDO})                             AS transacciones,
      SUM(IF(${VENDIDO}, t.PersonasPorTicket, 0))     AS personas,
      COUNT(DISTINCT IF(${VENDIDO} AND ${PM_VENTA}, t.OrdenID, NULL)) AS pm_ordenes
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND ${FECHA_ORDEN} BETWEEN DATE(@from) AND DATE(@to)
    GROUP BY fecha
    ORDER BY fecha
    `,
    { eventoId, from, to },
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    pmOrdenes: n(r.pm_ordenes),
  }));
}
