"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Lock, X } from "lucide-react";
import {
  COUNTRY_OPTIONS,
  VENUE_NONE,
  countryLabel,
  deriveMarca,
  existingIdSet,
  inferCurrency,
  inferTemporada,
  suggestNextEventoId,
  validateNewEvent,
  type CountryPrefix,
  type FieldErrors,
  type NewEventPayload,
} from "@/lib/eventos-create";
import { createEventAction } from "../actions";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Lista estandarizada de venues para el desplegable. */
  venues: string[];
  /** EventoIDs ya existentes en la hoja (para unicidad + sugerir el próximo). */
  existingIds: string[];
  /** Se llama tras crear con éxito (el padre refresca la grilla). */
  onCreated: () => void;
};

const onlyDigits = (v: string) => v.replace(/\D+/g, "");

export default function NuevoEventoModal({
  open,
  onClose,
  venues,
  existingIds,
  onCreated,
}: Props) {
  const [prefix, setPrefix] = useState<CountryPrefix>("GLO");
  const [numero, setNumero] = useState("");
  const [nombreGlovox, setNombreGlovox] = useState("");
  const [categoriaEvento, setCategoriaEvento] = useState("");
  const [categoriaEvento2, setCategoriaEvento2] = useState("");
  const [categoriaEvento3, setCategoriaEvento3] = useState("");
  const [fecha, setFecha] = useState("");
  const [venueSel, setVenueSel] = useState(""); // "" = sin elegir; VENUE_NONE = sin venue
  const [goalTickets, setGoalTickets] = useState("");
  const [budgetPm, setBudgetPm] = useState("");
  const [cuentaIg, setCuentaIg] = useState("");
  const [propertyGa4, setPropertyGa4] = useState("");
  const [unabaseId, setUnabaseId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [venueTouched, setVenueTouched] = useState(false);
  const [attempted, setAttempted] = useState(false); // errores "obligatorio" recién al intentar crear
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existing = useMemo(() => existingIdSet(existingIds), [existingIds]);
  /** Parte numérica sugerida (con padding) para un prefijo. */
  const suggestFor = (p: string) =>
    suggestNextEventoId(existingIds, p).slice(p.length);

  // Reset al abrir (patrón render-phase con guard de prev value, sin effects).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setPrefix("GLO");
      setNumero(suggestFor("GLO"));
      setNombreGlovox("");
      setCategoriaEvento("");
      setCategoriaEvento2("");
      setCategoriaEvento3("");
      setFecha("");
      setVenueSel("");
      setVenueTouched(false);
      setAttempted(false);
      setGoalTickets("");
      setBudgetPm("");
      setCuentaIg("");
      setPropertyGa4("");
      setUnabaseId("");
      setShowAdvanced(false);
      setError(null);
    }
  }

  const eventoId = prefix + numero;
  const currency = inferCurrency(eventoId);
  const pais = countryLabel(eventoId);
  const temporada = inferTemporada(fecha);
  const marca = deriveMarca(categoriaEvento);

  const payload: NewEventPayload = {
    eventoId,
    nombreGlovox,
    categoriaEvento,
    categoriaEvento2,
    categoriaEvento3,
    fecha,
    venue: venueSel === VENUE_NONE ? "" : venueSel,
    goalTickets,
    budgetPm,
    cuentaIg,
    propertyGa4,
    unabaseId,
    currency,
    temporada,
  };

  const errors: FieldErrors = validateNewEvent(payload, existing);
  const venueMissing = venueSel === "";

  function onPrefixChange(p: CountryPrefix) {
    setPrefix(p);
    setNumero(suggestFor(p)); // re-sugerir el próximo libre para el nuevo país
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAttempted(true);
    setVenueTouched(true);
    if (Object.keys(errors).length > 0 || venueMissing) {
      setError("Revisa los campos marcados antes de crear.");
      return;
    }
    startTransition(async () => {
      const res = await createEventAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated();
      onClose();
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#333333]/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuevo-evento-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="pointer-events-auto flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-[#E5E5E5] bg-white shadow-md">
              <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#E5E5E5] px-6 py-4">
                <div>
                  <h2
                    id="nuevo-evento-title"
                    className="font-display text-lg font-bold leading-none text-[#333333]"
                  >
                    Nuevo evento
                  </h2>
                  <p className="mt-1 font-sans text-xs text-[#999999]">
                    El EventoID es la llave que consolida tickets, AA&BB, mesas VIP
                    e inversión. Se valida formato y unicidad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="cursor-pointer rounded-lg p-1 text-[#333333] transition-colors hover:bg-[#F5F5F5]"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <form
                onSubmit={handleSubmit}
                className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
              >
                {/* Identidad ------------------------------------------------ */}
                <fieldset className="space-y-4">
                  <legend className="font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                    Identidad
                  </legend>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="País" required>
                      <select
                        value={prefix}
                        onChange={(e) =>
                          onPrefixChange(e.target.value as CountryPrefix)
                        }
                        className={selectCls}
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.prefix} value={c.prefix}>
                            {c.label} ({c.prefix})
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="EventoID" required error={errors.eventoId}>
                      <div className="flex items-stretch">
                        <span className="inline-flex items-center rounded-l-lg border border-r-0 border-[#E5E5E5] bg-[#FAFAFA] px-3 font-sans text-sm font-medium text-[#666666]">
                          {prefix}
                        </span>
                        <input
                          value={numero}
                          onChange={(e) => setNumero(onlyDigits(e.target.value))}
                          inputMode="numeric"
                          placeholder="201"
                          className={`${inputCls} rounded-l-none tabular-nums`}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ReadOnly label="País (inferido)" value={pais || "—"} />
                    <ReadOnly label="Moneda (inferida)" value={currency || "—"} />
                  </div>
                </fieldset>

                {/* Datos del evento ---------------------------------------- */}
                <fieldset className="space-y-4">
                  <legend className="font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                    Datos del evento
                  </legend>

                  <Field label="NombreGlovox" required error={attempted ? errors.nombreGlovox : undefined}>
                    <input
                      value={nombreGlovox}
                      onChange={(e) => setNombreGlovox(e.target.value)}
                      placeholder="Nombre comercial del evento"
                      className={inputCls}
                    />
                  </Field>

                  <Field
                    label="CategoriaEvento"
                    required
                    error={attempted ? errors.categoriaEvento : undefined}
                    hint={marca ? `Marca: ${marca}` : undefined}
                  >
                    <input
                      value={categoriaEvento}
                      onChange={(e) => setCategoriaEvento(e.target.value)}
                      placeholder="Ej. Kiki 1-2"
                      className={inputCls}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="CategoriaEvento2">
                      <input
                        value={categoriaEvento2}
                        onChange={(e) => setCategoriaEvento2(e.target.value)}
                        placeholder="Opcional"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="CategoriaEvento3">
                      <input
                        value={categoriaEvento3}
                        onChange={(e) => setCategoriaEvento3(e.target.value)}
                        placeholder="Opcional"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Fecha" required error={attempted ? errors.fecha : undefined}>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className={inputCls}
                      />
                    </Field>
                    <ReadOnly
                      label="Temporada (inferida)"
                      value={temporada || "—"}
                    />
                  </div>

                  <Field
                    label="venue"
                    required
                    error={(venueTouched || attempted) && venueMissing ? "Elige un venue o “Sin venue”." : undefined}
                  >
                    <select
                      value={venueSel}
                      onChange={(e) => {
                        setVenueSel(e.target.value);
                        setVenueTouched(true);
                      }}
                      className={selectCls}
                    >
                      <option value="" disabled>
                        Selecciona venue…
                      </option>
                      <option value={VENUE_NONE}>— Sin venue —</option>
                      {venues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </Field>
                </fieldset>

                {/* Metas --------------------------------------------------- */}
                <fieldset className="space-y-4">
                  <legend className="font-sans text-xs font-medium uppercase tracking-wide text-[#999999]">
                    Metas (opcional)
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="goalTickets" hint="Meta de tickets">
                      <input
                        value={goalTickets}
                        onChange={(e) => setGoalTickets(onlyDigits(e.target.value))}
                        inputMode="numeric"
                        placeholder="0"
                        className={`${inputCls} tabular-nums`}
                      />
                    </Field>
                    <Field label="budgetPm" hint="Techo inversión medios">
                      <input
                        value={budgetPm}
                        onChange={(e) => setBudgetPm(onlyDigits(e.target.value))}
                        inputMode="numeric"
                        placeholder="0"
                        className={`${inputCls} tabular-nums`}
                      />
                    </Field>
                  </div>
                </fieldset>

                {/* Avanzado ------------------------------------------------ */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((s) => !s)}
                    className="inline-flex cursor-pointer items-center gap-1.5 font-sans text-xs font-medium text-[#666666] transition-colors hover:text-[#333333]"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                    />
                    Campos avanzados (opcional)
                  </button>
                  {showAdvanced && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="CuentaIG">
                          <input
                            value={cuentaIg}
                            onChange={(e) => setCuentaIg(e.target.value)}
                            placeholder="@cuenta"
                            className={inputCls}
                          />
                        </Field>
                        <Field label="property_ga4">
                          <input
                            value={propertyGa4}
                            onChange={(e) => setPropertyGa4(e.target.value)}
                            placeholder="properties/123456"
                            className={inputCls}
                          />
                        </Field>
                      </div>
                      <Field label="unabaseid">
                        <input
                          value={unabaseId}
                          onChange={(e) => setUnabaseId(e.target.value)}
                          placeholder="Opcional"
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg border border-[#ED75A0] px-3 py-2 font-sans text-xs text-[#ED75A0]">
                    {error}
                  </p>
                )}
              </form>

              <footer className="flex shrink-0 gap-2 border-t border-[#E5E5E5] px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="flex-1 cursor-pointer rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={pending}
                  className="flex-1 cursor-pointer rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
                >
                  {pending ? "Creando…" : "Crear evento"}
                </button>
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------- Estilos compartidos + sub-componentes ----------

const inputCls =
  "w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

const selectCls =
  "w-full cursor-pointer rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block font-sans text-xs text-[#666666]">
        {label}
        {required && <span className="ml-0.5 text-[#ED75A0]">*</span>}
      </label>
      {children}
      {error ? (
        <p className="font-sans text-xs text-[#ED75A0]">{error}</p>
      ) : hint ? (
        <p className="font-sans text-xs text-[#999999]">{hint}</p>
      ) : null}
    </div>
  );
}

/** Campo inferido + bloqueado: no editable, con marca de candado. */
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="block font-sans text-xs text-[#666666]">{label}</label>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2">
        <span className="font-sans text-sm text-[#333333]">{value}</span>
        <Lock className="h-3.5 w-3.5 shrink-0 text-[#999999]" />
      </div>
    </div>
  );
}
