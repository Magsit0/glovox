"use client";

import { type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AgendaItem } from "@/db/schema";
import ItemCard from "./ItemCard";

/**
 * Wrapper sortable de un ítem. Registra el ítem en el DndContext del board con
 * `data` que lleva su día de origen (`fecha`) y el propio ítem — el board lo usa
 * para computar el movimiento entre días y para pintar el DragOverlay.
 */
export default function SortableItem({
  item,
  fecha,
  onEdit,
  onToggle,
  onDelete,
  onBlur,
}: {
  item: AgendaItem;
  fecha: string;
  onEdit: (id: string, texto: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onBlur: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { type: "item", fecha, item } });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // El overlay es la copia visible que se mueve; el origen queda atenuado.
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <ItemCard
      item={item}
      setNodeRef={setNodeRef}
      style={style}
      dragging={isDragging}
      attributes={{ ...attributes }}
      listeners={{ ...listeners }}
      onEdit={onEdit}
      onToggle={onToggle}
      onDelete={onDelete}
      onBlur={onBlur}
    />
  );
}
