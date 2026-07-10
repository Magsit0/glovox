"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAgendaNotaAction } from "../actions";

export interface DiaView {
  fecha: string; // YYYY-MM-DD
  contenido: string;
  esHoy: boolean;
}

type Status = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

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

export default function DayColumn({ dia }: { dia: DiaView }) {
  const [value, setValue] = useState(dia.contenido);
  const [status, setStatus] = useState<Status>("idle");
  const savedRef = useRef(dia.contenido);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (texto: string) => {
      if (texto === savedRef.current) return;
      setStatus("saving");
      const res = await saveAgendaNotaAction(dia.fecha, texto);
      if (res.ok) {
        savedRef.current = texto;
        setStatus("saved");
      } else {
        setStatus("error");
      }
    },
    [dia.fecha],
  );

  // Limpia el timer pendiente al desmontar.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    setStatus(v === savedRef.current ? "saved" : "idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(v), DEBOUNCE_MS);
  }

  // Al salir del campo, guarda de inmediato lo pendiente.
  function onBlur() {
    if (timerRef.current) clearTimeout(timerRef.current);
    void save(value);
  }

  const { weekday, day, month } = partesFecha(dia.fecha);

  return (
    <div
      data-hoy={dia.esHoy}
      className={`relative flex w-72 shrink-0 flex-col rounded-lg border bg-white transition-all duration-300 ease-out hover:z-10 hover:w-[22rem] hover:shadow-md ${
        dia.esHoy
          ? "border-[#9F99F8]"
          : "border-[#E5E5E5] hover:border-[#9F99F8]"
      }`}
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

      <div className="flex flex-1 flex-col p-3">
        <textarea
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="¿Qué hay que hacer?"
          className="min-h-[320px] w-full flex-1 resize-none rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        />
        <StatusLine status={status} />
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status === "saving") {
    return <p className="mt-2 font-sans text-xs text-[#999999]">Guardando…</p>;
  }
  if (status === "saved") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B1D750]" />
        Guardado
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs text-[#ED75A0]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ED75A0]" />
        No se pudo guardar
      </p>
    );
  }
  // Reserva la altura para que las columnas no salten al cambiar de estado.
  return <p className="mt-2 select-none font-sans text-xs text-transparent">·</p>;
}
