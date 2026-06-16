"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { TicketingPlan } from "@/db/schema";
import type { EventoOption } from "@/lib/queries/ticketing";
import { createPlanAction } from "@/app/ticketing/actions";

interface Props {
  planes: TicketingPlan[];
  /** Eventos de categoriaEvento que aún no tienen plan (para crear uno nuevo). */
  eventosDisponibles: EventoOption[];
}

function fmtFecha(v: string | null): string {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function eventoIdDe(p: TicketingPlan): string {
  const doc = p.doc as { eventoId?: unknown } | null;
  return typeof doc?.eventoId === "string" ? doc.eventoId : "";
}

export default function PlanList({ planes, eventosDisponibles }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
            Planes de pricing
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Cada plan se crea a partir de un evento de glovox.categoriaEvento. La info general
            (nombre, país, venue, fecha) viene de ahí.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
        >
          <Plus className="h-4 w-4" />
          Nuevo plan
        </button>
      </div>

      {showForm && (
        <NewPlanForm
          eventos={eventosDisponibles}
          onClose={() => setShowForm(false)}
          onCreated={(id) => router.push(`/ticketing?tab=pricing&plan=${id}`)}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left font-medium text-[#666666]">Evento</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">EventoID</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">País</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {planes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center font-sans text-sm text-[#999999]">
                  Todavía no hay planes. Creá el primero con “Nuevo plan”.
                </td>
              </tr>
            )}
            {planes.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/ticketing?tab=pricing&plan=${p.id}`)}
                className="cursor-pointer border-b border-[#E5E5E5] transition-colors last:border-0 hover:bg-[#FAFAFA]"
              >
                <td className="px-4 py-3 font-medium text-[#333333]">{p.nombre}</td>
                <td className="px-4 py-3 tabular-nums text-[#666666]">{eventoIdDe(p) || "—"}</td>
                <td className="px-4 py-3 text-[#666666]">{p.country}</td>
                <td className="px-4 py-3 text-[#666666]">{fmtFecha(p.fechaEvento)}</td>
                <td className="px-4 py-3 text-[#666666]">
                  {p.updatedAt
                    ? new Date(p.updatedAt).toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewPlanForm({
  eventos,
  onClose,
  onCreated,
}: {
  eventos: EventoOption[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [eventoId, setEventoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sel = eventos.find((e) => e.eventoId === eventoId);

  function submit() {
    setError(null);
    if (!eventoId) {
      setError("Elegí un evento de categoriaEvento");
      return;
    }
    startTransition(async () => {
      const res = await createPlanAction(eventoId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data) onCreated(res.data.id);
    });
  }

  return (
    <div className="rounded-lg border border-[#333333] bg-white p-6">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="font-display text-lg font-bold text-[#333333]">Nuevo plan</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {eventos.length === 0 ? (
        <p className="font-sans text-sm text-[#666666]">
          No hay eventos en glovox.categoriaEvento sin plan asignado. Cargá el evento en esa tabla
          (con su EventoID, nombre y fecha) o revisá si ya todos tienen plan.
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="font-sans text-xs text-[#666666]">Evento (de glovox.categoriaEvento)</span>
            <select
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Elegí un evento —</option>
              {eventos.map((ev) => (
                <option key={ev.eventoId} value={ev.eventoId}>
                  {ev.eventoId} — {ev.nombre || "sin nombre"}
                  {ev.fecha ? ` · ${ev.fecha}` : ""}
                </option>
              ))}
            </select>
          </label>
          {sel && (
            <p className="mt-2 font-sans text-sm text-[#666666]">
              {sel.country === "PE" ? "Perú" : "Chile"}
              {sel.venue ? ` · ${sel.venue}` : ""}
              {sel.fecha ? ` · ${sel.fecha}` : " · fecha s/d"}
            </p>
          )}
        </>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
          <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#E5E5E5] pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !eventoId}
          className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear plan"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";
