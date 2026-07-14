"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Check, GripVertical, X } from "lucide-react";
import type { AgendaItem } from "@/db/schema";

/**
 * Tarjeta visual de un ítem (grip · checkbox · texto · borrar). Se usa en dos
 * modos: interactivo (dentro de SortableItem) y `overlay` (dentro del DragOverlay
 * del board mientras se arrastra). En overlay no lleva handlers ni textarea
 * editable — es una copia estática que sigue al cursor.
 */
export default function ItemCard({
  item,
  overlay = false,
  dragging = false,
  setNodeRef,
  style,
  attributes,
  listeners,
  onEdit,
  onToggle,
  onDelete,
  onBlur,
}: {
  item: AgendaItem;
  overlay?: boolean;
  dragging?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  attributes?: Record<string, unknown>;
  listeners?: Record<string, unknown>;
  onEdit?: (id: string, texto: string) => void;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onBlur?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-alto del textarea según su contenido (solo modo interactivo).
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [item.texto]);

  const done = item.done === true;
  const textTone = done ? "text-[#999999] line-through" : "text-[#333333]";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item flex items-start gap-1.5 rounded-lg border px-2 py-1.5 ${
        overlay || dragging
          ? "border-[#9F99F8] bg-white shadow-md"
          : done
            ? "border-[#E5E5E5] bg-[#FAFAFA]"
            : "border-[#E5E5E5] bg-white"
      }`}
    >
      <button
        type="button"
        {...(attributes ?? {})}
        {...(listeners ?? {})}
        aria-label="Reordenar tarea"
        tabIndex={overlay ? -1 : undefined}
        className={`mt-0.5 shrink-0 touch-none text-[#999999] ${
          overlay
            ? "cursor-grabbing"
            : "cursor-grab hover:text-[#666666] active:cursor-grabbing"
        }`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={overlay ? undefined : () => onToggle?.(item.id)}
        aria-pressed={done}
        aria-label={done ? "Marcar como pendiente" : "Marcar como lista"}
        tabIndex={overlay ? -1 : undefined}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
          done
            ? "border-[#B1D750] bg-[#B1D750] text-white"
            : "border-[#E5E5E5] text-transparent hover:border-[#B1D750]"
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      {overlay ? (
        <span
          className={`min-w-0 flex-1 whitespace-pre-wrap font-sans text-sm leading-snug ${textTone}`}
        >
          {item.texto}
        </span>
      ) : (
        <textarea
          ref={taRef}
          value={item.texto}
          onChange={(e) => onEdit?.(item.id, e.target.value)}
          onBlur={onBlur}
          rows={1}
          className={`min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-sm leading-snug focus:outline-none focus:ring-0 ${textTone}`}
        />
      )}

      <button
        type="button"
        onClick={overlay ? undefined : () => onDelete?.(item.id)}
        aria-label="Eliminar tarea"
        tabIndex={overlay ? -1 : undefined}
        className="mt-0.5 shrink-0 text-[#999999] opacity-0 transition-opacity hover:text-[#ED75A0] group-hover/item:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
