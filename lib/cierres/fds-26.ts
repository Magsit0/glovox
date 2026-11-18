/**
 * Contenido de la presentación de cierre de la Feria del Sánguche 2026
 * (FDS 26 · GLO213, viernes 13 a domingo 15 de noviembre de 2026, Parque Padre
 * Hurtado). Borrador armado el 17-nov (2 días después del último día), para la
 * reunión de líderes del 18-nov junto con el cierre del Piknic 4.
 *
 * Se compara SOLO contra la FDS 25 (GLO181, 21 al 23 de noviembre de 2025,
 * mismo parque), como se acordó con Producción el 17-nov.
 *
 * Datos ESTÁTICOS, foto al 17-nov:
 * - Tickets: glovox.tickets, clase ventaNoventa, sin devueltos. Personas =
 *   PersonasPorTicket (los packs para 2 y el pase familiar cuentan 2 y 4),
 *   sin upgrades («Diferencial» en 2025) ni la entrada de prueba. Venta bruta =
 *   PrecioFinal (con cargo por servicio).
 * - Entraron = personas de los tickets escaneados (EsQuemado), sin upgrades,
 *   por día de la entrada. ⚠️ Los tickets de niños casi no se escanearon el
 *   viernes (31 de 543), así que «entraron» se queda corto.
 * - Onfire: onfire.soldItems (SubTotal bruto, por día de venta). Barras = puntos
 *   «Barra …» de Glovox (sin la Barra de Pickles, que es un expositor); juegos =
 *   Bingo, Bote Laguna y Entretenciones Krusty; expositores = el resto.
 * - Unabase: marts.finanzas_* del negocio 8897 (GLO213) y 7950 (GLO181), netos.
 * - Pauta: la misma función de /marketing/weekly (getPaidMediaSummary).
 * - Producción: glovox-produccion, plan 1240 (carta Gantt) y layout del evento.
 * - Marcas: planilla «Estatus Marcas - Feria del Sánguche 2026» (Comercial);
 *   el onepager todavía no tiene las marcas de la FDS 26.
 */

import type { AreaConNotas, HitoPlazo, Tone } from "@/components/cierres/deck/primitives";
import type { FechaClaveAnotable } from "@/lib/produccion/fechas-clave";

export const META = {
  evento: "Feria del Sánguche 2026",
  eventoId: "GLO213",
  /** Último día de la feria: base de los plazos «días después». */
  fechaFin: "2026-11-15",
  /** Plan en glovox-produccion (carta Gantt): `tareas.evento_id`. */
  planGantt: "1240",
  corte: "datos al 17-nov · 2 días después del último día",
  pdfFilename: "Cierre Feria del Sánguche 2026 (datos al 17-nov-2026)",
} as const;

/* ── 1 · Portada ── */
export const PORTADA_FACTS: { value: string; caption: string; tone?: "warn" }[] = [
  { value: "7.080", caption: "personas entraron en los tres días (FDS 25: 7.713)" },
  { value: "6.974", caption: "personas pagaron su entrada, por $39,5 M (FDS 25: 6.774, por $48,6 M)" },
  { value: "$202,2 M", caption: "vendido en Onfire: expositores, barras y juegos (FDS 25: $227,8 M)" },
  {
    value: "Sin cerrar",
    caption: "el resultado: en Unabase no hay ingresos facturados y las marcas no están en el onepager",
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
  /** Fecha clave de la carta Gantt que alimenta la fila (se lee en la page). */
  fechaClave?: FechaClaveAnotable;
}[] = [
  {
    punto: "Salida a la venta",
    area: "Marketing",
    plazo: "ideal 60 días antes · mínimo 30",
    quePaso: "Abrió el 29-sep, 45 días antes.",
    estado: "nivel bueno",
    tone: "success",
  },
  {
    punto: "Negocio en Unabase",
    area: "Producción y Finanzas",
    plazo: "30 días antes · 14-oct",
    quePaso: "Se asignó el 15-oct, 29 días antes (FDS 25: 36). La primera OC es del mismo día.",
    estado: "1 día tarde",
    tone: "error",
  },
  {
    punto: "Layout",
    area: "Producción Site",
    plazo: "60 días antes a las áreas · 80% 7 días antes · final el lunes siguiente",
    quePaso:
      "La rev17 se subió el 30-oct (14 días antes) y la final el domingo 15-nov. No hay registro de cuándo se presentó a las áreas.",
    estado: "80% y final a tiempo",
    tone: "success",
  },
  {
    punto: "OC antes del evento",
    area: "Finanzas y cada área",
    plazo: "95% del presupuesto",
    quePaso: "Al 13-nov había OC por $148,2 M de $287,0 M (52%). FDS 25: 41%, contra su presupuesto de hoy.",
    estado: "bajo la meta",
    tone: "error",
  },
  {
    punto: "Carta Gantt al día",
    area: "Producción",
    plazo: "3 días después · 18-nov",
    quePaso:
      "122 tareas: 84 cerradas y 36 vencidas sin cerrar; el desmontaje no tiene nada marcado.",
    estado: "vence mañana",
    tone: "pending",
  },
  {
    punto: "Cierre de datos",
    area: "Finanzas, Comercial y Datos",
    plazo: "3 días después · 18-nov",
    quePaso:
      "Onfire y la ticketera están cargados. Faltan las marcas en el onepager y facturar los ingresos en Unabase.",
    estado: "incompleto",
    tone: "pending",
  },
  {
    punto: "Informe de marcas",
    area: "Comercial y Marcas",
    plazo: "5 días después · 20-nov",
    quePaso: "Aún en plazo. Sin registro en la carta Gantt de la FDS 26.",
    estado: "vence el 20-nov",
    tone: "pending",
    fechaClave: "informe_marcas",
  },
];

/* ── 3 · Anticipación (días antes del primer día). Lo normal = la FDS 25. ── */
export const HITOS: HitoPlazo[] = [
  {
    hito: "Salida a la venta",
    area: "Marketing",
    plazo: 30,
    niveles: [
      { dias: 60, label: "ideal" },
      { dias: 45, label: "bueno" },
      { dias: 30, label: "mínimo" },
    ],
    mediana: 74,
    medianaTexto: "74",
    actual: 45,
    anterior: { nombre: "FDS 25", dias: 74 },
  },
  {
    hito: "Negocio en Unabase",
    area: "Producción y Finanzas",
    plazo: 30,
    mediana: 36,
    medianaTexto: "36",
    actual: 29,
    anterior: { nombre: "FDS 25", dias: 36 },
  },
];

/* ── 4 · Comparación con la FDS 25 ── */
type Cambio = { texto: string; tone: "good" | "bad" | "eq" };

/* CPA Meta (18-nov) = gasto en Meta de getPaidMediaSummary (FDS 25 US$7.336,
 * FDS 26 US$8.222) ÷ personas que entraron o que pagaron. No es atribución. La
 * FDS 26 gastó además US$1.873 en Google; en 2025 Google no se medía. */
/** `grupo`: las filas se muestran agrupadas (lámina de comparación, solo Marketing). */
export const CMP_RESULTADO: { grupo: string; indicador: string; f24: string; f25: string; f26: string; cambio: Cambio }[] = [
  { grupo: "Público", indicador: "Personas que entraron", f24: "8.973", f25: "7.713", f26: "7.080", cambio: { texto: "−8%", tone: "bad" } },
  { grupo: "Público", indicador: "Personas que pagaron entrada", f24: "7.750", f25: "6.774", f26: "6.974", cambio: { texto: "+3%", tone: "good" } },
  { grupo: "Público", indicador: "Cortesías emitidas", f24: "2.391", f25: "2.221", f26: "1.658", cambio: { texto: "−25%", tone: "eq" } },
  { grupo: "Venta de tickets", indicador: "Venta de tickets (bruta)", f24: "$60,5 M", f25: "$48,6 M", f26: "$39,5 M", cambio: { texto: "−19%", tone: "bad" } },
  { grupo: "Venta de tickets", indicador: "Venta por persona que pagó", f24: "$7.808", f25: "$7.175", f26: "$5.668", cambio: { texto: "−21%", tone: "bad" } },
  { grupo: "Pauta en Meta", indicador: "CPA Meta por asistente", f24: "—", f25: "US$0,95", f26: "US$1,16", cambio: { texto: "+22%", tone: "bad" } },
  { grupo: "Pauta en Meta", indicador: "CPA Meta por persona que pagó", f24: "—", f25: "US$1,08", f26: "US$1,18", cambio: { texto: "+9%", tone: "bad" } },
  { grupo: "Anticipación", indicador: "Salida a la venta (días antes)", f24: "95", f25: "74", f26: "45", cambio: { texto: "−29", tone: "bad" } },
];

/** Personas con entrada pagada según cuántos días antes de SU día compraron. */
export const TRAMOS_VENTA: {
  evento: string;
  tramos: { antes: number; semanas1a3: number; ultimaSemana: number; dia: number };
  total: string;
}[] = [
  { evento: "FDS 24", tramos: { antes: 874, semanas1a3: 894, ultimaSemana: 2383, dia: 3599 }, total: "7.750" },
  { evento: "FDS 25", tramos: { antes: 1022, semanas1a3: 844, ultimaSemana: 1736, dia: 3172 }, total: "6.774" },
  { evento: "FDS 26", tramos: { antes: 1609, semanas1a3: 1121, ultimaSemana: 1696, dia: 2548 }, total: "6.974" },
];

/** Por día de la feria: FDS 25 → FDS 26. Onfire por día de venta. */
export const POR_DIA: {
  dia: string;
  /** FDS 24, FDS 25, FDS 26. */
  pagaron: [string, string, string];
  entraron: [string, string, string];
}[] = [
  { dia: "Viernes", pagaron: ["365", "485", "1.210"], entraron: ["411", "562", "671"] },
  { dia: "Sábado", pagaron: ["4.040", "3.545", "3.645"], entraron: ["4.611", "3.858", "3.623"] },
  { dia: "Domingo", pagaron: ["3.345", "2.744", "2.119"], entraron: ["3.951", "3.293", "2.786"] },
];

/* ── 3 · La misma comparación, día por día (selector de la lámina) ──
 * Mismas reglas que CMP_RESULTADO, por el día de la entrada. La pauta y la
 * salida a la venta no se separan por día: solo salen en «Los 3 días».
 * FDS 24 = GLO145 (15 al 17-nov-2024): todas sus entradas eran individuales. */
export type DiaCmp = "todos" | "vie" | "sab" | "dom";
type FilaCmp = { grupo: string; indicador: string; f24: string; f25: string; f26: string; cambio: Cambio };
type Tramos = { antes: number; semanas1a3: number; ultimaSemana: number; dia: number };
/** Cada tupla: FDS 24, FDS 25, FDS 26, cambio 26 contra 25. */
type T4 = [string, string, string, string];
const filasDia = (
  e: T4,
  p: T4,
  c: T4,
  v: T4,
  pp: T4,
  tones: { e: Cambio["tone"]; p: Cambio["tone"]; v: Cambio["tone"]; pp: Cambio["tone"] },
): FilaCmp[] => [
  { grupo: "Público", indicador: "Personas que entraron", f24: e[0], f25: e[1], f26: e[2], cambio: { texto: e[3], tone: tones.e } },
  { grupo: "Público", indicador: "Personas que pagaron entrada", f24: p[0], f25: p[1], f26: p[2], cambio: { texto: p[3], tone: tones.p } },
  { grupo: "Público", indicador: "Cortesías emitidas", f24: c[0], f25: c[1], f26: c[2], cambio: { texto: c[3], tone: "eq" } },
  { grupo: "Venta de tickets", indicador: "Venta de tickets (bruta)", f24: v[0], f25: v[1], f26: v[2], cambio: { texto: v[3], tone: tones.v } },
  { grupo: "Venta de tickets", indicador: "Venta por persona que pagó", f24: pp[0], f25: pp[1], f26: pp[2], cambio: { texto: pp[3], tone: tones.pp } },
];

export const CMP_DIAS: {
  key: DiaCmp;
  label: string;
  titulo: string;
  nota: string;
  filas: FilaCmp[];
  tramos: { evento: string; tramos: Tramos; total: string; actual?: boolean }[];
}[] = [
  {
    key: "todos",
    label: "Los 3 días",
    titulo: "Pagaron 3% más personas que en 2025, pero la venta de tickets lleva dos años bajando: $60,5 M, $48,6 M y $39,5 M",
    nota: "Antes de 3 semanas la FDS 26 llevaba 1.609 personas con entrada (FDS 24: 874; FDS 25: 1.022). Lo que se perdió fue la compra durante la feria: 4.570 personas en 2024, 4.005 en 2025 y 3.097 en 2026.",
    filas: CMP_RESULTADO,
    tramos: TRAMOS_VENTA,
  },
  {
    key: "vie",
    label: "Viernes",
    titulo: "El viernes pagaron más del doble de personas que en 2025, pero entró solo 19% más gente",
    nota: "De las 1.210 personas con entrada del viernes, 543 son entradas de niños y solo 31 se escanearon. 549 compraron con más de 3 semanas de anticipación (FDS 24: 18; FDS 25: 74).",
    filas: filasDia(["411", "562", "671", "+19%"], ["365", "485", "1.210", "+149%"], ["420", "409", "227", "−44%"], ["$2,2 M", "$2,8 M", "$5,3 M", "+93%"], ["$6.057", "$5.709", "$4.407", "−23%"], { e: "good", p: "good", v: "good", pp: "bad" }),
    tramos: [
      { evento: "FDS 24", tramos: { antes: 18, semanas1a3: 32, ultimaSemana: 92, dia: 223 }, total: "365" },
      { evento: "FDS 25", tramos: { antes: 74, semanas1a3: 27, ultimaSemana: 82, dia: 302 }, total: "485" },
      { evento: "FDS 26", tramos: { antes: 549, semanas1a3: 206, ultimaSemana: 191, dia: 264 }, total: "1.210" },
    ],
  },
  {
    key: "sab",
    label: "Sábado",
    titulo: "El sábado pagaron 3% más personas que en 2025, pero cada una pagó 19% menos",
    nota: "El sábado se vendió igual o más que en 2025 en todos los tramos salvo el mismo día: 1.247 personas compraron ese día (FDS 24: 1.618; FDS 25: 1.397). Se emitieron menos de la mitad de las cortesías de 2024 (464 contra 1.020).",
    filas: filasDia(["4.611", "3.858", "3.623", "−6%"], ["4.040", "3.545", "3.645", "+3%"], ["1.020", "839", "464", "−45%"], ["$32,6 M", "$26,4 M", "$21,9 M", "−17%"], ["$8.061", "$7.456", "$6.017", "−19%"], { e: "bad", p: "good", v: "bad", pp: "bad" }),
    tramos: [
      { evento: "FDS 24", tramos: { antes: 588, semanas1a3: 543, ultimaSemana: 1291, dia: 1618 }, total: "4.040" },
      { evento: "FDS 25", tramos: { antes: 707, semanas1a3: 539, ultimaSemana: 902, dia: 1397 }, total: "3.545" },
      { evento: "FDS 26", tramos: { antes: 768, semanas1a3: 692, ultimaSemana: 938, dia: 1247 }, total: "3.645" },
    ],
  },
  {
    key: "dom",
    label: "Domingo",
    titulo: "El domingo fue el día más débil: pagaron 23% menos personas que en 2025 y la venta bajó 37%",
    nota: "El domingo viene cayendo hace dos años: pagaron 3.345 personas en 2024, 2.744 en 2025 y 2.119 en 2026. El mismo día compraron 1.037 (FDS 24: 1.758). Las cortesías se mantuvieron y pesaron más: 805 de las 2.786 personas que entraron (29%).",
    filas: filasDia(["3.951", "3.293", "2.786", "−15%"], ["3.345", "2.744", "2.119", "−23%"], ["951", "973", "967", "−1%"], ["$25,7 M", "$19,4 M", "$12,3 M", "−37%"], ["$7.692", "$7.069", "$5.789", "−18%"], { e: "bad", p: "bad", v: "bad", pp: "bad" }),
    tramos: [
      { evento: "FDS 24", tramos: { antes: 268, semanas1a3: 319, ultimaSemana: 1000, dia: 1758 }, total: "3.345" },
      { evento: "FDS 25", tramos: { antes: 241, semanas1a3: 278, ultimaSemana: 752, dia: 1473 }, total: "2.744" },
      { evento: "FDS 26", tramos: { antes: 292, semanas1a3: 223, ultimaSemana: 567, dia: 1037 }, total: "2.119" },
    ],
  },
];

/* ── 5 · Venta: convenios, tipos de entrada y canales ── */
export const CONVENIOS: { convenio: string; f25: string; f26: string; pct25: string; pct26: string }[] = [
  { convenio: "20% Caja Los Andes", f25: "2.252", f26: "1.791", pct25: "45%", pct26: "40%" },
  { convenio: "20% Copec Pay", f25: "965", f26: "1.066", pct25: "19%", pct26: "24%" },
  { convenio: "15% Vecino La Reina", f25: "—", f26: "82", pct25: "—", pct26: "2%" },
  { convenio: "Sin descuento", f25: "1.751", f26: "1.565", pct25: "35%", pct26: "35%" },
];
export const CONVENIOS_TOTAL = { f25: "4.968", f26: "4.504" };

export const CANALES: { canal: string; entradas: string; pct: string; venta: string }[] = [
  { canal: "Sin código de origen", entradas: "2.707", pct: "60%", venta: "25,7" },
  { canal: "Club Glovox (referidos)", entradas: "636", pct: "14%", venta: "2,3" },
  { canal: "Google Ads (pagado)", entradas: "398", pct: "9%", venta: "3,8" },
  { canal: "Meta (pagado)", entradas: "341", pct: "8%", venta: "3,5" },
  { canal: "Linktree", entradas: "317", pct: "7%", venta: "3,2" },
  { canal: "Email", entradas: "57", pct: "1%", venta: "0,5" },
  { canal: "Social orgánico", entradas: "48", pct: "1%", venta: "0,5" },
];
export const CANALES_TOTAL = { entradas: "4.504", pct: "100%", venta: "39,5" };

/** Tipos de entrada (anexo). Entradas pagadas, sin devueltas. */
export const TIPOS_F26: { tipo: string; entradas: string; precio: string }[] = [
  { tipo: "Pack para 2 (toda hora, almuerzo o tarde)", entradas: "2.524", precio: "$10.000 a $13.000" },
  { tipo: "Niños de 4 a 12 años", entradas: "1.011", precio: "$3.000 a $4.000" },
  { tipo: "General (toda hora, almuerzo o tarde)", entradas: "916", precio: "$6.000 a $8.000" },
  { tipo: "Upgrades", entradas: "53", precio: "$2.000 a $4.000" },
];
export const TIPOS_F25: { tipo: string; entradas: string; precio: string }[] = [
  { tipo: "Feria Atardecer (hasta las 18:00)", entradas: "2.117", precio: "$7.000 a $9.000" },
  { tipo: "Feria Estelar", entradas: "1.379", precio: "$7.000 a $11.000" },
  { tipo: "Feria Brunch (hasta las 14:00)", entradas: "648", precio: "$5.000 a $7.000" },
  { tipo: "Pase familiar (4 personas)", entradas: "566", precio: "$24.000 a $28.000" },
  { tipo: "After Sánguche (2 personas)", entradas: "183", precio: "$10.000" },
  { tipo: "Diferencial (upgrade en puerta)", entradas: "75", precio: "$2.000" },
];

/* ── 5 · Ingreso por hora: personas escaneadas por hora de escaneo, los tres días ──
 * El viernes el acceso se escaneó solo desde las 17:03 (igual en 2025). */
export const INGRESO_HORA: { hora: string; vie26: number; vie25: number; sab26: number; sab25: number; dom26: number; dom25: number }[] = [
  { hora: "11", vie26: 0, vie25: 0, sab26: 43, sab25: 79, dom26: 63, dom25: 102 },
  { hora: "12", vie26: 0, vie25: 0, sab26: 198, sab25: 270, dom26: 200, dom25: 284 },
  { hora: "13", vie26: 0, vie25: 0, sab26: 426, sab25: 537, dom26: 544, dom25: 639 },
  { hora: "14", vie26: 0, vie25: 0, sab26: 742, sab25: 581, dom26: 694, dom25: 710 },
  { hora: "15", vie26: 0, vie25: 0, sab26: 652, sab25: 604, dom26: 525, dom25: 600 },
  { hora: "16", vie26: 0, vie25: 0, sab26: 380, sab25: 500, dom26: 314, dom25: 333 },
  { hora: "17", vie26: 132, vie25: 86, sab26: 334, sab25: 454, dom26: 213, dom25: 244 },
  { hora: "18", vie26: 146, vie25: 127, sab26: 335, sab25: 371, dom26: 106, dom25: 164 },
  { hora: "19", vie26: 159, vie25: 181, sab26: 320, sab25: 312, dom26: 79, dom25: 136 },
  { hora: "20", vie26: 154, vie25: 115, sab26: 232, sab25: 118, dom26: 14, dom25: 63 },
  { hora: "21", vie26: 22, vie25: 52, sab26: 49, sab25: 22, dom26: 2, dom25: 26 },
  { hora: "22", vie26: 2, vie25: 3, sab26: 0, sab25: 0, dom26: 0, dom25: 0 },
];
export const INGRESO_RESUMEN = {
  viernesTotal: "615",
  viernesTotal25: "564",
  puntaVie: "159",
  puntaVie25: "181",
  puntaSab: "742",
  puntaSab25: "604",
  puntaDom: "694",
  puntaDom25: "710",
  /** Sábado: de 13:00 a 16:00 entró el 49% del día (FDS 25: 45%). */
  sabTramo: "49%",
  sabTramo25: "45%",
  /** El viernes el acceso se escaneó solo desde la tarde, igual que en 2025. */
  viernesDesde: "17:03",
  ninosViernes: "543",
  ninosViernesEsc: "31",
  ninosTotal: "1.011",
  ninosTotalEsc: "382",
} as const;

/* ── 7 · Mapa de ventas ──
 * Imagen: components/cierres/fds-26/mapa-ventas.jpg, del mapa de
 * GLOVOX/mapas-ventas/FDS 26, hecho el 17-nov sobre el layout final (REV 3
 * modificación + agregados 15 nov). El interactivo está en /cierres/mapas/fds-26. */
export const MAPA_ALT =
  "Layout final de la Feria del Sánguche 2026 con un globo por punto de venta, proporcional a lo vendido en Onfire: barras de Glovox, expositores y juegos.";

/* ── 8 · Onfire por tipo de puesto ── */
export const ONFIRE_GRUPOS: {
  grupo: string;
  que: string;
  f24: string;
  f25: string;
  f26: string;
  porPersona24: string;
  porPersona25: string;
  porPersona26: string;
  cambio: Cambio;
}[] = [
  {
    grupo: "Expositores",
    que: "sangucherías, foodtrucks, postres, café, jugos y mercadito",
    f24: "$151,7 M",
    f25: "$148,1 M",
    f26: "$131,1 M",
    porPersona24: "$16.901",
    porPersona25: "$19.203",
    porPersona26: "$18.522",
    cambio: { texto: "−11%", tone: "bad" },
  },
  {
    grupo: "Barras de Glovox",
    que: "FDS 26: Corchete, Cervezera, Escenario, Bosque y Zona Niños",
    f24: "$86,2 M",
    f25: "$78,2 M",
    f26: "$64,3 M",
    porPersona24: "$9.611",
    porPersona25: "$10.140",
    porPersona26: "$9.076",
    cambio: { texto: "−18%", tone: "bad" },
  },
  {
    grupo: "Juegos",
    que: "bingo, botes en la laguna y Entretenciones Krusty",
    f24: "—",
    f25: "$1,5 M",
    f26: "$6,8 M",
    porPersona24: "—",
    porPersona25: "$188",
    porPersona26: "$960",
    cambio: { texto: "+369%", tone: "good" },
  },
];
export const ONFIRE_TOTAL = { f24: "$237,9 M", f25: "$227,8 M", f26: "$202,2 M", porPersona24: "$26.512", porPersona25: "$29.532", porPersona26: "$28.559" };

/** Barras de Glovox en la FDS 26 (Onfire bruto, tres días). */
export const BARRAS: { barra: string; venta: string; pct: string }[] = [
  { barra: "Barra Corchete", venta: "$22,6 M", pct: "35%" },
  { barra: "Barra Cervezera", venta: "$18,5 M", pct: "29%" },
  { barra: "Barra Escenario", venta: "$10,8 M", pct: "17%" },
  { barra: "Barra Bosque", venta: "$7,7 M", pct: "12%" },
  { barra: "Barra Zona Niños", venta: "$4,7 M", pct: "7%" },
];

/** Los 10 expositores que más vendieron en la FDS 26, con su puesto en la FDS 25. */
export const RANKING: { n: number; nombre: string; venta: string; ticket: string; f24: string; f25: string }[] = [
  { n: 1, nombre: "La Fuente Carrera", venta: "$9,5 M", ticket: "$13.013", f24: "—", f25: "nuevo" },
  { n: 2, nombre: "Chicken Love You", venta: "$8,7 M", ticket: "$10.323", f24: "#2 · $13,6 M", f25: "#2 · $10,3 M" },
  { n: 3, nombre: "Hauromi Kai", venta: "$7,8 M", ticket: "$14.104", f24: "—", f25: "nuevo" },
  { n: 4, nombre: "Mano Negra Sanguchería Marina", venta: "$7,6 M", ticket: "$11.716", f24: "—", f25: "nuevo" },
  { n: 5, nombre: "Bestias Burger", venta: "$7,5 M", ticket: "$10.631", f24: "#7 · $7,9 M", f25: "#4 · $7,7 M" },
  { n: 6, nombre: "Mr Tex", venta: "$7,4 M", ticket: "$11.504", f24: "#1 · $14,9 M", f25: "#1 · $13,7 M" },
  { n: 7, nombre: "La Verità", venta: "$6,9 M", ticket: "$6.970", f24: "#4 · $11,3 M", f25: "#14 · $5,4 M" },
  { n: 8, nombre: "Uncle Fletch", venta: "$6,8 M", ticket: "$12.641", f24: "—", f25: "#9 · $6,7 M" },
  { n: 9, nombre: "Marraqueta Rustik", venta: "$6,7 M", ticket: "$13.738", f24: "#9 · $6,3 M", f25: "#6 · $7,2 M" },
  { n: 10, nombre: "Jugosos", venta: "$4,8 M", ticket: "$7.045", f24: "#16 · $5,0 M", f25: "#11 · $6,1 M" },
];
export const RANKING_RESUMEN = {
  puntos26: 39,
  puntos25: 33,
  puntos24: 24,
  nuevos: 20,
  top10: "$73,6 M",
  top10Pct: "56%",
  noVolvieron:
    "Liberty Burger ($9,9 M), One Guy ($7,4 M), Domino ($6,8 M), Gorilas ($6,7 M) y Fuente Chilena ($6,5 M)",
} as const;

/** Ranking completo de expositores FDS 26 (anexo): venta Onfire bruta y órdenes. */
export const RANKING_COMPLETO: { nombre: string; venta: string; ordenes: string; f25: string }[] = [
  { nombre: "La Fuente Carrera", venta: "9,47", ordenes: "728", f25: "—" },
  { nombre: "Chicken Love You", venta: "8,66", ordenes: "839", f25: "10,33" },
  { nombre: "Hauromi Kai", venta: "7,83", ordenes: "555", f25: "—" },
  { nombre: "Mano Negra Sanguchería Marina", venta: "7,62", ordenes: "650", f25: "—" },
  { nombre: "Bestias Burger", venta: "7,47", ordenes: "703", f25: "7,69" },
  { nombre: "Mr Tex", venta: "7,37", ordenes: "641", f25: "13,68" },
  { nombre: "La Verità", venta: "6,86", ordenes: "984", f25: "5,38" },
  { nombre: "Uncle Fletch", venta: "6,83", ordenes: "540", f25: "6,66" },
  { nombre: "Marraqueta Rustik", venta: "6,73", ordenes: "490", f25: "7,15" },
  { nombre: "Jugosos", venta: "4,80", ordenes: "681", f25: "6,13" },
  { nombre: "Je Suis Raclette", venta: "4,26", ordenes: "386", f25: "—" },
  { nombre: "Yamm", venta: "4,25", ordenes: "622", f25: "3,73" },
  { nombre: "Catedral", venta: "3,99", ordenes: "350", f25: "2,07" },
  { nombre: "Rishtedar", venta: "3,73", ordenes: "333", f25: "5,51" },
  { nombre: "Barra de Pickles", venta: "3,48", ordenes: "387", f25: "—" },
  { nombre: "Savory", venta: "3,45", ordenes: "581", f25: "—" },
  { nombre: "Salvado Pan de Barrio (stand)", venta: "2,97", ordenes: "261", f25: "—" },
  { nombre: "Jollys", venta: "2,63", ordenes: "553", f25: "2,14" },
  { nombre: "Umami", venta: "2,44", ordenes: "229", f25: "5,13" },
  { nombre: "Casa Combi", venta: "2,36", ordenes: "296", f25: "4,44" },
  { nombre: "El Ancestral", venta: "2,30", ordenes: "221", f25: "—" },
  { nombre: "Marina Creps", venta: "2,28", ordenes: "264", f25: "—" },
  { nombre: "By Maria", venta: "2,24", ordenes: "190", f25: "2,25" },
  { nombre: "Pedro Castillo", venta: "1,91", ordenes: "211", f25: "—" },
  { nombre: "La Chica de Humo", venta: "1,91", ordenes: "144", f25: "2,37" },
  { nombre: "Te Cont", venta: "1,39", ordenes: "106", f25: "—" },
  { nombre: "Frutos del Maipo", venta: "1,37", ordenes: "305", f25: "—" },
  { nombre: "Nación Picante", venta: "1,35", ordenes: "130", f25: "1,72" },
  { nombre: "Rienda Suelta", venta: "1,27", ordenes: "81", f25: "5,70" },
  { nombre: "Fermentate Esta", venta: "1,17", ordenes: "120", f25: "—" },
  { nombre: "Sr Pecado", venta: "1,11", ordenes: "138", f25: "—" },
  { nombre: "Kraft", venta: "1,08", ordenes: "143", f25: "—" },
  { nombre: "Piel Canela", venta: "0,92", ordenes: "45", f25: "—" },
  { nombre: "Opi Otto", venta: "0,92", ordenes: "160", f25: "—" },
  { nombre: "Faunuts", venta: "0,83", ordenes: "121", f25: "1,00" },
  { nombre: "Castaño", venta: "0,70", ordenes: "225", f25: "—" },
  { nombre: "Salvado Pan de Barrio (mercadito)", venta: "0,64", ordenes: "113", f25: "—" },
  { nombre: "Miel de Campo", venta: "0,52", ordenes: "57", f25: "—" },
  { nombre: "La Sazonería", venta: "0,00", ordenes: "273", f25: "2,77" },
];

/* ── 8 · Montaje y desmontaje día a día (carta Gantt, plan 1240) ── */
export const MONTAJE: {
  dia: string;
  fecha: string;
  fase: "Montaje" | "Feria" | "Desmontaje";
  tareas: number;
  cerradas: number;
  hito: string;
  que: string;
}[] = [
  {
    dia: "Domingo",
    fecha: "8-nov",
    fase: "Montaje",
    tareas: 4,
    cerradas: 1,
    hito: "Venue recibido · 08:30",
    que: "Base de producción y cobertura médica de montaje (hasta el 12-nov).",
  },
  {
    dia: "Lunes",
    fecha: "9-nov",
    fase: "Montaje",
    tareas: 21,
    cerradas: 17,
    hito: "Implementación de sangucherías",
    que: "Marcaje de estructuras, escenario, Barra Corchete y General 2, acreditación, boletería, containers y arco de acceso. Parte la seguridad de montaje.",
  },
  {
    dia: "Martes",
    fecha: "10-nov",
    fase: "Montaje",
    tareas: 9,
    cerradas: 7,
    hito: "Llega el proveedor de energía",
    que: "Generadores, audio e iluminación, vallas perimetrales, baños generales y montaje de marcas.",
  },
  {
    dia: "Miércoles",
    fecha: "11-nov",
    fase: "Montaje",
    tareas: 16,
    cerradas: 12,
    hito: "Energía lista · 22:00",
    que: "Piso y mobiliario de sangucherías, carga de bebidas, baños, gráficas de barras y boletería. La prueba de sonido quedó sin cerrar.",
  },
  {
    dia: "Jueves",
    fecha: "12-nov",
    fase: "Montaje",
    tareas: 17,
    cerradas: 11,
    hito: "Autorización de apertura · 22:30",
    que: "Llegan los foodtrucks (10:30), internet, hidratación, aseo final y recorrido final. Cuatro hitos de «habilitado» sin marcar.",
  },
  {
    dia: "Viernes a domingo",
    fecha: "13 al 15-nov",
    fase: "Feria",
    tareas: 17,
    cerradas: 14,
    hito: "Apertura de puertas",
    que: "Shows, contenido infantil, bingo y seguridad del evento.",
  },
  {
    dia: "Domingo a lunes",
    fecha: "15 y 16-nov",
    fase: "Desmontaje",
    tareas: 6,
    cerradas: 0,
    hito: "Venue entregado · 16-nov 19:00",
    que: "Planificado en un día y medio. El 17-nov todavía se estaba terminando, y nada está marcado en la carta Gantt.",
  },
];
export const MONTAJE_RESUMEN = { tareas: 67, cerradas: 48 } as const;

/* ── 9 · La cuenta: resultado en Unabase ── */
/** FDS 24 = negocio 6848 (asignado el 8-nov-2024) + Lipton (6955) y «Ventas FDS» (6877). */
export const RESULTADO_ANTERIORES: { concepto: string; f24: string; f25: string; detalle?: string; total?: boolean }[] = [
  { concepto: "Ingresos del negocio GLO", f24: "$271,4 M", f25: "$283,3 M", detalle: "marcas y otros, cobro en el evento y ticketera" },
  { concepto: "− Gasto real", f24: "$301,5 M", f25: "$328,4 M" },
  { concepto: "= Resultado del negocio GLO", f24: "−$30,1 M", f25: "−$45,1 M", total: true },
  {
    concepto: "+ Negocios aparte",
    f24: "+$0,8 M",
    f25: "+$21,7 M",
    detalle: "2024: Lipton y «Ventas FDS». 2025: Copec Pay, Kross (2), Entel y «Ventas FDS 2025»",
  },
  { concepto: "= Resultado de la feria", f24: "−$29,3 M", f25: "−$23,4 M", total: true },
];

export const RESULTADO_F26 = {
  ventaPresupuestada: "$328,4 M",
  gastoPresupuestado: "$287,0 M",
  utilidadPresupuestada: "$41,5 M",
  gastoConOc: "$155,2 M",
  ticketsNeto: "$33,7 M",
} as const;


/* ── 10 · OC y respaldo ── */
export const OC: {
  categoria: string;
  presupuesto: string;
  emitido: string | null;
  pct: number | null;
  real25: string;
}[] = [
  { categoria: "Producción Site", presupuesto: "84,3", emitido: "71,4", pct: 85, real25: "94,4" },
  { categoria: "Operaciones", presupuesto: "70,9", emitido: "16,6", pct: 23, real25: "69,1" },
  { categoria: "Producción Técnica", presupuesto: "40,8", emitido: "41,9", pct: 103, real25: "37,3" },
  { categoria: "Venue", presupuesto: "28,0", emitido: null, pct: null, real25: "22,8" },
  { categoria: "Marketing", presupuesto: "21,0", emitido: "5,3", pct: 25, real25: "18,5" },
  { categoria: "Seguridad", presupuesto: "19,8", emitido: "11,5", pct: 58, real25: "24,6" },
  { categoria: "Permisos y autoridades", presupuesto: "12,4", emitido: "0,6", pct: 5, real25: "10,9" },
  { categoria: "Logística y bodega", presupuesto: "4,7", emitido: "0,4", pct: 9, real25: "10,1" },
  { categoria: "Contenidos y experiencias", presupuesto: "4,7", emitido: "3,6", pct: 78, real25: "10,8" },
  { categoria: "Artística", presupuesto: "0,5", emitido: "3,8", pct: 721, real25: "10,9" },
  { categoria: "Sueldos", presupuesto: "—", emitido: null, pct: null, real25: "17,2" },
  { categoria: "Marcas y patrocinios", presupuesto: "—", emitido: null, pct: null, real25: "7,8" },
];
export const OC_TOTAL = { presupuesto: "287,0", emitido: "155,2", pct: 54, nOc: 53, real25: "334,4" };
export const OC_ANTES = { pct: 52, monto: "$148,2 M", fds25: 41, meta: 95, respaldo: "$0,9 M", sinOc: "$131,8 M" } as const;


/* ── 11 · Acuerdos del 17-nov medidos en la FDS 26 ── */
export const ACUERDOS_MEDIDOS: { acuerdo: string; areas: string; estado: string; tone: Tone; texto: string }[] = [
  {
    acuerdo: "Layout presentado a las áreas 60 días antes",
    areas: "Producción Site",
    estado: "sin registro",
    tone: "neutral",
    texto:
      "El primer layout que quedó en glovox-produccion es la rev17, del 30-oct (14 días antes). Las versiones anteriores no quedaron registradas.",
  },
  {
    acuerdo: "Layout al 80% 7 días antes",
    areas: "Producción Site",
    estado: "cumple",
    tone: "success",
    texto: "La rev17 estaba arriba 14 días antes del primer día.",
  },
  {
    acuerdo: "Layout final subido el lunes siguiente",
    areas: "Producción Site",
    estado: "cumple",
    tone: "success",
    texto:
      "La «REV 3 modificación + agregados 15 nov» se subió el domingo 15-nov a las 18:18, con los cambios hechos durante la feria. Con ella se arma el mapa de ventas.",
  },
  {
    acuerdo: "Visita técnica un mes antes",
    areas: "Producción Técnica",
    estado: "sin fecha",
    tone: "neutral",
    texto: "La carta Gantt la tiene como hecha, con un rango del 29-sep al 13-nov: no dice qué día fue.",
  },
  {
    acuerdo: "Registrar incidencias de ambulancia",
    areas: "Seguridad",
    estado: "por partir",
    tone: "pending",
    texto: "No hay registro de las atenciones de la FDS 26. Cruz del Mar estuvo en el montaje y en el evento.",
  },
  {
    acuerdo: "Piloto de conteo de salida",
    areas: "Seguridad y Datos",
    estado: "por partir",
    tone: "pending",
    texto: "Solo se mide la entrada. En una feria de tres días donde la gente entra y sale, no se conoce cuánta gente hubo a la vez.",
  },
];

/* ── 12 · Para la FDS 27 ── */
export const PARA_FDS27: { titulo: string; areas: string; texto: string }[] = [
  {
    titulo: "Volver a abrir la venta 60 días antes o más",
    areas: "Dirección y Marketing",
    texto:
      "La FDS 25 abrió 74 días antes y la FDS 26, 45. Antes de 3 semanas la FDS 26 vendió más (1.609 personas contra 1.022), pero durante la feria compraron 3.097 contra 4.005.",
  },
  {
    titulo: "Revisar el precio por persona",
    areas: "Dirección y Ticketing",
    texto:
      "Pagaron 3% más personas, pero la venta bajó 19%: con el pack para 2 y la entrada de niños, cada persona pagó en promedio $5.668 (FDS 25: $7.175).",
  },
  {
    titulo: "Escanear a los niños o dejar de venderles entrada aparte",
    areas: "Ticketing y Seguridad",
    texto: "De 1.011 entradas de niños se escanearon 382; el viernes, 31 de 543. No se sabe cuántos niños entraron.",
  },
  {
    titulo: "Subir el gasto en barras",
    areas: "Operaciones",
    texto:
      "Las barras de Glovox vendieron $9.076 por persona (FDS 25: $10.140). Los expositores casi se mantuvieron: $18.522 contra $19.203.",
  },
];

export const PENDIENTES: { titulo: string; areas: string; texto: string }[] = [
  {
    titulo: "Base de la venta de sanguchería",
    areas: "Operaciones y Finanzas",
    texto:
      "El 17-nov se habló de $29,6 M, más hasta $1 M por el descuento de Copec Pay. Onfire registra $131,1 M de expositores en los tres días: falta confirmar qué mide esa cifra.",
  },
  {
    titulo: "Marcas en el onepager e ingresos en Unabase",
    areas: "Comercial y Finanzas",
    texto:
      "Comercial tiene las marcas cerradas en su planilla; el onepager no tiene ninguna y en Unabase no hay ingresos facturados. Sin eso no se puede cerrar el resultado.",
  },
  {
    titulo: "La barra que se cambió el sábado",
    areas: "Producción Site y Operaciones",
    texto: "Confirmar cuál fue y desde qué hora, para marcarla en el mapa de ventas.",
  },
  {
    titulo: "Desmontaje en la carta Gantt",
    areas: "Producción",
    texto:
      "Marcar cuándo terminó cada parte: estaba planificado hasta el 16-nov y el 17-nov seguía. También cerrar las 36 tareas vencidas.",
  },
  {
    titulo: "Respaldo de OC y venue",
    areas: "Finanzas y Producción",
    texto: "De $155,2 M en OC, $0,9 M tienen factura o boleta. El venue ($28,0 M en el presupuesto) no tiene OC.",
  },
  {
    titulo: "Entradas de niños del viernes",
    areas: "Ticketing",
    texto:
      "330 se compraron entre el 1 y el 22-oct en 156 órdenes, y casi ninguna se escaneó. Confirmar si fue una compra de grupo y si esas personas vinieron.",
  },
];

/* ── Anexo: notas por confirmar ── */
export const NOTAS_POR_CONFIRMAR: AreaConNotas[] = [
  {
    area: "Operaciones",
    notas: [
      {
        texto: "La Sazonería tiene 273 órdenes en Onfire por $0; en el reporte de Operaciones vendió $412.560 solo el viernes.",
        tag: { label: "revisar", tone: "pending" },
      },
      {
        texto: "El reporte de Operaciones separa NFC y Copec Pay por punto. Onfire, en BigQuery, no trae el medio de pago.",
        tag: { label: "dato aparte", tone: "neutral" },
      },
    ],
  },
  {
    area: "Ticketing y Comunidad",
    notas: [
      {
        texto: "Club Glovox pasó de 48 a 636 entradas (14%). En 2025 casi no había códigos de origen, así que no se puede comparar canal por canal.",
        tag: { label: "dato", tone: "info" },
      },
      { texto: "Boletería vendió 648 entradas (FDS 25: 766).", tag: { label: "dato", tone: "info" } },
    ],
  },
  {
    area: "Marketing",
    notas: [
      {
        texto: "La pauta de la FDS 25 solo tiene Meta medido (Google no se cargaba en 2025): la comparación de pauta es parcial.",
        tag: { label: "salvedad", tone: "neutral" },
      },
    ],
  },
  {
    area: "Producción",
    notas: [
      {
        texto: "La carta Gantt dice apertura de puertas a las 11:00 del viernes, pero el primer escaneo fue a las 17:03, igual que en la FDS 25.",
        tag: { label: "revisar", tone: "pending" },
      },
    ],
  },
];
