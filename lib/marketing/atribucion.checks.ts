/**
 * Chequeos de lib/marketing/atribucion.ts (y formato.ts) con casos cerrados.
 *   tsx lib/marketing/atribucion.checks.ts  (o `npm run test:atribucion`)
 *
 * Los fixtures son las filas reales de la sonda GA4 fijada al 2026-09-27 (spec §6):
 * GLO211, GLO212, GLO214 y 738502. Sin BigQuery: la auditoría contra datos vivos
 * es `npm run audit:atribucion`.
 */
import assert from "node:assert/strict";
import {
  ALERTA,
  CANAL_META,
  CANAL_OTROS,
  CANAL_SIN_ORIGEN,
  COLOR_CANAL,
  COLOR_OTROS,
  COLOR_SIN_ORIGEN,
  COLORES_RESERVA,
  SERIE_OTROS,
  SERIE_SIN_ORIGEN,
  agruparCanales,
  agruparMediosPago,
  agruparPorDiaCanal,
  alertasCobertura,
  cpa,
  diaProvisional,
  diasEntre,
  estadoMedicion,
  etlAtrasado,
  hoySantiago,
  mergeUtmOrdenes,
  monedaDePais,
  muestraCpaReferido,
  pct,
  resumenContenidosPorCanal,
  segmentosCobertura,
  ventanaMedida,
  type CanalRealRow,
  type CoberturaDiaRow,
  type CoberturaMedioPagoRow,
  type EstadoMedicionInput,
} from "./atribucion";
import { fmtClpCompact, fmtFechaCorta, fmtPct, fmtUsd, fmtUsdOGuion, fmtVentaCompact } from "./formato";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// ---------- Fixtures (sonda 2026-09-27) ----------

const cr = (canal: string, fuente: CanalRealRow["fuente"], ordenes: number, personas = 0, venta = 0): CanalRealRow => ({
  canal,
  fuente,
  ordenes,
  personas,
  venta,
});

const GLO211_CANAL: CanalRealRow[] = [
  cr("Búsqueda orgánica", "ga4", 79, 134, 2777600),
  cr("Linktree", "ga4", 74, 135, 2850800),
  cr("Directo", "ga4", 50, 92, 1892800),
  cr(CANAL_SIN_ORIGEN, "sin_dato", 36, 55, 1362400),
  cr("Vendedores (ref)", "ga4", 31, 43, 945200),
  cr("Google Ads (pagado)", "ga4", 20, 31, 650000),
  cr("Meta (pagado)", "ga4", 20, 35, 854400),
  cr("Linktree", "referido", 9, 12, 265600),
  cr("Pasarela de pago", "ga4", 7, 7, 131200),
  cr("Vendedores (ref)", "referido", 6, 9, 200800),
  cr("Otro", "ga4", 5, 8, 190400),
  cr("Email", "referido", 4, 7, 136800),
  cr("Meta (pagado)", "referido", 4, 7, 131200),
  cr("(not set)", "ga4", 3, 4, 89600),
  cr("Google Ads (pagado)", "referido", 3, 5, 117600),
  cr("Social orgánico", "ga4", 2, 2, 44000),
  cr("Otro (código)", "referido", 1, 1, 28000),
];

const GLO212_CANAL: CanalRealRow[] = [
  cr("Directo", "ga4", 28),
  cr("Meta (pagado)", "ga4", 25),
  cr("Búsqueda orgánica", "ga4", 19),
  cr(CANAL_SIN_ORIGEN, "sin_dato", 9),
  cr("Linktree", "ga4", 3),
  cr("Vendedores (ref)", "referido", 3),
  cr("Google Ads (pagado)", "ga4", 2),
  cr("Meta (pagado)", "referido", 2),
  cr("Vendedores (ref)", "ga4", 2),
  cr("Linktree", "referido", 1),
  cr("Otro (código)", "referido", 1),
  cr("Pasarela de pago", "ga4", 1),
  cr("Social orgánico", "ga4", 1),
];

const dia = (date: string, ordenes: number, vistas: number, pasarela = 0): CoberturaDiaRow => ({
  date,
  ordenes,
  vistas,
  pasarela,
});

const GLO211_DIA: CoberturaDiaRow[] = [
  dia("2026-09-17", 22, 18, 1),
  dia("2026-09-18", 16, 15),
  dia("2026-09-19", 27, 24, 3),
  dia("2026-09-20", 17, 14, 1),
  dia("2026-09-21", 29, 28, 1),
  dia("2026-09-22", 26, 24),
  dia("2026-09-23", 36, 27),
  dia("2026-09-24", 47, 39, 1),
  dia("2026-09-25", 60, 52),
  dia("2026-09-26", 29, 21),
  dia("2026-09-27", 45, 41, 1),
];

const GLO214_DIA: CoberturaDiaRow[] = [dia("2026-09-17", 14, 12), dia("2026-09-18", 92, 56, 1), dia("2026-09-19", 17, 0)];

const D738502_DIA: CoberturaDiaRow[] = [
  dia("2026-08-28", 49, 31), dia("2026-08-29", 11, 7), dia("2026-08-30", 5, 3), dia("2026-08-31", 1, 0),
  dia("2026-09-01", 4, 4), dia("2026-09-02", 7, 2), dia("2026-09-03", 5, 4), dia("2026-09-04", 1, 0),
  dia("2026-09-05", 4, 2), dia("2026-09-06", 4, 2), dia("2026-09-07", 4, 4), dia("2026-09-09", 1, 0),
  dia("2026-09-10", 1, 0), dia("2026-09-11", 2, 0), dia("2026-09-12", 4, 3), dia("2026-09-13", 3, 1),
  dia("2026-09-14", 3, 0), dia("2026-09-15", 7, 3), dia("2026-09-16", 5, 1), dia("2026-09-17", 5, 4),
  dia("2026-09-18", 2, 1), dia("2026-09-19", 5, 2), dia("2026-09-20", 1, 1), dia("2026-09-21", 3, 1),
  dia("2026-09-22", 5, 2), dia("2026-09-23", 4, 3), dia("2026-09-24", 4, 2), dia("2026-09-25", 5, 3),
  dia("2026-09-26", 1, 0), dia("2026-09-27", 13, 0),
];

const GLO211_MEDIO_PAGO: CoberturaMedioPagoRow[] = [
  { medioPago: "TravelPay - Banco de Chile", ordenes: 203, vistas: 183 },
  { medioPago: "Webpay", ordenes: 67, vistas: 59 },
  { medioPago: "Paga con tu banco", ordenes: 33, vistas: 29 },
  { medioPago: "Tarjeta de crédito, débito o prepago", ordenes: 24, vistas: 21 },
  { medioPago: "Banco Santander - Pago en Línea", ordenes: 10, vistas: 4 },
  { medioPago: "Banco Crédito e Inversiones - Pago en Línea", ordenes: 7, vistas: 3 },
  { medioPago: "Banco de Chile - Pago en Línea", ordenes: 4, vistas: 0 },
  { medioPago: "Tarjeta de Crédito Stripe (Pago en Dólares)", ordenes: 4, vistas: 3 },
  { medioPago: "Compraquí de BancoEstado", ordenes: 1, vistas: 1 },
  { medioPago: "Mach", ordenes: 1, vistas: 0 },
];

const estadoBase = (over: Partial<EstadoMedicionInput> = {}): EstadoMedicionInput => ({
  ordenes: { noPase: 582, pase: 195 },
  propiedades: 1,
  ventanaDesde: "2026-09-15",
  medibleDesde: "2026-09-17",
  medibleHasta: "2026-09-27",
  ...over,
});

console.log("atribucion.checks");

// ---------- Estado de la medición ----------

check("estado: GLO211 → parcial", () => {
  assert.equal(estadoMedicion(estadoBase()), "parcial");
});

check("estado: 738502 (mide desde el primer día de venta) → completa", () => {
  assert.equal(
    estadoMedicion(estadoBase({ ordenes: { noPase: 182, pase: 0 }, ventanaDesde: "2026-08-28", medibleDesde: "2026-08-28" })),
    "completa",
  );
});

check("estado: GLO209 (sin propiedad GA4) → sin_propiedad", () => {
  assert.equal(
    estadoMedicion(estadoBase({ ordenes: { noPase: 961, pase: 0 }, propiedades: 0, medibleDesde: null, medibleHasta: "2026-09-29" })),
    "sin_propiedad",
  );
});

check("estado: scope PE sobre un evento CL → sin_ordenes (gana sobre sin_propiedad)", () => {
  assert.equal(
    estadoMedicion(estadoBase({ ordenes: { noPase: 0, pase: 0 }, propiedades: 0, ventanaDesde: null, medibleDesde: null, medibleHasta: null })),
    "sin_ordenes",
  );
});

check("estado: propiedad sin compras con número de orden → sin_tracking", () => {
  assert.equal(estadoMedicion(estadoBase({ medibleDesde: null })), "sin_tracking");
});

check("estado: medición empieza después del último día cargado → sin_dias", () => {
  assert.equal(estadoMedicion(estadoBase({ medibleDesde: "2026-09-28", medibleHasta: "2026-09-27" })), "sin_dias");
});

check("ventanaMedida: solo en parcial/completa", () => {
  assert.deepEqual(ventanaMedida({ estado: "parcial", medibleDesde: "2026-09-17", medibleHasta: "2026-09-27" }), {
    desde: "2026-09-17",
    hasta: "2026-09-27",
  });
  assert.equal(ventanaMedida({ estado: "sin_dias", medibleDesde: "2026-09-28", medibleHasta: "2026-09-27" }), null);
});

// ---------- CPA y propagación del referido ----------

check("cpa: null sin gasto o sin compras; GLO211 pixel 5,2 y GA4 72,4", () => {
  assert.equal(cpa(0, 10), null);
  assert.equal(cpa(100, 0), null);
  assert.equal(cpa(-5, 3), null);
  assert.equal(Number(cpa(1447.39, 278)!.toFixed(1)), 5.2);
  assert.equal(Number(cpa(1447.39, 20)!.toFixed(1)), 72.4);
  assert.equal(pct(1, 0), null);
});

check("muestraCpaReferido: GLO211 24/354 (6,8%) no, GLO212 23/97 (23,7%) sí", () => {
  assert.equal(muestraCpaReferido({ ordenes: { referidoPm: 24, medibles: 354 } }), false);
  assert.equal(muestraCpaReferido({ ordenes: { referidoPm: 23, medibles: 97 } }), true);
  assert.equal(muestraCpaReferido({ ordenes: { referidoPm: 0, medibles: 0 } }), false);
});

// ---------- Origen real ----------

check("agruparCanales GLO211: Linktree 83 (74 GA4 + 9 Ref.), Sin origen al final", () => {
  const g = agruparCanales(GLO211_CANAL, 354);
  assert.equal(g[0].canal, "Linktree");
  assert.equal(g[0].ordenes, 83);
  assert.equal(g[0].ga4, 74);
  assert.equal(g[0].referido, 9);
  assert.equal(g[1].canal, "Búsqueda orgánica");
  assert.equal(g.at(-1)!.canal, CANAL_SIN_ORIGEN);
  assert.equal(g.at(-1)!.ordenes, 36);
  assert.equal(g.reduce((s, x) => s + x.ordenes, 0), 354);
  const vend = g.find((x) => x.canal === "Vendedores (ref)")!;
  assert.deepEqual([vend.ordenes, vend.ga4, vend.referido], [37, 31, 6]);
  const meta = g.find((x) => x.canal === CANAL_META)!;
  assert.deepEqual([meta.ordenes, meta.ga4, meta.referido], [24, 20, 4]);
  assert.equal(g.reduce((s, x) => s + x.venta, 0), 12_668_400);
  assert.equal(g.reduce((s, x) => s + x.personas, 0), 587);
  assert.equal(Number(g[0].pct.toFixed(1)), 23.4);
});

check("segmentosCobertura: GLO211 231/60/27/36, GLO212 52/29/7/9", () => {
  assert.deepEqual(segmentosCobertura(GLO211_CANAL), { ga4Canal: 231, ga4SinCanal: 60, referido: 27, sinOrigen: 36 });
  assert.deepEqual(segmentosCobertura(GLO212_CANAL), { ga4Canal: 52, ga4SinCanal: 29, referido: 7, sinOrigen: 9 });
});

// ---------- Salud de la medición ----------

check("diaProvisional: el día cargado y los siguientes; sin ETL, ninguno", () => {
  assert.equal(diaProvisional("2026-09-27", "2026-09-27"), true);
  assert.equal(diaProvisional("2026-09-28", "2026-09-27"), true);
  assert.equal(diaProvisional("2026-09-26", "2026-09-27"), false);
  assert.equal(diaProvisional("2026-09-26", null), false);
});

check("etlAtrasado: rojo solo si el último día cargado es anterior a ayer − 1 (Santiago)", () => {
  assert.equal(etlAtrasado("2026-09-28", "2026-09-29"), false);
  assert.equal(etlAtrasado("2026-09-27", "2026-09-29"), false);
  assert.equal(etlAtrasado("2026-09-26", "2026-09-29"), true);
  assert.equal(etlAtrasado("2026-02-27", "2026-03-01"), false); // cruza fin de mes
  assert.equal(etlAtrasado(null, "2026-09-29"), false);
  // 29-sep 02:00 UTC todavía es 28-sep en Santiago (UTC−3).
  assert.equal(hoySantiago(new Date("2026-09-29T02:00:00Z")), "2026-09-28");
});

check("alertas GLO214: corte el 2026-09-19 con 17 órdenes, sin caída; tras el evento (18-sep) es informativo", () => {
  assert.deepEqual(alertasCobertura(GLO214_DIA, "2026-09-27"), [
    { tipo: "corte", fecha: "2026-09-19", ordenes: 17, postEvento: false },
  ]);
  // FechaEvento 2026-09-18 22:00: las 17 órdenes del 19 son de 00:00 a 02:59, durante el evento.
  assert.deepEqual(alertasCobertura(GLO214_DIA, "2026-09-27", "2026-09-18"), [
    { tipo: "corte", fecha: "2026-09-19", ordenes: 17, postEvento: true },
  ]);
  // El mismo día del evento todavía culpa al tag (no es posterior).
  assert.equal(
    (alertasCobertura([dia("2026-09-18", 12, 0)], "2026-09-27", "2026-09-18")[0] as { postEvento: boolean }).postEvento,
    false,
  );
});

check("alertas 738502: el 27-sep (0/13) es provisional → ninguna", () => {
  assert.deepEqual(alertasCobertura(D738502_DIA, "2026-09-27"), []);
  // Si el ETL ya hubiera cargado el 28, el 27 deja de ser provisional y sí corta.
  assert.deepEqual(alertasCobertura(D738502_DIA, "2026-09-28")[0], {
    tipo: "corte",
    fecha: "2026-09-27",
    ordenes: 13,
    postEvento: false,
  });
});

check("alertas GLO211: ninguna", () => {
  assert.deepEqual(alertasCobertura(GLO211_DIA, "2026-09-27"), []);
  assert.deepEqual(alertasCobertura(GLO211_DIA, "2026-09-28"), []);
});

check("alertas: caída sintética 85% → 60% ≈ 25 pp", () => {
  const dias: CoberturaDiaRow[] = [];
  for (let i = 1; i <= 7; i++) dias.push(dia(`2026-09-0${i}`, 20, 17));
  for (let i = 8; i <= 10; i++) dias.push(dia(`2026-09-${String(i).padStart(2, "0")}`, 20, 12));
  const a = alertasCobertura(dias, "2026-09-11");
  assert.deepEqual(a, [{ tipo: "caida", ultimos: 60, base: 85, pp: 25 }]);
  // Bajo el umbral de órdenes no hay alerta.
  const chicos = dias.map((d) => ({ ...d, ordenes: 1, vistas: d.vistas > 12 ? 1 : 0 }));
  assert.deepEqual(alertasCobertura(chicos, "2026-09-11"), []);
  assert.equal(ALERTA.caidaPp, 15);
});

check("agruparMediosPago GLO211: 8 filas + «Otros medios» (2 órdenes); bajas en rojo", () => {
  const m = agruparMediosPago(GLO211_MEDIO_PAGO);
  assert.equal(m.length, 9);
  assert.deepEqual(m.at(-1), { medioPago: "Otros medios", ordenes: 2, vistas: 1, pct: 50, baja: false });
  assert.equal(m[0].medioPago, "TravelPay - Banco de Chile");
  const bajas = m.filter((x) => x.baja).map((x) => x.medioPago);
  assert.deepEqual(bajas, [
    "Banco Santander - Pago en Línea",
    "Banco Crédito e Inversiones - Pago en Línea",
    "Banco de Chile - Pago en Línea",
  ]);
});

// ---------- Compras por día y canal ----------

check("agruparPorDiaCanal: top 5 + Otros + Sin origen, colores fijos, días rellenos", () => {
  const rows = [
    { date: "2026-09-17", canal: "Linktree", ordenes: 5 },
    { date: "2026-09-17", canal: CANAL_SIN_ORIGEN, ordenes: 9 },
    { date: "2026-09-17", canal: "Búsqueda orgánica", ordenes: 4 },
    { date: "2026-09-19", canal: "Directo", ordenes: 3 },
    { date: "2026-09-19", canal: CANAL_META, ordenes: 2 },
    { date: "2026-09-19", canal: "Vendedores (ref)", ordenes: 2 },
    { date: "2026-09-19", canal: "Email", ordenes: 1 },
    { date: "2026-09-19", canal: "Canal Nuevo", ordenes: 1 },
  ];
  const { series, puntos } = agruparPorDiaCanal(rows, { desde: "2026-09-17", hasta: "2026-09-19" });
  assert.deepEqual(
    series.map((s) => s.label),
    ["Linktree", "Búsqueda orgánica", "Directo", CANAL_META, "Vendedores (ref)", CANAL_OTROS, CANAL_SIN_ORIGEN],
  );
  assert.equal(series.find((s) => s.label === CANAL_META)!.color, COLOR_CANAL[CANAL_META]);
  const otros = series.find((s) => s.key === SERIE_OTROS)!;
  assert.deepEqual([otros.total, otros.canales], [2, ["Canal Nuevo", "Email"]]);
  const sin = series.find((s) => s.key === SERIE_SIN_ORIGEN)!;
  assert.deepEqual([sin.total, sin.color], [9, COLOR_SIN_ORIGEN]);
  assert.equal(new Set(series.map((s) => s.color)).size, series.length);
  assert.deepEqual(puntos.map((p) => p.date), ["2026-09-17", "2026-09-18", "2026-09-19"]);
  assert.equal(puntos[1].total, 0);
  assert.equal(puntos[0].total, 18);
  assert.equal(puntos[2][SERIE_OTROS], 2);
  assert.equal(puntos.reduce((s, p) => s + p.total, 0), 27);
  // Meta conserva su color aunque cambie de puesto (o sea el único canal).
  const solo = agruparPorDiaCanal([{ date: "2026-09-17", canal: CANAL_META, ordenes: 1 }]);
  assert.equal(solo.series[0].color, COLOR_CANAL[CANAL_META]);
  assert.equal(agruparPorDiaCanal([]).series.length, 0);
  // Un canal desconocido (nuevo en la vista) toma la reserva, nunca un color fijo.
  const nuevo = agruparPorDiaCanal([{ date: "2026-09-17", canal: "Canal Nuevo", ordenes: 4 }]);
  assert.equal(nuevo.series[0].color, COLORES_RESERVA[0]);
});

check("colores: todo canal que emite el SQL tiene color fijo y único (estable entre eventos)", () => {
  const canalesSql = [
    // CASE de canal de marts.ga4_purchases
    "Directo", "(not set)", "Sin dato", "Sin clasificar (other)", "Pasarela de pago", "Comunidad (referidos)",
    "Vendedores (ref)", CANAL_META, "Google Ads (pagado)", "Display / YouTube (pagado)", "TikTok (pagado)",
    "Búsqueda orgánica", "Linktree", "Sitio propio", "Social orgánico", "Email", "Otros referrals", "Otro",
    // referidoCanalSql
    "Paid media (otro código)", "Otro (código)",
  ];
  for (const c of canalesSql) assert.ok(COLOR_CANAL[c], `sin color fijo: ${c}`);
  const todos = [...Object.values(COLOR_CANAL), COLOR_OTROS, COLOR_SIN_ORIGEN, ...COLORES_RESERVA];
  assert.equal(new Set(todos).size, todos.length);
  // "Otro (código)" conserva su color en cualquier puesto del ranking.
  const a = agruparPorDiaCanal([
    { date: "2026-09-17", canal: "Otro", ordenes: 5 },
    { date: "2026-09-17", canal: "Otro (código)", ordenes: 3 },
  ]);
  const b = agruparPorDiaCanal([{ date: "2026-09-17", canal: "Otro (código)", ordenes: 9 }]);
  assert.equal(a.series.find((s) => s.label === "Otro (código)")!.color, b.series[0].color);
});

check("diasEntre: ambos extremos, cruza meses, vacío si está al revés", () => {
  assert.deepEqual(diasEntre("2026-08-30", "2026-09-02"), ["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
  assert.deepEqual(diasEntre("2026-09-02", "2026-09-01"), []);
  assert.deepEqual(diasEntre("2026-09-02", "2026-09-02"), ["2026-09-02"]);
});

// ---------- Qué contenido vende ----------

check("mergeUtmOrdenes: cruza por source|medium|content|term, cuenta huérfanas", () => {
  const utm = [
    { canal: "Meta (pagado)", source: "mt", medium: "pm", content: "video1", term: "", sesiones: 1000 },
    { canal: "Linktree", source: "lt", medium: "org", content: "ig", term: "", sesiones: 200 },
    { canal: "Sin dato", source: "lt", medium: "org", content: "ig", term: "", sesiones: 5 },
    { canal: "Email", source: "drip", medium: "email", content: "", term: "", sesiones: 0 },
  ];
  const ordenes = [
    { source: "lt", medium: "org", content: "ig", term: "", ordenes: 9, venta: 90 },
    { source: "mt", medium: "pm", content: "video1", term: "", ordenes: 2, venta: 20 },
    { source: "ff", medium: "ref", content: "FF1371", term: "", ordenes: 1, venta: 10 },
    { source: "drip", medium: "email", content: "", term: "", ordenes: 1, venta: 5 },
  ];
  const m = mergeUtmOrdenes(utm, ordenes);
  assert.deepEqual([m.ordenesGa4, m.huerfanas, m.huerfanasVenta], [13, 1, 10]);
  assert.deepEqual(
    m.rows.map((r) => [r.canal, r.ordenes, r.sesiones]),
    [
      ["Linktree", 9, 200],
      ["Meta (pagado)", 2, 1000],
      ["Email", 1, 0],
      ["Sin dato", 0, 5],
    ],
  );
  assert.equal(m.rows[0].conv, 4.5);
  assert.equal(m.rows[2].conv, null);
  const porCanal = resumenContenidosPorCanal(m.rows);
  assert.equal(porCanal.find((c) => c.canal === "Meta (pagado)")!.conv, 0.2);
});

// ---------- Formato ----------

check("formato: fmtPct en puntos, fmtFechaCorta es-CL, fmtUsd", () => {
  assert.equal(fmtPct(85.63), "85,6%");
  assert.equal(fmtPct(pct(303, 354)), "85,6%");
  assert.equal(fmtPct(null), "—");
  assert.equal(fmtPct(4.5, 2), "4,50%");
  assert.equal(fmtFechaCorta("2026-09-17"), "17 sept");
  assert.equal(fmtFechaCorta("2026-01-05"), "5 ene");
  assert.equal(fmtFechaCorta(null), "—");
  assert.equal(fmtUsd(1447.39), "US$1447.4");
  assert.equal(fmtUsdOGuion(null), "—");
  assert.equal(fmtUsdOGuion(cpa(1447.39, 20)), "US$72.4");
});

check("moneda: Pais PE → PEN (Fever Lima, soles); el resto CLP", () => {
  assert.equal(monedaDePais("PE"), "PEN");
  assert.equal(monedaDePais(" pe "), "PEN");
  assert.equal(monedaDePais("CL"), "CLP");
  assert.equal(monedaDePais(null), "CLP");
  assert.equal(fmtVentaCompact(12_668_400, "CLP"), fmtClpCompact(12_668_400));
  assert.ok(fmtClpCompact(12_668_400).startsWith("$"));
  assert.ok(fmtVentaCompact(154_476, "PEN").startsWith("S/ "));
  assert.equal(fmtVentaCompact(Number.NaN, "PEN"), "—");
});

console.log(`\n${passed} checks ok`);
