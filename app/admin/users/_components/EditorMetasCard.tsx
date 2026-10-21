"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { setEditoresAction } from "../actions";

type Candidato = { id: string; email: string };
type Editor = { userId: string; email: string; asignadoAt: string };

const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});

/**
 * Editores de `metas-evento`: las personas (hasta `max`) que definen goalTickets
 * y budgetPm desde el drill de Control inversión PM. Se guarda la lista entera y
 * rige al instante, sin esperar un nuevo sign-in. Candidatos: usuarios activos
 * con acceso a /inversion-medios, más quien ya sea editor (para poder quitarlo
 * aunque haya perdido el acceso al panel).
 */
export function EditorMetasCard({
  editores,
  candidatos,
  max,
}: {
  editores: Editor[];
  candidatos: Candidato[];
  max: number;
}) {
  const inicial = editores.map((e) => e.userId).sort();
  const [abierta, setAbierta] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const desde = new Map(editores.map((e) => [e.userId, e.asignadoAt]));
  const opciones = [
    ...candidatos,
    ...editores
      .filter((e) => !candidatos.some((c) => c.id === e.userId))
      .map((e) => ({ id: e.userId, email: e.email })),
  ].sort((a, b) => a.email.localeCompare(b.email, "es"));

  // Selección efectiva = solo lo que sigue en pantalla. Si al revalidar alguien
  // marcado desaparece (revocado, o perdió el acceso al panel sin ser editor),
  // no debe ocupar cupo ni viajar al guardar. La page además remonta la card
  // (key) cuando cambia la lista guardada.
  const efectivos = elegidos.filter((id) => opciones.some((o) => o.id === id));
  const lleno = efectivos.length >= max;
  const cambio = [...efectivos].sort().join() !== inicial.join();

  function alternar(id: string) {
    setError(null);
    setElegidos((prev) => {
      const vivos = prev.filter((x) => opciones.some((o) => o.id === x));
      return vivos.includes(id) ? vivos.filter((x) => x !== id) : vivos.length >= max ? vivos : [...vivos, id];
    });
  }

  function guardar() {
    setError(null);
    start(async () => {
      try {
        const res = await setEditoresAction("metas-evento", efectivos);
        if (!res.ok) setError(res.error);
      } catch {
        setError("No se pudo guardar. Intenta de nuevo.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
      {/* Plegada por defecto: en la página manda la matriz de usuarios, esto se
          toca poco. La línea resume quiénes son hoy los editores. */}
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-controls="editores-metas-panel"
        className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-[var(--surface-alt)]"
      >
        <span className="min-w-0 font-sans text-sm">
          <span className="font-medium text-[var(--ink)]">Editores de metas por evento</span>
          <span className="text-[var(--ink-muted)]">
            {" · "}
            {editores.length === 0 ? "nadie asignado" : editores.map((e) => e.email).join(", ")}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-sans text-xs font-medium text-[var(--ink-muted)]">
          {abierta ? "Ocultar" : "Gestionar"}
          <ChevronDown className={`h-4 w-4 transition-transform ${abierta ? "rotate-180" : ""}`} />
        </span>
      </button>

      {abierta && (
      <div id="editores-metas-panel" className="border-t border-[var(--divider)] px-4 pb-4 pt-3">
      <p className="max-w-3xl font-sans text-sm text-[var(--ink-muted)]">
        Hasta {max} personas definen la meta de tickets (goalTickets) y el techo de inversión
        (budgetPm) de un evento desde Control inversión PM. Escriben solo la celda de ese evento en
        la planilla y en BigQuery. Quitar a alguien rige al instante. Los superadmins siempre
        pueden editar y no ocupan cupo.
      </p>

      <div className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {opciones.map((o) => {
          const marcado = efectivos.includes(o.id);
          const bloqueado = pending || (!marcado && lleno);
          const asignado = desde.get(o.id);
          return (
            <label
              key={o.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 font-sans text-sm text-[var(--ink)] transition-colors ${
                bloqueado ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[var(--surface-alt)]"
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                disabled={bloqueado}
                onChange={() => alternar(o.id)}
                className="h-4 w-4 accent-[#9F99F8]"
              />
              <span className="min-w-0 truncate">{o.email}</span>
              {asignado && (
                <span className="shrink-0 font-sans text-xs text-[var(--ink-subtle)]">
                  desde {FECHA.format(new Date(asignado))}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={guardar}
          disabled={pending || !cambio}
          className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <span className="font-sans text-xs text-[var(--ink-subtle)]">
          {efectivos.length === 0 ? "Nadie elegido" : `${efectivos.length} de ${max} elegidos`}
        </span>
      </div>
      {error && <p className="mt-2 font-sans text-xs text-[#ED75A0]">{error}</p>}
      </div>
      )}
    </section>
  );
}
