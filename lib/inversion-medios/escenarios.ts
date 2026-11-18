/**
 * Opciones de plan (escenarios) de un evento — módulo CLIENT-SAFE.
 *
 * Una opción es un plan alternativo ("Opción B") que se arma para comparar y
 * presentar a la jefatura. Vive en tablas aparte (db/schema.ts,
 * `inversion_medios_escenarios`): nunca suma en el calendario ni en los
 * totales. El plan VIGENTE sigue siendo `inversion_medios_diario`; al elegir
 * una opción, sus días desde hoy pasan a ser el vigente.
 */
import type { PlanDiarioRow } from "@/lib/queries/inversion-medios";

const CANAL_LABEL: Record<string, string> = { meta: "Meta", google: "Google", tiktok: "TikTok" };
const ORDEN_CANAL = ["meta", "google", "tiktok"];
const ordenCanal = (p: string) => (ORDEN_CANAL.includes(p) ? ORDEN_CANAL.indexOf(p) : ORDEN_CANAL.length);

/** Tope de opciones por evento (sin contar el vigente). */
export const MAX_OPCIONES = 3;
export const NOMBRE_OPCION_MAX = 40;

export type OpcionPlan = {
  id: string;
  nombre: string;
  /** Celdas de la opción, con la misma forma que el plan vigente. */
  rows: PlanDiarioRow[];
};

/**
 * El plan que quedaría VIGENTE si se elige la opción: los días anteriores a hoy
 * son los del vigente (elegir no los toca: son la vara del desvío) y desde hoy,
 * los de la opción. Es lo que se muestra y se compara de una opción; sus propias
 * celdas pasadas (copiadas al crearla) no cuentan.
 */
export function planSiSeElige(vigente: PlanDiarioRow[], opcion: PlanDiarioRow[], hoy: string): PlanDiarioRow[] {
  return [...vigente.filter((r) => r.fecha < hoy), ...opcion.filter((r) => r.fecha >= hoy)];
}

/** uuid de Postgres (gen_random_uuid). */
export const OPCION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Nombre normalizado (espacios colapsados) o null si queda vacío o largo. */
export function limpiarNombreOpcion(v: unknown): string | null {
  const t = String(v ?? "").trim().replace(/\s+/g, " ");
  return t.length >= 1 && t.length <= NOMBRE_OPCION_MAX ? t : null;
}

/** "Opción B", "Opción C"… el primero libre (sin distinguir mayúsculas). */
export function siguienteNombreOpcion(usados: string[]): string {
  const tomados = new Set(usados.map((n) => n.toLowerCase()));
  for (const letra of "BCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const nombre = `Opción ${letra}`;
    if (!tomados.has(nombre.toLowerCase())) return nombre;
  }
  return `Opción ${usados.length + 2}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Una fila de la tabla de comparación: un monto por plan (vigente primero). */
export type FilaComparacion = {
  clave: string;
  label: string;
  /** 0 = total o grupo; 1 = detalle dentro del grupo (tipo de un canal). */
  nivel: 0 | 1;
  valores: number[];
};

export type Comparacion = {
  total: number[];
  /** Desde hoy: lo que reemplazaría al vigente si se elige la opción. */
  desdeHoy: number[];
  porCanal: FilaComparacion[];
  porMes: FilaComparacion[];
};

/**
 * Agrega cada plan (el vigente primero, después las opciones) por canal → tipo
 * y por mes, para la tabla de comparación del drill. Solo filas con monto en
 * algún plan.
 */
export function compararPlanes(planes: PlanDiarioRow[][], hoy: string, tipoLabel: (t: string) => string): Comparacion {
  const n = planes.length;
  const cero = () => new Array<number>(n).fill(0);
  const total = cero();
  const desdeHoy = cero();
  const canal = new Map<string, number[]>();
  const tipo = new Map<string, number[]>(); // "plataforma|tipo"
  const mes = new Map<string, number[]>(); // "YYYY-MM"
  planes.forEach((rows, i) => {
    for (const r of rows) {
      total[i] += r.montoUsd;
      if (r.fecha >= hoy) desdeHoy[i] += r.montoUsd;
      const sum = (m: Map<string, number[]>, k: string) => {
        if (!m.has(k)) m.set(k, cero());
        m.get(k)![i] += r.montoUsd;
      };
      sum(canal, r.plataforma);
      sum(tipo, `${r.plataforma}|${r.tipo}`);
      sum(mes, r.fecha.slice(0, 7));
    }
  });
  const conMonto = (v: number[]) => v.some((x) => Math.abs(x) >= 0.005);
  const porCanal: FilaComparacion[] = [];
  for (const p of [...canal.keys()].sort((a, b) => ordenCanal(a) - ordenCanal(b) || a.localeCompare(b))) {
    const v = canal.get(p)!;
    if (!conMonto(v)) continue;
    porCanal.push({ clave: p, label: CANAL_LABEL[p] ?? p, nivel: 0, valores: v });
    const tipos = [...tipo.entries()]
      .filter(([k, tv]) => k.startsWith(`${p}|`) && conMonto(tv))
      .sort((a, b) => Math.max(...b[1]) - Math.max(...a[1]));
    for (const [k, tv] of tipos) {
      porCanal.push({ clave: k, label: tipoLabel(k.slice(p.length + 1)), nivel: 1, valores: tv });
    }
  }
  const porMes = [...mes.entries()]
    .filter(([, v]) => conMonto(v))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({
      clave: k,
      label: `${MESES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`,
      nivel: 0 as const,
      valores: v,
    }));
  return { total, desdeHoy, porCanal, porMes };
}
