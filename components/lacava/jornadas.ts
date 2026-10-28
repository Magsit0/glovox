/**
 * Jornadas del evento (cada día de La Cava) a partir de las filas de
 * getLaCavaTipos: lo que comparten la pestaña "Venta por día" y el detalle de
 * devoluciones. Módulo puro: se usa en el servidor (page.tsx) y en el cliente.
 */
import type { LaCavaTipoRow } from "@/lib/queries/lacava";
import { lacavaSeriesColor } from "./theme";

/**
 * Objetivo de venta por jornada (el sold out), indexado por día de la semana
 * (0 = domingo … 6 = sábado): así sobrevive a un reagendamiento.
 */
export type SoldOutPorJornada = Partial<Record<number, number>>;

export type Jornada = {
  /** YYYY-MM-DD de la jornada (calendario vigente). */
  dia: string;
  color: string;
  /** Solo venta y pases (vigentes): lo que cuenta para el sold out. */
  vendidas: number;
  /** Venta neta de esas entradas vigentes. */
  venta: number;
  cortesias: number;
  /** Vigentes compradas para una fecha anterior a un reagendamiento. */
  reasignadas: number;
  /** Entradas vendidas que se devolvieron (no están en `vendidas`). */
  devueltas: number;
  devueltasReasignadas: number;
  ventaDevuelta: number;
  objetivo?: number;
};

// Nombres fijos en vez de Intl: estas fechas se renderizan en el servidor y
// se hidratan en el navegador, y el ICU de Safari/iOS abrevia distinto que el
// de Node ("11 dic." vs "11 dic") — esa diferencia rompe la hidratación.
export const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

// Fechas YYYY-MM-DD leídas como UTC: así el día no se corre en zonas horarias
// negativas (Chile).
export function fechaUTC(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/** "vie, 11 dic". */
export function fmtDia(iso: string): string {
  const f = fechaUTC(iso);
  return f ? `${DIAS_CORTOS[f.getUTCDay()]}, ${f.getUTCDate()} ${MESES[f.getUTCMonth()]}` : iso;
}

/** "Viernes, 11 dic". */
export function fmtDiaLargo(iso: string): string {
  const f = fechaUTC(iso);
  return f ? `${DIAS_LARGOS[f.getUTCDay()]}, ${f.getUTCDate()} ${MESES[f.getUTCMonth()]}` : iso;
}

/** "Viernes" (día de la semana de la jornada). */
export function fmtDiaSemana(iso: string): string {
  const f = fechaUTC(iso);
  return f ? DIAS_LARGOS[f.getUTCDay()] : iso;
}

/** "11 dic" (sin día de la semana), para ejes. */
export function fmtFechaCorta(iso: string): string {
  const f = fechaUTC(iso);
  return f ? `${f.getUTCDate()} ${MESES[f.getUTCMonth()]}` : iso;
}

/** Suma `n` días a una fecha YYYY-MM-DD (aritmética UTC). */
export function sumarDias(iso: string, n: number): string {
  const f = fechaUTC(iso);
  if (!f) return iso;
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

/** Días entre dos fechas YYYY-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  const fa = fechaUTC(a);
  const fb = fechaUTC(b);
  if (!fa || !fb) return 0;
  return Math.round((fb.getTime() - fa.getTime()) / 86_400_000);
}

/**
 * % de avance redondeado hacia abajo: 100% solo cuando de verdad se completó
 * (con redondeo normal, 827 de 831 ya decía 100% junto a "Faltan 4"). El
 * épsilon evita que 0,58 × 100 = 57,999… caiga a 57.
 */
export function pctAvance(fraccion: number): number {
  return Math.floor(fraccion * 100 + 1e-9);
}

/**
 * Agrupa las filas por jornada, en orden cronológico. El color de cada
 * jornada se fija por índice y se reutiliza en curva, donut y filas.
 */
export function agruparJornadas(
  tipos: LaCavaTipoRow[],
  soldOut?: SoldOutPorJornada,
): Jornada[] {
  const map = new Map<string, Omit<Jornada, "dia" | "color" | "objetivo">>();
  for (const t of tipos) {
    const j = map.get(t.diaEvento) ?? {
      vendidas: 0,
      venta: 0,
      cortesias: 0,
      reasignadas: 0,
      devueltas: 0,
      devueltasReasignadas: 0,
      ventaDevuelta: 0,
    };
    if (t.clase === "VENTA" || t.clase === "PASE TEMPORADA") {
      j.vendidas += t.personas;
      j.venta += t.venta;
      j.reasignadas += t.reasignadas;
    } else if (t.clase === "CORTESIA") {
      j.cortesias += t.personas;
    }
    j.devueltas += t.devueltas;
    j.devueltasReasignadas += t.devueltasReasignadas;
    j.ventaDevuelta += t.ventaDevuelta;
    map.set(t.diaEvento, j);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dia, j], i) => ({
      dia,
      color: lacavaSeriesColor(i),
      ...j,
      objetivo: soldOut?.[fechaUTC(dia)?.getUTCDay() ?? -1],
    }));
}
