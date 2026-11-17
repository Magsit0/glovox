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

export const META = {
  evento: "Feria del Sánguche 2026",
  eventoId: "GLO213",
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
}[] = [
  {
    punto: "Salida a la venta",
    area: "Dirección y Marketing",
    plazo: "ideal 60 días antes · mínimo 30",
    quePaso: "Abrió el 29-sep, 45 días antes. La FDS 25 abrió el 8-sep, 74 días antes.",
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
    punto: "Costo de pauta por comprador",
    area: "Marketing",
    plazo: "umbral por definir",
    quePaso:
      "US$10.095 en Meta y Google y 6.974 personas que pagaron: US$1,45 por persona. FDS 25: US$1,08, pero solo con Meta medido.",
    estado: "por definir",
    tone: "neutral",
  },
  {
    punto: "Carta Gantt al día",
    area: "Producción",
    plazo: "3 días después · 18-nov",
    quePaso:
      "122 tareas, 84 cerradas y 36 vencidas sin cerrar. La última edición es del domingo 15-nov; el desmontaje no tiene nada marcado.",
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
];

/* ── 3 · Anticipación (días antes del primer día). Lo normal = la FDS 25. ── */
export const HITOS: HitoPlazo[] = [
  {
    hito: "Salida a la venta",
    area: "Dirección y Marketing",
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

export const CMP_RESULTADO: { indicador: string; f25: string; f26: string; cambio: Cambio }[] = [
  { indicador: "Personas que entraron", f25: "7.713", f26: "7.080", cambio: { texto: "−8%", tone: "bad" } },
  { indicador: "Personas que pagaron entrada", f25: "6.774", f26: "6.974", cambio: { texto: "+3%", tone: "good" } },
  { indicador: "Cortesías emitidas", f25: "2.221", f26: "1.658", cambio: { texto: "−25%", tone: "eq" } },
  { indicador: "Venta de tickets (bruta)", f25: "$48,6 M", f26: "$39,5 M", cambio: { texto: "−19%", tone: "bad" } },
  { indicador: "Venta por persona que pagó", f25: "$7.175", f26: "$5.668", cambio: { texto: "−21%", tone: "bad" } },
  { indicador: "Vendido en Onfire", f25: "$227,8 M", f26: "$202,2 M", cambio: { texto: "−11%", tone: "bad" } },
  { indicador: "Onfire por persona que entró", f25: "$29.532", f26: "$28.559", cambio: { texto: "−3%", tone: "eq" } },
  { indicador: "Pauta digital", f25: "US$7.336", f26: "US$10.095", cambio: { texto: "+38%", tone: "eq" } },
  { indicador: "Salida a la venta (días antes)", f25: "74", f26: "45", cambio: { texto: "−29", tone: "bad" } },
];

/** Personas con entrada pagada según cuántos días antes de SU día compraron. */
export const TRAMOS_VENTA: {
  evento: string;
  tramos: { antes: number; semanas1a3: number; ultimaSemana: number; dia: number };
  total: string;
}[] = [
  { evento: "FDS 25", tramos: { antes: 1022, semanas1a3: 844, ultimaSemana: 1736, dia: 3172 }, total: "6.774" },
  { evento: "FDS 26", tramos: { antes: 1609, semanas1a3: 1121, ultimaSemana: 1696, dia: 2548 }, total: "6.974" },
];

/** Por día de la feria: FDS 25 → FDS 26. Onfire por día de venta. */
export const POR_DIA: {
  dia: string;
  pagaron: [string, string];
  entraron: [string, string];
  onfire: [string, string];
}[] = [
  { dia: "Viernes", pagaron: ["485", "1.210"], entraron: ["562", "671"], onfire: ["$39,1 M", "$34,8 M"] },
  { dia: "Sábado", pagaron: ["3.545", "3.645"], entraron: ["3.858", "3.623"], onfire: ["$103,0 M", "$96,4 M"] },
  { dia: "Domingo", pagaron: ["2.744", "2.119"], entraron: ["3.293", "2.786"], onfire: ["$85,7 M", "$71,0 M"] },
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

/* ── 6 · Ingreso por hora: personas escaneadas por hora, sábado y domingo ── */
export const INGRESO_HORA: { hora: string; sab26: number; sab25: number; dom26: number; dom25: number }[] = [
  { hora: "11", sab26: 43, sab25: 79, dom26: 63, dom25: 102 },
  { hora: "12", sab26: 198, sab25: 270, dom26: 200, dom25: 284 },
  { hora: "13", sab26: 426, sab25: 537, dom26: 544, dom25: 639 },
  { hora: "14", sab26: 742, sab25: 581, dom26: 694, dom25: 710 },
  { hora: "15", sab26: 652, sab25: 604, dom26: 525, dom25: 600 },
  { hora: "16", sab26: 380, sab25: 500, dom26: 314, dom25: 333 },
  { hora: "17", sab26: 334, sab25: 454, dom26: 213, dom25: 244 },
  { hora: "18", sab26: 335, sab25: 371, dom26: 106, dom25: 164 },
  { hora: "19", sab26: 320, sab25: 312, dom26: 79, dom25: 136 },
  { hora: "20", sab26: 232, sab25: 118, dom26: 14, dom25: 63 },
  { hora: "21", sab26: 49, sab25: 22, dom26: 2, dom25: 26 },
];
export const INGRESO_RESUMEN = {
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
  f25: string;
  f26: string;
  porPersona25: string;
  porPersona26: string;
  cambio: Cambio;
}[] = [
  {
    grupo: "Expositores",
    que: "sangucherías, foodtrucks, postres, café, jugos y mercadito",
    f25: "$148,1 M",
    f26: "$131,1 M",
    porPersona25: "$19.203",
    porPersona26: "$18.522",
    cambio: { texto: "−11%", tone: "bad" },
  },
  {
    grupo: "Barras de Glovox",
    que: "FDS 26: Corchete, Cervezera, Escenario, Bosque y Zona Niños",
    f25: "$78,2 M",
    f26: "$64,3 M",
    porPersona25: "$10.140",
    porPersona26: "$9.076",
    cambio: { texto: "−18%", tone: "bad" },
  },
  {
    grupo: "Juegos",
    que: "bingo, botes en la laguna y Entretenciones Krusty",
    f25: "$1,5 M",
    f26: "$6,8 M",
    porPersona25: "$188",
    porPersona26: "$960",
    cambio: { texto: "+369%", tone: "good" },
  },
];
export const ONFIRE_TOTAL = { f25: "$227,8 M", f26: "$202,2 M", porPersona25: "$29.532", porPersona26: "$28.559" };

/** Barras de Glovox en la FDS 26 (Onfire bruto, tres días). */
export const BARRAS: { barra: string; venta: string; pct: string }[] = [
  { barra: "Barra Corchete", venta: "$22,6 M", pct: "35%" },
  { barra: "Barra Cervezera", venta: "$18,5 M", pct: "29%" },
  { barra: "Barra Escenario", venta: "$10,8 M", pct: "17%" },
  { barra: "Barra Bosque", venta: "$7,7 M", pct: "12%" },
  { barra: "Barra Zona Niños", venta: "$4,7 M", pct: "7%" },
];

/** Los 10 expositores que más vendieron en la FDS 26, con su puesto en la FDS 25. */
export const RANKING: { n: number; nombre: string; venta: string; ticket: string; f25: string }[] = [
  { n: 1, nombre: "La Fuente Carrera", venta: "$9,5 M", ticket: "$13.013", f25: "nuevo" },
  { n: 2, nombre: "Chicken Love You", venta: "$8,7 M", ticket: "$10.323", f25: "#2 · $10,3 M" },
  { n: 3, nombre: "Hauromi Kai", venta: "$7,8 M", ticket: "$14.104", f25: "nuevo" },
  { n: 4, nombre: "Mano Negra Sanguchería Marina", venta: "$7,6 M", ticket: "$11.716", f25: "nuevo" },
  { n: 5, nombre: "Bestias Burger", venta: "$7,5 M", ticket: "$10.631", f25: "#4 · $7,7 M" },
  { n: 6, nombre: "Mr Tex", venta: "$7,4 M", ticket: "$11.504", f25: "#1 · $13,7 M" },
  { n: 7, nombre: "La Verità", venta: "$6,9 M", ticket: "$6.970", f25: "#14 · $5,4 M" },
  { n: 8, nombre: "Uncle Fletch", venta: "$6,8 M", ticket: "$12.641", f25: "#9 · $6,7 M" },
  { n: 9, nombre: "Marraqueta Rustik", venta: "$6,7 M", ticket: "$13.738", f25: "#6 · $7,2 M" },
  { n: 10, nombre: "Jugosos", venta: "$4,8 M", ticket: "$7.045", f25: "#11 · $6,1 M" },
];
export const RANKING_RESUMEN = {
  puntos26: 39,
  puntos25: 33,
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
export const RESULTADO_F25: { concepto: string; monto: string; detalle?: string; total?: boolean }[] = [
  { concepto: "Ingresos del negocio GLO181", monto: "$283,3 M", detalle: "facturado $261,0 M: marcas y otros $163,6 M · cobro en el evento $59,3 M · ticketera $38,1 M" },
  { concepto: "− Gasto real", monto: "$328,4 M" },
  { concepto: "= Resultado del negocio GLO181", monto: "−$45,1 M", total: true },
  {
    concepto: "+ Negocios aparte",
    monto: "+$21,7 M",
    detalle: "utilidad de Copec Pay, Kross (2), Entel y «Ventas FDS 2025», con su propio número en Unabase",
  },
  { concepto: "= Resultado de la FDS 25", monto: "−$23,4 M", total: true },
];

export const RESULTADO_F26 = {
  ventaPresupuestada: "$328,4 M",
  gastoPresupuestado: "$287,0 M",
  utilidadPresupuestada: "$41,5 M",
  gastoConOc: "$155,2 M",
  marcasCerradas: "$83,0 M",
  ticketsNeto: "$33,7 M",
} as const;

/** Marcas cerradas según la planilla de Comercial (no están en el onepager). */
export const MARCAS: { marca: string; valor: string; categoria: string }[] = [
  { marca: "Copec Pay", valor: "$25,0 M", categoria: "presenta" },
  { marca: "Pepsi", valor: "$19,0 M", categoria: "invita" },
  { marca: "Caja Los Andes", valor: "$15,0 M", categoria: "invita · uso de la laguna" },
  { marca: "Estrella + Tübinger", valor: "$10,0 M", categoria: "invita" },
  { marca: "Lay's", valor: "$8,0 M", categoria: "invita" },
  { marca: "Heinz / Kraft", valor: "$6,0 M", categoria: "invita · acuerdo por $2,0 M" },
];

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
      "La planilla de Comercial suma $83,0 M en marcas cerradas; el onepager no tiene ninguna y en Unabase no hay ingresos facturados. Sin eso no se puede cerrar el resultado.",
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
