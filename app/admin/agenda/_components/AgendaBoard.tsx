"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { AgendaItem } from "@/db/schema";
import { newId } from "@/lib/agenda/newId";
import DayColumn, { type ColumnHandle, type DiaView } from "./DayColumn";
import ItemCard from "./ItemCard";

type ActiveDrag = { item: AgendaItem; fecha: string } | null;

/**
 * Colisión del board: prefiere el hit de un ÍTEM sobre el de la columna que lo
 * contiene (la columna contiene geométricamente a los ítems). Si el puntero no
 * cae en ningún droppable (p. ej. a mitad de un fling), cae a rectIntersection.
 * Así: sobre un ítem → insertar relativo a él; sobre header/vacío/hueco → columna
 * → append al final.
 */
const boardCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const hits = pointer.length ? pointer : rectIntersection(args);
  const itemHit = hits.find((h) => {
    const dc = (
      h.data as
        | { droppableContainer?: { data?: { current?: { type?: string } } } }
        | undefined
    )?.droppableContainer;
    return dc?.data?.current?.type === "item";
  });
  return itemHit ? [itemHit] : hits;
};

export default function AgendaBoard({ dias }: { dias: DiaView[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null); // pinta el DragOverlay
  const draggingRef = useRef(false); // suprime refresh-on-focus mientras se arrastra
  const columnsRef = useRef(new Map<string, ColumnHandle>()); // fecha -> handle de columna

  const register = useCallback((fecha: string, handle: ColumnHandle) => {
    columnsRef.current.set(fecha, handle);
  }, []);
  const unregister = useCallback((fecha: string) => {
    columnsRef.current.delete(fecha);
  }, []);

  // distance:4 → un click en el grip no inicia drag por accidente.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Al montar, posiciona la tira en "hoy" sin arrastrar el scroll vertical.
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const el = cont.querySelector<HTMLElement>('[data-hoy="true"]');
    if (el) cont.scrollLeft = el.offsetLeft - 16;
  }, []);

  // #4 Tablero compartido: al volver a la pestaña, revalida para traer cambios de
  // otros admins (cada DayColumn adopta las props frescas solo si no tiene edición
  // sin guardar). PERO no durante un drag: mutar las listas del SortableContext
  // bajo un arrastre activo rompería el drop.
  useEffect(() => {
    function onFocus() {
      if (!draggingRef.current) router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  function onDragStart(e: DragStartEvent) {
    draggingRef.current = true;
    const d = e.active.data.current as
      | { item?: AgendaItem; fecha?: string }
      | undefined;
    if (d?.item && d.fecha) setActiveDrag({ item: d.item, fecha: d.fecha });
  }

  function onDragCancel() {
    draggingRef.current = false;
    setActiveDrag(null);
  }

  // ¿insertar DESPUÉS del ítem sobre el que se soltó? (según el punto medio).
  function placeAfter(e: DragEndEvent): boolean {
    const a = e.active.rect.current.translated;
    const o = e.over?.rect;
    if (!a || !o) return false;
    return a.top + a.height / 2 > o.top + o.height / 2;
  }

  function onDragEnd(e: DragEndEvent) {
    draggingRef.current = false;
    setActiveDrag(null);

    const { active, over } = e;
    if (!over) return; // soltado fuera de todo droppable → no-op

    const srcFecha = (active.data.current as { fecha?: string } | undefined)
      ?.fecha;
    if (!srcFecha) return;
    const src = columnsRef.current.get(srcFecha);
    if (!src) return; // columna origen desmontada mid-drag → abortar sin romper

    const od = over.data.current as
      | { type?: string; fecha?: string }
      | undefined;
    const tgtFecha = od?.fecha;
    if (!tgtFecha) return;
    const tgt = columnsRef.current.get(tgtFecha);
    if (!tgt) return;

    // ---------- MISMO DÍA → reorden intra-día ----------
    if (srcFecha === tgtFecha) {
      if (active.id === over.id) return; // soltado sobre sí mismo → no-op
      const cur = src.getItems();
      const oldI = cur.findIndex((i) => i.id === active.id);
      if (oldI < 0) return;
      const overI = cur.findIndex((i) => i.id === over.id); // -1 si es el droppable de columna
      const dest = overI < 0 ? cur.length - 1 : overI; // soltado en el cuerpo → al final
      if (oldI === dest) return;
      src.moveApply(arrayMove(cur, oldI, dest));
      return;
    }

    // ---------- ENTRE DÍAS ----------
    const srcItems = src.getItems();
    const moved0 = srcItems.find((i) => i.id === active.id);
    if (!moved0) return;

    const tgtItems = tgt.getItems();
    // Unicidad defensiva de id en el día destino (con UUIDs es ~imposible; si se
    // repitiera, sanitizeItems lo descartaría en silencio, así que regeneramos).
    const moved = tgtItems.some((i) => i.id === moved0.id)
      ? { ...moved0, id: newId() }
      : moved0;

    let insertAt = tgtItems.length; // vacío / header / hueco → append
    if (od?.type === "item") {
      const overI = tgtItems.findIndex((i) => i.id === over.id);
      if (overI >= 0) insertAt = placeAfter(e) ? overI + 1 : overI;
    }
    const tgtNext = [
      ...tgtItems.slice(0, insertAt),
      moved,
      ...tgtItems.slice(insertAt),
    ];
    const srcNext = srcItems.filter((i) => i.id !== active.id);

    // TARGET-FIRST: dirección de fallo segura. Si el guardado del destino sale y
    // el del origen agota reintentos, el ítem queda en AMBOS (duplicado visible
    // que el usuario borra) — nunca desaparece. Source-first arriesgaría pérdida.
    tgt.moveApply(tgtNext);
    src.moveApply(srcNext);
  }

  return (
    <DndContext
      id="agenda-board"
      sensors={sensors}
      collisionDetection={boardCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={{ threshold: { x: 0.18, y: 0 } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
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
            <DayColumn
              key={d.fecha}
              dia={d}
              register={register}
              unregister={unregister}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? <ItemCard item={activeDrag.item} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
