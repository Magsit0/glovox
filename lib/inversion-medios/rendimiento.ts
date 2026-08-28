/**
 * Constantes y helpers CLIENT-SAFE de las métricas de rendimiento del panel
 * (sin imports de servidor, igual que `tipos.ts`, `etapas.ts` y `facturacion.ts`).
 *
 * El umbral vive acá y no en `lib/queries/inversion-medios.ts` porque lo necesitan
 * las dos orillas: el SQL, para clasificar el estado del referido, y el
 * componente, para decidir si pinta la card de doble ancho. Una sola definición.
 */

/**
 * Umbral de propagación del referido, en % de órdenes que llegan con etiqueta
 * `PM_`. Debajo de esto el CPA referido no se publica.
 *
 * Medido sobre los 20 eventos con al menos una orden `PM_`: por arriba de 8% las
 * brechas pixel-vs-referido van de 0,81× a 2,25× (6 eventos, sin excepción); por
 * abajo van de 2,0× a 250×, y ninguna es interpretable. Ningún evento cruza el
 * corte en el sentido contrario.
 *
 * Es una muestra chica: recalcular con `npm run audit:referido` cuando entren
 * temporadas nuevas.
 */
export const PM_PROPAGACION_MIN = 8;

/** Brecha por encima de la cual el pie de la CpaCard pasa de "sano" a "atención". */
export const BRECHA_SANA_MAX = 1.5;
