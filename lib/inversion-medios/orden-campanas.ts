/**
 * Orden de las sub-filas de campaña del calendario ("No atribuido" y las
 * iniciativas). Módulo CLIENT-SAFE.
 *
 * Criterio (2026-10-15, pedido del usuario): RECENCIA dentro del tramo que se
 * está mirando. Primero las campañas con gasto en el tramo, de la que gastó
 * más recientemente a la que menos; a igual último día, la que gastó más ese
 * día, después la de más gasto en el tramo. Al final las que no gastaron en el
 * tramo, por gasto total del período cargado.
 *
 * Antes el orden era solo el gasto total del período CARGADO (jun–mar, ~10
 * meses). Las 20 filas individuales se las llevaban campañas grandes de meses
 * atrás —que además se ocultan por no tener gasto en el tramo— y las que
 * explicaban el gasto de ayer quedaban enterradas en "otras N", a varios clics
 * de "mostrar 20 más".
 */

export type CampanaConSerie = {
  /** Gasto por día, alineado a las columnas del calendario. */
  dias: number[];
  /** Gasto total en el período cargado. */
  total: number;
  nombre: string;
};

/** Devuelve una copia ordenada; `a`..`b` = índices de columna del tramo mirado (inclusive). */
export function ordenarPorRecencia<T extends CampanaConSerie>(camps: T[], a: number, b: number): T[] {
  const clave = new Map<T, { ultimo: number; montoUltimo: number; tramo: number }>();
  for (const c of camps) {
    let ultimo = -1;
    let montoUltimo = 0;
    let tramo = 0;
    for (let j = Math.max(0, a); j <= b && j < c.dias.length; j++) {
      const v = c.dias[j];
      if (v > 0) {
        ultimo = j;
        montoUltimo = v;
        tramo += v;
      }
    }
    clave.set(c, { ultimo, montoUltimo, tramo });
  }
  return [...camps].sort((x, y) => {
    const kx = clave.get(x)!;
    const ky = clave.get(y)!;
    return (
      ky.ultimo - kx.ultimo ||
      ky.montoUltimo - kx.montoUltimo ||
      ky.tramo - kx.tramo ||
      y.total - x.total ||
      x.nombre.localeCompare(y.nombre)
    );
  });
}
