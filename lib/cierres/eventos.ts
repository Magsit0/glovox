/**
 * Eventos del grupo CIERRES: cada uno puede tener su presentación de cierre,
 * su mapa de ventas, o ambos. El hub `/cierres` los lista uno por fila, con la
 * presentación y el mapa lado a lado; si falta uno, la fila lo dice.
 *
 * Los mapas son el HTML interactivo que se arma fuera del repo en
 * `GLOVOX/mapas-ventas/<Evento>/` (ver su `fuentes/build.py`) y se copia a
 * `content/mapas-ventas/<slug>.html`. No van en `public/`: traen montos de venta
 * y se sirven solo con sesión y permiso por `/api/cierres/mapas/[slug]`.
 *
 * Para sumar un evento: agrega su fila aquí (más reciente arriba). Si tiene
 * presentación, además va su entrada en `DASHBOARDS_CATALOG` y en `CIERRES_GROUP`.
 */

export interface EventoCierre {
  /** Slug de la URL del mapa (`/cierres/mapas/<slug>`) y del archivo del mapa. */
  slug: string;
  nombre: string;
  eventoId: string;
  /** Fecha del evento (o primer día), ISO. */
  fecha: string;
  /** Texto corto de la fecha para la fila del hub. */
  fechaTexto: string;
  lugar: string;
  /** Ruta de la presentación de cierre, si existe. */
  cierre?: string;
  /** El mapa existe en `content/mapas-ventas/<slug>.html`. */
  mapa: boolean;
}

export const EVENTOS_CIERRE: readonly EventoCierre[] = [
  {
    slug: "piknic-4-26-27",
    nombre: "Piknic 4 · 26-27",
    eventoId: "GLO216",
    fecha: "2026-11-07",
    fechaTexto: "sáb 7 nov 2026",
    lugar: "Parque Padre Hurtado",
    cierre: "/cierres/piknic-4-26-27",
    mapa: true,
  },
  {
    slug: "piknic-3-26-27",
    nombre: "Piknic 3 · 26-27",
    eventoId: "GLO211",
    fecha: "2026-10-03",
    fechaTexto: "sáb 3 oct 2026",
    lugar: "Parque Ciudad Empresarial",
    cierre: "/cierres/piknic-3-26-27",
    mapa: true,
  },
  {
    slug: "piknic-1-26-27",
    nombre: "Piknic 1 · 26-27",
    eventoId: "GLO206",
    fecha: "2026-09-12",
    fechaTexto: "sáb 12 sep 2026",
    lugar: "Parque Padre Hurtado",
    mapa: true,
  },
  {
    slug: "fds-25",
    nombre: "Feria del Sanguche 2025",
    eventoId: "GLO181",
    fecha: "2025-11-21",
    fechaTexto: "21 al 23 nov 2025",
    lugar: "Parque Padre Hurtado",
    mapa: true,
  },
];

/** Prefijo (y permiso) de todos los mapas. */
export const MAPAS_PATH = "/cierres/mapas";

export const mapaHref = (slug: string) => `${MAPAS_PATH}/${slug}`;

export function eventoPorSlug(slug: string): EventoCierre | undefined {
  return EVENTOS_CIERRE.find((e) => e.slug === slug);
}
