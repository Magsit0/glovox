"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { AgendaItem } from "@/db/schema";
import { newId } from "@/lib/agenda/newId";
import { saveAgendaItemsAction } from "../actions";
import SortableItem from "./SortableItem";

export interface DiaView {
  fecha: string; // YYYY-MM-DD
  items: AgendaItem[];
  esHoy: boolean;
}

/**
 * Contrato que cada columna expone al board (AgendaBoard) para coordinar el drag
 * ENTRE días. El board hospeda el único DndContext y, al soltar, computa el
 * movimiento y lo aplica llamando `moveApply` en la columna origen y en la destino
 * — así toda la persistencia (debounce/flush/reintento/re-sync) sigue viviendo
 * acá, sin duplicarse.
 */
export interface ColumnHandle {
  fecha: string;
  getItems: () => AgendaItem[];
  moveApply: (next: AgendaItem[]) => void;
}

type Status = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;
const MAX_RETRIES = 3;

/**
 * Partes de fecha en es-CL sin off-by-one: la fecha viene como YYYY-MM-DD y la
 * anclamos a UTC medianoche, así que formateamos en UTC para no cruzar de día.
 */
function partesFecha(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", ...opts }).format(d);
  return {
    weekday: fmt({ weekday: "long" }),
    day: fmt({ day: "numeric" }),
    month: fmt({ month: "short" }),
  };
}

export default function DayColumn({
  dia,
  register,
  unregister,
}: {
  dia: DiaView;
  register: (fecha: string, handle: ColumnHandle) => void;
  unregister: (fecha: string) => void;
}) {
  const [items, setItems] = useState<AgendaItem[]>(dia.items);
  const [status, setStatus] = useState<Status>("idle");
  const [nuevo, setNuevo] = useState("");
  // Snapshots en STATE (no refs) para poder compararlos EN RENDER: `savedSnap`
  // = último confirmado en DB; `serverSnap` = últimas props del server adoptadas.
  const [savedSnap, setSavedSnap] = useState(() => JSON.stringify(dia.items));
  const [serverSnap, setServerSnap] = useState(() => JSON.stringify(dia.items));

  const savedRef = useRef(savedSnap); // espejo de savedSnap para la lógica async
  const pendingRef = useRef<AgendaItem[] | null>(null); // items esperando guardado
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef(0);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve()); // serializa saves de esta columna
  const itemsRef = useRef(items); // espejo de items para getItems() (lectura del board en el drop)

  // Columna = droppable de área completa (header + lista + input): soltar en
  // cualquier parte que NO sea sobre un ítem cae "en este día" (append al final).
  const { setNodeRef: setColRef, isOver } = useDroppable({
    id: `col:${dia.fecha}`,
    data: { type: "column", fecha: dia.fecha },
  });

  // #4 Re-sync con props del server (patrón oficial de React "ajustar estado al
  // cambiar una prop": setState condicional EN RENDER, converge porque igualamos
  // serverSnap). Cuando el server manda datos nuevos (via router.refresh al volver
  // a la pestaña — ver AgendaBoard) los adoptamos, pero SOLO si no hay edición
  // local sin guardar → no pisamos lo que estás escribiendo. Tablero compartido de
  // uso casi individual: last-write-wins. El merge por-ítem concurrente (dos
  // superadmins en el mismo día a la vez) queda DIFERIDO por decisión.
  const incoming = JSON.stringify(dia.items);
  if (incoming !== serverSnap) {
    setServerSnap(incoming);
    if (JSON.stringify(items) === savedSnap) {
      setItems(dia.items);
      setSavedSnap(incoming);
    }
  }

  // Espejo savedSnap → savedRef, para leer el último guardado dentro de callbacks
  // async (donde el state del closure podría estar stale entre guardados).
  useEffect(() => {
    savedRef.current = savedSnap;
  }, [savedSnap]);

  // Espejo items → itemsRef, para que el board lea el estado vivo de la columna al
  // soltar (getItems) sin re-registrar el handle en cada cambio.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const persist = useCallback(
    async (next: AgendaItem[]) => {
      const snap = JSON.stringify(next);
      if (snap === savedRef.current) {
        // Limpiar el pending SOLO si sigue siendo este payload: no pisar un edit
        // más nuevo que se encoló mientras este guardado estaba en vuelo.
        if (pendingRef.current === next) pendingRef.current = null;
        setStatus("saved");
        return;
      }
      setStatus("saving");
      // Serializa las escrituras de ESTA columna: cada save se emite recién cuando
      // el anterior terminó, así dos guardados a la misma fecha (p. ej. el flush de
      // un edit + el guardado de un movimiento entre días) commitean EN ORDEN y no
      // se pisan (evita el duplicado por reordenamiento de requests).
      const run = saveChainRef.current.then(() =>
        saveAgendaItemsAction(dia.fecha, next),
      );
      saveChainRef.current = run.then(
        () => undefined,
        () => undefined,
      );
      try {
        const res = await run;
        if (res.ok) {
          savedRef.current = snap;
          setSavedSnap(snap);
          // Ver arriba: limpiar el pending solo si sigue siendo este payload.
          if (pendingRef.current === next) pendingRef.current = null;
          retryRef.current = 0;
          setStatus("saved");
        } else {
          // #5 En fallo NO revertimos (perdería lo tipeado): conservamos el estado
          // local, dejamos el pending y marcamos error; el efecto de reintento se
          // encarga del backoff acotado.
          pendingRef.current = next;
          setStatus("error");
        }
      } catch {
        // Rechazo del RPC (p. ej. fallo de red): mismo trato que un error de
        // guardado, sin revertir, para que el reintento acotado lo tome.
        pendingRef.current = next;
        setStatus("error");
      }
    },
    [dia.fecha],
  );

  // Cambios estructurales (reordenar/agregar/borrar/toggle/mover-de-día) → guardar ya.
  const persistNow = useCallback(
    (next: AgendaItem[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      retryRef.current = 0;
      pendingRef.current = next;
      void persist(next);
    },
    [persist],
  );

  // Edición de texto → guardar con debounce.
  const persistDebounced = useCallback(
    (next: AgendaItem[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      retryRef.current = 0;
      pendingRef.current = next;
      setStatus("idle");
      timerRef.current = setTimeout(() => void persist(next), DEBOUNCE_MS);
    },
    [persist],
  );

  // Aplica un nuevo array (reorden intra-día o movimiento entre días que dispara
  // el board) y lo persiste ya. No cierra sobre `items` → estable; el board pasa
  // el `next` ya computado.
  const moveApply = useCallback(
    (next: AgendaItem[]) => {
      setItems(next);
      persistNow(next);
    },
    [persistNow],
  );

  // Registro del handle en el board (para coordinar el drag entre días).
  useEffect(() => {
    const handle: ColumnHandle = {
      fecha: dia.fecha,
      getItems: () => itemsRef.current,
      moveApply,
    };
    register(dia.fecha, handle);
    return () => unregister(dia.fecha);
  }, [dia.fecha, moveApply, register, unregister]);

  // #3 Flush inmediato de lo pendiente (onBlur del textarea): guarda el edit
  // dentro de la ventana de debounce antes de perder el foco.
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current) void persist(pendingRef.current);
  }, [persist]);

  // #3 Flush también al desmontar (navegar fuera / cerrar) para no perder el
  // último edit pendiente. Fire-and-forget: dispara el POST antes del teardown.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current) void persist(pendingRef.current);
    };
  }, [persist]);

  // #5 Reintento acotado ante fallo: al quedar en "error", reintenta el pending
  // con backoff creciente hasta MAX_RETRIES. persist pasa por "saving" en cada
  // intento, así que el cambio de status re-dispara este efecto en cadena. Una
  // nueva acción del usuario resetea retryRef y corta la cadena vieja.
  useEffect(() => {
    if (status !== "error" || retryRef.current >= MAX_RETRIES) return;
    const t = setTimeout(
      () => {
        retryRef.current += 1;
        const p = pendingRef.current;
        if (p) void persist(p);
      },
      1500 * (retryRef.current + 1),
    );
    return () => clearTimeout(t);
  }, [status, persist]);

  function editItem(id: string, texto: string) {
    const next = items.map((i) => (i.id === id ? { ...i, texto } : i));
    setItems(next);
    persistDebounced(next);
  }

  function deleteItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    persistNow(next);
  }

  // Marcar/desmarcar como listo (ok).
  function toggleItem(id: string) {
    const next = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
    setItems(next);
    persistNow(next);
  }

  function addItem() {
    const texto = nuevo.trim();
    if (!texto) return;
    const next = [...items, { id: newId(), texto }];
    setItems(next);
    setNuevo("");
    persistNow(next);
  }

  const { weekday, day, month } = partesFecha(dia.fecha);

  return (
    <div
      ref={setColRef}
      data-hoy={dia.esHoy}
      className={`relative flex w-72 shrink-0 flex-col rounded-lg border bg-white transition-all duration-300 ease-out hover:z-10 hover:w-[22rem] hover:shadow-md ${
        dia.esHoy
          ? "border-[#9F99F8]"
          : "border-[#E5E5E5] hover:border-[#9F99F8]"
      } ${isOver ? "ring-1 ring-[#9F99F8]" : ""}`}
    >
      <div
        className={`rounded-t-lg border-b px-4 py-3 ${
          dia.esHoy ? "border-[#9F99F8] bg-[#F0EFFE]" : "border-[#E5E5E5]"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-sans text-xs capitalize text-[#666666]">
            {weekday}
          </span>
          {dia.esHoy && (
            <span className="rounded-full bg-[#9F99F8] px-2 py-0.5 font-sans text-xs font-medium text-white">
              Hoy
            </span>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span
            className={`font-display text-2xl font-bold leading-none ${
              dia.esHoy ? "text-[#9F99F8]" : "text-[#333333]"
            }`}
          >
            {day}
          </span>
          <span className="font-sans text-sm text-[#666666]">{month}</span>
        </div>
      </div>

      <div className="flex min-h-[300px] flex-1 flex-col gap-2 p-3">
        <SortableContext
          id={dia.fecha}
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1.5">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                fecha={dia.fecha}
                onEdit={editItem}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onBlur={flush}
              />
            ))}
          </div>
        </SortableContext>

        {items.length === 0 && (
          <p className="px-1 font-sans text-xs text-[#999999]">
            Sin tareas todavía.
          </p>
        )}

        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          onBlur={addItem}
          placeholder="Agregar tarea…"
          className="mt-1 w-full rounded-lg border border-dashed border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-solid focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        />
        <StatusLine status={status} />
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status === "saving") {
    return <p className="font-sans text-xs text-[#999999]">Guardando…</p>;
  }
  if (status === "saved") {
    return (
      <p className="inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B1D750]" />
        Guardado
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="inline-flex items-center gap-1.5 font-sans text-xs text-[#ED75A0]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ED75A0]" />
        No se pudo guardar · reintentando…
      </p>
    );
  }
  // Reserva la altura para que las columnas no salten al cambiar de estado.
  return <p className="select-none font-sans text-xs text-transparent">·</p>;
}
