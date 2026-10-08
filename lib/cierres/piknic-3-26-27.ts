/**
 * Contenido de la presentación de cierre del Piknic 3 · temporada 26-27
 * (GLO211, sábado 3-oct-2026), reunión del 8-oct-2026.
 *
 * Datos ESTÁTICOS: es la foto al 8-oct (D+5) que se presentó en la reunión, no
 * una consulta viva. Se transcribieron tal cual de CIERRE-PIKNIC-3.html, versión de 13 láminas (las
 * cifras ya vienen redondeadas y formateadas como se mostraron; los % de avance
 * de OC se guardan tal cual porque salen de montos sin redondear). Fuentes
 * originales de cada tabla: glovox.tickets, Unabase (marts.finanzas_*), Onfire
 * (onfire.soldItems), onepager y glovox-produccion — ver el pie de cada lámina.
 */

import type { Tone } from "@/components/cierres/deck/primitives";

export const META = {
  evento: "Piknic 3 · 26-27",
  eventoId: "GLO211",
  fechaReunion: "8-oct-2026",
  pdfFilename: "Cierre Piknic 3 · 26-27 (reunión 8-oct-2026)",
} as const;

/* ── 1 · Portada ── */
export const PORTADA_FACTS: { value: string; caption: string; tone?: "warn" }[] = [
  { value: "3.037", caption: "personas entraron" },
  {
    value: "2.060",
    caption:
      "personas pagaron: 1.808 su entrada del Piknic 3 y 252 con pase de temporada",
  },
  { value: "$57,5 M", caption: "vendido en barras · $18.941 por persona" },
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
    plazo: "D−60 · 4-ago",
    quePaso:
      "Abrió el 15-sep, 18 días antes. El mismo Piknic del año pasado abrió 52 días antes.",
    estado: "tarde",
    tone: "error",
  },
  {
    punto: "Negocio en Unabase",
    area: "Producción y Finanzas",
    plazo: "D−30 · 3-sep",
    quePaso:
      "Se creó el 25-sep, 8 días antes. Sin negocio no se pueden emitir órdenes de compra.",
    estado: "tarde",
    tone: "error",
  },
  {
    punto: "Permisos ingresados",
    area: "Permisos y Legal",
    plazo: "M−3 · 5-jul",
    quePaso:
      "No hay registro del ingreso. En Unabase solo aparecen el TE1 y la directiva, pagados 8 días antes.",
    estado: "sin dato",
    tone: "neutral",
  },
  {
    punto: "Pauta contra venta",
    area: "Marketing",
    plazo: "umbral por definir",
    quePaso:
      "US$3,1 de pauta por persona que compró. Es la primera medición: sirve para fijar el umbral junto con Marketing.",
    estado: "por definir",
    tone: "neutral",
  },
  {
    punto: "Plan de producción al día",
    area: "Producción",
    plazo: "D+3 · 6-oct",
    quePaso:
      "El plan empezó el 21-sep, 12 días antes del evento. Hoy tiene 10 de 92 tareas vencidas sin cerrar.",
    estado: "abierto",
    tone: "error",
  },
  {
    punto: "Cierre de datos",
    area: "Finanzas y Datos",
    plazo: "D+3 · 6-oct",
    quePaso:
      "Onfire llegó en D+2. Al cierre semanal hubo que recalcularlo a mano. Marcas y mesas VIP siguen sin cargar.",
    estado: "incompleto",
    tone: "error",
  },
];

/* ── 4 · Anticipación ── */
/** Escala de las barras (días) y marca del plazo propuesto por columna. */
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
  { evento: "Piknic 3 26-27", fecha: "3-oct-26", pagadas: "1.853", lanzamiento: 18, negocio: 8, permisos: 8, actual: true },
];

/* ── 6 · Venta y público ── */
export const CANALES: { canal: string; entradas: string; pct: string; venta: string }[] = [
  { canal: "Sin código de origen", entradas: "1.039", pct: "56%", venta: "34,3" },
  { canal: "Linktree", entradas: "351", pct: "19%", venta: "11,9" },
  { canal: "Club Glovox (referidos)", entradas: "196", pct: "11%", venta: "6,1" },
  { canal: "Boletería", entradas: "84", pct: "5%", venta: "3,1" },
  { canal: "Meta (pagado)", entradas: "82", pct: "4%", venta: "2,6" },
  { canal: "Google Ads (pagado)", entradas: "68", pct: "4%", venta: "2,4" },
  { canal: "Email (Drip)", entradas: "24", pct: "1%", venta: "0,7" },
  { canal: "Otro orgánico", entradas: "9", pct: "0%", venta: "0,3" },
];
export const CANALES_TOTAL = { entradas: "1.853", pct: "100%", venta: "61,3" };

export const INGRESOS: { tipo: string; personas: string; nota?: string }[] = [
  { tipo: "Con entrada pagada", personas: "1.709", nota: "95% de los que compraron" },
  { tipo: "Invitaciones", personas: "649" },
  { tipo: "Mesas VIP", personas: "425", nota: "venta que va por carga manual" },
  { tipo: "Pase de temporada", personas: "177", nota: "de 252 pases (GLO205)" },
  { tipo: "Pilates", personas: "77" },
];
export const INGRESOS_TOTAL = { personas: "3.037", nota: "Piknic 1: 3.113" };

/* ── 3 · Permisos ── */
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
    plazo: "5-jul",
    plazoDetalle: "D−90 · M−3",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Permiso transitorio de alcoholes",
    anteQuien: "Municipalidad",
    plazo: "4-sep",
    plazoDetalle: "20 días hábiles",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Predictivo de sonido (DS 38)",
    anteQuien: "Parque",
    plazo: "11-sep",
    plazoDetalle: "10 háb. antes del montaje",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "TE1, declaración eléctrica",
    anteQuien: "SEC",
    plazo: "15-sep",
    plazoDetalle: "D−18",
    registro: { estado: "pagado 25-sep", tone: "success", extra: "$350.000" },
  },
  {
    tramite: "Directiva de funcionamiento",
    anteQuien: "Seguridad",
    plazo: "15-sep",
    plazoDetalle: "D−18",
    registro: { estado: "pagado 25-sep", tone: "success", extra: "$250.000" },
  },
  {
    tramite: "Plan de emergencia",
    anteQuien: "Prevencionista",
    plazo: "antes del ingreso",
    plazoDetalle: "",
    registro: { texto: "D−8, según el mapa de procesos" },
  },
  {
    tramite: "Garantía 170 UF y póliza RC ≥3.000 UF",
    anteQuien: "Parque",
    plazo: "28-sep",
    plazoDetalle: "montaje, D−5",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Resolución SEREMI y conformidad de evento masivo",
    anteQuien: "SEREMI y Delegación",
    plazo: "1 y 2-oct",
    plazoDetalle: "D−2 y D−1",
    registro: { estado: "sin registro", tone: "neutral" },
  },
  {
    tramite: "Informe de ruido (ETFA)",
    destacado: true,
    anteQuien: "Parque",
    plazo: "16-nov",
    plazoDetalle: "≤30 días hábiles después",
    registro: { estado: "pendiente", tone: "pending" },
  },
];

/* ── 7 · Mapa de ventas ──
 * La imagen (components/cierres/piknic-3-26-27/mapa-ventas.jpg, 2200×1215) es la
 * captura del mapa de globos que venía embebida en el HTML: venta Onfire por punto
 * dibujada sobre el layout REV6 del 28-sep. */
export const MAPA_ALT =
  "Mapa del Parque Ciudad Empresarial con un globo por punto de venta: Barra Glovox $21,8 M (38%), Barra VIP $9,2 M, Barra 360 CDGA $8,7 M, Barra Entel $5,1 M, Mistral $3,7 M, Heineken $2,6 M, Red Bull $1,8 M, JW VIP $1,3 M, Pi Pay $0,9 M; asistentes por zona: General 2.212, VIP 424, VIP mesa 425.";

/* ── 8 · Barras ── */
export const BARRAS_TOP: {
  sector: string;
  tragos: string;
  top: { nombre: string; detalle: string }[];
}[] = [
  {
    sector: "Total",
    tragos: "6.989 tragos",
    top: [
      { nombre: "Tropical Gin", detalle: "1.413 · 20% · $13,0 M" },
      { nombre: "Mistral 35° + bebida", detalle: "1.349 · 19% · $9,4 M" },
      { nombre: "Mistral Cristalino 40° + bebida", detalle: "660 · 9% · $4,4 M" },
    ],
  },
  {
    sector: "General",
    tragos: "5.756 tragos",
    top: [
      { nombre: "Tropical Gin", detalle: "1.122" },
      { nombre: "Mistral 35° + bebida", detalle: "1.059" },
      { nombre: "Mistral Cristalino 40° + bebida", detalle: "614" },
    ],
  },
  {
    sector: "VIP",
    tragos: "1.203 tragos",
    top: [
      { nombre: "Tropical Gin", detalle: "289" },
      { nombre: "Mistral 35° + bebida", detalle: "288" },
      { nombre: "Heineken Silver 470cc", detalle: "71" },
    ],
  },
  {
    sector: "Mesa VIP",
    tragos: "30 tragos",
    top: [
      { nombre: "Moscow Mule", detalle: "5" },
      { nombre: "Shot Don Julio", detalle: "5" },
      { nombre: "Spritz", detalle: "4" },
    ],
  },
];

/* ── 9 · Resultado ── */
export const INGRESOS_CARGA: { estado: string; tone: Tone; texto: string }[] = [
  { estado: "cargado", tone: "success", texto: "Tickets: $61,3 M bruto, desde la ticketera." },
  {
    estado: "cargado",
    tone: "success",
    texto:
      "Barras: $57,5 M bruto, desde Onfire. El cierre semanal se recalculó a mano después del lunes.",
  },
  {
    estado: "falta",
    tone: "error",
    texto:
      "Marcas: el onepager dice $0. En Unabase hay $23,1 M de venta en 4 negocios de marca (Heinz, Heinz VIP, Entel vasos y pulseras) que no llevan «GLO211» en la referencia, así que no suman al evento.",
  },
  {
    estado: "falta",
    tone: "error",
    texto: "Mesas VIP: el onepager dice $0, con 425 personas que entraron con mesa.",
  },
  {
    estado: "revisar",
    tone: "pending",
    texto:
      "Pase de temporada: 252 pases vendidos por $22,2 M (GLO205) para toda la temporada. Hoy no se reparte entre los Piknic, así que el Piknic 3 no recibe nada de ese ingreso.",
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
  /** % de avance tal cual se presentó (sale de montos sin redondear). */
  pct: number | null;
}[] = [
  { categoria: "Operaciones", presupuesto: "52,6", emitido: "11,7", nOc: 21, pct: 22 },
  { categoria: "Producción técnica", presupuesto: "27,8", emitido: "28,8", nOc: 8, pct: 104 },
  { categoria: "Producción site", presupuesto: "26,6", emitido: "27,0", nOc: 14, pct: 101 },
  { categoria: "Artística", presupuesto: "18,7", emitido: "2,1", nOc: 6, pct: 11 },
  { categoria: "Seguridad", presupuesto: "15,0", emitido: "8,2", nOc: 3, pct: 55 },
  { categoria: "Logística y bodega", presupuesto: "14,2", emitido: "12,0", nOc: 7, pct: 84 },
  { categoria: "Marketing", presupuesto: "5,6", emitido: "2,2", nOc: 1, pct: 39 },
  { categoria: "Permisos y autoridades", presupuesto: "5,4", emitido: "0,6", nOc: 2, pct: 11 },
  { categoria: "Venue", presupuesto: "5,0", emitido: null, nOc: 0, pct: null },
  { categoria: "Sueldos", presupuesto: "3,0", emitido: null, nOc: 0, pct: null },
  { categoria: "Contenidos y experiencias", presupuesto: "0,4", emitido: "0,6", nOc: 3, pct: 132 },
  { categoria: "Sostenibilidad", presupuesto: "0,2", emitido: "0,1", nOc: 1, pct: 89 },
];
export const OC_TOTAL = { presupuesto: "174,3", emitido: "93,2", nOc: 63, pct: 53 };

/* ── 5 · Comparación con Piknic 1 ── */
type Cambio = { texto: string; tone: "good" | "bad" | "eq" };

export const CMP_RESULTADO: { indicador: string; p1: string; p3: string; cambio: Cambio }[] = [
  { indicador: "Personas que entraron", p1: "3.113", p3: "3.037", cambio: { texto: "−2%", tone: "bad" } },
  { indicador: "Personas que compraron", p1: "1.983", p3: "1.808", cambio: { texto: "−9%", tone: "bad" } },
  { indicador: "Venta de tickets (bruta)", p1: "$67,0 M", p3: "$61,3 M", cambio: { texto: "−8%", tone: "bad" } },
  { indicador: "Venta por persona que compró", p1: "$33.774", p3: "$33.914", cambio: { texto: "=", tone: "eq" } },
  { indicador: "Vendido en barras", p1: "$53,2 M", p3: "$57,5 M", cambio: { texto: "+8%", tone: "good" } },
  { indicador: "Barras por persona", p1: "$17.098", p3: "$18.941", cambio: { texto: "+11%", tone: "good" } },
  { indicador: "Pauta", p1: "US$4.502", p3: "US$5.525", cambio: { texto: "+23%", tone: "eq" } },
  { indicador: "Trago más vendido", p1: "Tropical Gin · 1.335", p3: "Tropical Gin · 1.413", cambio: { texto: "=", tone: "eq" } },
];

export const CMP_CONTROL: { punto: string; p1: string; p3: Cambio }[] = [
  { punto: "Salida a la venta", p1: "D−52", p3: { texto: "D−18", tone: "bad" } },
  { punto: "Negocio en Unabase", p1: "D−4", p3: { texto: "D−8", tone: "eq" } },
  { punto: "Primer pago de permisos", p1: "D−3", p3: { texto: "D−8", tone: "eq" } },
  { punto: "Plan de producción desde", p1: "D−49", p3: { texto: "D−12", tone: "bad" } },
  { punto: "Tareas vencidas sin cerrar", p1: "14 de 85", p3: { texto: "10 de 92", tone: "eq" } },
  { punto: "Marcas en el onepager", p1: "$34,6 M", p3: { texto: "$0", tone: "bad" } },
  { punto: "Mesas VIP en el onepager", p1: "$8,8 M", p3: { texto: "$0", tone: "bad" } },
  { punto: "Gasto documentado", p1: "74% · D+26", p3: { texto: "53% · D+5", tone: "eq" } },
];

/* ── 11 · Cómo se monitorea ── */
/** En `cuando`, los offsets al Día D (D−60, M−3, D+3…) se destacan al renderizar. */
export const MONITOREO: {
  punto: string;
  cuando: string;
  aQuien: string;
  fuente: string;
  estado: string;
  tone: Tone;
}[] = [
  {
    punto: "Salida a la venta",
    cuando: "D−60 sin venta; ámbar desde D−75",
    aQuien: "Marketing y Ticketing",
    fuente: "Ticketera (vista diaria de venta)",
    estado: "dato listo",
    tone: "success",
  },
  {
    punto: "Negocio en Unabase",
    cuando: "D−30 sin negocio; ámbar desde D−45",
    aQuien: "Producción y Finanzas",
    fuente: "Unabase",
    estado: "dato listo",
    tone: "success",
  },
  {
    punto: "Permisos ingresados",
    cuando:
      "M−3 sin «trámites iniciados»; después, cada hito (municipal, predictivo, TE1, SEREMI)",
    aQuien: "Permisos y Legal, Producción",
    fuente: "No existe: se declara como fecha clave en glovox-produccion",
    estado: "falta registrar",
    tone: "pending",
  },
  {
    punto: "Pauta contra venta",
    cuando: "Pauta activa y costo por persona que compró sobre el umbral acordado",
    aQuien: "Marketing",
    fuente: "Paid media y ticketera",
    estado: "dato listo",
    tone: "success",
  },
  {
    punto: "Plan de producción al día",
    cuando: "Tareas vencidas sin marcar entre D−5 y D+3",
    aQuien: "Producción",
    fuente: "glovox-produccion",
    estado: "construido, falta canal",
    tone: "success",
  },
  {
    punto: "Cierre de datos",
    cuando:
      "D+3: Onfire cargado, marcas y mesas VIP cargadas, negocios de marca con el GLO",
    aQuien: "Finanzas y Datos",
    fuente: "Onfire, onepager y Unabase",
    estado: "dato listo",
    tone: "success",
  },
];

/* ── 12 · Acuerdos ── */
export const ACUERDOS: { titulo: string; texto: string }[] = [
  {
    titulo: "Cargar marcas y mesas VIP",
    texto:
      "En el onepager, y poner «GLO211» en los 4 negocios de marca de Unabase para que sumen al evento.",
  },
  {
    titulo: "Facturas que faltan",
    texto:
      "Operaciones ($41,0 M por documentar), Artística ($16,5 M), Venue y Sueldos. ¿Quién las persigue y para cuándo?",
  },
  {
    titulo: "Cerrar el plan",
    texto:
      "Las 10 tareas vencidas sin cerrar: marcar las que se hicieron y anotar por qué no las otras.",
  },
  {
    titulo: "Informe de ruido al parque",
    texto: "Vence el 16-nov. ¿Quién lo pide a la ETFA y lo entrega?",
  },
  {
    titulo: "Dueños y umbrales",
    texto: "Un nombre por punto de control y validar D−60, D−30 y M−3.",
  },
  {
    titulo: "Canal del aviso",
    texto:
      "¿Un canal nuevo de alertas o cada #proy-<evento>? ¿A qué hora sale? Propuesta: 09:00.",
  },
];

/* ── 13 · Observaciones por área ── */
export const AREAS = [
  "Dirección",
  "Comercial y Marcas",
  "Programación Artística",
  "Marketing",
  "Ticketing y Comunidad",
  "Permisos y Legal",
  "Producción",
  "Operaciones",
  "Finanzas",
  "Datos y Tecnología",
] as const;
