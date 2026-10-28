"use client";

import { useEntraEnVista } from "./useEntraEnVista";

/**
 * Revela su contenido de izquierda a derecha (`.lacava-barra-revela`, en
 * app/globals.css) la primera vez que entra en pantalla. Para objetos sin
 * gráfico propio, como tablas y barras de avance, que así se "trazan" igual
 * que el resto.
 *
 * Se observa el envoltorio externo y no el elemento recortado: Chrome resta
 * el clip-path del propio objetivo, y un elemento que parte recortado al 100%
 * nunca alcanza el umbral, así que la revelación no arrancaría jamás.
 *
 * `className` se aplica a los dos envoltorios (p. ej. `h-full` dentro de una
 * pista de barra).
 */
export default function RevelarAlVer({
  children,
  umbral = 0.25,
  className = "",
}: {
  children: React.ReactNode;
  umbral?: number;
  className?: string;
}) {
  const [ref, enVista] = useEntraEnVista<HTMLDivElement>(umbral);
  return (
    <div ref={ref} className={className}>
      <div
        className={`lacava-barra-revela ${className}`}
        style={{ animationPlayState: enVista ? "running" : "paused" }}
      >
        {children}
      </div>
    </div>
  );
}
