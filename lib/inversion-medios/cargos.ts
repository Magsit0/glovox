/**
 * Cargos extra (CARDDA) — módulo CLIENT-SAFE (sin imports de servidor). Tipos y
 * normalización de la frecuencia de pago a costo MENSUAL y SEMANAL, para el
 * resumen que dice cuánto presupuestar. Lo comparten actions (server), la query
 * y el componente (cliente).
 */

export const METODOS_CARGO = ["anual", "mensual", "semanal", "diario"] as const;
export type MetodoCargo = (typeof METODOS_CARGO)[number];

export const METODO_LABEL: Record<MetodoCargo, string> = {
  anual: "Anual",
  mensual: "Mensual",
  semanal: "Semanal",
  diario: "Diario",
};

// Cuántos "pagos" caen en un mes / una semana promedio, por método.
const FACTOR_MENSUAL: Record<MetodoCargo, number> = {
  anual: 1 / 12,
  mensual: 1,
  semanal: 52 / 12,
  diario: 365 / 12,
};
const FACTOR_SEMANAL: Record<MetodoCargo, number> = {
  anual: 1 / 52,
  mensual: 12 / 52,
  semanal: 1,
  diario: 7,
};

type CargoLike = { montoUsd: number; metodo: string };

/** Costo normalizado a un mes promedio (USD). */
export function costoMensual(c: CargoLike): number {
  return c.montoUsd * (FACTOR_MENSUAL[c.metodo as MetodoCargo] ?? 0);
}
/** Costo normalizado a una semana promedio (USD). */
export function costoSemanal(c: CargoLike): number {
  return c.montoUsd * (FACTOR_SEMANAL[c.metodo as MetodoCargo] ?? 0);
}

/** Totales normalizados del set de cargos. */
export function resumenCargos(cargos: CargoLike[]): { mensual: number; semanal: number } {
  return {
    mensual: cargos.reduce((a, c) => a + costoMensual(c), 0),
    semanal: cargos.reduce((a, c) => a + costoSemanal(c), 0),
  };
}

// ---------- Fechas de cobro (toggle "sumar cargos extra") ----------
// `diaPago` es texto libre. Para ubicar el cobro en el calendario se reconoce:
//  - mensual: "15" → el 15 de cada mes; "30"/"31" o "último"/"fin de mes" → el
//    último día del mes si el mes es más corto (DRIP "30" cae el 28 de febrero);
//  - anual: "15/03", "15-03" o "15 de marzo";
//  - semanal: el nombre del día ("lunes");
//  - diario: todos los días (el día de pago no importa).
// Lo que no se reconoce NO se suma: se lista aparte para que se corrija.

type CargoConDia = CargoLike & { proveedor: string; diaPago: string | null };

const MESES_NOMBRE = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_SEMANA_NOMBRE = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function normTexto(v: string): string {
  return v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ultimoDiaMes(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Día del mes del cobro mensual: 1..31, "ultimo", o null si no se reconoce. */
function diaMensual(diaPago: string): number | "ultimo" | null {
  const t = normTexto(diaPago);
  if (/^(ultimo|fin)/.test(t)) return "ultimo";
  const m = t.match(/^(\d{1,2})\b/);
  if (!m) return null;
  const d = Number(m[1]);
  return d >= 1 && d <= 31 ? d : null;
}

/** (día, mes 1-12) del cobro anual, o null. */
function diaAnual(diaPago: string): { dia: number; mes: number } | null {
  const t = normTexto(diaPago);
  const num = t.match(/^(\d{1,2})\s*[/-]\s*(\d{1,2})$/);
  if (num) {
    const dia = Number(num[1]);
    const mes = Number(num[2]);
    return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 ? { dia, mes } : null;
  }
  const txt = t.match(/^(\d{1,2})\s*(?:de\s+)?([a-z]+)/);
  if (!txt) return null;
  const mes = MESES_NOMBRE.findIndex((n) => n.startsWith(txt[2].slice(0, 3))) + 1;
  const dia = Number(txt[1]);
  return mes > 0 && dia >= 1 && dia <= 31 ? { dia, mes } : null;
}

/** ¿El cargo se cobra en esta fecha (`YYYY-MM-DD`)? null = día de pago no reconocible. */
export function cobraEn(c: CargoConDia, fecha: string): boolean | null {
  const metodo = c.metodo as MetodoCargo;
  if (metodo === "diario") return true;
  const diaPago = (c.diaPago ?? "").trim();
  if (!diaPago) return null;
  const y = Number(fecha.slice(0, 4));
  const m = Number(fecha.slice(5, 7));
  const d = Number(fecha.slice(8, 10));
  if (metodo === "mensual") {
    const dia = diaMensual(diaPago);
    if (dia == null) return null;
    const ult = ultimoDiaMes(y, m);
    return d === (dia === "ultimo" ? ult : Math.min(dia, ult));
  }
  if (metodo === "anual") {
    const a = diaAnual(diaPago);
    if (!a) return null;
    return m === a.mes && d === Math.min(a.dia, ultimoDiaMes(y, m));
  }
  if (metodo === "semanal") {
    const idx = DIAS_SEMANA_NOMBRE.findIndex((n) => normTexto(diaPago).startsWith(n.slice(0, 3)));
    if (idx < 0) return null;
    return new Date(`${fecha}T00:00:00Z`).getUTCDay() === idx;
  }
  return null;
}

export type CobroDia = { proveedor: string; montoUsd: number };

/**
 * Cobros de los cargos extra ubicados en `fechas`: Map fecha → cobros de ese
 * día. `sinDia` = los cargos cuyo día de pago no se reconoce (no se suman).
 */
export function cobrosPorDia<C extends CargoConDia>(
  cargos: C[],
  fechas: string[],
): { porFecha: Map<string, CobroDia[]>; sinDia: C[] } {
  const porFecha = new Map<string, CobroDia[]>();
  const sinDia: C[] = [];
  for (const c of cargos) {
    if (cobraEn(c, fechas[0] ?? "2000-01-01") === null) {
      sinDia.push(c);
      continue;
    }
    for (const f of fechas) {
      if (!cobraEn(c, f)) continue;
      if (!porFecha.has(f)) porFecha.set(f, []);
      porFecha.get(f)!.push({ proveedor: c.proveedor, montoUsd: c.montoUsd });
    }
  }
  return { porFecha, sinDia };
}
