/**
 * Auditoría del esquema de referidos PM_ y del umbral de propagación.
 *
 * Lectura PURA de BigQuery: no importa `lib/queries/inversion-medios.ts`, para no
 * validar el código contra sí mismo. Recalcula desde cero:
 *
 *  1. El corte de propagación (PM_PROPAGACION_MIN, hoy 8%): imprime los eventos
 *     con al menos una orden PM_ ordenados por propagación y marca dónde cae el
 *     corte. Si aparece un evento con propagación alta y brecha absurda, o uno
 *     con propagación baja y brecha creíble, el umbral hay que recalibrarlo.
 *  2. La taxonomía de códigos PM_: cualquier código que no matchee la gramática
 *     conocida sale listado. Es la lista de trabajo para el equipo de medios.
 *  3. Las filas duplicadas del mart (el P0 de GLP007), para saber si
 *     data-governance ya lo arregló.
 *
 * Uso: npm run audit:referido
 */
import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const MART = `\`${P}.marts.paidmedia_ads_performance\``;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;

const UMBRAL = 8; // espejo de PM_PROPAGACION_MIN

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object)) return Number((v as { value: unknown }).value);
  return Number(v);
}

async function propagacion() {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ads AS (
      SELECT m.EventoID AS evento,
        SUM(IF(m.plataforma='meta' AND m.objective='OUTCOME_SALES', m.gasto_usd, 0))    AS gasto_ventas,
        SUM(IF(m.plataforma='meta' AND m.objective='OUTCOME_SALES', m.conversiones, 0)) AS conv_ventas
      FROM ${MART} m
      WHERE m.EventoID IS NOT NULL
        AND EXISTS (SELECT 1 FROM ${CATEGORY} c
                    WHERE c.EventoID = m.EventoID AND c.isCanceled IS NOT TRUE)
      GROUP BY evento
    ),
    tix AS (
      SELECT t.EventoID AS evento,
        COUNT(DISTINCT IF(vendido, t.OrdenID, NULL)) AS ordenes,
        COUNT(DISTINCT IF(vendido AND pm_venta, t.OrdenID, NULL)) AS pm_ordenes
      FROM (
        SELECT t.*,
          (CASE
            WHEN t.MedioPago='Otro' AND (LOWER(t.TipoTicket) LIKE '%pase%' OR LOWER(t.TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
            WHEN t.MedioPago='Otro' AND LOWER(t.TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
            WHEN t.MedioPago='Otro' THEN 'CORTESIA' ELSE 'VENTA' END
           ) IN ('VENTA','PASE TEMPORADA') AND t.EsDevuelto IS FALSE AS vendido,
          (REGEXP_CONTAINS(UPPER(TRIM(COALESCE(t.Referido,''))), r'^PM_MT_[A-Z0-9]+_CONV$')
           OR REGEXP_CONTAINS(UPPER(TRIM(COALESCE(t.Referido,''))), r'^PM_GG_(PMAX|SEARCH|SEA|SHOPPING)_')) AS pm_venta
        FROM ${TICKETS} t
      ) t
      GROUP BY evento
    )
    SELECT a.evento,
      ROUND(a.gasto_ventas, 0) AS gasto_ventas,
      ROUND(a.conv_ventas, 0)  AS conv_ventas,
      t.ordenes, t.pm_ordenes,
      ROUND(100 * SAFE_DIVIDE(t.pm_ordenes, t.ordenes), 1) AS propagacion_pct,
      ROUND(SAFE_DIVIDE(a.conv_ventas, t.pm_ordenes), 2)   AS brecha,
      ROUND(SAFE_DIVIDE(a.gasto_ventas, a.conv_ventas), 2) AS cpa_pixel,
      ROUND(SAFE_DIVIDE(a.gasto_ventas, t.pm_ordenes), 2)  AS cpa_ref
    FROM ads a JOIN tix t USING (evento)
    WHERE t.pm_ordenes > 0
    ORDER BY propagacion_pct DESC
    `,
  );
  console.log(`\n=== 1. Propagación del referido · umbral vigente ${UMBRAL}% ===`);
  console.table(
    rows.map((r) => ({
      evento: r.evento,
      gasto_ventas: n(r.gasto_ventas),
      prop: `${n(r.propagacion_pct)}%`,
      lado: n(r.propagacion_pct) >= UMBRAL ? "▲ se publica" : "▼ n/d",
      cpa_pixel: n(r.cpa_pixel),
      cpa_ref: n(r.cpa_ref),
      brecha: `${n(r.brecha)}x`,
    })),
  );
  const arriba = rows.filter((r) => n(r.propagacion_pct) >= UMBRAL);
  const abajo = rows.filter((r) => n(r.propagacion_pct) < UMBRAL);
  const brechas = (rs: typeof rows) => rs.map((r) => n(r.brecha));
  const rango = (xs: number[]) =>
    xs.length ? `${Math.min(...xs).toFixed(2)}x – ${Math.max(...xs).toFixed(2)}x` : "—";
  console.log(`  sobre el umbral (${arriba.length} eventos): brechas ${rango(brechas(arriba))}`);
  console.log(`  bajo el umbral  (${abajo.length} eventos): brechas ${rango(brechas(abajo))}`);

  // El corte NO separa los intervalos de brecha de forma estricta, y decir que
  // sí sería falso: hay eventos bajo el umbral cuya brecha cae dentro del rango
  // de los que se publican. Lo que importa es si esos cruces PESAN.
  //
  // Al calibrar (2026-08) el único cruce era GLO199 con brecha 2,00× y $128 de
  // gasto en Ventas — contra 2,25× del peor publicado. Un cruce de ese tamaño no
  // invalida el umbral; tres, o uno con gasto real, sí. La alarma se dispara solo
  // ahí, para que no se vuelva ruido que nadie lee.
  const techoArriba = arriba.length ? Math.max(...brechas(arriba)) : Infinity;
  const cruces = abajo.filter((r) => n(r.brecha) <= techoArriba);
  const GASTO_MATERIAL = 1000;
  const crucesMateriales = cruces.filter((r) => n(r.gasto_ventas) >= GASTO_MATERIAL);

  if (cruces.length === 0) {
    console.log("  ✓ separación estricta: ninguna brecha bajo el umbral entra en el rango publicable.");
  } else {
    console.log(
      `  · ${cruces.length} evento(s) bajo el umbral con brecha dentro del rango publicable ` +
        `(<= ${techoArriba.toFixed(2)}x):`,
    );
    for (const r of cruces) {
      console.log(
        `      ${r.evento}: brecha ${n(r.brecha).toFixed(2)}x · propagación ${n(r.propagacion_pct)}% ` +
          `· gasto Ventas $${n(r.gasto_ventas)}`,
      );
    }
  }
  if (crucesMateriales.length > 0 || cruces.length >= 3) {
    console.log(
      "  ⚠️  RECALIBRAR PM_PROPAGACION_MIN: los cruces ya pesan " +
        `(${crucesMateriales.length} con >= $${GASTO_MATERIAL} de gasto en Ventas, ${cruces.length} en total).`,
    );
  } else if (cruces.length > 0) {
    console.log("  ✓ el umbral sigue sirviendo: los cruces son marginales en gasto.");
  }
}

async function taxonomia() {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT codigo, tickets, eventos, ticketeras,
      -- La gramática se evalúa FUERA del GROUP BY: dentro, la columna Referido
      -- no está ni agrupada ni agregada y BigQuery la rechaza.
      REGEXP_CONTAINS(codigo, r'^PM_(MT|GG|TT)_[A-Z0-9]+_(CONV|TRF|ALC|MIX)$') AS gramatica_ok
    FROM (
      SELECT UPPER(TRIM(Referido)) AS codigo, COUNT(*) AS tickets,
        COUNT(DISTINCT EventoID) AS eventos,
        STRING_AGG(DISTINCT Ticketera) AS ticketeras
      FROM ${TICKETS}
      WHERE REGEXP_CONTAINS(UPPER(TRIM(COALESCE(Referido,''))), r'^PM')
      GROUP BY codigo
    )
    ORDER BY tickets DESC
    `,
  );
  console.log("\n=== 2. Taxonomía de códigos PM_ ===");
  console.table(rows.map((r) => ({
    codigo: r.codigo, tickets: n(r.tickets), eventos: n(r.eventos),
    ticketeras: r.ticketeras, gramatica: r.gramatica_ok ? "ok" : "⚠️ fuera de convención",
  })));

  const mut = await query<Record<string, unknown>>(
    `
    SELECT EventoID, COUNT(*) AS tickets, STRING_AGG(DISTINCT UPPER(TRIM(Referido)) LIMIT 5) AS ejemplos
    FROM ${TICKETS}
    WHERE UPPER(TRIM(COALESCE(Referido,''))) IN ('CONV','MIX','ALC','TRF','SEA')
       OR REGEXP_CONTAINS(UPPER(TRIM(COALESCE(Referido,''))), r'^[0-9]{15,20}$')
    GROUP BY EventoID ORDER BY tickets DESC LIMIT 10
    `,
  );
  console.log("  Referidos MUTILADOS (paid media que llegó sin el prefijo PM_):");
  console.table(mut.map((r) => ({ evento: r.EventoID, tickets: n(r.tickets), ejemplos: r.ejemplos })));
}

async function duplicados() {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT COUNT(*) AS grupos, SUM(filas) - COUNT(*) AS filas_excedentes,
      STRING_AGG(DISTINCT evento LIMIT 5) AS eventos,
      MIN(desde) AS desde, MAX(hasta) AS hasta
    FROM (
      SELECT fecha AS desde, fecha AS hasta, COUNT(*) AS filas,
             ANY_VALUE(COALESCE(EventoID, UPPER(LEFT(campaign_name,6)))) AS evento
      FROM ${MART}
      GROUP BY fecha, plataforma, account_id, campaign_id, adset_id
      HAVING COUNT(*) > 1
    )
    `,
  );
  const r = rows[0] ?? {};
  console.log("\n=== 3. Filas duplicadas del mart (P0 de data-governance) ===");
  if (n(r.grupos) === 0) {
    console.log("  ✓ sin duplicados. Si antes había, data-governance ya lo arregló:");
    console.log("    se pueden reclamar cierres de conteo en los criterios de aceptación.");
  } else {
    console.log(`  ⚠️  ${n(r.grupos)} grupos duplicados · ${n(r.filas_excedentes)} filas excedentes`);
    console.log(`     eventos: ${r.eventos} · rango: ${JSON.stringify(r.desde)} → ${JSON.stringify(r.hasta)}`);
    console.log("     Los CONTEOS (impresiones, clics) de esos eventos salen inflados.");
  }
}

async function main() {
  await propagacion();
  await taxonomia();
  await duplicados();
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
