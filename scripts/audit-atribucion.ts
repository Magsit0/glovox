/**
 * Auditoría de la sección "Atribución de compras" (/marketing/weekly) contra los
 * valores de aceptación de la spec (§6), con el fin de la ventana medida fijado al
 * 2026-09-27 (fecha de la sonda GA4) para que los números sean reproducibles.
 *
 * Llama a las MISMAS funciones que usa la página (lib/queries/marketing.ts) y
 * compara con tolerancia: ±2 órdenes, ±1 pp de cobertura, ±2% en montos USD y
 * sesiones. Los contadores que siguen creciendo con ventas nuevas (órdenes
 * pendientes de eventos en venta) se chequean como mínimo. Termina con código
 * distinto de 0 si algún valor queda fuera de tolerancia.
 *
 * Solo lectura (SELECT). Uso: npm run audit:atribucion
 */
import {
  getAtribucionCompras,
  getContenidosQueVenden,
  getFunnelCompra,
  getFunnelData,
  getRendimientoConjuntos,
} from "@/lib/queries/marketing";
import {
  agruparCanales,
  agruparMediosPago,
  agruparPorDiaCanal,
  alertasCobertura,
  cpa,
  muestraCpaReferido,
  pct,
  propagacionReferidoPct,
  resumenContenidosPorCanal,
  segmentosCobertura,
  ventanaMedida,
  type AtribucionCompras,
  type EstadoMedicion,
} from "@/lib/marketing/atribucion";

const HASTA = "2026-09-27";

// ---------- Comparación ----------

type Tipo = "ord" | "pp" | "usd" | "eq" | "min" | "info";
type Fila = { evento: string; metrica: string; esperado: string; real: string; ok: string };

const filas: Fila[] = [];
let fallas = 0;

const fmt = (v: unknown) =>
  v == null
    ? "—"
    : typeof v === "number"
      ? Number.isInteger(v)
        ? String(v)
        : v.toFixed(2)
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);

function comparar(evento: string, metrica: string, tipo: Tipo, esperado: unknown, real: unknown) {
  let ok: boolean | null;
  if (tipo === "info" || esperado === undefined) ok = null;
  else if (tipo === "eq") ok = JSON.stringify(esperado) === JSON.stringify(real);
  else {
    const e = Number(esperado);
    const r = Number(real);
    if (!Number.isFinite(e) || !Number.isFinite(r)) ok = esperado === real;
    else if (tipo === "ord") ok = Math.abs(r - e) <= 2;
    else if (tipo === "pp") ok = Math.abs(r - e) <= 1;
    else if (tipo === "usd") ok = Math.abs(r - e) <= Math.max(0.02 * Math.abs(e), 0.05);
    else ok = r >= e - 2; // "min": crece con ventas nuevas
  }
  if (ok === false) fallas += 1;
  filas.push({
    evento,
    metrica,
    esperado: fmt(esperado),
    real: fmt(real),
    ok: ok == null ? "info" : ok ? "ok" : "FALLA",
  });
}

// ---------- Valores de aceptación (spec §6) ----------

type Esperado = {
  estado: EstadoMedicion;
  desde: string;
  hasta: string;
  propiedades?: number;
  medibles: number;
  vistas: number;
  cov: number;
  pase: number;
  fueraWeb: number;
  antes: number;
  pendientes: number;
  pixelV: number;
  pixelT?: number;
  ga4Meta: number;
  refMt: number;
  ga4Gg: number;
  refGg: number;
  gastoV: number;
  gastoT: number;
  cpaPixel: number;
  cpaGa4: number;
  cpaRef: number | null; // null = se oculta (propagación de PM_ bajo el 8%)
  enVenta: boolean; // la venta sigue abierta: las órdenes pendientes siguen creciendo
};

const ESPERADO: Record<string, Esperado> = {
  GLO211: {
    estado: "parcial", desde: "2026-09-17", hasta: "2026-09-27", propiedades: 1,
    medibles: 354, vistas: 303, cov: 85.6, pase: 195, fueraWeb: 0, antes: 134, pendientes: 94,
    pixelV: 278, pixelT: 280, ga4Meta: 20, refMt: 16, ga4Gg: 20, refGg: 8,
    gastoV: 1447.39, gastoT: 2229.66, cpaPixel: 5.2, cpaGa4: 72.4, cpaRef: null, enVenta: true,
  },
  GLO212: {
    estado: "parcial", desde: "2026-09-17", hasta: "2026-09-27", propiedades: 1,
    medibles: 97, vistas: 82, cov: 84.5, pase: 0, fueraWeb: 0, antes: 698, pendientes: 2,
    pixelV: 65, pixelT: 70, ga4Meta: 25, refMt: 23, ga4Gg: 2, refGg: 0,
    gastoV: 791.66, gastoT: 1595.28, cpaPixel: 12.2, cpaGa4: 31.7, cpaRef: 34.4, enVenta: true,
  },
  GLO203: {
    estado: "parcial", desde: "2026-09-17", hasta: "2026-09-27", propiedades: 1,
    medibles: 56, vistas: 29, cov: 51.8, pase: 0, fueraWeb: 0, antes: 2648, pendientes: 1,
    pixelV: 21, pixelT: 21, ga4Meta: 4, refMt: 0, ga4Gg: 4, refGg: 0,
    gastoV: 116.23, gastoT: 172.87, cpaPixel: 5.5, cpaGa4: 29.1, cpaRef: null, enVenta: true,
  },
  GLO214: {
    estado: "parcial", desde: "2026-09-17", hasta: "2026-09-19", propiedades: 1,
    medibles: 123, vistas: 68, cov: 55.3, pase: 0, fueraWeb: 0, antes: 40, pendientes: 0,
    pixelV: 22, pixelT: 28, ga4Meta: 3, refMt: 5, ga4Gg: 1, refGg: 0,
    gastoV: 233.69, gastoT: 483.71, cpaPixel: 10.6, cpaGa4: 77.9, cpaRef: null, enVenta: false,
  },
  "708092": {
    estado: "parcial", desde: "2026-08-24", hasta: "2026-09-20", propiedades: 1,
    medibles: 617, vistas: 439, cov: 71.2, pase: 0, fueraWeb: 157, antes: 261, pendientes: 0,
    pixelV: 315, pixelT: 316, ga4Meta: 84, refMt: 87, ga4Gg: 0, refGg: 0,
    gastoV: 2773.14, gastoT: 3747.25, cpaPixel: 8.8, cpaGa4: 33.0, cpaRef: 31.9, enVenta: false,
  },
  "660905": {
    estado: "parcial", desde: "2026-06-17", hasta: "2026-08-02", propiedades: 1,
    medibles: 1609, vistas: 1353, cov: 84.1, pase: 0, fueraWeb: 654, antes: 54, pendientes: 0,
    pixelV: 747, pixelT: 753, ga4Meta: 276, refMt: 3, ga4Gg: 268, refGg: 0,
    gastoV: 3131.67, gastoT: 5321.61, cpaPixel: 4.2, cpaGa4: 11.3, cpaRef: null, enVenta: false,
  },
  "669533": {
    estado: "parcial", desde: "2026-07-01", hasta: "2026-09-12", propiedades: 2,
    medibles: 507, vistas: 297, cov: 58.6, pase: 0, fueraWeb: 22, antes: 149, pendientes: 0,
    pixelV: 177, pixelT: 177, ga4Meta: 34, refMt: 26, ga4Gg: 1, refGg: 1,
    gastoV: 2763.82, gastoT: 4213.61, cpaPixel: 15.6, cpaGa4: 81.3, cpaRef: null, enVenta: false,
  },
  "738502": {
    estado: "completa", desde: "2026-08-28", hasta: "2026-09-27", propiedades: 1,
    medibles: 169, vistas: 86, cov: 50.9, pase: 0, fueraWeb: 0, antes: 0, pendientes: 13,
    pixelV: 16, pixelT: 17, ga4Meta: 6, refMt: 3, ga4Gg: 0, refGg: 0,
    gastoV: 637.39, gastoT: 961.09, cpaPixel: 39.8, cpaGa4: 106.2, cpaRef: null, enVenta: true,
  },
};

const SIN_DATOS: Record<string, { country: "PE" | null; estado: EstadoMedicion }> = {
  GLO209: { country: null, estado: "sin_propiedad" },
  GLO210: { country: null, estado: "sin_propiedad" },
  "GLO211 (scope PE)": { country: "PE", estado: "sin_ordenes" },
};

const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
const minIso = (a: string | null, b: string) => (a == null || a > b ? b : a);

// ---------- Slice 1: lentes, cobertura y estado ----------

function auditarEvento(ev: string, a: AtribucionCompras, e: Esperado) {
  const o = a.ordenes;
  comparar(ev, "estado", "eq", e.estado, a.estado);
  comparar(ev, "medible desde", "eq", e.desde, a.medibleDesde);
  comparar(ev, "medible hasta", "eq", e.hasta, a.medibleHasta);
  comparar(ev, "propiedades", "eq", e.propiedades, a.propiedades);
  comparar(ev, "órdenes medidas", "ord", e.medibles, o.medibles);
  comparar(ev, "vistas por GA4", "ord", e.vistas, o.vistas);
  comparar(ev, "cobertura %", "pp", e.cov, r1(pct(o.vistas, o.medibles)));
  comparar(ev, "pases", "ord", e.pase, o.pase);
  comparar(ev, "fuera de web", "ord", e.fueraWeb, o.fueraWeb);
  comparar(ev, "antes de la medición", "ord", e.antes, o.antes);
  comparar(ev, e.enVenta ? "pendientes (mín., crece)" : "pendientes", e.enVenta ? "min" : "ord", e.pendientes, o.pendientes);
  comparar(ev, "pixel Meta Ventas", "ord", e.pixelV, Math.round(a.meta.pixelVentas));
  comparar(ev, "pixel Meta total", "ord", e.pixelT, Math.round(a.meta.pixelTotal));
  comparar(ev, "GA4 Meta", "ord", e.ga4Meta, a.meta.ga4);
  comparar(ev, "Referido PM_MT", "ord", e.refMt, a.meta.referido);
  comparar(ev, "GA4 Google", "ord", e.ga4Gg, a.google.ga4);
  comparar(ev, "Referido PM_GG", "ord", e.refGg, a.google.referido);
  comparar(ev, "gasto Meta Ventas USD", "usd", e.gastoV, a.meta.gastoVentasUsd);
  comparar(ev, "gasto Meta total USD", "usd", e.gastoT, a.meta.gastoTotalUsd);
  comparar(ev, "gasto Google USD", "usd", 0, a.google.gastoUsd);
  comparar(ev, "CPA pixel", "info", e.cpaPixel, r1(cpa(a.meta.gastoVentasUsd, a.meta.pixelVentas)));
  comparar(ev, "CPA GA4", "info", e.cpaGa4, r1(cpa(a.meta.gastoVentasUsd, a.meta.ga4)));
  const muestra = muestraCpaReferido(a);
  comparar(ev, "CPA Referido visible (D2)", "eq", e.cpaRef != null, muestra);
  comparar(ev, "CPA Referido", "info", e.cpaRef, muestra ? r1(cpa(a.meta.gastoVentasUsd, a.meta.referido)) : null);
  comparar(ev, "propagación PM_ %", "info", undefined, r1(propagacionReferidoPct(a)));
  // Invariantes internas: el origen real, la cobertura diaria y la serie por canal suman lo mismo.
  const suma = (xs: { ordenes: number }[]) => xs.reduce((s, x) => s + x.ordenes, 0);
  comparar(ev, "Σ origen real = medidas", "eq", o.medibles, suma(a.canalReal));
  comparar(ev, "Σ por día = medidas", "eq", o.medibles, suma(a.porDia));
  comparar(ev, "Σ por día y canal = medidas", "eq", o.medibles, suma(a.porDiaCanal));
  comparar(ev, "Σ por medio de pago = medidas", "eq", o.medibles, suma(a.porMedioPago));
  comparar(ev, "etl hasta (vivo; mín. utm y compras)", "info", undefined, a.etlHasta);
  comparar(ev, "primer día del evento", "info", undefined, a.fechaEvento);
  comparar(ev, "moneda", "eq", ev.startsWith("GLO") || ev === "660905" ? "CLP" : "PEN", a.moneda);
  comparar(ev, "ventana de venta (vivo)", "info", undefined, `${a.ventanaDesde} → ${a.ventanaHasta}`);
}

function auditarOrigen(ev: string, a: AtribucionCompras, canales: Record<string, number>, seg: number[]) {
  const g = agruparCanales(a.canalReal, a.ordenes.medibles);
  for (const [canal, esperado] of Object.entries(canales)) {
    comparar(ev, `origen · ${canal}`, "ord", esperado, g.find((x) => x.canal === canal)?.ordenes ?? 0);
  }
  const s = segmentosCobertura(a.canalReal);
  comparar(ev, "barra · GA4 con canal", "ord", seg[0], s.ga4Canal);
  comparar(ev, "barra · GA4 directo o sin canal", "ord", seg[1], s.ga4SinCanal);
  comparar(ev, "barra · solo Referido", "ord", seg[2], s.referido);
  comparar(ev, "barra · sin origen", "ord", seg[3], s.sinOrigen);
}

async function main() {
  console.log(`Auditoría "Atribución de compras" · ventana medida fijada hasta ${HASTA}\n`);

  const eventos = Object.keys(ESPERADO);
  const res = await Promise.all(eventos.map((ev) => getAtribucionCompras(ev, null, HASTA)));
  const porEvento = new Map(eventos.map((ev, i) => [ev, res[i]]));
  for (const ev of eventos) auditarEvento(ev, porEvento.get(ev)!, ESPERADO[ev]);

  for (const [etiqueta, x] of Object.entries(SIN_DATOS)) {
    const ev = etiqueta.split(" ")[0];
    const a = await getAtribucionCompras(ev, x.country, HASTA);
    comparar(etiqueta, "estado", "eq", x.estado, a.estado);
  }

  // Origen real (spec §6).
  const g211 = porEvento.get("GLO211")!;
  const g212 = porEvento.get("GLO212")!;
  auditarOrigen(
    "GLO211",
    g211,
    {
      Linktree: 83, "Búsqueda orgánica": 79, Directo: 50, "Vendedores (ref)": 37, "Sin origen conocido": 36,
      "Meta (pagado)": 24, "Google Ads (pagado)": 23, "Pasarela de pago": 7, Otro: 5, Email: 4, "(not set)": 3,
      "Social orgánico": 2, "Otro (código)": 1,
    },
    [231, 60, 27, 36],
  );
  comparar("GLO211", "origen · personas", "ord", 587, g211.canalReal.reduce((s, c) => s + c.personas, 0));
  comparar("GLO211", "origen · venta CLP", "usd", 12_668_400, g211.canalReal.reduce((s, c) => s + c.venta, 0));
  auditarOrigen(
    "GLO212",
    g212,
    {
      Directo: 28, "Meta (pagado)": 27, "Búsqueda orgánica": 19, "Sin origen conocido": 9, "Vendedores (ref)": 5,
      Linktree: 4, "Google Ads (pagado)": 2, "Otro (código)": 1, "Pasarela de pago": 1, "Social orgánico": 1,
    },
    [52, 29, 7, 9],
  );
  comparar("GLO212", "origen · personas", "ord", 151, g212.canalReal.reduce((s, c) => s + c.personas, 0));
  comparar("GLO212", "origen · venta CLP", "usd", 6_621_000, g212.canalReal.reduce((s, c) => s + c.venta, 0));

  // Fever: Referido "(not set)" / "(not provided)" es un placeholder, no un código.
  // Antes caía en "Otro (código)" y pisaba el Directo de GA4 (708092: 82 órdenes,
  // barra 299 / 55 / 106 / 157). Normalizado: 299 / 125 / 24 / 169.
  auditarOrigen("708092", porEvento.get("708092")!, { "Otro (código)": 0, Directo: 82 }, [299, 125, 24, 169]);
  auditarOrigen("738502", porEvento.get("738502")!, { "Otro (código)": 0 }, [64, 20, 4, 81]);
  for (const ev of ["660905", "669533"]) {
    const g = agruparCanales(porEvento.get(ev)!.canalReal, porEvento.get(ev)!.ordenes.medibles);
    // 660905 conserva códigos reales de Fever (fechas de campaña "30JUN", CTA "COMPRAR"…) como "Otro (código)".
    comparar(ev, "origen · Otro (código) (códigos no placeholder)", "info", undefined, g.find((x) => x.canal === "Otro (código)")?.ordenes ?? 0);
    comparar(ev, "barra (GA4 canal / GA4 sin canal / Referido / sin origen)", "info", undefined, Object.values(segmentosCobertura(porEvento.get(ev)!.canalReal)).join(" / "));
  }

  // Salud GLO211: medios de pago y pasarela.
  const medios = agruparMediosPago(g211.porMedioPago);
  const medio = (m: string) => medios.find((x) => x.medioPago === m);
  for (const [m, ord, vis] of [
    ["TravelPay - Banco de Chile", 203, 183],
    ["Webpay", 67, 59],
    ["Paga con tu banco", 33, 29],
    ["Tarjeta de crédito, débito o prepago", 24, 21],
    ["Banco Santander - Pago en Línea", 10, 4],
    ["Banco Crédito e Inversiones - Pago en Línea", 7, 3],
    ["Banco de Chile - Pago en Línea", 4, 0],
  ] as const) {
    comparar("GLO211", `medio · ${m} (vistas/órdenes)`, "info", `${vis}/${ord}`, `${medio(m)?.vistas}/${medio(m)?.ordenes}`);
    comparar("GLO211", `medio · ${m} órdenes`, "ord", ord, medio(m)?.ordenes ?? 0);
    comparar("GLO211", `medio · ${m} vistas`, "ord", vis, medio(m)?.vistas ?? 0);
  }
  comparar("GLO211", "vistas desde pasarela", "ord", 8, g211.ordenes.vistasPasarela);

  // Alertas: con el ETL fijado al día de la sonda (reproducible) y con el ETL vivo.
  const alertas = (ev: string, fijado: boolean) => {
    const a = porEvento.get(ev)!;
    return alertasCobertura(a.porDia, fijado ? minIso(a.etlHasta, HASTA) : a.etlHasta, a.fechaEvento);
  };
  // GLO214 (evento 18-sep 22:00): las 17 órdenes del 19 son de 00:00 a 02:59, durante el
  // evento; la misma propiedad vio 12 de 14 órdenes de GLO212 ese día, así que el tag
  // funcionaba: el corte se informa sin culpar al tag (postEvento).
  comparar("GLO214", "primer día del evento", "eq", "2026-09-18", porEvento.get("GLO214")!.fechaEvento);
  comparar("GLO214", "alertas (ETL al 27-sep)", "eq", [{ tipo: "corte", fecha: "2026-09-19", ordenes: 17, postEvento: true }], alertas("GLO214", true));
  comparar("738502", "alertas (ETL al 27-sep)", "eq", [], alertas("738502", true));
  comparar("GLO211", "alertas (ETL al 27-sep)", "eq", [], alertas("GLO211", true));
  for (const ev of eventos) comparar(ev, "alertas (ETL vivo)", "info", undefined, JSON.stringify(alertas(ev, false)));
  const d738 = porEvento.get("738502")!.porDia.find((d) => d.date === "2026-09-27");
  comparar("738502", "27-sep vistas/órdenes (vivo)", "info", "0/13", d738 ? `${d738.vistas}/${d738.ordenes}` : "—");

  // ---------- Adiciones (GLO211) ----------

  const v211 = ventanaMedida(g211)!;

  // Compras por día y canal.
  const dc = agruparPorDiaCanal(g211.porDiaCanal, { desde: v211.desde, hasta: v211.hasta });
  comparar("GLO211", "día×canal · días", "eq", 11, dc.puntos.length);
  comparar("GLO211", "día×canal · Σ = medidas", "eq", g211.ordenes.medibles, dc.puntos.reduce((s, p) => s + p.total, 0));
  for (const s of dc.series) comparar("GLO211", `día×canal · ${s.label} (${s.color})`, "info", undefined, s.total);

  // Qué contenido vende (slice 3 de la spec: 303 órdenes GA4, 301 con fila, 2 huérfanas).
  const cont = await getContenidosQueVenden("GLO211", null, v211);
  comparar("GLO211", "contenido · órdenes GA4", "ord", 303, cont.ordenesGa4);
  comparar("GLO211", "contenido · con fila de tráfico", "ord", 301, cont.ordenesGa4 - cont.huerfanas);
  comparar("GLO211", "contenido · huérfanas", "ord", 2, cont.huerfanas);
  comparar("GLO211", "contenido · filas (CSV)", "info", undefined, cont.rows.length);
  const porCanal = resumenContenidosPorCanal(cont.rows);
  for (const [canal, ord, ses] of [
    ["Meta (pagado)", 20, 7876],
    ["(not set)", 64, 2259],
    ["Búsqueda orgánica", 84, 1989],
    ["Linktree", 74, 1643],
    ["Vendedores (ref)", 29, 549],
    ["Google Ads (pagado)", 13, 170],
  ] as const) {
    const c = porCanal.find((x) => x.canal === canal);
    comparar("GLO211", `contenido · ${canal} órdenes`, "ord", ord, c?.ordenes ?? 0);
    comparar("GLO211", `contenido · ${canal} sesiones`, "usd", ses, c?.sesiones ?? 0);
    comparar("GLO211", `contenido · ${canal} conv. %`, "info", r1(pct(ord, ses)), r1(c?.conv ?? null));
  }
  for (const r of cont.rows.slice(0, 5)) {
    comparar("GLO211", `contenido top · ${r.canal} · ${r.source}/${r.medium} · ${r.content}`, "info", undefined, `${r.ordenes} ord / ${r.sesiones} ses`);
  }

  // Rendimiento por conjunto (slice 5 de la spec).
  const rc = await getRendimientoConjuntos("GLO211", null, v211);
  const conj = (nombre: string, objective: string) =>
    rc.rows.find((r) => r.conjunto.toLowerCase().includes(nombre.toLowerCase()) && r.objective === objective);
  const dark = conj("DARK Stgo", "OUTCOME_SALES");
  const org = conj("Org Stgo", "OUTCOME_SALES");
  comparar("GLO211", "conjunto · ADV+ DARK Stgo gasto", "usd", 786.1, dark?.gastoUsd ?? 0);
  comparar("GLO211", "conjunto · ADV+ DARK Stgo pixel", "ord", 151, Math.round(dark?.pixel ?? 0));
  comparar("GLO211", "conjunto · ADV+ DARK Stgo órdenes GA4", "ord", 7, dark?.ordenesGa4 ?? 0);
  comparar("GLO211", "conjunto · ADV+ DARK Stgo CPA GA4", "info", 112.3, r1(cpa(dark?.gastoUsd ?? 0, dark?.ordenesGa4 ?? 0)));
  comparar("GLO211", "conjunto · ADV+ Org Stgo gasto", "usd", 661.3, org?.gastoUsd ?? 0);
  comparar("GLO211", "conjunto · ADV+ Org Stgo pixel", "ord", 127, Math.round(org?.pixel ?? 0));
  comparar("GLO211", "conjunto · ADV+ Org Stgo órdenes GA4", "ord", 12, org?.ordenesGa4 ?? 0);
  comparar("GLO211", "conjunto · ADV+ Org Stgo CPA GA4", "info", 55.1, r1(cpa(org?.gastoUsd ?? 0, org?.ordenesGa4 ?? 0)));
  const aw = rc.rows.filter((r) => r.objective === "OUTCOME_AWARENESS");
  comparar("GLO211", "conjuntos awareness · cantidad", "eq", 2, aw.length);
  comparar("GLO211", "conjuntos awareness · gasto", "usd", 782.2, aw.reduce((s, r) => s + r.gastoUsd, 0));
  comparar("GLO211", "conjuntos awareness · pixel", "ord", 2, Math.round(aw.reduce((s, r) => s + r.pixel, 0)));
  comparar("GLO211", "conjuntos awareness · órdenes GA4", "ord", 0, aw.reduce((s, r) => s + r.ordenesGa4, 0));
  comparar("GLO211", "órdenes GA4 Meta sin conjunto", "ord", 1, rc.ga4MetaSinConjunto);
  comparar("GLO211", "Σ órdenes por conjunto + sin conjunto = GA4 Meta", "info", g211.meta.ga4, rc.rows.reduce((s, r) => s + r.ordenesGa4, 0) + rc.ga4MetaSinConjunto);

  // Funnel "Desde medición GA4" (slice 4; pasos 1-4 se re-basan, solo informativos).
  const FUNNEL: Record<string, { compran: number; alcance: "evento" | "propiedad"; pasos: number[] }> = {
    GLO211: { compran: 303, alcance: "propiedad", pasos: [14016, 1501, 395, 380] },
    GLO212: { compran: 150, alcance: "propiedad", pasos: [13277, 1328, 241, 226] },
    GLO203: { compran: 29, alcance: "propiedad", pasos: [3931, 495, 74, 68] },
  };
  for (const [ev, f] of Object.entries(FUNNEL)) {
    const v = ventanaMedida(porEvento.get(ev)!)!;
    const [compra, pasos] = await Promise.all([getFunnelCompra(ev, null, v), getFunnelData(ev, undefined, v)]);
    comparar(ev, "funnel · Compran (órdenes GA4)", "ord", f.compran, compra.users);
    comparar(ev, "funnel · alcance", "eq", f.alcance, compra.alcance);
    comparar(ev, "funnel · otros eventos incluidos", "info", undefined, compra.otrosEventos.join(", ") || "—");
    pasos.forEach((p, i) => comparar(ev, `funnel · ${p.step}`, "info", f.pasos[i], p.users));
  }

  // ---------- Reporte ----------
  const grupos = new Map<string, Fila[]>();
  for (const f of filas) grupos.set(f.evento, [...(grupos.get(f.evento) ?? []), f]);
  for (const [ev, fs] of grupos) {
    console.log(`\n=== ${ev} ===`);
    console.table(fs.map(({ metrica, esperado, real, ok }) => ({ metrica, esperado, real, ok })));
  }
  const chequeadas = filas.filter((f) => f.ok !== "info").length;
  console.log(`\n${chequeadas - fallas}/${chequeadas} dentro de tolerancia · ${filas.length - chequeadas} informativas`);
  if (fallas > 0) {
    console.error(`\n${fallas} fuera de tolerancia:`);
    for (const f of filas.filter((x) => x.ok === "FALLA")) console.error(`  ${f.evento} · ${f.metrica}: esperado ${f.esperado}, real ${f.real}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
