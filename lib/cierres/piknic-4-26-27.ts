/**
 * Contenido de la presentación de cierre del Piknic 4 · temporada 26-27
 * (GLO216, sábado 7-nov-2026, Parque Padre Hurtado). Borrador armado el 9-nov.
 *
 * Datos ESTÁTICOS: foto al 9-nov (D+2), con los mismos criterios que la
 * presentación del Piknic 3 para que se puedan comparar:
 * - Tickets: glovox.tickets, clase ventaNoventa, sin devueltos. Venta bruta =
 *   PrecioFinal (con cargo por servicio). Personas = entradas menos upgrades.
 * - Asistentes: tickets escaneados (EsQuemado); personas distintas = escaneos
 *   menos los upgrades escaneados junto con su entrada.
 * - Barras: onfire.soldItems (SubTotal bruto, todo Onfire).
 * - Unabase: marts.finanzas_* del negocio 8910 (GLO216), montos netos.
 * - Pauta: la misma función de /marketing/weekly (getPaidMediaSummary).
 * - Plan de producción: glovox-produccion, plan 1238-CL-PKN.
 * - Onepager: tablas data.marca_ingresos / mesas_vip_ingresos / rebate_config.
 * Lo que necesita la reunión (acuerdos nuevos, observaciones) queda abierto.
 *
 * Revisión del 17-nov (después de las notas por área del Piknic 3): se suman
 * VIP vs general, punto de equilibrio, OC antes del evento y el seguimiento de
 * las notas por área, con datos al 17-nov; las marcas del onepager (cargadas el
 * 9-nov por la tarde) y el cierre semanal ya cuentan. Permisos, tragos y la
 * tabla de anticipación pasan al anexo.
 */

import type { AreaConNotas, HitoPlazo, Tone } from "@/components/cierres/deck/primitives";

export const META = {
  evento: "Piknic 4 · 26-27",
  eventoId: "GLO216",
  corte: "datos al 9-nov · D+2",
  pdfFilename: "Cierre Piknic 4 · 26-27 (datos al 9-nov-2026)",
} as const;

/* ── 1 · Portada ── */
export const PORTADA_FACTS: { value: string; caption: string; tone?: "warn" }[] = [
  { value: "3.364", caption: "personas entraron (Piknic 3: 3.037)" },
  {
    value: "2.641",
    caption: "personas pagaron su entrada del Piknic 4, sin contar pases de temporada",
  },
  { value: "$78,6 M", caption: "vendido en barras · $23.371 por persona" },
  {
    value: "Sin resultado",
    caption: "gasto documentado: 53% del presupuesto",
    tone: "warn",
  },
];

/* ── 2 · Tarjeta de control ── */
export const PUNTOS_CONTROL: {
  punto: string;
  area: string;
  plazo: string;
  quePaso: string;
  estado: string;
  tone: Tone;
}[] = [
  {
    punto: "Salida a la venta",
    area: "Dirección y Marketing",
    plazo: "D−60 · 8-sep",
    quePaso:
      "Abrió el 6-oct, 32 días antes, con 388 entradas el primer día. El Piknic 3 abrió 18 días antes.",
    estado: "tarde",
    tone: "error",
  },
  {
    punto: "Negocio en Unabase",
    area: "Producción y Finanzas",
    plazo: "D−30 · 8-oct",
    quePaso:
      "Se asignó el 27-oct, 11 días antes. Las primeras OC son del 28-oct.",
    estado: "tarde",
    tone: "error",
  },
  {
    punto: "Permisos ingresados",
    area: "Permisos y Legal",
    plazo: "M−3 · 9-ago",
    quePaso:
      "No hay registro del ingreso. En Unabase otra vez solo aparecen el TE1 y la directiva, pagados el 28-oct.",
    estado: "sin dato",
    tone: "neutral",
  },
  {
    punto: "Pauta contra venta",
    area: "Marketing",
    plazo: "umbral por definir",
    quePaso:
      "US$2,0 de pauta por persona que compró (Piknic 3: US$3,1). Con menos pauta se vendió 46% más.",
    estado: "por definir",
    tone: "neutral",
  },
  {
    punto: "Plan de producción al día",
    area: "Producción",
    plazo: "D+3 · 10-nov",
    quePaso:
      "El plan empezó el 6-oct, 32 días antes (Piknic 3: 12). Hoy tiene 30 de 125 tareas vencidas sin cerrar.",
    estado: "en curso",
    tone: "pending",
  },
  {
    punto: "Cierre de datos",
    area: "Finanzas y Datos",
    plazo: "D+3 · 10-nov",
    quePaso:
      "Onfire y las marcas ya están cargados. Mesas VIP sigue en $0 en el onepager y los pases de temporada no aparecen en la ticketera.",
    estado: "en curso",
    tone: "pending",
  },
];

/* ── 3 · Permisos (Parque Padre Hurtado, plazos contados desde el 7-nov) ── */
export const PERMISOS: {
  tramite: string;
  destacado?: boolean;
  anteQuien: string;
  plazo: string;
  plazoDetalle: string;
  registro: { estado: string; tone: Tone; extra?: string } | { texto: string };
}[] = [
  {
    tramite: "Iniciar trámites y expediente de evento masivo",
    anteQuien: "Delegación y SEREMI",
    plazo: "9-ago",
    plazoDetalle: "D−90 · M−3",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Permiso transitorio de alcoholes",
    anteQuien: "Municipalidad",
    plazo: "9-oct",
    plazoDetalle: "20 días hábiles",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Predictivo de sonido (DS 38)",
    anteQuien: "Parque",
    plazo: "19-oct",
    plazoDetalle: "10 háb. antes del montaje",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "TE1, declaración eléctrica",
    anteQuien: "SEC",
    plazo: "20-oct",
    plazoDetalle: "D−18",
    registro: { estado: "pagado 28-oct", tone: "success", extra: "$350.000" },
  },
  {
    tramite: "Directiva de funcionamiento",
    anteQuien: "Seguridad",
    plazo: "20-oct",
    plazoDetalle: "D−18",
    registro: { estado: "pagado 28-oct", tone: "success", extra: "$250.000" },
  },
  {
    tramite: "Patente y decreto municipal",
    anteQuien: "Municipalidad",
    plazo: "29-oct",
    plazoDetalle: "D−9",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Garantía 170 UF y póliza RC ≥3.000 UF",
    anteQuien: "Parque",
    plazo: "2-nov",
    plazoDetalle: "montaje, D−5",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Resolución SEREMI y conformidad de evento masivo",
    anteQuien: "SEREMI y Delegación",
    plazo: "5 y 6-nov",
    plazoDetalle: "D−2 y D−1",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Informe de ruido (ETFA)",
    destacado: true,
    anteQuien: "Parque",
    plazo: "≈21-dic",
    plazoDetalle: "≤30 días hábiles después",
    registro: { estado: "pendiente", tone: "pending" },
  },
];

/* ── 4 · Anticipación: línea de tiempo de los 3 hitos ──
 * Días antes del evento. Medianas de los 12 Piknic de la tabla del anexo. */
export const HITOS: HitoPlazo[] = [
  {
    hito: "Salida a la venta",
    area: "Dirección y Marketing",
    plazo: 60,
    mediana: 36.5,
    medianaTexto: "36,5",
    actual: 32,
    anterior: { nombre: "Piknic 3", dias: 18 },
  },
  {
    hito: "Negocio en Unabase",
    area: "Producción y Finanzas",
    plazo: 30,
    mediana: 6.5,
    medianaTexto: "6,5",
    actual: 11,
    anterior: { nombre: "Piknic 3", dias: 8 },
  },
  {
    hito: "Primer pago de permisos",
    area: "Permisos y Legal",
    plazo: 90,
    mediana: 9,
    medianaTexto: "9",
    actual: 10,
    anterior: { nombre: "Piknic 3", dias: 8 },
  },
];

/* ── 14 · Anexo: anticipación por evento ── */
export const ANTICIPACION_ESCALA = {
  max: 90,
  marcas: { lanzamiento: 60, negocio: 30, permisos: 90 },
} as const;

export const ANTICIPACION: {
  evento: string;
  fecha: string;
  pagadas: string;
  lanzamiento: number | null;
  negocio: number | null;
  permisos: number | null;
  actual?: boolean;
}[] = [
  { evento: "Piknic 1 25-26", fecha: "6-sep-25", pagadas: "2.464", lanzamiento: 37, negocio: 3, permisos: 18 },
  { evento: "Piknic 2 25-26", fecha: "4-oct-25", pagadas: "3.532", lanzamiento: 52, negocio: 2, permisos: 10 },
  { evento: "Piknic 3 25-26", fecha: "9-nov-25", pagadas: "2.126", lanzamiento: 30, negocio: 4, permisos: 3 },
  { evento: "Piknic 4 25-26", fecha: "6-dic-25", pagadas: "3.969", lanzamiento: 33, negocio: 5, permisos: 5 },
  { evento: "Piknic 5 25-26", fecha: "10-ene-26", pagadas: "3.110", lanzamiento: 30, negocio: 0, permisos: 11 },
  { evento: "Piknic Playa 25-26", fecha: "21-feb-26", pagadas: "2.395", lanzamiento: 40, negocio: 39, permisos: 24 },
  { evento: "Piknic 6 25-26", fecha: "28-feb-26", pagadas: "3.308", lanzamiento: 36, negocio: 40, permisos: 19 },
  { evento: "Piknic 7 25-26", fecha: "28-mar-26", pagadas: "2.894", lanzamiento: 59, negocio: 10, permisos: 8 },
  { evento: "Piknic 8 25-26", fecha: "18-abr-26", pagadas: "2.454", lanzamiento: 53, negocio: 10, permisos: 8 },
  { evento: "Piknic 1 26-27", fecha: "12-sep-26", pagadas: "2.035", lanzamiento: 52, negocio: 4, permisos: 3 },
  { evento: "Piknic 3 26-27", fecha: "3-oct-26", pagadas: "1.853", lanzamiento: 18, negocio: 8, permisos: 8 },
  { evento: "Piknic 4 26-27", fecha: "7-nov-26", pagadas: "2.776", lanzamiento: 32, negocio: 11, permisos: 10, actual: true },
];

/* ── 5 · Comparación con el Piknic 3 ── */
type Cambio = { texto: string; tone: "good" | "bad" | "eq" };

export const CMP_RESULTADO: { indicador: string; p3: string; p4: string; cambio: Cambio }[] = [
  { indicador: "Personas que entraron", p3: "3.037", p4: "3.364", cambio: { texto: "+11%", tone: "good" } },
  { indicador: "Personas que compraron", p3: "1.808", p4: "2.641", cambio: { texto: "+46%", tone: "good" } },
  { indicador: "Venta de tickets (bruta)", p3: "$61,3 M", p4: "$98,0 M", cambio: { texto: "+60%", tone: "good" } },
  { indicador: "Venta por persona que compró", p3: "$33.914", p4: "$37.090", cambio: { texto: "+9%", tone: "good" } },
  { indicador: "Vendido en barras", p3: "$57,5 M", p4: "$78,6 M", cambio: { texto: "+37%", tone: "good" } },
  { indicador: "Barras por persona", p3: "$18.941", p4: "$23.371", cambio: { texto: "+23%", tone: "good" } },
  { indicador: "Pauta", p3: "US$5.525", p4: "US$5.169", cambio: { texto: "−6%", tone: "eq" } },
  { indicador: "Trago más vendido", p3: "Tropical Gin · 1.413", p4: "Mistral 35° · 1.652", cambio: { texto: "≠", tone: "eq" } },
];

/** Entradas pagadas (personas, sin devueltas) según cuántos días antes del evento se compraron. */
export const TRAMOS_VENTA: {
  evento: string;
  tramos: { antes: number; semanas1a3: number; ultimaSemana: number; dia: number };
  total: string;
}[] = [
  { evento: "Piknic 3", tramos: { antes: 0, semanas1a3: 692, ultimaSemana: 734, dia: 427 }, total: "1.853" },
  { evento: "Piknic 4", tramos: { antes: 970, semanas1a3: 394, ultimaSemana: 788, dia: 624 }, total: "2.776" },
];

/* ── 6 · Venta y público ── */
export const CANALES: { canal: string; entradas: string; pct: string; venta: string }[] = [
  { canal: "Sin código de origen", entradas: "1.564", pct: "56%", venta: "55,9" },
  { canal: "Club Glovox (referidos)", entradas: "363", pct: "13%", venta: "12,9" },
  { canal: "Linktree", entradas: "296", pct: "11%", venta: "11,1" },
  { canal: "Boletería", entradas: "178", pct: "6%", venta: "4,6" },
  { canal: "Google Ads (pagado)", entradas: "123", pct: "4%", venta: "5,2" },
  { canal: "Meta (pagado)", entradas: "105", pct: "4%", venta: "3,4" },
  { canal: "Social orgánico", entradas: "92", pct: "3%", venta: "2,9" },
  { canal: "Email (Drip)", entradas: "54", pct: "2%", venta: "2,0" },
  { canal: "Otro orgánico", entradas: "1", pct: "0%", venta: "0,0" },
];
export const CANALES_TOTAL = { entradas: "2.776", pct: "100%", venta: "98,0" };

export const INGRESOS: { tipo: string; personas: string; nota?: string }[] = [
  { tipo: "Con entrada pagada", personas: "2.119", nota: "80% de los que compraron" },
  { tipo: "Invitaciones", personas: "811", nota: "de 993 emitidas" },
  { tipo: "Mesas VIP", personas: "410", nota: "de 566 emitidas; venta por carga manual" },
  { tipo: "Pilates", personas: "23", nota: "de 189 emitidas" },
  { tipo: "Pase de temporada", personas: "1", nota: "los pases GLO205 no aparecen" },
];
export const INGRESOS_TOTAL = { personas: "3.364", nota: "Piknic 3: 3.037" };

/* ── 7 · Mapa de ventas ──
 * Imagen: components/cierres/piknic-4-26-27/mapa-ventas.jpg (2200×1960), del
 * mapa de GLOVOX/mapas-ventas/Piknic 4 26-27 (layout rev3 del 28-oct). El
 * interactivo está en /cierres/mapas/piknic-4-26-27. */
export const MAPA_ALT =
  "Mapa del Parque Padre Hurtado con un globo por punto de venta: Barra Corchete $21,6 M, Barra 360 CDGA $9,9 M, Barra VIP $9,8 M, Barra Entel $8,9 M, Mistral $7,5 M, Heineken $5,8 M; asistentes por zona: General, VIP y VIP mesa.";

/* ── 8 · Barras ── */
export const BARRAS_TOP: {
  sector: string;
  tragos: string;
  top: { nombre: string; detalle: string }[];
}[] = [
  {
    sector: "Total",
    tragos: "9.516 tragos",
    top: [
      { nombre: "Mistral 35° + bebida", detalle: "1.652 · 17% · $11,7 M" },
      { nombre: "Tropical Gin", detalle: "1.608 · 17% · $14,8 M" },
      { nombre: "Schop Heineken 500cc", detalle: "1.054 · 11% · $4,3 M" },
    ],
  },
  {
    sector: "General",
    tragos: "7.668 tragos",
    top: [
      { nombre: "Mistral 35° + bebida", detalle: "1.272" },
      { nombre: "Tropical Gin", detalle: "1.242" },
      { nombre: "Schop Heineken 500cc", detalle: "1.054" },
    ],
  },
  {
    sector: "VIP",
    tragos: "1.236 tragos",
    top: [
      { nombre: "Tropical Gin", detalle: "290" },
      { nombre: "Mistral 35° + bebida", detalle: "267" },
      { nombre: "Mistral Cristalino 40° + bebida", detalle: "89" },
    ],
  },
  {
    sector: "Mesa VIP",
    tragos: "612 tragos",
    top: [
      { nombre: "Mistral 35° + bebida", detalle: "113" },
      { nombre: "Tropical Gin", detalle: "76" },
      { nombre: "Tanqueray Tonic", detalle: "63" },
    ],
  },
];

/* ── 9 · Resultado ── */
export const INGRESOS_CARGA: { estado: string; tone: Tone; texto: string }[] = [
  {
    estado: "cargado",
    tone: "success",
    texto: "Tickets: $98,0 M bruto (con cargo por servicio), desde la ticketera.",
  },
  {
    estado: "cargado",
    tone: "success",
    texto: "Barras: $78,6 M bruto, desde Onfire. El cierre semanal ya lo incluye.",
  },
  {
    estado: "cargado",
    tone: "success",
    texto:
      "Marcas: $39,7 M netos en fees (Entel, Banco de Chile, Heinz, Pepsi y Cupra) y $2,0 M en producto, cargados en el onepager el 9-nov. Los 3 negocios de marca de Unabase siguen sin «GLO216».",
  },
  {
    estado: "falta",
    tone: "error",
    texto: "Mesas VIP: el onepager dice $0, con 410 personas que entraron con mesa (566 emitidas).",
  },
  {
    estado: "revisar",
    tone: "pending",
    texto:
      "Pase de temporada: la ticketera no trae entradas de pase para el Piknic 4 (en el Piknic 3 entraron 177). Y el ingreso de los 252 pases (GLO205) sigue sin repartirse entre los Piknic.",
  },
  {
    estado: "revisar",
    tone: "pending",
    texto: "Rebate: no tiene porcentaje propio; usa el 55% por defecto.",
  },
];

/* ── 10 · Avance de OC (millones de pesos netos) ── */
export const OC: {
  categoria: string;
  presupuesto: string;
  emitido: string | null;
  nOc: number;
  pct: number | null;
}[] = [
  { categoria: "Operaciones", presupuesto: "38,9", emitido: "4,7", nOc: 12, pct: 12 },
  { categoria: "Producción técnica", presupuesto: "31,0", emitido: "26,8", nOc: 6, pct: 86 },
  { categoria: "Producción site", presupuesto: "29,5", emitido: "23,0", nOc: 14, pct: 78 },
  { categoria: "Artística", presupuesto: "27,9", emitido: "2,5", nOc: 4, pct: 9 },
  { categoria: "Seguridad", presupuesto: "15,3", emitido: "11,5", nOc: 3, pct: 75 },
  { categoria: "Venue", presupuesto: "14,0", emitido: null, nOc: 0, pct: null },
  { categoria: "Logística y bodega", presupuesto: "12,0", emitido: "9,1", nOc: 2, pct: 76 },
  { categoria: "Marketing", presupuesto: "8,6", emitido: "18,8", nOc: 1, pct: 219 },
  { categoria: "Permisos y autoridades", presupuesto: "4,7", emitido: "0,6", nOc: 2, pct: 13 },
  { categoria: "Marcas y patrocinios", presupuesto: "1,9", emitido: null, nOc: 0, pct: null },
  { categoria: "Contenidos y experiencias", presupuesto: "0,6", emitido: "0,6", nOc: 3, pct: 100 },
  { categoria: "Sostenibilidad", presupuesto: "0,04", emitido: "0,03", nOc: 1, pct: 70 },
];
export const OC_TOTAL = { presupuesto: "184,4", emitido: "97,7", nOc: 44, pct: 53 };

/** OC con fecha de documento hasta el día del evento, al 17-nov (meta acordada en el Piknic 3: 95%). */
export const OC_ANTES = { pct: 53, monto: "97,8", piknic3: 44, meta: 95 };

/* ── VIP contra general (al 17-nov) ──
 * Personas = escaneos menos upgrades. Consumo = todo Onfire en las barras de
 * cada zona (una persona VIP también puede comprar en una barra general).
 * Baños = gasto real en Unabase por tipo (generales vs trailers VIP); las
 * cantidades por zona no se registran en ningún sistema. */
export const ZONAS: {
  zona: string;
  personas: string;
  pct: string;
  consumo: string;
  porPersona: string;
  porPersonaP3: string;
}[] = [
  { zona: "General", personas: "2.500", pct: "74%", consumo: "$60,9 M", porPersona: "$24.358", porPersonaP3: "$21.472" },
  { zona: "VIP", personas: "454", pct: "13%", consumo: "$10,5 M", porPersona: "$23.211", porPersonaP3: "$25.031" },
  { zona: "Mesa VIP", personas: "410", pct: "12%", consumo: "$7,2 M", porPersona: "$17.528", porPersonaP3: "sin medir" },
];
export const ZONAS_TOTAL = { personas: "3.364", consumo: "$78,6 M", porPersona: "$23.371", porPersonaP3: "$18.941" };

export const BANOS: { tipo: string; p3: string; p4: string }[] = [
  { tipo: "Generales, por persona de general", p3: "$1.144", p4: "$1.439" },
  { tipo: "Trailers VIP, por persona de VIP y mesa", p3: "$3.914", p4: "$4.360" },
];

/* ── Punto de equilibrio (al 17-nov) ──
 * Costo = presupuesto de gasto del negocio 8910 (neto). Ingreso por persona que
 * entró, sin IVA: tickets = (precio − descuento + 55% del cargo por servicio) /
 * 1,19 = $77,1 M; barras = Onfire / 1,19 = $66,1 M; entre 3.364 personas.
 * Marcas = fees del onepager (neto). No incluye producto de marcas, mesas VIP ni
 * pases de temporada. Supone gasto fijo y la misma mezcla de público. */
export const EQUILIBRIO = {
  presupuesto: "$184,4 M",
  artistica: "$27,9 M",
  marcas: "$39,7 M",
  porCubrir: "$144,7 M",
  porPersona: "$42.569",
  porPersonaTickets: "$22.930",
  porPersonaBarras: "$19.639",
  conMarcas: 3400,
  sinMarcas: 4333,
  entraron: 3364,
  personasPorMillon: 23,
  personasArtistica: 655,
} as const;


/* ── 11 · Qué pasó con los acuerdos del Piknic 3 ── */
export const SEGUIMIENTO_P3: { acuerdo: string; estado: string; tone: Tone; texto: string }[] = [
  {
    acuerdo: "Cargar marcas y mesas VIP",
    estado: "a medias",
    tone: "pending",
    texto:
      "Las marcas del Piknic 3 y del 4 se cargaron el 9-nov. Mesas VIP sigue en $0 en los dos, y los negocios de marca del Piknic 4 se crearon otra vez sin el GLO.",
  },
  {
    acuerdo: "Facturas que faltan",
    estado: "en curso",
    tone: "pending",
    texto: "El gasto documentado del Piknic 3 pasó de $93,2 M a $112,8 M en Unabase.",
  },
  {
    acuerdo: "Cerrar el plan",
    estado: "abierto",
    tone: "error",
    texto: "El plan del Piknic 3 tiene hoy 11 tareas vencidas sin cerrar (eran 10).",
  },
  {
    acuerdo: "Informe de ruido al parque",
    estado: "sin dato",
    tone: "neutral",
    texto: "Venció el 16-nov. No hay gasto de ETFA en Unabase: confirmar si se entregó.",
  },
  {
    acuerdo: "Dueños y umbrales",
    estado: "sin dato",
    tone: "neutral",
    texto: "Un nombre por punto de control y validar D−60, D−30 y M−3: revisar en la reunión.",
  },
  {
    acuerdo: "Presupuesto de canjes",
    estado: "sin dato",
    tone: "neutral",
    texto:
      "Se acordó un presupuesto aparte para canjes y fletes. En el Piknic 4 hay una OC de radio por $18,8 M: ¿es canje?",
  },
];

/* ── 12 · Pendientes del Piknic 4 ── */
export const PENDIENTES: { titulo: string; texto: string }[] = [
  {
    titulo: "Mesas VIP, rebate y GLO de marcas",
    texto:
      "Cargar las mesas VIP y el % de rebate en el onepager, y poner «GLO216» en los 3 negocios de marca de Unabase (Heinz, Entel vasos y Johnnie Walker).",
  },
  {
    titulo: "Pases de temporada",
    texto:
      "Aclarar cómo entraron los pases GLO205: la ticketera no trae ninguna entrada de pase para el Piknic 4.",
  },
  {
    titulo: "OC que faltan",
    texto:
      "Operaciones ($34,1 M por emitir al 9-nov), Artística ($25,3 M), Venue ($14,0 M) y Marcas y patrocinios ($1,9 M). Para el Piknic 5: 95% antes del evento.",
  },
  {
    titulo: "Marketing sobre presupuesto",
    texto:
      "Una OC de radio (Megamedia) por $18,8 M contra $8,6 M de presupuesto. ¿Es canje o compra? ¿Va al presupuesto de canjes?",
  },
  {
    titulo: "Cantidades por zona",
    texto:
      "Registrar en el plan de producción cuántos baños, guardias y barras van en general y en VIP: hoy no está en ningún sistema.",
  },
  {
    titulo: "Piknic 5 es domingo",
    texto:
      "Es el domingo 6-dic: en el Piknic 3 se dijo que los domingos se vende menos. Revisar campaña y producción.",
  },
  {
    titulo: "Cerrar el plan",
    texto: "30 de 125 tareas vencidas sin cerrar: marcar las que se hicieron y anotar por qué no las otras.",
  },
  {
    titulo: "Informes de ruido",
    texto: "Piknic 3: venció el 16-nov. Piknic 4: ≈21-dic. ¿Quién los pide a la ETFA y los entrega?",
  },
];

/* ── Seguimiento de las notas por área del Piknic 3 (al 17-nov) ──
 * Sin repetir lo que ya está en los acuerdos. Gris = no queda en ningún
 * sistema: lo confirma cada área en la reunión. */
export const NOTAS_AREA: AreaConNotas[] = [
  {
    area: "Dirección",
    notas: [
      { tag: { label: "en esta reunión", tone: "info" }, texto: "Punto de equilibrio y aforo objetivo: ver la lámina 10." },
      { tag: { label: "revisar", tone: "pending" }, texto: "Domingos: el Piknic 5 es el domingo 6-dic." },
    ],
  },
  {
    area: "Comercial y Marcas",
    notas: [
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Heineken (fee + producto) en su centro de costo." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Cuánta venta cuesta tener la gráfica 2 semanas antes por los sponsors." },
    ],
  },
  {
    area: "Programación Artística",
    notas: [
      { tag: { label: "abierto", tone: "error" }, texto: "Costo visible: al 9-nov había OC por el 9% de los $27,9 M." },
      { tag: { label: "en esta reunión", tone: "info" }, texto: "Cada $1 M de artística son ~23 personas más para cubrir el gasto." },
    ],
  },
  {
    area: "Marketing",
    notas: [
      { tag: { label: "mejoró", tone: "success" }, texto: "Campaña más larga: abrió en D−32 y todo lo vendido de más salió antes de D−21." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Propuesta de dirección de arte y decoración (plantas, sin banderitas)." },
    ],
  },
  {
    area: "Ticketing y Comunidad",
    notas: [
      { tag: { label: "revisar", tone: "pending" }, texto: "Invitaciones sin usar: entraron 811 de 993, y de Pilates 23 de 189." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Cortesías validadas por sistema (RUT o link): no se mide." },
    ],
  },
  {
    area: "Permisos y Legal",
    notas: [
      { tag: { label: "se repite", tone: "error" }, texto: "El ingreso de los trámites sigue sin registro: solo aparecen pagos." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Cómo se tramitó el Piknic 4 (la nota decía: sobre 3.000 personas)." },
    ],
  },
  {
    area: "Producción",
    notas: [
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Layout: arco de bienvenida, foto opportunity, rejas, baños y barra VIP cerca de las mesas." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Pasillo a la cabina DJ para artistas y videógrafos." },
    ],
  },
  {
    area: "Operaciones",
    notas: [
      { tag: { label: "mejoró", tone: "success" }, texto: "Mesa VIP ya pasa por Onfire: 612 tragos (Piknic 3: 30)." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "App de Onfire por contrato en todos los bartenders; productos fríos en la barra VIP." },
    ],
  },
  {
    area: "Finanzas",
    notas: [
      { tag: { label: "no se cumplió", tone: "error" }, texto: "95% de OC antes del evento: llegó al 53% (Piknic 3: 44%)." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Centros de costo y boletas del personal de barra." },
    ],
  },
  {
    area: "Datos y Tecnología",
    notas: [
      { tag: { label: "abierto", tone: "error" }, texto: "Rentabilidad de mesas VIP: falta el ingreso de mesas en el onepager." },
      { tag: { label: "confirmar", tone: "neutral" }, texto: "Avisos de plazos por Slack (propuesta del Piknic 3)." },
    ],
  },
];
