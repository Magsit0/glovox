import { addDiasIso } from "./evento";

export const DIAS_RANGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export type DiaSubtotal = { fecha: string; plan: number; real: number; conDatos: boolean };

/** Rangos recurrentes inclusivos, de 1 a 7 días; lunes = 0.
 * Viernes→martes cruza la semana. El scroll solo filtra las tarjetas:
 * sus montos siempre se calculan sobre el calendario completo cargado. */
export function buildRangos(dias: DiaSubtotal[], inicioDia: number, finDia: number, realMaxFecha: string) {
  const primero = dias[0]?.fecha;
  const ultimo = dias[dias.length - 1]?.fecha;
  if (!primero || !ultimo) return [];
  const duracion = (finDia - inicioDia + 7) % 7;
  const acc = new Map<string, {
    inicio: string; fin: string; semana: string;
    plan: number; real: number; planTrans: number;
    idxMinData: number; idxMaxData: number;
  }>();
  dias.forEach((dia, i) => {
    const dow = (new Date(`${dia.fecha}T00:00:00Z`).getUTCDay() + 6) % 7;
    const offset = (dow - inicioDia + 7) % 7;
    if (offset > duracion) return;
    const inicio = addDiasIso(dia.fecha, -offset);
    if (!acc.has(inicio)) acc.set(inicio, {
      inicio, fin: addDiasIso(inicio, duracion), semana: addDiasIso(inicio, -inicioDia),
      plan: 0, real: 0, planTrans: 0, idxMinData: Infinity, idxMaxData: -Infinity,
    });
    const rango = acc.get(inicio)!;
    rango.plan += dia.plan;
    rango.real += dia.real;
    if (dia.fecha <= realMaxFecha) rango.planTrans += dia.plan;
    if (dia.conDatos) {
      rango.idxMinData = Math.min(rango.idxMinData, i);
      rango.idxMaxData = Math.max(rango.idxMaxData, i);
    }
  });
  return [...acc.values()]
    .filter((r) => r.plan > 0 || r.real > 0)
    .map((r) => ({
      ...r,
      inicioVista: r.inicio < primero ? primero : r.inicio,
      finVista: r.fin > ultimo ? ultimo : r.fin,
      futura: r.inicio > realMaxFecha,
      parcial: r.inicio < primero || r.fin > ultimo || r.fin > realMaxFecha,
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
