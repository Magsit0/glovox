"use client";

/**
 * Edición de las metas del evento (goalTickets / budgetPm) en el drill. Solo se
 * monta para un EDITOR de `metas-evento` o un superadmin (la page lo decide leyendo la base);
 * para cualquier otra persona el drill se ve exactamente como siempre, sin
 * lápiz ni aviso. El guardado lo revalida la server action.
 *
 * Al abrir, el input lee el valor ACTUAL de la hoja (leerMetaEventoAction): de
 * ahí nace todo, y puede diferir de lo que pinta la card (BigQuery) si alguien
 * editó la hoja y aún no sincroniza. Esa base queda fija mientras el input está
 * abierto y viaja como `esperado`: si la página se refresca entremedio (otra
 * edición del drill) y otro editor cambió la celda, el guardado da conflicto en
 * vez de pisarlo.
 */
import { useEffect, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "@/lib/use-router";
import { MAX_META, parseMeta, type BaseMeta, type CampoMeta } from "@/lib/inversion-medios/metas";
import { leerMetaEventoAction, saveMetaEventoAction } from "../actions";

export type MetaEditable = {
  eventoId: string;
  campo: CampoMeta;
};

const UNIDAD: Record<CampoMeta, string> = { goalTickets: "personas", budgetPm: "USD" };
const NOMBRE: Record<CampoMeta, string> = {
  goalTickets: "la meta de tickets",
  budgetPm: "el techo de inversión",
};

type Carga = { estado: "cargando" } | { estado: "lista"; base: BaseMeta } | { estado: "error"; error: string };

/** Input + Guardar / Cancelar. Enter guarda, Escape cancela. */
export function MetaInput({ meta, onCerrar }: { meta: MetaEditable; onCerrar: () => void }) {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: "cargando" });
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let vigente = true;
    leerMetaEventoAction({ eventoId: meta.eventoId, campo: meta.campo })
      .then((res) => {
        if (!vigente) return;
        if (!res.ok) {
          setCarga({ estado: "error", error: res.error });
          return;
        }
        const base = res.data?.base ?? null;
        setCarga({ estado: "lista", base });
        setTexto(typeof base === "number" ? String(base) : "");
      })
      .catch(() => {
        if (vigente) setCarga({ estado: "error", error: "No se pudo leer la planilla. Intenta de nuevo." });
      });
    return () => {
      vigente = false;
    };
  }, [meta.eventoId, meta.campo]);

  const lista = carga.estado === "lista";
  const base = lista ? carga.base : null;
  const valor = parseMeta(texto);
  const invalido = valor === undefined || (valor != null && valor > MAX_META[meta.campo]);

  function guardar() {
    if (!lista || invalido || pending) return;
    if (valor === base) {
      onCerrar();
      return;
    }
    setError(null);
    start(async () => {
      const res = await saveMetaEventoAction({
        eventoId: meta.eventoId,
        campo: meta.campo,
        esperado: base,
        valor: texto,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.warning) window.alert(res.warning);
      onCerrar();
      router.refresh();
    });
  }

  const ayuda = !lista
    ? null
    : valor === undefined
      ? "Escribe un número entero (puedes usar punto de miles)."
      : valor != null && valor > MAX_META[meta.campo]
        ? "El valor es demasiado alto."
        : typeof base === "string"
          ? `La planilla tiene «${base}» en esta celda; al guardar se reemplaza.`
          : null;
  const mensaje = carga.estado === "error" ? carga.error : (error ?? ayuda);
  const mensajeEsError = carga.estado === "error" || error != null || (ayuda != null && typeof base !== "string");

  return (
    // Escape en el contenedor: también cierra con el foco en los botones.
    <div
      className="mt-1.5 flex flex-col gap-1.5"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onCerrar();
      }}
    >
      <div className="flex items-center gap-1.5">
        <input
          // key: al terminar de leer la hoja se remonta y toma el foco ya habilitado.
          key={carga.estado}
          autoFocus
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
          }}
          inputMode="numeric"
          placeholder={carga.estado === "cargando" ? "Leyendo…" : "0"}
          aria-label={`Nuevo valor de ${NOMBRE[meta.campo]}`}
          disabled={!lista || pending}
          className="min-w-0 max-w-28 flex-1 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-2 py-1 text-right font-sans text-sm tabular-nums text-[var(--ink)] transition-colors focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] disabled:opacity-60"
        />
        <span className="shrink-0 font-sans text-[11px] text-[var(--ink-subtle)]">{UNIDAD[meta.campo]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={guardar}
          disabled={!lista || pending || invalido}
          className="rounded-lg bg-[#9F99F8] px-3 py-1 font-sans text-xs font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={onCerrar}
          disabled={pending}
          className="rounded-lg px-3 py-1 font-sans text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--grid)] disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
      {mensaje && (
        <p
          className={`font-sans text-[11px] leading-tight ${
            mensajeEsError ? "text-[#ED75A0]" : "text-[var(--ink-muted)]"
          }`}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}

/**
 * Card de stat del drill (mismo molde: label / valor / nota) con un lápiz junto
 * al label. Al editar, el input reemplaza el valor y la nota.
 */
export function StatMeta({
  label,
  value,
  hint,
  hintClassName = "mt-2 font-sans text-[11px] text-[var(--ink-subtle)]",
  title,
  meta,
}: {
  label: string;
  value: string;
  hint?: string;
  hintClassName?: string;
  title?: string;
  meta: MetaEditable;
}) {
  const [editando, setEditando] = useState(false);
  return (
    <div
      className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4"
      title={editando ? undefined : title}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-sans text-xs text-[var(--ink-muted)]">{label}</p>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            aria-label={`Editar ${NOMBRE[meta.campo]}`}
            title={`Editar ${NOMBRE[meta.campo]}`}
            className="-my-1 inline-flex h-6 w-6 items-center justify-center rounded-lg text-[var(--ink-subtle)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editando ? (
        <MetaInput meta={meta} onCerrar={() => setEditando(false)} />
      ) : (
        <>
          <p className="mt-1.5 font-display text-2xl font-bold leading-none text-[var(--ink)]">{value}</p>
          {hint && <p className={hintClassName}>{hint}</p>}
        </>
      )}
    </div>
  );
}

/** Botón secundario que abre el input en línea (estado vacío de la holgura). */
export function DefinirMeta({ meta, label }: { meta: MetaEditable; label: string }) {
  const [editando, setEditando] = useState(false);
  if (editando) return <MetaInput meta={meta} onCerrar={() => setEditando(false)} />;
  return (
    <button
      onClick={() => setEditando(true)}
      className="rounded-lg border border-[var(--ink)] bg-[var(--surface)] px-3 py-1.5 font-sans text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-alt)]"
    >
      {label}
    </button>
  );
}
