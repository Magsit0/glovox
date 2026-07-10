"use client";

import { useEffect, useRef } from "react";
import DayColumn, { type DiaView } from "./DayColumn";

export default function AgendaBoard({ dias }: { dias: DiaView[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Al montar, posiciona la tira en "hoy" sin arrastrar el scroll vertical.
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const el = cont.querySelector<HTMLElement>('[data-hoy="true"]');
    if (el) cont.scrollLeft = el.offsetLeft - 16;
  }, []);

  return (
    <div
      ref={scrollRef}
      className="-mx-6 overflow-x-auto px-6 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        // Bordes laterales difusos: la tira se funde con el lienzo (#FAFAFA).
        maskImage:
          "linear-gradient(to right, transparent 0, #000 3.5rem, #000 calc(100% - 3.5rem), transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, #000 3.5rem, #000 calc(100% - 3.5rem), transparent 100%)",
      }}
    >
      <div className="flex items-stretch gap-4">
        {dias.map((d) => (
          <DayColumn key={d.fecha} dia={d} />
        ))}
      </div>
    </div>
  );
}
