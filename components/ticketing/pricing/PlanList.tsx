"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import type { TicketingPlan, Country as PgCountry } from "@/db/schema";
import { createPlanAction } from "@/app/ticketing/actions";

interface Props {
  planes: TicketingPlan[];
  defaultCountry: PgCountry;
}

function fmtFecha(v: string | null): string {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PlanList({ planes, defaultCountry }: Props) {
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
            Armá el pricing de un evento: etapas de venta, tipos de producto y sponsors. Guardá y
            exportá a Excel para compartir con la ticketera.
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
          defaultCountry={defaultCountry}
          onClose={() => setShowForm(false)}
          onCreated={(id) => router.push(`/ticketing?tab=pricing&plan=${id}`)}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left font-medium text-[#666666]">Evento</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">País</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-[#666666]">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {planes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center font-sans text-sm text-[#999999]">
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
  defaultCountry,
  onClose,
  onCreated,
}: {
  defaultCountry: PgCountry;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [country, setCountry] = useState<PgCountry>(defaultCountry);
  const [fechaEvento, setFechaEvento] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!nombre.trim()) {
      setError("El nombre del evento es obligatorio");
      return;
    }
    startTransition(async () => {
      const res = await createPlanAction({
        nombre: nombre.trim(),
        country,
        fechaEvento: fechaEvento || null,
      });
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Nombre del evento *">
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Piknic 9 26-27"
            className={inputCls}
          />
        </Field>
        <Field label="País">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value as PgCountry)}
            className={inputCls}
          >
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
          </select>
        </Field>
        <Field label="Fecha del evento">
          <input
            type="date"
            value={fechaEvento}
            onChange={(e) => setFechaEvento(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

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
          disabled={pending || !nombre.trim()}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-xs text-[#666666]">{label}</span>
      {children}
    </label>
  );
}
