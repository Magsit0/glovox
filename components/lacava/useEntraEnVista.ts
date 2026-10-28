"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Marcas del observer cada 5%: el criterio por alto visible necesita oírlo crecer. */
const MARCAS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * `true` desde que el elemento entra en pantalla por primera vez (no vuelve a
 * `false`). Las animaciones de trazado del dashboard esperan este momento:
 * varias cards quedan bajo el pliegue y, si su animación partiera al cargar,
 * se reproduciría sin que nadie la viera.
 *
 * Devuelve una ref de callback: se empieza a observar cuando el elemento se
 * monta, aunque sea después del primer render (una card que primero mostró
 * "Sin ventas" y luego recibe datos al cambiar de edición).
 *
 * `umbral` es la fracción del elemento que debe verse. Se compara contra
 * `intersectionRatio` y no contra `isIntersecting`: la primera notificación
 * del observer llega con el estado inicial, y `isIntersecting` ya es true con
 * un solo píxel a la vista. Un elemento más alto que la pantalla (o con zoom
 * alto) nunca alcanzaría ese ratio: también cuenta si ya llena la mitad de la
 * vista.
 *
 * Si el foco del teclado estaba dentro del elemento cuando entró en pantalla
 * (llegó con Tab), se devuelve a su primer control al volver a montarse el
 * gráfico animado; si no, quedaría en <body>.
 *
 * No observar un elemento que parte recortado por su propio clip-path (como
 * `.lacava-barra-revela`): Chrome lo resta del área visible, el ratio queda en
 * 0 y nunca llega al umbral. Observar su contenedor.
 */
export function useEntraEnVista<T extends Element>(umbral = 0.25) {
  const [el, setEl] = useState<T | null>(null);
  const [enVista, setEnVista] = useState(false);
  const focoDentro = useRef(false);

  useEffect(() => {
    if (!el || enVista) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visto = entries.some((e) => {
          if (e.intersectionRatio >= umbral - 0.001) return true;
          const altoVista = e.rootBounds?.height ?? window.innerHeight;
          return e.isIntersecting && e.intersectionRect.height >= altoVista * 0.5;
        });
        if (!visto) return;
        const activo = document.activeElement;
        focoDentro.current = activo !== null && activo !== el && el.contains(activo);
        setEnVista(true);
        io.disconnect();
      },
      { threshold: MARCAS },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, enVista, umbral]);

  useLayoutEffect(() => {
    if (!enVista || !el || !focoDentro.current) return;
    focoDentro.current = false;
    const activo = document.activeElement;
    if (activo && activo !== document.body && el.contains(activo)) return;
    el.querySelector<HTMLElement>(
      '[tabindex]:not([tabindex="-1"]), button, a[href], input, select',
    )?.focus({ preventScroll: true });
  }, [enVista, el]);

  return [setEl, enVista, el] as const;
}
