/**
 * Auditoría de la taxonomía de TIPO DE CAMPAÑA sobre marts.paidmedia_ads_performance.
 *
 * Contexto: en /inversion-medios el PLAN vive a nivel plataforma × día, pero el
 * gasto real se lee desagregado por tipo de campaña. Ese "tipo" no es un dato
 * guardado: se deriva en el cliente desde `objective` (OBJ_MAP). Este script
 * audita esa derivación contra el mart:
 *
 *   1. Cuánto gasto hay por plataforma (y qué se esconde en "Otras").
 *   2. Qué objetivos NO están en OBJ_MAP (caerían al enum crudo).
 *   3. Qué campañas concretas caen en Ventas, Cobertura, etc.
 *   4. Cuánto del gasto es remarketing y dentro de qué tipos vive.
 *
 * La sección 2 es el guardián del supuesto: si algún día aparece un objetivo
 * nuevo, sale acá antes de que alguien lo note como un bucket raro en la UI.
 *
 * Usa las MISMAS funciones que producción (lib/inversion-medios/tipos.ts), así
 * que lo que imprime es exactamente lo que ve el dashboard. SOLO LECTURA.
 *
 * Uso:  npm run audit:tipos                          (año en curso)
 *       npm run audit:tipos -- 2025-01-01 2025-12-31
 *       npm run audit:tipos -- 2026-01-01 2026-12-31 GLO203   (un solo evento)
 */
import { query } from "@/lib/bigquery";
import { esRemarketing, tipoDeObjetivo } from "@/lib/inversion-medios/tipos";

const P = process.env.BIGQUERY_PROJECT_ID;
const MART = `\`${P}.marts.paidmedia_ads_performance\``;

type Row = {
  plataforma: string;
  objective: string;
  campaignName: string;
  eventoId: string;
  gastoUsd: number;
  dias: number;
  primera: string;
  ultima: string;
};

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pad = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n);

/** Un objetivo está SIN MAPEAR si tipoDeObjetivo devuelve el enum crudo. */
function sinMapear(plataforma: string, objective: string): boolean {
  const o = (objective || "").trim().toUpperCase();
  if (!o) return true; // objective vacío → "Otros"
  return tipoDeObjetivo(plataforma, objective) === o;
}

async function main() {
  const [, , argFrom, argTo, argEvento] = process.argv;
  const from = argFrom ?? `${new Date().getUTCFullYear()}-01-01`;
  const to = argTo ?? `${new Date().getUTCFullYear()}-12-31`;
  const evento = (argEvento ?? "").trim().toUpperCase() || null;

  console.log(
    `\n=== AUDITORÍA TIPO DE CAMPAÑA · ${from} → ${to}${evento ? ` · ${evento}` : ""} ===\n`,
  );

  const raw = await query<Record<string, unknown>>(
    `
    SELECT
      IFNULL(plataforma, '(null)')            AS plataforma,
      IFNULL(objective, '')                   AS objective,
      IFNULL(campaign_name, '')               AS campaign_name,
      IFNULL(EventoID, '(sin evento)')        AS evento_id,
      SUM(gasto_usd)                          AS gasto_usd,
      COUNT(DISTINCT fecha)                   AS dias,
      FORMAT_DATE('%Y-%m-%d', MIN(fecha))     AS primera,
      FORMAT_DATE('%Y-%m-%d', MAX(fecha))     AS ultima
    FROM ${MART}
    WHERE fecha BETWEEN DATE(@from) AND DATE(@to)
      ${evento ? "AND EventoID = @evento" : ""}
    GROUP BY plataforma, objective, campaign_name, evento_id
    HAVING gasto_usd > 0
    ORDER BY gasto_usd DESC
    `,
    evento ? { from, to, evento } : { from, to },
  );

  const rows: Row[] = raw.map((r) => ({
    plataforma: String(r.plataforma),
    objective: String(r.objective),
    campaignName: String(r.campaign_name),
    eventoId: String(r.evento_id),
    gastoUsd: Number(r.gasto_usd),
    dias: Number(r.dias),
    primera: String(r.primera),
    ultima: String(r.ultima),
  }));

  const total = rows.reduce((a, r) => a + r.gastoUsd, 0);
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  // ---------- 1. Gasto por plataforma ----------
  console.log("── 1. GASTO POR PLATAFORMA ─────────────────────────────────\n");
  const CONOCIDAS = new Set(["meta", "google", "tiktok"]);
  const porPlat = new Map<string, { gasto: number; camps: Set<string> }>();
  for (const r of rows) {
    const k = r.plataforma.toLowerCase();
    if (!porPlat.has(k)) porPlat.set(k, { gasto: 0, camps: new Set() });
    const a = porPlat.get(k)!;
    a.gasto += r.gastoUsd;
    a.camps.add(r.campaignName);
  }
  for (const [plat, a] of [...porPlat].sort((x, y) => y[1].gasto - x[1].gasto)) {
    const flag = CONOCIDAS.has(plat) ? "  " : "→ cae en «Otras»";
    console.log(
      `  ${pad(plat, 14)} ${pad(usd(a.gasto), 12)} ${pad(pct(a.gasto), 8)} ${String(a.camps.size).padStart(4)} campañas  ${flag}`,
    );
  }
  console.log(`  ${pad("TOTAL", 14)} ${pad(usd(total), 12)}\n`);

  // ---------- 2. Qué hay dentro de "Otras" ----------
  const otras = rows.filter((r) => !CONOCIDAS.has(r.plataforma.toLowerCase()));
  console.log("── 2. DETALLE DE «OTRAS» (plataformas no planificables hoy) ─\n");
  if (otras.length === 0) {
    console.log("  (vacío — todo el gasto cae en meta/google/tiktok)\n");
  } else {
    for (const r of otras.sort((a, b) => b.gastoUsd - a.gastoUsd)) {
      console.log(
        `  ${pad(r.plataforma, 12)} ${pad(usd(r.gastoUsd), 10)} ${pad(r.eventoId, 12)} ${pad(r.objective || "(sin objective)", 22)} ${pad(r.campaignName || "(sin nombre)", 46)} ${r.primera}→${r.ultima} (${r.dias}d)`,
      );
    }
    const totOtras = otras.reduce((a, r) => a + r.gastoUsd, 0);
    console.log(`\n  subtotal «Otras»: ${usd(totOtras)} (${pct(totOtras)} del gasto)\n`);
  }

  // ---------- 3. Objetivos SIN MAPEAR en OBJ_MAP ----------
  console.log("── 3. OBJETIVOS SIN MAPEAR (buckets no planificables) ──────\n");
  const gaps = new Map<string, { gasto: number; camps: Set<string> }>();
  for (const r of rows) {
    if (!sinMapear(r.plataforma, r.objective)) continue;
    const k = `${r.plataforma.toLowerCase()} · ${r.objective || "(sin objective)"}`;
    if (!gaps.has(k)) gaps.set(k, { gasto: 0, camps: new Set() });
    const a = gaps.get(k)!;
    a.gasto += r.gastoUsd;
    a.camps.add(r.campaignName);
  }
  if (gaps.size === 0) {
    console.log("  ✓ ninguno — OBJ_MAP cubre el 100% del gasto\n");
  } else {
    for (const [k, a] of [...gaps].sort((x, y) => y[1].gasto - x[1].gasto)) {
      console.log(`  ${pad(k, 42)} ${pad(usd(a.gasto), 10)} ${pad(pct(a.gasto), 7)} ${a.camps.size} campañas`);
    }
    const totGap = [...gaps.values()].reduce((a, g) => a + g.gasto, 0);
    console.log(`\n  subtotal sin mapear: ${usd(totGap)} (${pct(totGap)} del gasto)\n`);
  }

  // ---------- 4. Campañas dentro de Ventas y Cobertura ----------
  console.log("── 4. QUÉ CAMPAÑAS CAEN EN CADA TIPO (modo Objetivo) ───────\n");
  const porTipo = new Map<string, Row[]>();
  for (const r of rows) {
    const t = `${r.plataforma.toLowerCase()} · ${tipoDeObjetivo(r.plataforma, r.objective)}`;
    if (!porTipo.has(t)) porTipo.set(t, []);
    porTipo.get(t)!.push(r);
  }
  const orden = [...porTipo].sort(
    (a, b) =>
      b[1].reduce((s, r) => s + r.gastoUsd, 0) - a[1].reduce((s, r) => s + r.gastoUsd, 0),
  );
  for (const [tipo, rs] of orden) {
    const sub = rs.reduce((a, r) => a + r.gastoUsd, 0);
    console.log(`\n  ▸ ${tipo} — ${usd(sub)} (${pct(sub)}) · ${rs.length} campañas`);
    const top = rs.sort((a, b) => b.gastoUsd - a.gastoUsd).slice(0, 8);
    for (const r of top) {
      console.log(
        `      ${pad(usd(r.gastoUsd), 9)} ${pad(r.eventoId, 11)} ${pad(r.objective, 22)} ${r.campaignName || "(sin nombre)"}`,
      );
    }
    if (rs.length > top.length) console.log(`      … y ${rs.length - top.length} campañas más`);
  }
  console.log("");

  // ---------- 5. Remarketing (sub-etiqueta, no un tipo) ----------
  console.log("\n── 5. REMARKETING ──────────────────────────────────────────\n");
  const rmkt = rows.filter((r) => esRemarketing(r.campaignName));
  const totRmkt = rmkt.reduce((a, r) => a + r.gastoUsd, 0);
  if (rmkt.length === 0) {
    console.log("  (sin campañas de remarketing en el período)\n");
  } else {
    console.log(
      `  ${rmkt.length} campañas · ${usd(totRmkt)} (${pct(totRmkt)} del gasto)\n`,
    );
    // En qué tipos vive (RMKT NO sale de su tipo: suma dentro de él).
    const porTipoRmkt = new Map<string, number>();
    for (const r of rmkt) {
      const k = `${r.plataforma.toLowerCase()} · ${tipoDeObjetivo(r.plataforma, r.objective)}`;
      porTipoRmkt.set(k, (porTipoRmkt.get(k) ?? 0) + r.gastoUsd);
    }
    for (const [k, v] of [...porTipoRmkt].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${pad(k, 26)} ${pad(usd(v), 10)} ${pct(v)}`);
    }
    console.log("");
    for (const r of rmkt.sort((a, b) => b.gastoUsd - a.gastoUsd).slice(0, 15)) {
      console.log(
        `    ${pad(usd(r.gastoUsd), 9)} ${pad(r.eventoId, 11)} ${pad(r.objective, 22)} ${r.campaignName}`,
      );
    }
    if (rmkt.length > 15) console.log(`    … y ${rmkt.length - 15} más`);
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
