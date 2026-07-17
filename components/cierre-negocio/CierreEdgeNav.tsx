import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface EdgeNeighbor {
  id: string;
  nombre: string;
  href: string;
}

type Side = "left" | "right";

// Navegación anterior/siguiente: un botón-flecha chico SIEMPRE visible, pegado al
// borde y centrado verticalmente. El disparador es el botón mismo (no una franja
// ancha), así que sólo se expande al pasar el cursor POR ÉL — no al hover de las
// cards de contenido, evitando colisiones con sus tooltips. Al expandirse muestra
// el nombre destino sobre una card opaca; el botón entero es el link. Pura CSS
// (hover/focus): sin listeners, sin estados que se traben.
function EdgeButton({ side, neighbor }: { side: Side; neighbor: EdgeNeighbor }) {
  const isLeft = side === "left";
  const Chevron = isLeft ? ChevronLeft : ChevronRight;
  return (
    <Link
      href={neighbor.href}
      aria-label={`${isLeft ? "Negocio anterior" : "Negocio siguiente"}: ${neighbor.nombre}`}
      data-no-print="true"
      className={`group fixed top-1/2 z-20 flex -translate-y-1/2 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white p-3 opacity-40 shadow-sm transition-[opacity,box-shadow] duration-200 hover:opacity-100 hover:shadow-md focus-visible:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9F99F8] ${
        isLeft ? "left-3 flex-row" : "right-3 flex-row-reverse text-right"
      }`}
    >
      <Chevron className="h-6 w-6 shrink-0 text-[#9F99F8]" />
      {/* La sección del nombre se revela (ancho 0 → 14rem) sólo en hover/focus. */}
      <span
        className={`flex w-56 max-w-0 shrink-0 flex-col gap-0.5 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover:max-w-[14rem] group-hover:opacity-100 group-focus-visible:max-w-[14rem] group-focus-visible:opacity-100 ${
          isLeft ? "" : "items-end"
        }`}
      >
        <span className="whitespace-nowrap font-sans text-xs text-[#666666]">
          {isLeft ? "Negocio anterior" : "Negocio siguiente"}
        </span>
        <span className="line-clamp-2 font-display text-base font-bold leading-tight tracking-tight text-[#333333]">
          {neighbor.nombre}
        </span>
        <span className="whitespace-nowrap font-sans text-xs text-[#999999]">#{neighbor.id}</span>
      </span>
    </Link>
  );
}

export default function CierreEdgeNav({
  prev,
  next,
}: {
  prev: EdgeNeighbor | null;
  next: EdgeNeighbor | null;
}) {
  return (
    <>
      {prev && <EdgeButton side="left" neighbor={prev} />}
      {next && <EdgeButton side="right" neighbor={next} />}
    </>
  );
}
