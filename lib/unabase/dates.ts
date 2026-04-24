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
