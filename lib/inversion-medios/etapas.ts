/**
 * Etapas de campaña — módulo CLIENT-SAFE (sin imports de servidor: nada de
 * BigQuery ni del cliente Drizzle). Lo comparten el schema (tipo), la capa de
 * queries (servidor) y los componentes del drill (cliente). Mantenerlo puro:
 * si acá entra un import de `@/lib/bigquery` o `@/db`, el bundle del cliente
 * vuelve a romperse con "Can't resolve 'child_process'".
 */

export interface EtapaCampana {
  nombre: string;
  fechaInicio: string; // YYYY-MM-DD ("" = sin fecha, no pinta)
}

/** Plantilla por defecto (nombres; las fechas las pone el usuario). */
export const ETAPAS_DEFAULT: readonly string[] = [
  "Pre-registro",
  "Awareness",
  "FOMO",
  "Last call",
  "Día de evento",
] as const;

const FECHA_RE_ETAPA = /^\d{4}-\d{2}-\d{2}$/;

export type EtapaSegment = { nombre: string | null; colorIdx: number | null; span: number };

/**
 * Convierte las etapas (lista ordenada, cada una con su fecha de inicio) en
 * segmentos de banda alineados a las columnas `dias`. El inicio de una etapa es
 * el fin de la anterior; la última corre hasta el final del rango. El color se
 * deriva del ÍNDICE en la lista (estable por etapa). Días previos a la primera
 * etapa con fecha quedan sin banda (colorIdx null).
 */
export function computeEtapaSegments(dias: string[], etapas: EtapaCampana[]): EtapaSegment[] {
  const dated = etapas
    .map((e, idx) => ({ ...e, idx }))
    .filter((e) => FECHA_RE_ETAPA.test(e.fechaInicio))
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  const perDay: (number | null)[] = dias.map((d) => {
    let found: number | null = null;
    for (const e of dated) {
      if (e.fechaInicio <= d) found = e.idx; // la última etapa iniciada ≤ d
      else break;
    }
    return found;
  });

  const segs: EtapaSegment[] = [];
  for (const v of perDay) {
    const last = segs[segs.length - 1];
    if (last && last.colorIdx === v) {
      last.span++;
    } else {
      segs.push({ nombre: v === null ? null : etapas[v].nombre, colorIdx: v, span: 1 });
    }
  }
  return segs;
}
