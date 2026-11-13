/**
 * Días de un evento de varias jornadas (FDS, Bocas Moradas, La Cava…) para el
 * filtro "Día" de /marketing/weekly. Cada ticket vale para un día: su
 * `FechaEvento`. Módulo puro (servidor y cliente); las pruebas están en
 * diasEvento.checks.ts (`npm run test:dias-evento`).
 */

/** Tickets vendidos del evento en un día de `FechaEvento` ("YYYY-MM-DD"). */
export type DiaEventoRow = { dia: string; tickets: number; personas: number };

/** Una jornada del evento tal como la ofrece el filtro. */
export type JornadaEvento = {
  /** "YYYY-MM-DD" de la jornada en el calendario vigente. */
  dia: string;
  /**
   * Fechas de `FechaEvento` que caen en esta jornada: la misma `dia`, más la
   * fecha original de los tickets vendidos antes de un reagendamiento.
   */
  originales: string[];
  tickets: number;
  personas: number;
};

/** Lo que reciben las queries cuando hay un día elegido. */
export type FiltroDia = {
  /** Fechas de `FechaEvento` del evento principal (las `originales`). */
  dias: string[];
  /** Día de la semana de la jornada en BigQuery: 1 = domingo … 7 = sábado. */
  diaSemana: number;
};

// Un día cuenta como jornada si tiene al menos 10 tickets y el 1% de los del
// evento. Deja fuera tickets sueltos con otra fecha (Sundeck Apache PE: 2 de 192
// el día anterior) sin perder el viernes chico de una FDS (FDS 24: 365 de 7.789).
const MIN_TICKETS = 10;
const MIN_PARTE = 0.01;

const DIA_MS = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const diaSemana = (d: string) => new Date(ms(d)).getUTCDay(); // 0 = domingo

/**
 * Jornada vigente de cada fecha. Si el evento se reagendó, los tickets vendidos
 * antes conservan la fecha original (La Cava 2026: 6–8 nov → 11–13 dic): cada
 * fecha va al día de la última semana del evento con su mismo día de la semana,
 * como en /lacava. Solo se aplica si TODAS las fechas caen así en un día de esa
 * semana que tiene tickets propios; si no, el evento no es un reagendamiento
 * (dos funciones separadas, una temporada de Piknic) y cada fecha queda igual.
 */
function mapaReagendamiento(dias: string[]): Map<string, string> {
  const identidad = new Map(dias.map((d) => [d, d]));
  if (dias.length < 2) return identidad;
  const ultimo = ms(dias[dias.length - 1]);
  if (ultimo - ms(dias[0]) <= 6 * DIA_MS) return identidad;
  const semanaFinal = new Set(dias.filter((d) => ultimo - ms(d) <= 6 * DIA_MS));
  const mapa = new Map<string, string>();
  for (const d of dias) {
    const atras = (new Date(ultimo).getUTCDay() - diaSemana(d) + 7) % 7;
    const vigente = iso(ultimo - atras * DIA_MS);
    if (!semanaFinal.has(vigente)) return identidad;
    mapa.set(d, vigente);
  }
  return mapa;
}

/**
 * Jornadas del evento, en orden. Vacío si tiene menos de dos: en un evento de
 * un día el filtro no aparece.
 */
export function jornadasDelEvento(rows: DiaEventoRow[]): JornadaEvento[] {
  const filas = rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.dia)).sort((a, b) => a.dia.localeCompare(b.dia));
  const mapa = mapaReagendamiento(filas.map((r) => r.dia));

  const porDia = new Map<string, JornadaEvento>();
  for (const r of filas) {
    const dia = mapa.get(r.dia) ?? r.dia;
    const j = porDia.get(dia) ?? { dia, originales: [], tickets: 0, personas: 0 };
    j.originales.push(r.dia);
    j.tickets += r.tickets;
    j.personas += r.personas;
    porDia.set(dia, j);
  }

  const total = filas.reduce((s, r) => s + r.tickets, 0);
  const minimo = Math.max(MIN_TICKETS, total * MIN_PARTE);
  const jornadas = [...porDia.values()]
    .filter((j) => j.tickets >= minimo)
    .sort((a, b) => a.dia.localeCompare(b.dia));
  return jornadas.length >= 2 ? jornadas : [];
}

/** La jornada que pide `?dia=`, o null si no es una del evento (o no hay). */
export function jornadaElegida(jornadas: JornadaEvento[], param: string | undefined): JornadaEvento | null {
  if (!param) return null;
  return jornadas.find((j) => j.dia === param) ?? null;
}

export function filtroDeJornada(j: JornadaEvento): FiltroDia {
  return { dias: j.originales, diaSemana: diaSemana(j.dia) + 1 };
}

// Nombres fijos en vez de Intl: se renderizan en el servidor y se hidratan en el
// navegador, y el ICU de Safari abrevia distinto que el de Node.
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/** "sáb 14 nov". */
export function etiquetaDia(dia: string): string {
  const f = new Date(ms(dia));
  return `${DIAS_CORTOS[f.getUTCDay()]} ${f.getUTCDate()} ${MESES[f.getUTCMonth()]}`;
}

/** "sábado": para "solo sus entradas de sábado". */
export function nombreDiaSemana(dia: string): string {
  return DIAS_LARGOS[diaSemana(dia)];
}
