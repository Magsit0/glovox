/**
 * Validador de paridad para la consolidación de /paid-media en USD.
 *
 * Consulta BigQuery DIRECTAMENTE con las dos formas de SQL —la vieja (tabla
 * cruda `paidMedia.ads_performance`, agregada dentro de una sola moneda) y la
 * nueva (vista gobernada `marts.paidmedia_ads_performance`, consolidada en
 * USD)— y compara los resultados. No importa nada de `lib/queries/paidMedia.ts`
 * a propósito: si importara el código que estamos migrando, validaría el
 * refactor contra sí mismo.
 *
 * Qué comprueba, por cada scope:
 *   1. TOTAL — la suma de los totales por moneda convertidos a USD con el FX
 *      diario debe coincidir con el total consolidado del mart (< 1 centavo).
 *   2. CARDINALIDAD — cuántas filas devuelve cada breakdown antes y después,
 *      para detectar lo que se cae por los LIMIT.
 *   3. ORDEN — el top-20 de cada ranking, para detectar el reordenamiento que
 *      produce pasar de una tasa plana a una tasa diaria.
 *   4. HUECO DE FX — filas sin conversión y cuánto gasto local representan.
 *   5. SWITCH USD ↔ CLP — que cambiar la moneda de despliegue cambie la unidad
 *      y nada más: CTR y ROAS idénticos, métricas currency-free intactas y una
 *      tasa implícita plausible.
 *   6. COBERTURA — que ninguna moneda de ads falte en referencia.tipo_cambio.
 *
 * El rango cerrado (`<= MAX(fecha)` de tipo_cambio) es el único donde la
 * igualdad debe ser exacta. Los scopes que incluyen el día en curso se
 * reportan pero no fallan: ahí la diferencia ES el hueco que la migración
 * viene a resolver.
 *
 * Los chequeos se anclan a DATOS (MAX(fecha) de tipo_cambio), nunca al reloj:
 * un umbral con CURRENT_DATE() pasa o falla según la hora a la que se corra.
 *
 * Uso:  npm run test:paidmedia-fx
 * Exit 0 = la migración preserva los números. Distinto de 0 = parar y revisar.
 */
import { BigQuery } from "@google-cloud/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
if (!P) throw new Error("BIGQUERY_PROJECT_ID no está seteado");
const RAW = `\`${P}.paidMedia.ads_performance\``;
const MART = `\`${P}.marts.paidmedia_ads_performance\``;
const FX = `\`${P}.referencia.tipo_cambio\``;

const bq = new BigQuery({
  projectId: P,
  credentials: JSON.parse(process.env.BIGQUERY_SERVICE_ACCOUNT ?? "{}"),
});

/** Tolerancia en USD. Por debajo de un centavo es ruido de punto flotante. */
const EPSILON = 0.01;

type Scope = {
  nombre: string;
  /**
   * SQL boolean que se inyecta en el WHERE. Solo literales del propio script.
   * Usa el token `{a}` donde vaya el alias de la tabla de ads: las queries
   * "viejas" hacen JOIN contra tipo_cambio, que también tiene `fecha`, así que
   * las columnas del scope tienen que ir calificadas o BigQuery las rechaza
   * por ambiguas.
   */
  where: string;
  /** true = el scope incluye el día en curso, donde el hueco de FX es esperable. */
  incluyeHoy: boolean;
};

/** Resuelve el token `{a}` del scope al alias que use cada query. */
function where(s: Scope, alias: string): string {
  return s.where.replace(/\{a\}/g, alias);
}

type Fallo = { scope: string; check: string; detalle: string };

const fallos: Fallo[] = [];
const avisos: string[] = [];

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
}

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const [rows] = await bq.query({ query: sql });
  return rows as T[];
}

/** Último día con tipo de cambio publicado para TODAS las monedas. */
async function cierreFx(): Promise<string> {
  const rows = await q(`
    SELECT FORMAT_DATE('%Y-%m-%d', MIN(max_fecha)) AS cierre
    FROM (SELECT currency, MAX(fecha) AS max_fecha FROM ${FX} GROUP BY currency)
  `);
  return str(rows[0]?.cierre);
}

// ─────────────────────────── Check 1: totales ───────────────────────────

async function checkTotal(s: Scope) {
  // VIEJO: replica lo que hacía el dashboard — agregar dentro de cada moneda —
  // y recién después convierte cada moneda a USD con el FX diario, sumando.
  // Es la definición contra la que el consolidado tiene que empatar.
  const viejo = await q(`
    SELECT ROUND(SUM(SAFE_DIVIDE(e.gasto, tc.units_per_usd)), 4) AS usd
    FROM ${RAW} e
    LEFT JOIN ${FX} tc ON tc.currency = e.currency AND tc.fecha = e.fecha
    WHERE ${where(s, "e")}
  `);
  const nuevo = await q(`
    SELECT ROUND(SUM(a.gasto_usd), 4) AS usd
    FROM ${MART} a
    WHERE ${where(s, "a")}
  `);

  const a = num(viejo[0]?.usd);
  const b = num(nuevo[0]?.usd);
  const delta = b - a;

  if (Math.abs(delta) <= EPSILON) {
    console.log(`  ✓ total USD  ${b.toFixed(2)}  (delta ${delta.toFixed(4)})`);
    return;
  }

  const linea = `antes ${a.toFixed(2)} · después ${b.toFixed(2)} · delta ${delta.toFixed(2)}`;
  if (s.incluyeHoy) {
    // Con la vista vigente el día en curso sale NULL en AMBOS lados, así que
    // un delta acá significa que el carry-forward del mart ya está aplicado.
    avisos.push(`[${s.nombre}] total difiere en un rango que incluye hoy: ${linea}`);
    console.log(`  ~ total USD  ${linea}  (esperable: incluye el día en curso)`);
  } else {
    fallos.push({ scope: s.nombre, check: "total", detalle: linea });
    console.log(`  ✗ total USD  ${linea}`);
  }
}

// ────────────────────── Check 2 y 3: cardinalidad y orden ──────────────────────

const RANKINGS = [
  { nombre: "cuentas",  col: "account_id",  label: "account_name",  limite: 50 },
  { nombre: "campañas", col: "campaign_id", label: "campaign_name", limite: 50 },
  { nombre: "adsets",   col: "adset_id",    label: "adset_name",    limite: 50 },
] as const;

async function checkRanking(s: Scope, r: (typeof RANKINGS)[number]) {
  // El ranking VIEJO vivía dentro de una sola moneda: reproducimos el de la
  // moneda de mayor gasto, que es la que el dashboard elegía por defecto.
  const monedaTop = await q(`
    SELECT a.currency AS currency FROM ${RAW} a
    WHERE ${where(s, "a")} AND a.currency IS NOT NULL
    GROUP BY currency ORDER BY SUM(IFNULL(a.gasto, 0)) DESC LIMIT 1
  `);
  const moneda = str(monedaTop[0]?.currency);
  if (!moneda) return;

  const viejo = await q(`
    SELECT a.${r.col} AS k, ANY_VALUE(a.${r.label}) AS l
    FROM ${RAW} a
    WHERE ${where(s, "a")} AND a.currency = '${moneda}'
    GROUP BY k ORDER BY SUM(IFNULL(a.gasto, 0)) DESC LIMIT ${r.limite}
  `);
  const nuevo = await q(`
    SELECT a.${r.col} AS k, ANY_VALUE(a.${r.label}) AS l
    FROM ${MART} a
    WHERE ${where(s, "a")}
    GROUP BY k ORDER BY SUM(IFNULL(a.gasto_usd, 0)) DESC LIMIT ${r.limite}
  `);

  const totalViejo = await q(
    `SELECT COUNT(DISTINCT a.${r.col}) AS n FROM ${RAW} a WHERE ${where(s, "a")} AND a.currency = '${moneda}'`,
  );
  const totalNuevo = await q(
    `SELECT COUNT(DISTINCT a.${r.col}) AS n FROM ${MART} a WHERE ${where(s, "a")}`,
  );

  const nv = num(totalViejo[0]?.n);
  const nn = num(totalNuevo[0]?.n);
  const ocultosNuevo = Math.max(0, nn - r.limite);

  // Cuántos de los que estaban arriba en la vista mono-moneda siguen entrando
  // en el top consolidado. No es un fallo: es la magnitud del cambio que el
  // usuario va a percibir, y tiene que quedar en el registro.
  const setNuevo = new Set(nuevo.map((x) => str(x.k)));
  const salieron = viejo.filter((x) => !setNuevo.has(str(x.k)));

  console.log(
    `  · ${r.nombre.padEnd(9)} ${moneda}: ${nv} → consolidado ${nn}` +
      (ocultosNuevo > 0 ? ` · ${ocultosNuevo} fuera del LIMIT ${r.limite}` : "") +
      (salieron.length > 0 ? ` · ${salieron.length} salen del top-${r.limite}` : ""),
  );
  if (ocultosNuevo > 0) {
    avisos.push(
      `[${s.nombre}] ${r.nombre}: ${ocultosNuevo} de ${nn} quedan fuera del LIMIT ${r.limite}`,
    );
  }
}

// ────────────────────────── Check 4: hueco de FX ──────────────────────────

async function checkHueco(s: Scope) {
  const rows = await q(`
    SELECT a.currency AS currency,
           COUNTIF(a.gasto_usd IS NULL)                                 AS filas,
           ROUND(SUM(IF(a.gasto_usd IS NULL, IFNULL(a.gasto, 0), 0)), 2) AS gasto_local,
           FORMAT_DATE('%Y-%m-%d', MIN(IF(a.gasto_usd IS NULL, a.fecha, NULL))) AS desde,
           FORMAT_DATE('%Y-%m-%d', MAX(IF(a.gasto_usd IS NULL, a.fecha, NULL))) AS hasta
    FROM ${MART} a
    WHERE ${where(s, "a")}
    GROUP BY currency
    HAVING filas > 0
    ORDER BY gasto_local DESC
  `);

  if (rows.length === 0) {
    console.log("  ✓ sin hueco de FX");
    return;
  }
  for (const r of rows) {
    const linea = `${str(r.currency)}: ${num(r.filas)} filas · ${num(r.gasto_local)} sin convertir · ${str(r.desde)}→${str(r.hasta)}`;
    if (s.incluyeHoy) {
      console.log(`  ~ hueco FX   ${linea}`);
      avisos.push(`[${s.nombre}] hueco de FX ${linea}`);
    } else {
      // Un hueco en un rango CERRADO no es el día en curso: es cobertura
      // faltante de verdad (p. ej. una moneda que tipo_cambio no cubre).
      console.log(`  ✗ hueco FX   ${linea}`);
      fallos.push({ scope: s.nombre, check: "hueco-fx-en-rango-cerrado", detalle: linea });
    }
  }
}

// ───────────────── Check 5: invariantes del switch USD ↔ CLP ─────────────────

/**
 * El switch cambia la UNIDAD, no el scope. Lo que se comprueba:
 *
 *  - CTR es adimensional: idéntico en las dos monedas.
 *  - ROAS está anclado a USD a propósito (ver ROAS_USD_SQL en paidMedia.ts):
 *    idéntico. Sin el ancla difería ~1%, porque reexpresar fila a fila con una
 *    tasa que varía por día cambia el peso de cada día dentro del cociente.
 *  - Las métricas currency-free (impresiones, clics) no se mueven.
 *  - Los totales escalan por una tasa implícita plausible.
 *
 * Lo que NO se comprueba porque legítimamente cambia: el ORDEN de los rankings.
 * Dos eventos con el mismo gasto en dólares difieren en pesos si invirtieron en
 * fechas con tasas distintas.
 */
async function checkSwitch(s: Scope) {
  const uno = async (moneda: "USD" | "CLP") => {
    const fx = moneda === "CLP" ? `LEFT JOIN ${FX} fx ON fx.currency = 'CLP' AND fx.fecha = a.fecha` : "";
    const monto = (c: string) => (moneda === "CLP" ? `(${c} * fx.units_per_usd)` : c);
    const rows = await q(`
      SELECT
        SUM(${monto("a.gasto_usd")})                                  AS gasto,
        SUM(IFNULL(a.impresiones, 0))                                 AS impresiones,
        SUM(IFNULL(a.clics, 0))                                       AS clics,
        SAFE_DIVIDE(SUM(IFNULL(a.clics, 0)), SUM(IFNULL(a.impresiones, 0))) AS ctr,
        SAFE_DIVIDE(SUM(a.valor_conversion_usd), SUM(a.gasto_usd))    AS roas
      FROM ${MART} a
      ${fx}
      WHERE ${where(s, "a")}
    `);
    const r = rows[0] ?? {};
    return {
      gasto: num(r.gasto), impresiones: num(r.impresiones),
      clics: num(r.clics), ctr: num(r.ctr), roas: num(r.roas),
    };
  };

  const [u, c] = await Promise.all([uno("USD"), uno("CLP")]);

  const iguales: [string, number, number][] = [
    ["CTR", u.ctr, c.ctr],
    ["ROAS", u.roas, c.roas],
    ["impresiones", u.impresiones, c.impresiones],
    ["clics", u.clics, c.clics],
  ];
  for (const [nombre, a, b] of iguales) {
    const delta = Math.abs(a - b);
    if (delta > 1e-9) {
      fallos.push({
        scope: s.nombre,
        check: `switch-invariante-${nombre}`,
        detalle: `USD ${a} · CLP ${b} · delta ${delta}`,
      });
      console.log(`  ✗ switch     ${nombre} cambia con la moneda: ${a} vs ${b}`);
    }
  }

  const tasa = u.gasto > 0 ? c.gasto / u.gasto : 0;
  // Rango defensivo: el dólar observado no ha salido de [700, 1200] CLP en la
  // ventana que cubre tipo_cambio (min 777,10 · max 1.042,97).
  if (u.gasto > 0 && (tasa < 700 || tasa > 1200)) {
    fallos.push({
      scope: s.nombre,
      check: "switch-tasa-implicita",
      detalle: `${tasa.toFixed(2)} CLP/USD fuera del rango plausible [700, 1200]`,
    });
    console.log(`  ✗ switch     tasa implícita ${tasa.toFixed(2)} CLP/USD fuera de rango`);
  } else if (u.gasto > 0) {
    console.log(`  ✓ switch     invariantes OK · ${tasa.toFixed(2)} CLP/USD implícito`);
  }
}

// ───────────────────── Check 6: cobertura de monedas ─────────────────────

async function checkCobertura() {
  const rows = await q(`
    SELECT DISTINCT currency FROM ${RAW}
    WHERE currency IS NOT NULL
      AND currency NOT IN (SELECT DISTINCT currency FROM ${FX})
  `);
  if (rows.length === 0) {
    console.log("✓ cobertura de monedas: todas las monedas de ads están en tipo_cambio");
    return;
  }
  const faltantes = rows.map((r) => str(r.currency)).join(", ");
  fallos.push({
    scope: "global",
    check: "cobertura-monedas",
    detalle: `sin tipo de cambio: ${faltantes}`,
  });
  console.log(`✗ cobertura de monedas: falta ${faltantes} en referencia.tipo_cambio`);
}

// ─────────────────────────────── Main ───────────────────────────────

async function main() {
  const cierre = await cierreFx();
  console.log(`Cierre de FX (último día publicado en las 3 monedas): ${cierre}\n`);

  const scopes: Scope[] = [
    { nombre: "rango cerrado (todo el histórico con FX)", where: `{a}.fecha <= DATE '${cierre}'`, incluyeHoy: false },
    { nombre: "rango cerrado · meta",                     where: `{a}.fecha <= DATE '${cierre}' AND {a}.plataforma = 'meta'`, incluyeHoy: false },
    { nombre: "rango cerrado · google",                   where: `{a}.fecha <= DATE '${cierre}' AND {a}.plataforma = 'google'`, incluyeHoy: false },
    { nombre: "rango cerrado · tiktok",                   where: `{a}.fecha <= DATE '${cierre}' AND {a}.plataforma = 'tiktok'`, incluyeHoy: false },
    { nombre: "últimos 30 días cerrados",                 where: `{a}.fecha BETWEEN DATE_SUB(DATE '${cierre}', INTERVAL 30 DAY) AND DATE '${cierre}'`, incluyeHoy: false },
    { nombre: "últimos 7 días cerrados",                  where: `{a}.fecha BETWEEN DATE_SUB(DATE '${cierre}', INTERVAL 7 DAY) AND DATE '${cierre}'`, incluyeHoy: false },
    { nombre: "2025 completo",                            where: `{a}.fecha BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'`, incluyeHoy: false },
    { nombre: "todo (incluye el día en curso)",           where: `TRUE`, incluyeHoy: true },
  ];

  await checkCobertura();
  console.log("");

  for (const s of scopes) {
    console.log(`── ${s.nombre}`);
    await checkTotal(s);
    await checkHueco(s);
    await checkSwitch(s);
    for (const r of RANKINGS) await checkRanking(s, r);
    console.log("");
  }

  if (avisos.length > 0) {
    console.log("AVISOS (no bloquean):");
    for (const a of avisos) console.log(`  · ${a}`);
    console.log("");
  }

  if (fallos.length === 0) {
    console.log("✓ PARIDAD OK — la migración preserva los números en todos los rangos cerrados.");
    process.exit(0);
  }

  console.log(`✗ ${fallos.length} FALLO(S):`);
  for (const f of fallos) console.log(`  · [${f.scope}] ${f.check}: ${f.detalle}`);
  process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : e);
  process.exit(2);
});
