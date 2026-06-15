"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { TicketingSponsor, Country as PgCountry } from "@/db/schema";
import {
  createSponsorAction,
  deleteSponsorAction,
  renameSponsorAction,
  setSponsorActivoAction,
} from "@/app/ticketing/actions";

interface Props {
  sponsors: TicketingSponsor[]; // ambos países, incluye inactivos
  defaultCountry: PgCountry;
}

/**
 * Gestión simple del catálogo de sponsors: alta, renombrar y activar/desactivar,
 * con pestañas por país. El % de descuento y el cupo NO se manejan acá — van por
 * evento en el plan.
 */
export default function SponsorManager({ sponsors, defaultCountry }: Props) {
  const router = useRouter();
  const [country, setCountry] = useState<PgCountry>(defaultCountry);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const delPais = useMemo(
    () =>
      sponsors
        .filter((s) => s.country === country)
        .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre)),
    [sponsors, country],
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Error inesperado");
        return;
      }
      router.refresh();
    });
  }

  function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    run(async () => {
      const res = await createSponsorAction(country, nombre);
      if (res.ok) setNuevo("");
      return res;
    });
  }

  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-[#333333]">Catálogo de sponsors</h3>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Marcas disponibles para elegir al armar un plan. El % de descuento y el cupo se cargan
            por evento.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-[#E5E5E5] p-0.5">
          {(["CL", "PE"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCountry(c)}
              className={`rounded-md px-3 py-1 font-sans text-sm transition-colors ${
                country === c
                  ? "bg-[#9F99F8] font-medium text-white"
                  : "text-[#666666] hover:text-[#333333]"
              }`}
            >
              {c === "CL" ? "Chile" : "Perú"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
          <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col divide-y divide-[#E5E5E5] border-y border-[#E5E5E5]">
        {delPais.length === 0 && (
          <p className="py-6 text-center font-sans text-sm text-[#999999]">
            Todavía no hay marcas para {country === "CL" ? "Chile" : "Perú"}.
          </p>
        )}
        {delPais.map((s) => (
          <SponsorRow key={s.id} sponsor={s} pending={pending} onRun={run} />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              agregar();
            }
          }}
          placeholder="Nueva marca (ej. ENTEL)…"
          className="max-w-xs flex-1 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        />
        <button
          type="button"
          onClick={agregar}
          disabled={pending || !nuevo.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>
    </section>
  );
}

function SponsorRow({
  sponsor,
  pending,
  onRun,
}: {
  sponsor: TicketingSponsor;
  pending: boolean;
  onRun: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(sponsor.nombre);

  function guardar() {
    const next = nombre.trim();
    if (!next || next === sponsor.nombre) {
      setEditing(false);
      setNombre(sponsor.nombre);
      return;
    }
    onRun(() => renameSponsorAction(sponsor.id, next));
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      {editing ? (
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar();
            } else if (e.key === "Escape") {
              setEditing(false);
              setNombre(sponsor.nombre);
            }
          }}
          className="max-w-xs flex-1 rounded-md border border-[#9F99F8] bg-white px-2 py-1 font-sans text-sm text-[#333333] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
        />
      ) : (
        <span
          className={`flex-1 font-sans text-sm ${
            sponsor.activo ? "text-[#333333]" : "text-[#999999] line-through"
          }`}
        >
          {sponsor.nombre}
        </span>
      )}

      {editing ? (
        <>
          <button
            type="button"
            onClick={guardar}
            disabled={pending}
            aria-label="Guardar nombre"
            className="rounded-md p-1.5 text-[#4F9D69] transition-colors hover:bg-[#EBF7EF] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNombre(sponsor.nombre);
            }}
            aria-label="Cancelar"
            className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#FAFAFA]"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Renombrar"
            className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRun(() => setSponsorActivoAction(sponsor.id, !sponsor.activo))}
            disabled={pending}
            className={`rounded-full px-3 py-1 font-sans text-xs font-medium transition-colors disabled:opacity-50 ${
              sponsor.activo
                ? "border border-[#E5E5E5] text-[#666666] hover:border-[#ED75A0] hover:text-[#A8336B]"
                : "bg-[#F0EFFE] text-[#9F99F8] hover:bg-[#E4E2FC]"
            }`}
          >
            {sponsor.activo ? "Desactivar" : "Activar"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Eliminar "${sponsor.nombre}" del catálogo? Los planes que ya la usan conservan el nombre.`)) {
                onRun(() => deleteSponsorAction(sponsor.id));
              }
            }}
            disabled={pending}
            aria-label="Eliminar"
            className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#FCE4EE] hover:text-[#A8336B] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
