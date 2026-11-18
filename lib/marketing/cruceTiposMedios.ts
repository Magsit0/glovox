/**
 * Matriz tipo de ticket × medio de pago de la vista "Cruce" (card "Tipos de
 * ticket y medios de pago" de /marketing/weekly). Módulo puro: lo usan la card
 * y su CSV, así la descarga es exactamente la tabla que se ve.
 */
import type { CruceTipoMedioRow } from "@/lib/queries/marketing";

export type MedidaCruce = "personas" | "venta";
/** Qué va en las filas; lo otro va en las columnas. */
export type FilasCruce = "tipos" | "medios";

export type MatrizCruce = {
  filas: { clave: string; total: number; celdas: Map<string, number> }[];
  columnas: { clave: string; total: number }[];
  total: number;
  /** El valor de celda más alto: escala del sombreado. */
  max: number;
};

/** Filas y columnas ordenadas de mayor a menor total (empates por nombre). */
export function armarCruce(cruce: CruceTipoMedioRow[], filasSon: FilasCruce, medida: MedidaCruce): MatrizCruce {
  const fila = (r: CruceTipoMedioRow) => (filasSon === "tipos" ? r.tipo : r.medio);
  const col = (r: CruceTipoMedioRow) => (filasSon === "tipos" ? r.medio : r.tipo);
  const valor = (r: CruceTipoMedioRow) => (medida === "personas" ? r.personas : r.venta);

  const porFila = new Map<string, { clave: string; total: number; celdas: Map<string, number> }>();
  const porCol = new Map<string, number>();
  let total = 0;
  for (const r of cruce) {
    const v = valor(r);
    const f = porFila.get(fila(r)) ?? { clave: fila(r), total: 0, celdas: new Map<string, number>() };
    f.total += v;
    f.celdas.set(col(r), (f.celdas.get(col(r)) ?? 0) + v);
    porFila.set(fila(r), f);
    porCol.set(col(r), (porCol.get(col(r)) ?? 0) + v);
    total += v;
  }
  const orden = (a: { clave: string; total: number }, b: { clave: string; total: number }) =>
    b.total - a.total || a.clave.localeCompare(b.clave);
  const filas = [...porFila.values()].sort(orden);
  const columnas = [...porCol.entries()].map(([clave, t]) => ({ clave, total: t })).sort(orden);
  let max = 0;
  for (const f of filas) for (const v of f.celdas.values()) max = Math.max(max, v);
  return { filas, columnas, total, max };
}

export const ETIQUETA_EJE: Record<FilasCruce, string> = {
  tipos: "Tipo de ticket",
  medios: "Medio de pago",
};
