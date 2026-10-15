/**
 * Ancho de la columna de nombres de las tablas de /inversion-medios: el
 * calendario global (eventos, iniciativas, campañas) y la sábana del drill
 * (canal → tipo → campaña). Módulo CLIENT-SAFE: lo usan la page (lee la cookie
 * en el servidor) y los componentes (la leen y la escriben en el navegador).
 *
 * Pedido 2026-10-15: con el ancho fijo las campañas se leían todas como
 * "Publicación de Instagr…". Es preferencia del navegador, no de la URL: no se
 * le impone a quien abre un link compartido. Cada tabla guarda la suya.
 *
 * Va en COOKIE (no localStorage) para que el servidor la conozca: así el primer
 * render ya sale con el ancho guardado y la columna no salta del ancho original
 * al guardado en cada recarga (servidor y cliente arrancan con el mismo valor).
 */

export type ColumnaNombre = {
  cookie: string;
  /** Ancho original (el que tenía antes de ser ajustable). */
  def: number;
  min: number;
};

export const COL_NOMBRE_MAX = 640;

/** Calendario global: antes `w-56`. */
export const COL_CALENDARIO: ColumnaNombre = { cookie: "glovox_im_col_nombre", def: 224, min: 180 };
/** Sábana del drill (evento o iniciativa): antes `w-40`. Mínimo = el original:
 *  más angosta, los botones de las filas de tipo editables (Formularios,
 *  Interacción…) se salían de la columna y tapaban la primera celda de día. */
export const COL_DRILL: ColumnaNombre = { cookie: "glovox_im_col_nombre_drill", def: 160, min: 160 };

export function clampAncho(v: number, col: ColumnaNombre): number {
  return Math.min(COL_NOMBRE_MAX, Math.max(col.min, Math.round(v)));
}

/** Valor crudo de la cookie → ancho válido, o el original si no hay o no sirve. */
export function anchoDesdeCookie(v: string | undefined | null, col: ColumnaNombre): number {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? clampAncho(n, col) : col.def;
}

/** Snapshot del cliente (useSyncExternalStore). */
export function leerAncho(col: ColumnaNombre): number {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${col.cookie}=([^;]*)`));
    return anchoDesdeCookie(m?.[1], col);
  } catch {
    return col.def;
  }
}

const evento = (col: ColumnaNombre) => `${col.cookie}:change`;

export function suscribirAncho(col: ColumnaNombre, onChange: () => void): () => void {
  window.addEventListener(evento(col), onChange);
  return () => window.removeEventListener(evento(col), onChange);
}

export function guardarAncho(col: ColumnaNombre, v: number) {
  try {
    document.cookie = `${col.cookie}=${clampAncho(v, col)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // cookies bloqueadas: igual avisamos, y la columna vuelve a su valor
  }
  window.dispatchEvent(new Event(evento(col)));
}
