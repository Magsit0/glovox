/**
 * Contenido de la presentación de cierre del Piknic 4 · temporada 26-27
 * (GLO216, sábado 7-nov-2026, Parque Padre Hurtado). Borrador armado el 9-nov y
 * actualizado al 17-nov (D+10).
 *
 * Datos ESTÁTICOS: foto al 17-nov (D+10), con los mismos criterios que la
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
 *
 * Revisión del 17-nov (tarde), con lo dicho en la reunión con Rodrigo Saavedra
 * (Producción Site, Técnica y Seguridad): salida a la venta con tres umbrales
 * (60 ideal · 45 bueno · 30 mínimo), sin el hito de pago de permisos, Piknic 1
 * en la comparación y en el punto de equilibrio, pagos de Finanzas en la
 * lámina de OC, y láminas nuevas de próximos eventos, ingreso por hora y
 * acuerdos con Producción. El mapa pasa al layout final (3-nov). La lámina de
 * permisos sale hasta tener las fechas de ingreso (Cessi).
 */

import type { AreaConNotas, Tone } from "@/components/cierres/deck/primitives";
import type { FechaClaveAnotable } from "@/lib/produccion/fechas-clave";

export const META = {
  evento: "Piknic 4 · 26-27",
  eventoId: "GLO216",
  fechaEvento: "2026-11-07",
  /** Plan en glovox-produccion (1238-CL-PKN): `tareas.evento_id`. */
  planGantt: "1238",
  corte: "datos al 17-nov · 10 días después del evento",
  pdfFilename: "Cierre Piknic 4 · 26-27 (datos al 17-nov-2026)",
} as const;

/* ── 1 · Portada ── */
export const PORTADA_FACTS: { value: string; caption: string; tone?: "warn" }[] = [
  { value: "3.364", caption: "personas entraron (Piknic 3: 3.037)" },
  {
    value: "2.641",
    caption: "personas pagaron su entrada del Piknic 4, sin contar pases de temporada",
  },
  { value: "$78,6 M", caption: "vendido en barras · $23.371 por persona" },
  {
    value: "99%",
    caption: "del punto de equilibrio: hacían falta unas 3.400 personas y entraron 3.364",
  },
];

/* ── 2 · Tarjeta de control ──
 * «Line up confirmado» se lee en vivo de la carta Gantt (fecha clave
 * `lineup_confirmado`, área Booking, plazo ideal Piknic = 90 días antes; creada
 * el 17-nov). Un superadmin anota la fecha real desde la misma lámina y queda en
 * la Gantt. `quePaso` y `estado` de esa fila son lo que se muestra mientras el
 * plan del Piknic 4 no tenga la tarea marcada. */
export const PUNTOS_CONTROL: {
  punto: string;
  area: string;
  plazo: string;
  quePaso: string;
  estado: string;
  tone: Tone;
  /** Fecha clave de la carta Gantt que alimenta la fila (se lee en la page). */
  fechaClave?: FechaClaveAnotable;
}[] = [
  {
    punto: "Line up confirmado",
    area: "Booking",
    plazo: "por definir",
    quePaso:
      "Sin registro en la carta Gantt del Piknic 4.",
    estado: "sin dato",
    tone: "neutral",
    fechaClave: "lineup_confirmado",
  },
  {
    punto: "Permisos ingresados",
    area: "Permisos y Legal",
    plazo: "3 meses antes · 9-ago",
    quePaso:
      "No hay registro de cuándo se ingresaron. Unabase solo tiene OC de trámites del 28-oct, que no miden el atraso.",
    estado: "sin dato",
    tone: "neutral",
  },
  {
    punto: "Salida a la venta",
    area: "Marketing",
    plazo: "ideal 60 días antes · mínimo 30",
    quePaso:
      "Abrió el 6-oct, 32 días antes.",
    estado: "cumple el mínimo",
    tone: "pending",
  },
  {
    punto: "Negocio en Unabase",
    area: "Producción y Finanzas",
    plazo: "30 días antes · 8-oct",
    quePaso:
      "Se asignó el 27-oct, 11 días antes. Las primeras OC son del 28-oct.",
    estado: "tarde",
    tone: "error",
  },
  {
    punto: "Layout",
    area: "Producción Site",
    plazo: "80% 7 días antes",
    quePaso:
      "Se mide desde el Piknic 5. El layout que se montó (3-nov) se subió el 17-nov.",
    estado: "desde el Piknic 5",
    tone: "neutral",
  },
  {
    punto: "Carta Gantt al día",
    area: "Producción",
    plazo: "3 días después · 10-nov",
    quePaso: "Al 17-nov, 30 de 125 tareas siguen vencidas sin cerrar.",
    estado: "abierto",
    tone: "error",
  },
  {
    punto: "Cierre de datos",
    area: "Finanzas y Datos",
    plazo: "3 días después · 10-nov",
    quePaso:
      "Faltan los montos de mesas VIP y repartir los pases de temporada; el rebate usa el 55% por defecto.",
    estado: "incompleto",
    tone: "error",
  },
  {
    punto: "Informe de marcas",
    area: "Comercial y Marcas",
    plazo: "5 días después · 12-nov",
    quePaso: "Sin registro en la carta Gantt del Piknic 4.",
    estado: "sin dato",
    tone: "neutral",
    fechaClave: "informe_marcas",
  },
];

/* ── Anexo: anticipación por evento ── */
export const ANTICIPACION_ESCALA = {
  max: 90,
  /** Salida a la venta: mínimo 30 (raya en tinta); bueno 45 e ideal 60 (grises). */
  lanzamiento: { minimo: 30, otros: [45, 60] },
  negocio: 30,
} as const;

export const ANTICIPACION: {
  evento: string;
  fecha: string;
  pagadas: string;
  lanzamiento: number | null;
  negocio: number | null;
  actual?: boolean;
}[] = [
  { evento: "Piknic 1 25-26", fecha: "6-sep-25", pagadas: "2.464", lanzamiento: 37, negocio: 3 },
  { evento: "Piknic 2 25-26", fecha: "4-oct-25", pagadas: "3.532", lanzamiento: 52, negocio: 2 },
  { evento: "Piknic 3 25-26", fecha: "9-nov-25", pagadas: "2.126", lanzamiento: 30, negocio: 4 },
  { evento: "Piknic 4 25-26", fecha: "6-dic-25", pagadas: "3.969", lanzamiento: 33, negocio: 5 },
  { evento: "Piknic 5 25-26", fecha: "10-ene-26", pagadas: "3.110", lanzamiento: 30, negocio: 0 },
  { evento: "Piknic Playa 25-26", fecha: "21-feb-26", pagadas: "2.395", lanzamiento: 40, negocio: 39 },
  { evento: "Piknic 6 25-26", fecha: "28-feb-26", pagadas: "3.308", lanzamiento: 36, negocio: 40 },
  { evento: "Piknic 7 25-26", fecha: "28-mar-26", pagadas: "2.894", lanzamiento: 59, negocio: 10 },
  { evento: "Piknic 8 25-26", fecha: "18-abr-26", pagadas: "2.454", lanzamiento: 53, negocio: 10 },
  { evento: "Piknic 1 26-27", fecha: "12-sep-26", pagadas: "2.035", lanzamiento: 52, negocio: 4 },
  { evento: "Piknic 3 26-27", fecha: "3-oct-26", pagadas: "1.853", lanzamiento: 18, negocio: 8 },
  { evento: "Piknic 4 26-27", fecha: "7-nov-26", pagadas: "2.776", lanzamiento: 32, negocio: 11, actual: true },
];

/* ── 13 · Lo que viene: próximos eventos contra los mismos plazos (al 17-nov) ──
 * Eventos propios de glovox.categoriaEvento con fecha futura (sin corporativos
 * ni eventos de marca), hasta el Piknic 7. Venta = primer día con 10 o más entradas pagadas en la
 * ticketera; negocio = fecha de asignación en Unabase del negocio con ese GLO
 * (marts actualizado al 16-nov); Gantt = tareas en glovox-produccion. */
export type EstadoProximo = { texto: string; tone: Tone; detalle?: string };
export const PROXIMOS: {
  evento: string;
  fecha: string;
  faltan: number;
  venta: EstadoProximo;
  negocio: EstadoProximo;
  gantt: EstadoProximo;
}[] = [
  {
    evento: "Sundeck Mathame",
    fecha: "sáb 21-nov",
    faltan: 4,
    venta: { texto: "67 días antes", tone: "success", detalle: "1.922 pagadas" },
    negocio: { texto: "8 días antes", tone: "error", detalle: "asignado el 13-nov" },
    gantt: { texto: "106 tareas", tone: "pending", detalle: "sin cambios desde el 5-nov" },
  },
  {
    evento: "The Grid: Ki/Ki",
    fecha: "sáb 5-dic",
    faltan: 18,
    venta: { texto: "172 días antes", tone: "success", detalle: "6.379 pagadas" },
    negocio: { texto: "31 días antes", tone: "success", detalle: "asignado el 4-nov" },
    gantt: { texto: "80 tareas", tone: "pending", detalle: "sin cambios desde el 25-sep" },
  },
  {
    evento: "Piknic 5",
    fecha: "dom 6-dic",
    faltan: 19,
    venta: { texto: "53 días antes", tone: "success", detalle: "939 pagadas" },
    negocio: { texto: "sin negocio", tone: "error", detalle: "el plazo venció el 6-nov" },
    gantt: { texto: "sin tareas", tone: "error", detalle: "solo el layout" },
  },
  {
    evento: "Bocas Moradas 11",
    fecha: "sáb 19-dic",
    faltan: 32,
    venta: { texto: "sin ventas en la ticketera", tone: "pending", detalle: "el mínimo vence el 19-nov" },
    negocio: { texto: "sin negocio", tone: "pending", detalle: "el plazo vence el 19-nov" },
    gantt: { texto: "sin tareas", tone: "neutral" },
  },
  {
    evento: "TKM Fest",
    fecha: "sáb 9-ene",
    faltan: 53,
    venta: { texto: "sin salir", tone: "pending", detalle: "pasó el ideal; bueno hasta el 25-nov" },
    negocio: { texto: "sin negocio", tone: "neutral", detalle: "plazo: 10-dic" },
    gantt: { texto: "sin tareas", tone: "neutral" },
  },
  {
    evento: "Piknic 6",
    fecha: "dom 10-ene",
    faltan: 54,
    venta: { texto: "sin salir", tone: "pending", detalle: "pasó el ideal; bueno hasta el 26-nov" },
    negocio: { texto: "sin negocio", tone: "neutral", detalle: "plazo: 11-dic" },
    gantt: { texto: "sin tareas", tone: "neutral" },
  },
  {
    evento: "Piknic 7",
    fecha: "sáb 13-feb",
    faltan: 88,
    venta: { texto: "sin salir", tone: "neutral", detalle: "ideal hasta el 15-dic" },
    negocio: { texto: "sin negocio", tone: "neutral", detalle: "plazo: 14-ene" },
    gantt: { texto: "sin tareas", tone: "neutral" },
  },
];

/* ── 4 · Comparación con el Piknic 1 y el Piknic 3 ──
 * Columnas p1 y p3 = cifras publicadas en el cierre del Piknic 3 (foto al
 * 8-oct). Ojo: ese cierre contó «personas que entraron» descontando solo los
 * upgrades emparejados por email; con la regla de este deck (todos los upgrades
 * escaneados) serían 3.104 y 3.021 en vez de 3.113 y 3.037 (menos de 1%). */
type Cambio = { texto: string; tone: "good" | "bad" | "eq" };

/* CPA Meta (18-nov) = gasto en Meta de getPaidMediaSummary (US$4.502, 4.545 y
 * 4.152) ÷ personas que entraron o que compraron. No es atribución: reparte el
 * gasto entre todos. Google va aparte (Piknic 4: US$1.017; Piknic 3: US$980). */

/** `grupo`: las filas se muestran agrupadas, con el nombre del grupo como subtítulo. */
export const CMP_RESULTADO: { grupo: string; indicador: string; p1: string; p3: string; p4: string; cambio: Cambio }[] = [
  { grupo: "Público", indicador: "Personas que entraron", p1: "3.113", p3: "3.037", p4: "3.364", cambio: { texto: "+11%", tone: "good" } },
  { grupo: "Público", indicador: "Personas que compraron", p1: "1.983", p3: "1.808", p4: "2.641", cambio: { texto: "+46%", tone: "good" } },
  { grupo: "Venta de tickets", indicador: "Venta de tickets (bruta)", p1: "$67,0 M", p3: "$61,3 M", p4: "$98,0 M", cambio: { texto: "+60%", tone: "good" } },
  { grupo: "Venta de tickets", indicador: "Venta por persona que compró", p1: "$33.774", p3: "$33.914", p4: "$37.090", cambio: { texto: "+9%", tone: "good" } },
  { grupo: "Pauta en Meta", indicador: "CPA Meta por asistente", p1: "US$1,45", p3: "US$1,50", p4: "US$1,23", cambio: { texto: "−18%", tone: "good" } },
  { grupo: "Pauta en Meta", indicador: "CPA Meta por comprador", p1: "US$2,27", p3: "US$2,51", p4: "US$1,57", cambio: { texto: "−37%", tone: "good" } },
  { grupo: "Anticipación", indicador: "Salida a la venta (días antes)", p1: "52", p3: "18", p4: "32", cambio: { texto: "+14", tone: "good" } },
];

/** Entradas pagadas (personas, sin devueltas) según cuántos días antes del evento se compraron. */
export const TRAMOS_VENTA: {
  evento: string;
  tramos: { antes: number; semanas1a3: number; ultimaSemana: number; dia: number };
  total: string;
}[] = [
  { evento: "Piknic 1", tramos: { antes: 849, semanas1a3: 316, ultimaSemana: 454, dia: 416 }, total: "2.035" },
  { evento: "Piknic 3", tramos: { antes: 0, semanas1a3: 692, ultimaSemana: 734, dia: 427 }, total: "1.853" },
  { evento: "Piknic 4", tramos: { antes: 970, semanas1a3: 394, ultimaSemana: 788, dia: 624 }, total: "2.776" },
];

/* ── 4 · Venta: cómo llegó la gente a comprar ──
 * Los tres que pesan, con el Piknic 3 al lado. El ranking completo (CANALES) y
 * «Quién entró» (INGRESOS) van en el anexo. */
/* Piknic 1 (18-nov): misma regla que el 3 y el 4 (código Referido de la entrada
 * pagada; FF = Club Glovox), sobre 2.034 entradas pagadas de hoy (el cierre
 * del Piknic 3 publicó 2.035: una devolución posterior). */
export const CANALES_CLAVE: { canal: string; que: string; p1: string; p3: string; p4: string; pctP1: string; pctP3: string; pctP4: string }[] = [
  {
    canal: "Club Glovox",
    que: "Cada miembro comparte su link personal y suma puntos por cada entrada que vende.",
    p1: "218",
    p3: "196",
    p4: "363",
    pctP1: "11%",
    pctP3: "11%",
    pctP4: "13%",
  },
  {
    canal: "Linktree",
    que: "El link de la bio de Instagram.",
    p1: "257",
    p3: "351",
    p4: "296",
    pctP1: "13%",
    pctP3: "19%",
    pctP4: "11%",
  },
  {
    canal: "Google Ads",
    que: "Anuncios pagados de Google con link rastreado (código PM_GG). El Piknic 1 no tuvo Google.",
    p1: "0",
    p3: "68",
    p4: "123",
    pctP1: "0%",
    pctP3: "4%",
    pctP4: "4%",
  },
];

/* ── Anexo · Venta y público (detalle) ── */
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
 * mapa de GLOVOX/mapas-ventas/Piknic 4 26-27, rehecho el 17-nov sobre el
 * layout que se montó (versión del 3-nov, subida por Producción el 17-nov). El
 * interactivo está en /cierres/mapas/piknic-4-26-27. */
export const MAPA_ALT =
  "Mapa del Parque Padre Hurtado con un globo por punto de venta: Barra Corchete $21,6 M, Barra 360 CDGA $9,9 M, Barra VIP $9,8 M, Barra Entel $8,9 M, Mistral $7,5 M, Heineken $5,8 M; Épica y Carpano en el sector oriente y BigTime en el borde sur, sin venta; asistentes por zona: General frente al escenario, VIP y VIP mesa.";

/* ── Anexo · Tragos más vendidos ── */
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

/* ── 16 · Anexo: resultado ── */
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
      "Marcas: fees y producto cargados en el onepager el 9-nov. Los 3 negocios de marca de Unabase siguen sin «GLO216».",
  },
  {
    estado: "falta",
    tone: "error",
    texto:
      "Mesas VIP: el onepager dice $0, con 410 personas que entraron con mesa. Los montos los tienen Anto y Andrés (referencia: en el Piknic 1 fueron $8,8 M).",
  },
  {
    estado: "falta repartir",
    tone: "pending",
    texto:
      "Pase de temporada: el ingreso está (252 pases por $22,2 M, GLO205), pero no se ha repartido entre los Piknic. Además, la ticketera trae 1 sola entrada de pase para el Piknic 4 (en el Piknic 3 entraron 177).",
  },
  {
    estado: "estimado",
    tone: "pending",
    texto:
      "Rebate: es la parte del cargo por servicio de la ticketera que vuelve a Glovox. Está calculado con el 55% por defecto; falta confirmar el porcentaje del contrato.",
  },
  {
    estado: "aparte",
    tone: "neutral",
    texto:
      "BTL (montaje de activaciones de marca): en Unabase va en negocios aparte y no entra en este resultado.",
  },
];

/* ── 10 · Avance de OC (millones de pesos netos) ──
 * conFactura = parte de lo emitido que ya tiene su documento de respaldo
 * registrado en Unabase (factura, boleta o rendición). responsable = lo confirmado en la
 * reunión del 17-nov; el resto queda sin nombre hasta que se defina. */
export const OC: {
  categoria: string;
  responsable?: string;
  presupuesto: string;
  emitido: string | null;
  conFactura: string | null;
  pct: number | null;
}[] = [
  { categoria: "Operaciones", presupuesto: "38,9", emitido: "11,1", conFactura: "0,2", pct: 29 },
  { categoria: "Producción técnica", responsable: "Rodrigo Saavedra", presupuesto: "31,0", emitido: "26,9", conFactura: "25,0", pct: 87 },
  { categoria: "Producción site", responsable: "Rodrigo Saavedra", presupuesto: "29,5", emitido: "23,6", conFactura: "0,4", pct: 80 },
  { categoria: "Artística", presupuesto: "27,9", emitido: "3,6", conFactura: null, pct: 13 },
  { categoria: "Seguridad", responsable: "Rodrigo Saavedra", presupuesto: "15,3", emitido: "11,5", conFactura: null, pct: 75 },
  { categoria: "Venue", presupuesto: "14,0", emitido: null, conFactura: null, pct: null },
  { categoria: "Logística y bodega", responsable: "Rodrigo Saavedra", presupuesto: "12,0", emitido: "9,1", conFactura: null, pct: 76 },
  { categoria: "Marketing", presupuesto: "8,6", emitido: "18,8", conFactura: null, pct: 219 },
  { categoria: "Permisos y autoridades", presupuesto: "4,7", emitido: "0,6", conFactura: null, pct: 13 },
  { categoria: "Marcas y patrocinios", presupuesto: "1,9", emitido: null, conFactura: null, pct: null },
  { categoria: "Contenidos y experiencias", presupuesto: "0,6", emitido: "0,6", conFactura: null, pct: 100 },
  { categoria: "Sostenibilidad", presupuesto: "0,04", emitido: "0,03", conFactura: null, pct: 70 },
];
export const OC_TOTAL = { presupuesto: "184,4", emitido: "105,8", conFactura: "25,6", nOc: 55, pct: 57 };

/**
 * OC con fecha de documento hasta el día del evento, al 17-nov (meta acordada
 * en el Piknic 3: 95%). Sin la radio de $18,8 M (Megamedia) en los dos eventos,
 * igual que en el punto de equilibrio: Piknic 4 = $79,0 M de $184,4 M; Piknic 3
 * = $85,2 M de $174,3 M. Tal como está cargado en Unabase serían 53% (cuenta
 * una OC de radio que no está en el presupuesto) y 44% (su presupuesto de hoy
 * incluye la radio, que no tiene OC). hoySinRadio = $87,0 M de $184,4 M.
 */
export const OC_ANTES = { pct: 43, conRadio: 53, piknic3: 49, meta: 95, hoySinRadio: 47, sinOc: "$88,8 M" };

/**
 * Pagos al 17-nov. En Unabase no hay ningún pago a proveedores marcado
 * (pago_realizado = 0 líneas); lo abonado son dos rendiciones de fondo. Unabase
 * no guarda la fecha en que se paga cada documento: el calendario es una
 * estimación (fecha de la OC + plazo de la forma de pago de cada OC: «a 30
 * días», «al día» o «contado»). Las referencias cuentan abonos.
 */
export const OC_PAGO = {
  abonado: "$0,4 M",
  conFactura: "$25,6 M",
  pctFactura: 24,
  sinFactura: "$80,2 M",
  ocSinFactura: 48,
  calendario: [
    { cuando: "ya exigibles", monto: "$4,5 M" },
    { cuando: "del 27 al 29-nov", monto: "$61,6 M" },
    { cuando: "del 2 al 5-dic", monto: "$32,3 M" },
    { cuando: "del 9 al 16-dic", monto: "$7,2 M" },
  ],
  referencia: "Piknic 3, a 45 días del evento: 29% pagado. Piknic 1, a 66 días: 25%.",
} as const;

/**
 * 10 · Pagos según el estado de la OC en Unabase (finanzas.unabase_gasto_dtc,
 * carga del 17-nov 09:15). Montos con IVA (total de la OC), que es lo que se
 * paga; sin las OC anuladas. Cerrada = pagada completa; Pagada = pagada (en
 * estos eventos, rendiciones chicas); Emitida = por pagar, puede tener abonos
 * («pago» de la OC). Días = desde el evento hasta el 18-nov.
 */
export type OcEstadoCelda = { n: number; monto: string; abonado?: string };
export const OC_ESTADOS: {
  evento: string;
  dias: number;
  cerrada: OcEstadoCelda;
  pagada: OcEstadoCelda;
  emitida: OcEstadoCelda;
  total: OcEstadoCelda;
  pagado: string;
  pct: string;
  actual?: boolean;
}[] = [
  {
    evento: "Piknic 1",
    dias: 67,
    cerrada: { n: 11, monto: "$36,6 M" },
    pagada: { n: 2, monto: "$0,5 M" },
    emitida: { n: 60, monto: "$146,1 M", abonado: "$9,5 M" },
    total: { n: 73, monto: "$183,2 M" },
    pagado: "$46,7 M",
    pct: "25%",
  },
  {
    evento: "Piknic 3",
    dias: 46,
    cerrada: { n: 10, monto: "$21,9 M" },
    pagada: { n: 5, monto: "$0,9 M" },
    emitida: { n: 61, monto: "$110,1 M", abonado: "$14,8 M" },
    total: { n: 76, monto: "$132,9 M" },
    pagado: "$37,6 M",
    pct: "28%",
  },
  {
    evento: "Piknic 4",
    dias: 11,
    cerrada: { n: 0, monto: "—" },
    pagada: { n: 1, monto: "$0,2 M" },
    emitida: { n: 54, monto: "$125,0 M", abonado: "$0,1 M" },
    total: { n: 55, monto: "$125,3 M" },
    pagado: "$0,4 M",
    pct: "0,4%",
    actual: true,
  },
];

/* ── VIP contra general (al 17-nov) ──
 * Personas = escaneos menos upgrades. Consumo = todo Onfire en las barras de
 * cada zona (una persona VIP también puede comprar en una barra general).
 * Los baños salieron de la lámina el 18-nov (gasto Unabase por persona: P1
 * $1.630 / $5.090, P3 $1.144 / $3.914, P4 $1.439 / $4.360, generales / VIP). */
export const ZONAS: {
  zona: string;
  personas: string;
  pct: string;
  consumo: string;
  porPersona: string;
  /** El consumo por persona no es comparable (falta lo incluido en la mesa). */
  parcial?: boolean;
  porPersonaP1: string;
  porPersonaP3: string;
}[] = [
  { zona: "General", personas: "2.500", pct: "74%", consumo: "$60,9 M", porPersona: "$24.358", porPersonaP1: "$19.455", porPersonaP3: "$21.472" },
  { zona: "VIP", personas: "454", pct: "13%", consumo: "$10,5 M", porPersona: "$23.211", porPersonaP1: "$19.553", porPersonaP3: "$25.031" },
  { zona: "Mesa VIP", personas: "410", pct: "12%", consumo: "$7,2 M", porPersona: "$17.528", parcial: true, porPersonaP1: "sin barra", porPersonaP3: "sin barra" },
];
/* Piknic 1 (18-nov), misma regla que el 3 y el 4: VIP = Backstage VIP (370
 * personas, Barra VIP $7,2 M), general = el resto sin upgrades (2.364, $46,0 M),
 * mesa = VIP MESA (370). En el Piknic 1 no había barra de mesas en Onfire y en
 * el 3 solo pasó $0,3 M (30 tragos): por eso «sin barra». Totales por persona =
 * los publicados en el cierre del Piknic 3. */
export const ZONAS_TOTAL = { personas: "3.364", consumo: "$78,6 M", porPersona: "$23.371", porPersonaP1: "$17.098", porPersonaP3: "$18.941" };


/* ── 6 · Ingreso por hora (escaneos en el acceso, tramos de 30 minutos) ──
 * glovox.tickets, HoraQuemado (hora local), mismo criterio que la curva de
 * llegada del onepager. Son escaneos: incluyen los upgrades (127 en el Piknic 4
 * y 40 en el Piknic 3), que se escanean aparte de la entrada. */
export const INGRESO_HORA: { hora: string; p4: number; p3: number }[] = [
  { hora: "13:00", p4: 6, p3: 0 },
  { hora: "13:30", p4: 40, p3: 38 },
  { hora: "14:00", p4: 62, p3: 74 },
  { hora: "14:30", p4: 212, p3: 182 },
  { hora: "15:00", p4: 113, p3: 118 },
  { hora: "15:30", p4: 91, p3: 28 },
  { hora: "16:00", p4: 89, p3: 50 },
  { hora: "16:30", p4: 134, p3: 75 },
  { hora: "17:00", p4: 217, p3: 108 },
  { hora: "17:30", p4: 402, p3: 226 },
  { hora: "18:00", p4: 362, p3: 363 },
  { hora: "18:30", p4: 482, p3: 496 },
  { hora: "19:00", p4: 731, p3: 545 },
  { hora: "19:30", p4: 319, p3: 414 },
  { hora: "20:00", p4: 156, p3: 176 },
  { hora: "20:30", p4: 37, p3: 108 },
  { hora: "21:00", p4: 20, p3: 43 },
  { hora: "21:30", p4: 18, p3: 11 },
  { hora: "22:00", p4: 0, p3: 3 },
  { hora: "22:30", p4: 0, p3: 3 },
];
export const INGRESO_RESUMEN = {
  total: "3.491",
  totalP3: "3.061",
  horaPunta: "18:41 a 19:41",
  horaPuntaPersonas: "1.350",
  horaPuntaPct: "39%",
  horaPuntaP3: "1.072",
  pico15: "19:00 a 19:15",
  pico15Personas: "375",
  pico15PorMinuto: 25,
  mitad: "18:42",
  noventa: "19:45",
  noventaP3: "20:04",
  antes15: "320",
  antes15Pct: "9%",
  mesaMitad: "19:10",
} as const;

/* ── Punto de equilibrio (al 17-nov) ──
 * Costo = presupuesto de gasto del negocio 8910 (neto). Ingreso por persona que
 * entró, sin IVA: tickets = (precio − descuento + 55% del cargo por servicio) /
 * 1,19 = $77,1 M; barras = Onfire / 1,19 = $66,1 M; entre 3.364 personas.
 * Marcas = SUPUESTO de $40 M (18-nov: el monto real de marcas no se expone en
 * la presentación; el onepager tiene $39,7 M). No incluye producto de marcas, mesas VIP ni
 * pases de temporada. Supone gasto fijo y la misma mezcla de público. */
export const EQUILIBRIO = {
  presupuesto: "$184,4 M",
  artistica: "$27,9 M",
  marcas: "$40 M",
  porCubrir: "$144,4 M",
  porPersona: "$42.569",
  porPersonaTickets: "$22.930",
  porPersonaBarras: "$19.639",
  conMarcas: 3392,
  sinMarcas: 4333,
  entraron: 3364,
  personasPorMillon: 23,
} as const;

/**
 * La misma cuenta para los tres Piknic de la temporada, con datos al 17-nov.
 * Personas del Piknic 1 y 3 = las publicadas en el cierre del Piknic 3.
 * Para comparar parejo, los tres van SIN la radio de $18,8 M (Megamedia): esa
 * línea está en el presupuesto del Piknic 1 y del 3 (por eso el del Piknic 3
 * pasó de $174,3 M a $193,2 M después de su cierre) y en el Piknic 4 es una OC
 * fuera de presupuesto. Marcas = el mismo supuesto de $40 M en los tres (reales:
 * $41,7 M, $41,7 M y $39,7 M; con ellos el equilibrio era 4.115, 4.174 y 3.400).
 * Otra salvedad: en el Piknic 1 y el 3 entraron 185 y 177 personas con pase de
 * temporada, que en esta cuenta aportan $0 en tickets.
 */
export const EQUILIBRIO_CMP: {
  evento: string;
  presupuesto: string;
  marcas: string;
  porPersona: string;
  necesarias: number;
  sinMarcas: number;
  entraron: number;
  actual?: boolean;
}[] = [
  { evento: "Piknic 1", presupuesto: "$170,4 M", marcas: "$40 M", porPersona: "$31.268", necesarias: 4170, sinMarcas: 5449, entraron: 3113 },
  { evento: "Piknic 3", presupuesto: "$174,3 M", marcas: "$40 M", porPersona: "$31.779", necesarias: 4226, sinMarcas: 5486, entraron: 3037 },
  { evento: "Piknic 4", presupuesto: "$184,4 M", marcas: "$40 M", porPersona: "$42.569", necesarias: 3392, sinMarcas: 4333, entraron: 3364, actual: true },
];
/** Si la OC de radio del Piknic 4 es compra y no canje, su equilibrio sube. */
export const EQUILIBRIO_CON_RADIO = { radio: "$18,8 M", necesarias: 3834, pct: 88 } as const;

/* ── 15 · Pendientes del Piknic 4 ── */
export const PENDIENTES: { titulo: string; areas: string; texto: string }[] = [
  {
    titulo: "Mesas VIP, rebate y GLO de marcas",
    areas: "Comercial y Marcas · Finanzas · Datos",
    texto:
      "Pedir a Anto y Andrés los montos de mesas VIP y cargarlos en el onepager; confirmar el % de rebate del contrato; poner «GLO216» en los 3 negocios de marca de Unabase.",
  },
  {
    titulo: "Pases de temporada",
    areas: "Ticketing y Comunidad · Datos",
    texto:
      "Repartir entre los Piknic el ingreso de los 252 pases ($22,2 M) y aclarar cómo entraron: la ticketera trae 1 sola entrada de pase.",
  },
  {
    titulo: "OC y facturas que faltan",
    areas: "Finanzas · Operaciones · Artística · Producción",
    texto:
      "Sin OC: Operaciones ($27,7 M), Artística ($24,2 M), Venue ($14,0 M) y Marcas ($1,9 M). Sin respaldo registrado (factura, boleta o rendición): 48 OC por $80,2 M. Para el Piknic 5: 95% antes del evento.",
  },
  {
    titulo: "Marketing sobre presupuesto",
    areas: "Marketing · Finanzas",
    texto:
      "Una OC de radio (Megamedia) por $18,8 M contra $8,6 M de presupuesto. ¿Es canje o compra? ¿Va al presupuesto de canjes?",
  },
  {
    titulo: "Cantidades por zona",
    areas: "Producción · Operaciones · Ticketing",
    texto:
      "Registrar en la carta Gantt cuántos baños, guardias y barras van en general y en VIP, y cuánta gente pasó a VIP sin ticket VIP.",
  },
  {
    titulo: "Permisos con fecha",
    areas: "Permisos y Legal · Datos",
    texto:
      "Ver con Cessi cómo registrar la fecha de ingreso y de aprobación de cada trámite (una sección en la carta Gantt, con el link a Drive). Con eso vuelve la lámina de permisos.",
  },
  {
    titulo: "Cerrar la carta Gantt",
    areas: "Producción",
    texto: "30 de 125 tareas vencidas sin cerrar: marcar las que se hicieron y anotar por qué no las otras.",
  },
  {
    titulo: "Informe de ruido",
    areas: "Permisos y Legal",
    texto: "Piknic 4: ≈21-dic. ¿Quién lo pide a la ETFA y lo entrega?",
  },
];

/* ── Anexo · Notas por área del Piknic 3 que no quedan en ningún sistema ──
 * Las confirma cada área. */
export const NOTAS_POR_CONFIRMAR: AreaConNotas[] = [
  {
    area: "Comercial y Marcas",
    notas: [
      { texto: "Heineken (fee + producto) en su centro de costo." },
      { texto: "Cuánta venta cuesta tener la gráfica 2 semanas antes por los sponsors." },
    ],
  },
  {
    area: "Marketing",
    notas: [{ texto: "Propuesta de dirección de arte y decoración (plantas, sin banderitas)." }],
  },
  {
    area: "Ticketing y Comunidad",
    notas: [{ texto: "Cortesías validadas por sistema (RUT o link): no se mide." }],
  },
  {
    area: "Permisos y Legal",
    notas: [{ texto: "Cómo se tramitó el Piknic 4 (la nota decía: sobre 3.000 personas)." }],
  },
  {
    area: "Producción",
    notas: [
      { texto: "Layout: arco de bienvenida, foto opportunity, rejas, baños y barra VIP cerca de las mesas." },
      { texto: "Pasillo a la cabina DJ para artistas y videógrafos." },
    ],
  },
  {
    area: "Operaciones",
    notas: [{ texto: "App de Onfire por contrato en todos los bartenders; productos fríos en la barra VIP." }],
  },
  {
    area: "Finanzas",
    notas: [{ texto: "Centros de costo y boletas del personal de barra." }],
  },
];

/* ── 14 · Lo acordado con Producción Site, Técnica y Seguridad ──
 * Reunión del 17-nov con Rodrigo Saavedra (líder de las tres áreas). Sale de la
 * transcripción; «acordado» = quedó dicho como acuerdo, «piloto» = se va a
 * probar, «por escribir» = existe en la práctica y falta dejarlo escrito. */
export const ACUERDOS_PRODUCCION: AreaConNotas[] = [
  {
    area: "Producción Site · layout",
    notas: [
      {
        tag: { label: "acordado", tone: "success" },
        texto: "60 días antes: presentación inicial a todas las áreas, con el recinto y el último layout montado ahí como borrador.",
      },
      {
        tag: { label: "acordado", tone: "success" },
        texto: "7 días antes: el 80% del layout listo. La versión final, el día del evento.",
      },
      {
        tag: { label: "acordado", tone: "success" },
        texto: "El lunes siguiente: layout final subido; con eso Datos arma el mapa de ventas ese día.",
      },
    ],
  },
  {
    area: "Producción Técnica",
    notas: [
      {
        tag: { label: "por escribir", tone: "pending" },
        texto: "Visita técnica un mes antes (hoy se hace entre un mes y tres semanas antes): primero interna, después con marcas, y con proveedores cuando el recinto es nuevo o cambia algo.",
      },
      {
        tag: { label: "piloto", tone: "info" },
        texto: "Cruzar las tareas de la carta Gantt con su OC en Unabase, partiendo por Técnica.",
      },
    ],
  },
  {
    area: "Seguridad",
    notas: [
      {
        tag: { label: "por escribir", tone: "pending" },
        texto: "Protocolo de accesos: al llegar, la seguridad del evento toma el control de las puertas; la de montaje no cierra accesos; revisión cada media hora.",
      },
      {
        tag: { label: "acordado", tone: "success" },
        texto: "Registrar las atenciones de ambulancia con su hora, para cruzarlas con la venta de barras.",
      },
      {
        tag: { label: "piloto", tone: "info" },
        texto: "Contar la salida con una cámara en un único canal, sin datos personales. Evento por definir.",
      },
    ],
  },
];
