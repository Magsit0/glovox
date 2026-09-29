/**
 * Atribución de compras GA4 en Venta Diaria (`/marketing/weekly`, sección
 * "Atribución de compras").
 *
 * Módulo CLIENT-SAFE (sin imports de servidor), igual que
 * `lib/inversion-medios/rendimiento.ts`: lo importan tanto las queries
 * (`lib/queries/marketing.ts`, para tipos y constantes que viajan al SQL) como
 * los componentes cliente (tabla de origen real, gráfico por día y canal).
 *
 * Reglas (spec, decisiones D1–D7):
 *   - Ventana medida (D6): desde el primer día completo en que GA4 mide compras
 *     con número de orden en la propiedad (su primer día + 1) o el primer día con
 *     una orden vista "en vivo" (lo que ocurra después), hasta el último día que
 *     cargó el ETL de GA4, sin pasar el fin de la ventana de venta.
 *   - Solo cuentan órdenes del checkout web (D7): Internet/marketplace y medios de
 *     pago que pasan por el checkout. Pases de temporada, boletería, invitaciones
 *     y gratis nunca disparan `purchase`.
 *   - CPA (D1) = gasto de campañas Meta de Ventas (OUTCOME_SALES) en la ventana
 *     medida ÷ compras de la lente. La cobertura (awareness) se muestra aparte.
 *   - CPA por Referido (D2) solo si al menos PM_PROPAGACION_MIN % de las órdenes
 *     medidas trae código PM_.
 *   - Un canal por orden: manda GA4; si GA4 no vio la orden o la vio como directa,
 *     sin canal o desde la pasarela de pago, se usa el Referido del link.
 *
 * Convención de porcentajes: todos los `pct`, `conv`, `ultimos`, `base` y `pp`
 * de este módulo están en PUNTOS PORCENTUALES (85.6 = 85,6%), nunca en fracción.
 * `fmtPct` (lib/marketing/formato.ts) recibe la misma unidad.
 */
import { PM_PROPAGACION_MIN } from "@/lib/inversion-medios/rendimiento";

// ---------- Tipos ----------

export type EstadoMedicion =
  | "sin_ordenes" // el evento no tiene órdenes (o el scope las oculta)
  | "sin_propiedad" // sin propiedad GA4 asignada ni compras GA4
  | "sin_tracking" // hay propiedad pero GA4 no registra compras con número de orden
  | "sin_dias" // la medición empieza después del último día cargado
  | "parcial" // GA4 mide solo parte de la ventana de venta
  | "completa"; // GA4 mide toda la ventana de venta

export type FuenteCanal = "ga4" | "referido" | "sin_dato";

/** Órdenes medidas por (canal, fuente). Grano del SQL; `agruparCanales` junta fuentes. */
export type CanalRealRow = {
  canal: string;
  fuente: FuenteCanal;
  ordenes: number;
  personas: number;
  venta: number; // en la moneda del evento (AtribucionCompras.moneda), SUM(Precio - Descuento)
};

export type CoberturaMedioPagoRow = { medioPago: string; ordenes: number; vistas: number };

export type CoberturaDiaRow = {
  date: string; // YYYY-MM-DD, DATE(FechaOrden) como el resto de la página
  ordenes: number;
  vistas: number;
  pasarela: number; // vistas cuyo canal GA4 es "Pasarela de pago"
};

/** Órdenes web medidas por día y canal real (el mismo canal de la tabla de origen). */
export type OrdenCanalDiaRow = { date: string; canal: string; ordenes: number };

/** Moneda de la venta del evento (glovox.tickets no la trae: sale de categoriaEvento.Pais). */
export type Moneda = "CLP" | "PEN";

/** categoriaEvento.Pais → moneda de los montos de glovox.tickets (Fever Lima vende en soles). */
export function monedaDePais(pais: string | null | undefined): Moneda {
  return pais?.trim().toUpperCase() === "PE" ? "PEN" : "CLP";
}

export type AtribucionCompras = {
  estado: EstadoMedicion;
  ventanaDesde: string | null; // YYYY-MM-DD, ventana de venta existente
  ventanaHasta: string | null;
  medibleDesde: string | null; // ventana medida por GA4 (D6)
  medibleHasta: string | null;
  // Último día que cargó el ETL de GA4: el menor entre el tráfico (marts.ga4_utm)
  // y las compras (última carga de marts.ga4_purchases − 1 día, Santiago).
  etlHasta: string | null;
  fechaEvento: string | null; // YYYY-MM-DD, primer día del evento (MIN(DATE(FechaEvento)))
  moneda: Moneda; // de los montos `venta` (Precio − Descuento)
  propiedades: number;
  ordenes: {
    noPase: number; // todas las órdenes del evento menos los pases de temporada
    pase: number;
    fueraWeb: number; // boletería, invitación, gratis
    antes: number; // web, antes de la ventana medida
    pendientes: number; // web, después del último día cargado por GA4
    medibles: number; // web, dentro de la ventana medida (denominador de todo)
    vistas: number; // medibles que GA4 registró con su número de orden
    vistasPasarela: number; // vistas con canal GA4 "Pasarela de pago"
    soloReferido: number; // medibles no vistas por GA4 pero con Referido
    referidoPm: number; // medibles con Referido PM_ (Meta, Google u otro)
  };
  meta: {
    pixelVentas: number; // conversiones pixel de campañas de Ventas en la ventana
    pixelTotal: number; // todas las campañas Meta
    ga4: number; // órdenes medidas con canal GA4 "Meta (pagado)"
    referido: number; // órdenes medidas con Referido PM_MT
    gastoVentasUsd: number; // numerador del CPA (D1)
    gastoTotalUsd: number;
  };
  google: { ga4: number; referido: number; gastoUsd: number };
  canalReal: CanalRealRow[];
  porMedioPago: CoberturaMedioPagoRow[];
  porDia: CoberturaDiaRow[];
  porDiaCanal: OrdenCanalDiaRow[];
};

/** Ventana medida, lista para pasar a las queries dependientes. */
export type VentanaMedida = { desde: string; hasta: string };

// ---------- Constantes ----------

export const CANAL_META = "Meta (pagado)";
export const CANAL_GOOGLE = "Google Ads (pagado)";
export const CANAL_SIN_ORIGEN = "Sin origen conocido";
export const CANAL_OTROS = "Otros canales";
export const CANAL_VENDEDORES = "Vendedores (ref)";

/**
 * Canales GA4 que no dicen de dónde vino la compra. Con ellos el Referido del
 * link, si existe, decide el canal real. También los usa el SQL (GA4_DEBIL_SQL).
 */
export const CANALES_GA4_DEBILES = [
  "Directo",
  "(not set)",
  "Sin dato",
  "Sin clasificar (other)",
  "Pasarela de pago",
] as const;

/**
 * Umbrales de alerta de cobertura, sobre días no provisionales:
 *   - corte: un día con al menos `minOrdenesDia` órdenes web y 0 vistas;
 *   - caída: los últimos `ventanaDias` días (con al menos `minOrdenesVentana`
 *     órdenes) quedan `caidaPp` pp o más bajo el resto del período (que también
 *     necesita `minOrdenesVentana` órdenes).
 */
export const ALERTA = { minOrdenesDia: 10, ventanaDias: 3, minOrdenesVentana: 10, caidaPp: 15 } as const;
/** Medios de pago bajo este % de cobertura se muestran en rojo. */
export const COBERTURA_BAJA_PCT = 50;
/** Medios de pago con menos órdenes se agrupan como "Otros medios". */
export const MIN_ORDENES_MEDIO_PAGO = 3;
/** Canales con serie propia en "Compras por día y canal"; el resto va a "Otros canales". */
export const TOP_CANALES_DIA = 5;
/** Filas visibles en "Qué contenido vende" (el CSV lleva la lista completa). */
export const TOP_CONTENIDOS = 15;

/** Fin abierto para `getAtribucionCompras(…, hastaMax)`: sin tope extra. */
export const HASTA_ABIERTO = "9999-12-31";

// ---------- Helpers numéricos ----------

/** parte / total en puntos porcentuales; null si total ≤ 0. */
export function pct(parte: number, total: number): number | null {
  return total > 0 ? (100 * parte) / total : null;
}

/** CPA en USD; null cuando no hay gasto o no hay compras (se muestra "—"). */
export function cpa(gastoUsd: number, compras: number): number | null {
  return gastoUsd > 0 && compras > 0 ? gastoUsd / compras : null;
}

// ---------- Estado de la medición ----------

export type EstadoMedicionInput = {
  ordenes: { noPase: number; pase: number };
  propiedades: number;
  ventanaDesde: string | null;
  medibleDesde: string | null;
  medibleHasta: string | null;
};

/** Máquina de estados; el orden de las reglas importa. */
export function estadoMedicion(x: EstadoMedicionInput): EstadoMedicion {
  if (x.ordenes.noPase + x.ordenes.pase === 0) return "sin_ordenes";
  if (x.propiedades === 0) return "sin_propiedad";
  if (!x.medibleDesde) return "sin_tracking";
  if (!x.medibleHasta || x.medibleDesde > x.medibleHasta) return "sin_dias";
  if (x.ventanaDesde && x.medibleDesde > x.ventanaDesde) return "parcial";
  return "completa";
}

/** true cuando la sección tiene números que mostrar (parcial o completa). */
export function tieneMedicion(a: Pick<AtribucionCompras, "estado">): boolean {
  return a.estado === "parcial" || a.estado === "completa";
}

/** Ventana medida si existe; null en los estados sin datos. */
export function ventanaMedida(
  a: Pick<AtribucionCompras, "estado" | "medibleDesde" | "medibleHasta">,
): VentanaMedida | null {
  if (!tieneMedicion(a) || !a.medibleDesde || !a.medibleHasta) return null;
  return { desde: a.medibleDesde, hasta: a.medibleHasta };
}

/** % de órdenes medidas con código PM_ (propagación del referido). */
export function propagacionReferidoPct(a: { ordenes: { referidoPm: number; medibles: number } }): number | null {
  return pct(a.ordenes.referidoPm, a.ordenes.medibles);
}

/** D2: el CPA por Referido solo es comparable con suficiente propagación de PM_. */
export function muestraCpaReferido(a: { ordenes: { referidoPm: number; medibles: number } }): boolean {
  const p = propagacionReferidoPct(a);
  return p != null && p >= PM_PROPAGACION_MIN;
}

// ---------- Origen real ----------

export type CanalAgrupado = {
  canal: string;
  ordenes: number;
  personas: number;
  venta: number;
  pct: number; // % de las órdenes medidas
  ga4: number; // órdenes cuyo canal salió de GA4
  referido: number; // órdenes cuyo canal salió del Referido
};

const esp = (a: string, b: string) => a.localeCompare(b, "es");

/**
 * Junta las fuentes de cada canal (Linktree por GA4 + Linktree por Referido).
 * Orden: órdenes desc, luego nombre; "Sin origen conocido" siempre al final.
 */
export function agruparCanales(rows: CanalRealRow[], medibles: number): CanalAgrupado[] {
  const m = new Map<string, CanalAgrupado>();
  for (const r of rows) {
    const g = m.get(r.canal) ?? { canal: r.canal, ordenes: 0, personas: 0, venta: 0, pct: 0, ga4: 0, referido: 0 };
    g.ordenes += r.ordenes;
    g.personas += r.personas;
    g.venta += r.venta;
    if (r.fuente === "ga4") g.ga4 += r.ordenes;
    else if (r.fuente === "referido") g.referido += r.ordenes;
    m.set(r.canal, g);
  }
  const out = [...m.values()].map((g) => ({ ...g, pct: pct(g.ordenes, medibles) ?? 0 }));
  return out.sort((a, b) => {
    const sa = a.canal === CANAL_SIN_ORIGEN ? 1 : 0;
    const sb = b.canal === CANAL_SIN_ORIGEN ? 1 : 0;
    return sa - sb || b.ordenes - a.ordenes || esp(a.canal, b.canal);
  });
}

export type SegmentosCobertura = {
  ga4Canal: number; // GA4 con un canal informativo
  ga4SinCanal: number; // GA4 directo, sin canal o pasarela, sin Referido que lo resuelva
  referido: number; // solo el Referido del link dio el canal
  sinOrigen: number;
};

const DEBILES: ReadonlySet<string> = new Set(CANALES_GA4_DEBILES);

export function esCanalGa4Debil(canal: string): boolean {
  return DEBILES.has(canal);
}

/** Segmentos de la barra de cobertura de "Origen real de la venta". */
export function segmentosCobertura(rows: CanalRealRow[]): SegmentosCobertura {
  const s: SegmentosCobertura = { ga4Canal: 0, ga4SinCanal: 0, referido: 0, sinOrigen: 0 };
  for (const r of rows) {
    if (r.fuente === "ga4") {
      if (DEBILES.has(r.canal)) s.ga4SinCanal += r.ordenes;
      else s.ga4Canal += r.ordenes;
    } else if (r.fuente === "referido") s.referido += r.ordenes;
    else s.sinOrigen += r.ordenes;
  }
  return s;
}

// ---------- Salud de la medición ----------

/** El último día cargado (y los posteriores) puede seguir incompleto en GA4. */
export function diaProvisional(date: string, etlHasta: string | null): boolean {
  return etlHasta != null && date >= etlHasta;
}

/** Fecha de hoy en Santiago (YYYY-MM-DD). `ahora` es inyectable para tests. */
export function hoySantiago(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
}

function restarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - dias)).toISOString().slice(0, 10);
}

/**
 * GA4 llega con un día de atraso (hoy se ve hasta ayer). El chip "GA4 cargado
 * hasta el…" pasa a rojo cuando el último día cargado es anterior a ayer − 1.
 * Sin fecha de carga (evento viejo, sin tráfico reciente) no hay atraso que avisar.
 */
export function etlAtrasado(etlHasta: string | null, hoy: string = hoySantiago()): boolean {
  return etlHasta != null && etlHasta < restarDias(hoy, 2);
}

export type AlertaCobertura =
  // postEvento: el día es posterior al primer día del evento. Esas órdenes suelen
  // entrar por el portal de la ticketera o en la entrada (el sitio no las ve), así
  // que el corte se informa sin culpar al tag (GLO214 el 19-sep: la misma
  // propiedad vio 12 de 14 órdenes de GLO212 ese día).
  | { tipo: "corte"; fecha: string; ordenes: number; postEvento: boolean }
  | { tipo: "caida"; ultimos: number; base: number; pp: number }; // % y pp, 1 decimal

const r1 = (v: number) => Math.round(v * 10) / 10;

export function alertasCobertura(
  porDia: CoberturaDiaRow[],
  etlHasta: string | null,
  fechaEvento: string | null = null,
): AlertaCobertura[] {
  const completos = [...porDia]
    .filter((d) => !diaProvisional(d.date, etlHasta))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out: AlertaCobertura[] = [];
  for (const d of completos) {
    if (d.ordenes >= ALERTA.minOrdenesDia && d.vistas === 0) {
      out.push({ tipo: "corte", fecha: d.date, ordenes: d.ordenes, postEvento: fechaEvento != null && d.date > fechaEvento });
    }
  }
  const suma = (xs: CoberturaDiaRow[]) =>
    xs.reduce((acc, d) => ({ vistas: acc.vistas + d.vistas, ordenes: acc.ordenes + d.ordenes }), { vistas: 0, ordenes: 0 });
  const ult = suma(completos.slice(-ALERTA.ventanaDias));
  const prev = suma(completos.slice(0, -ALERTA.ventanaDias));
  if (ult.ordenes >= ALERTA.minOrdenesVentana && prev.ordenes >= ALERTA.minOrdenesVentana) {
    const ultimos = (100 * ult.vistas) / ult.ordenes;
    const base = (100 * prev.vistas) / prev.ordenes;
    if (base - ultimos >= ALERTA.caidaPp) {
      out.push({ tipo: "caida", ultimos: r1(ultimos), base: r1(base), pp: r1(base - ultimos) });
    }
  }
  return out;
}

export type MedioPagoAgrupado = CoberturaMedioPagoRow & { pct: number | null; baja: boolean };

/**
 * Filas "Por medio de pago": las de al menos MIN_ORDENES_MEDIO_PAGO órdenes, en
 * orden de órdenes; el resto se junta en «Otros medios» (al final, si existe).
 * `baja` = cobertura bajo COBERTURA_BAJA_PCT.
 */
export function agruparMediosPago(rows: CoberturaMedioPagoRow[]): MedioPagoAgrupado[] {
  const grandes = rows
    .filter((r) => r.ordenes >= MIN_ORDENES_MEDIO_PAGO)
    .sort((a, b) => b.ordenes - a.ordenes || esp(a.medioPago, b.medioPago));
  const chicos = rows.filter((r) => r.ordenes < MIN_ORDENES_MEDIO_PAGO);
  const out = [...grandes];
  if (chicos.length > 0) {
    out.push({
      medioPago: "Otros medios",
      ordenes: chicos.reduce((s, r) => s + r.ordenes, 0),
      vistas: chicos.reduce((s, r) => s + r.vistas, 0),
    });
  }
  return out.map((r) => {
    const p = pct(r.vistas, r.ordenes);
    return { ...r, pct: p, baja: p != null && p < COBERTURA_BAJA_PCT };
  });
}

// ---------- Compras por día y canal ----------

/**
 * Colores fijos por canal (tokens brutalistas de la ruta), para que un canal
 * conserve su color entre eventos. Cubre TODOS los canales que puede emitir el
 * SQL: el CASE de canal de marts.ga4_purchases y referidoCanalSql. Solo un
 * nombre desconocido (un canal nuevo en la vista) toma el primero libre de
 * COLORES_RESERVA, en el orden de la serie.
 */
export const COLOR_CANAL: Readonly<Record<string, string>> = {
  [CANAL_META]: "#0000FF",
  [CANAL_GOOGLE]: "#00FF00",
  "Búsqueda orgánica": "#00FFFF",
  Linktree: "#FFFF00",
  Directo: "#FF00FF",
  [CANAL_VENDEDORES]: "#FF8000",
  "Social orgánico": "#FF6FB5",
  Email: "#8000FF",
  "Comunidad (referidos)": "#008080",
  "Pasarela de pago": "#804000",
  "(not set)": "#B0B0B0",
  // Resto del CASE de marts.ga4_purchases.
  Otro: "#808000",
  "Sitio propio": "#008000",
  "Otros referrals": "#00A0FF",
  "Display / YouTube (pagado)": "#FF0080",
  "TikTok (pagado)": "#400040",
  "Sin dato": "#C8C8A0",
  "Sin clasificar (other)": "#A0A0C8",
  // Salidas de referidoCanalSql que no son canales GA4.
  "Otro (código)": "#800000",
  "Paid media (otro código)": "#000080",
};
export const COLORES_RESERVA = ["#FFB000", "#00FF80", "#B000FF", "#FF5050", "#50B0FF", "#B0FF50"] as const;
export const COLOR_OTROS = "#606060";
export const COLOR_SIN_ORIGEN = "#D9D9D9";

/** Claves internas de serie: nunca chocan con un nombre de canal. */
export const SERIE_OTROS = "__otros__";
export const SERIE_SIN_ORIGEN = "__sin_origen__";

export type SerieCanalDia = {
  key: string; // dataKey para recharts: "s0".."s4", SERIE_OTROS, SERIE_SIN_ORIGEN
  label: string; // nombre visible (canal, "Otros canales", "Sin origen conocido")
  color: string;
  total: number; // órdenes en la ventana
  canales: string[]; // canales reales que suma (más de uno solo en "Otros canales")
};

export type PuntoCanalDia = { date: string; total: number } & Record<string, number | string>;

export type ComprasDiaCanal = { series: SerieCanalDia[]; puntos: PuntoCanalDia[] };

/** Días YYYY-MM-DD de `desde` a `hasta`, ambos incluidos (tope de seguridad: 1.000). */
export function diasEntre(desde: string, hasta: string): string[] {
  const [y, m, d] = desde.split("-").map(Number);
  if (!y || !m || !d || desde > hasta) return [];
  const t = new Date(Date.UTC(y, m - 1, d));
  const out: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const iso = t.toISOString().slice(0, 10);
    if (iso > hasta) break;
    out.push(iso);
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}

/**
 * Series para el gráfico de barras apiladas "Compras por día y canal".
 *
 * Top `top` canales por órdenes (sin contar "Sin origen conocido"), luego
 * «Otros canales» y al final «Sin origen conocido»; cada serie solo aparece si
 * suma órdenes. Con `desde`/`hasta` rellena con ceros los días sin órdenes para
 * que el eje no salte días.
 */
export function agruparPorDiaCanal(
  rows: OrdenCanalDiaRow[],
  opts: { desde?: string | null; hasta?: string | null; top?: number } = {},
): ComprasDiaCanal {
  const top = opts.top ?? TOP_CANALES_DIA;
  const totales = new Map<string, number>();
  for (const r of rows) totales.set(r.canal, (totales.get(r.canal) ?? 0) + r.ordenes);

  const ranking = [...totales.entries()]
    .filter(([c, v]) => c !== CANAL_SIN_ORIGEN && v > 0)
    .sort((a, b) => b[1] - a[1] || esp(a[0], b[0]));
  const principales = ranking.slice(0, top);
  const resto = ranking.slice(top);

  const series: SerieCanalDia[] = [];
  const usados = new Set<string>();
  principales.forEach(([canal, total], i) => {
    const propio = COLOR_CANAL[canal];
    const color = propio && !usados.has(propio) ? propio : undefined;
    series.push({ key: `s${i}`, label: canal, color: color ?? "", total, canales: [canal] });
    if (color) usados.add(color);
  });
  // Los que no tienen color propio (o lo comparten) toman el primero libre de la reserva.
  for (const s of series) {
    if (s.color) continue;
    const libre = COLORES_RESERVA.find((c) => !usados.has(c)) ?? COLOR_OTROS;
    s.color = libre;
    usados.add(libre);
  }
  if (resto.length > 0) {
    series.push({
      key: SERIE_OTROS,
      label: CANAL_OTROS,
      color: COLOR_OTROS,
      total: resto.reduce((s, [, v]) => s + v, 0),
      canales: resto.map(([c]) => c),
    });
  }
  const sinOrigen = totales.get(CANAL_SIN_ORIGEN) ?? 0;
  if (sinOrigen > 0) {
    series.push({ key: SERIE_SIN_ORIGEN, label: CANAL_SIN_ORIGEN, color: COLOR_SIN_ORIGEN, total: sinOrigen, canales: [CANAL_SIN_ORIGEN] });
  }

  const keyDe = new Map<string, string>();
  for (const s of series) for (const c of s.canales) keyDe.set(c, s.key);

  const vacio = (date: string): PuntoCanalDia => {
    const p: PuntoCanalDia = { date, total: 0 };
    for (const s of series) p[s.key] = 0;
    return p;
  };
  const porDia = new Map<string, PuntoCanalDia>();
  if (opts.desde && opts.hasta) for (const d of diasEntre(opts.desde, opts.hasta)) porDia.set(d, vacio(d));
  for (const r of rows) {
    const key = keyDe.get(r.canal);
    if (!key || r.ordenes === 0) continue;
    const p = porDia.get(r.date) ?? vacio(r.date);
    p[key] = (p[key] as number) + r.ordenes;
    p.total += r.ordenes;
    porDia.set(r.date, p);
  }
  const puntos = [...porDia.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { series, puntos };
}

// ---------- Qué contenido vende ----------

/** Sesiones UTM en la ventana medida, en el grano de `getUtmTraffic` (dims manuales). */
export type UtmSesionesRow = {
  canal: string;
  source: string;
  medium: string;
  content: string;
  term: string;
  sesiones: number;
};

/** Órdenes GA4 medidas por clave manual (mismos COALESCE que la tabla UTM). */
export type UtmOrdenesRow = {
  source: string;
  medium: string;
  content: string;
  term: string;
  ordenes: number;
  venta: number;
};

export type ContenidoRow = {
  canal: string; // canal de la fila UTM (dims manuales de la sesión)
  source: string;
  medium: string;
  content: string;
  term: string;
  sesiones: number;
  ordenes: number;
  venta: number;
  conv: number | null; // órdenes ÷ sesiones, en %; null si no hubo sesiones
};

export type ContenidosQueVenden = {
  rows: ContenidoRow[]; // lista completa (para el CSV), ordenada por órdenes y luego sesiones
  ordenesGa4: number; // órdenes GA4 medidas del evento, con o sin fila de tráfico
  huerfanas: number; // órdenes GA4 cuya clave no tiene fila de tráfico
  huerfanasVenta: number;
};

export const claveUtm = (r: { source: string; medium: string; content: string; term: string }) =>
  `${r.source}|${r.medium}|${r.content}|${r.term}`;

/**
 * Cruza las órdenes GA4 con las filas de tráfico por la clave MANUAL
 * source|medium|content|term. Si una clave tiene más de una fila (mismo source
 * con distinto canal), las órdenes van a la fila con más sesiones.
 */
export function mergeUtmOrdenes(utm: UtmSesionesRow[], ordenes: UtmOrdenesRow[]): ContenidosQueVenden {
  const rows: ContenidoRow[] = utm.map((u) => ({ ...u, ordenes: 0, venta: 0, conv: null }));
  const destino = new Map<string, ContenidoRow>();
  for (const r of rows) {
    const k = claveUtm(r);
    const actual = destino.get(k);
    if (!actual || r.sesiones > actual.sesiones) destino.set(k, r);
  }
  let huerfanas = 0;
  let huerfanasVenta = 0;
  let ordenesGa4 = 0;
  for (const o of ordenes) {
    ordenesGa4 += o.ordenes;
    const r = destino.get(claveUtm(o));
    if (r) {
      r.ordenes += o.ordenes;
      r.venta += o.venta;
    } else {
      huerfanas += o.ordenes;
      huerfanasVenta += o.venta;
    }
  }
  for (const r of rows) r.conv = pct(r.ordenes, r.sesiones);
  rows.sort(
    (a, b) => b.ordenes - a.ordenes || b.sesiones - a.sesiones || esp(a.canal, b.canal) || esp(claveUtm(a), claveUtm(b)),
  );
  return { rows, ordenesGa4, huerfanas, huerfanasVenta };
}

export type ContenidoCanalResumen = { canal: string; sesiones: number; ordenes: number; venta: number; conv: number | null };

/** Totales por canal UTM (auditoría y posibles subtotales de la tabla). */
export function resumenContenidosPorCanal(rows: ContenidoRow[]): ContenidoCanalResumen[] {
  const m = new Map<string, ContenidoCanalResumen>();
  for (const r of rows) {
    const g = m.get(r.canal) ?? { canal: r.canal, sesiones: 0, ordenes: 0, venta: 0, conv: null };
    g.sesiones += r.sesiones;
    g.ordenes += r.ordenes;
    g.venta += r.venta;
    m.set(r.canal, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, conv: pct(g.ordenes, g.sesiones) }))
    .sort((a, b) => b.ordenes - a.ordenes || b.sesiones - a.sesiones || esp(a.canal, b.canal));
}

// ---------- Rendimiento por conjunto (Meta) ----------

export type ConjuntoMetaRow = {
  adsetId: string;
  campana: string; // "" si el conjunto no aparece en el mart de pauta
  conjunto: string;
  objective: string; // enum crudo del mart (OUTCOME_SALES, OUTCOME_AWARENESS…)
  objetivo: string; // etiqueta de /inversion-medios (Ventas, Cobertura…)
  gastoUsd: number; // gasto en la ventana medida
  pixel: number; // conversiones pixel en la ventana medida
  ordenesGa4: number; // órdenes web medidas cuya sesión trae este adset (sessionCampaignId)
};

export type RendimientoConjuntos = {
  rows: ConjuntoMetaRow[]; // gasto desc, luego órdenes GA4
  ga4Meta: number; // órdenes medidas con canal GA4 Meta (pagado)
  ga4MetaSinConjunto: number; // de ellas, sin adset identificable
};

// ---------- Funnel: paso "Compran" ----------

/** Paso que el Funnel agrega en modo "Desde medición GA4" (FunnelRow.step / stepOrder). */
export const FUNNEL_PASO_COMPRA = { step: "compra", stepOrder: 5 } as const;

export type FunnelCompra = {
  users: number; // órdenes que GA4 registró con su número de orden, en la ventana medida
  // "evento": el evento tiene landings mapeadas y se cuenta solo el evento (por OrdenID).
  // "propiedad": sin mapa, igual que los pasos 1-4 se cuenta toda la propiedad GA4.
  alcance: "evento" | "propiedad";
  otrosEventos: string[]; // EventoIDs de otras compras incluidas cuando alcance = "propiedad"
};
