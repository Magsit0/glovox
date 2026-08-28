import { safeText } from "@/lib/unabase/formatting";

export const parseDateFlexible = (value: unknown): number => {
  const text = safeText(value);
  if (text === "Sin dato") return Number.POSITIVE_INFINITY;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`).getTime();
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split("-");
    return new Date(`${year}-${month}-${day}T00:00:00`).getTime();
  }

  const ts = Date.parse(text);
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
};

export const sortRowsByFechaAsc = <T extends { fechaAsignacion: string; nombre: string }>(
  rows: T[],
): T[] =>
  [...rows].sort((a, b) => {
    const diff = parseDateFlexible(a.fechaAsignacion) - parseDateFlexible(b.fechaAsignacion);
    if (diff !== 0) return diff;
    return a.nombre.localeCompare(b.nombre, "es");
  });

export const compareEventsByFechaAsc = (
  a: { fechaAsignacion: string; eventName?: string; nombre?: string },
  b: { fechaAsignacion: string; eventName?: string; nombre?: string },
): number => {
  const diff = parseDateFlexible(a.fechaAsignacion) - parseDateFlexible(b.fechaAsignacion);
  if (diff !== 0) return diff;
  return safeText(a.eventName || a.nombre).localeCompare(
    safeText(b.eventName || b.nombre),
    "es",
  );
};

export const toMonthKey = (value: unknown): string => {
  const ts = parseDateFlexible(value);
  if (!Number.isFinite(ts)) return "Sin fecha";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// --- Fecha financiera (pestaña "Análisis financiero" de /cierre-mensual) ---
// El análisis financiero imputa cada negocio al período de su fecha de
// realización (devengo: cuándo ocurrió el evento). Si no existe, cae a la
// fecha de asignación y se marca el fallback para advertirlo en la UI.

export interface FechaFinanciera {
  /** Timestamp; POSITIVE_INFINITY si ninguna fecha parsea (año fuera de 2000-2100 incluido). */
  ts: number;
  /** true = se usó fecha de asignación porque no hay fecha de realización válida. */
  usaFallback: boolean;
}

const isValidFinancialTs = (ts: number): boolean => {
  if (!Number.isFinite(ts)) return false;
  const y = new Date(ts).getFullYear();
  return y >= 2000 && y <= 2100;
};

export const resolveFechaFinanciera = (
  fechaRealizacion: unknown,
  fechaAsignacion: unknown,
): FechaFinanciera => {
  const real = parseDateFlexible(fechaRealizacion);
  if (isValidFinancialTs(real)) return { ts: real, usaFallback: false };
  const asig = parseDateFlexible(fechaAsignacion);
  if (isValidFinancialTs(asig)) return { ts: asig, usaFallback: true };
  return { ts: Number.POSITIVE_INFINITY, usaFallback: false };
};

// --- Períodos (mes / trimestre / año) ---

export type PeriodGrain = "month" | "quarter" | "year";

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Llave de período ordenable lexicográficamente: "2026-03" | "2026-T1" | "2026". */
export const periodKeyFromTs = (ts: number, grain: PeriodGrain): string => {
  const d = new Date(ts);
  const y = d.getFullYear();
  if (grain === "year") return String(y);
  const m = d.getMonth();
  if (grain === "quarter") return `${y}-T${Math.floor(m / 3) + 1}`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** Llave de período a partir de un mes "YYYY-MM" (serie de estructura). */
export const periodKeyFromMonth = (monthKey: string, grain: PeriodGrain): string => {
  const [y, m] = monthKey.split("-");
  if (grain === "year") return y;
  if (grain === "quarter") return `${y}-T${Math.floor((parseInt(m, 10) - 1) / 3) + 1}`;
  return monthKey;
};

/** Etiqueta corta para ejes/columnas: "Mar 26" | "T1 26" | "2026". */
export const periodLabel = (key: string, grain: PeriodGrain): string => {
  if (grain === "year") return key;
  const [y, rest] = key.split("-");
  if (grain === "quarter") return `${rest} ${y.slice(2)}`;
  return `${MONTHS_ES[parseInt(rest, 10) - 1]} ${y.slice(2)}`;
};
