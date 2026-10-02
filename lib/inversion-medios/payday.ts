// Días de pago (payday) en Chile: el sueldo cae alrededor del ÚLTIMO día del
// mes, así que la ventana de compra con más poder adquisitivo va aprox. del 28
// al 3 del mes siguiente. El calendario la marca con una escala de 4 pasos
// centrada en el último día:
//
//   nivel 1 = último día del mes (D)        → el más intenso
//   nivel 2 = D−1 / D+1
//   nivel 3 = D−2 / D+2
//   nivel 4 = D−3 / D+3                      → el más suave
//
// Se mide en DISTANCIA al fin de mes y no por número de día, así que la ventana
// se corre sola en meses cortos: en septiembre (30) va del 27 al 3 y en febrero
// del 25 al 3. Es una heurística de calendario, no un dato: no mira feriados ni
// el día de la semana en que cae el pago.

export type NivelPayday = 0 | 1 | 2 | 3 | 4;

const ALCANCE = 3;

function ultimoDiaDelMes(y: number, m: number): number {
  // m en 1..12; el día 0 del mes siguiente es el último de este.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Distancia firmada al fin de mes más cercano: 0 = último día, −2 = dos días
 * antes, +2 = el 2 del mes siguiente. null si cae fuera de la ventana.
 */
export function offsetPayday(fecha: string): number | null {
  const y = Number(fecha.slice(0, 4));
  const m = Number(fecha.slice(5, 7));
  const d = Number(fecha.slice(8, 10));
  if (!y || !m || !d) return null;
  if (d <= ALCANCE) return d; // el 1 es D+1 del mes anterior
  const off = d - ultimoDiaDelMes(y, m);
  return off >= -ALCANCE ? off : null;
}

export function nivelPayday(fecha: string): NivelPayday {
  const off = offsetPayday(fecha);
  return off == null ? 0 : ((Math.abs(off) + 1) as NivelPayday);
}

/** Texto del tooltip: "Payday · último día del mes", "Payday · D−2", … */
export function tituloPayday(fecha: string): string | undefined {
  const off = offsetPayday(fecha);
  if (off == null) return undefined;
  if (off === 0) return "Payday · último día del mes";
  return `Payday · D${off > 0 ? "+" : "−"}${Math.abs(off)} del fin de mes`;
}

// Clases COMPLETAS (literales) para que Tailwind las genere. Encabezado: tinte
// lleno + tinta verde. Cuerpo: el mismo tinte al 50% para que la columna se
// lea sin competir con el ámbar del día del evento ni con el morado de hoy.
export const PAYDAY_HEAD: Record<Exclude<NivelPayday, 0>, string> = {
  1: "bg-[var(--payday-1)] text-[var(--payday-ink)]",
  2: "bg-[var(--payday-2)] text-[var(--payday-ink)]",
  3: "bg-[var(--payday-3)] text-[var(--payday-ink)]",
  4: "bg-[var(--payday-4)] text-[var(--payday-ink)]",
};

export const PAYDAY_CELL: Record<Exclude<NivelPayday, 0>, string> = {
  1: "bg-[var(--payday-1)]/50",
  2: "bg-[var(--payday-2)]/50",
  3: "bg-[var(--payday-3)]/50",
  4: "bg-[var(--payday-4)]/50",
};

/** Fondo de una celda del cuerpo: payday si toca, si no `fallback`. */
export function paydayCell(fecha: string, fallback = ""): string {
  const n = nivelPayday(fecha);
  return n === 0 ? fallback : PAYDAY_CELL[n];
}
