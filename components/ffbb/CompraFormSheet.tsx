"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, X } from "lucide-react";
import type { CompraInsumoRow } from "@/lib/queries/compras-insumo";
import {
  bulkCreateComprasAction,
  updateCompraAction,
  type CompraInput,
} from "@/app/ffbb/actions";
import InsumoCombobox from "./InsumoCombobox";
import ProveedorCombobox from "./ProveedorCombobox";

interface Props {
  open: boolean;
  onClose: () => void;
  eventoId: string;
  insumos: string[];
  proveedores: string[];
  initial?: CompraInsumoRow | null;
  onSaved?: () => void;
}

interface DocumentState {
  numeroFactura: string;
  proveedor: string;
  fechaCompra: string;
  tipoOperacion: string;
  obs: string;
}

interface ItemState {
  uid: number; // identificador local para keys de React
  insumo: string;
  recibido: string;
  bruto: string;
}

const EMPTY_DOC: DocumentState = {
  numeroFactura: "",
  proveedor: "",
  fechaCompra: "",
  tipoOperacion: "ingreso",
  obs: "",
};

function emptyItem(uid: number): ItemState {
  return { uid, insumo: "", recibido: "", bruto: "" };
}

function fromRow(r: CompraInsumoRow): { doc: DocumentState; item: ItemState } {
  const num = (v: number | null) => (v == null ? "" : String(v));
  return {
    doc: {
      numeroFactura: r.numeroFactura ?? "",
      proveedor: r.proveedor ?? "",
      fechaCompra: r.fechaCompra ?? "",
      tipoOperacion: r.tipoOperacion,
      obs: r.obs ?? "",
    },
    item: {
      uid: 0,
      insumo: r.insumo,
      recibido: num(r.recibido),
      bruto: num(r.bruto),
    },
  };
}

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function CompraFormSheet({
  open,
  onClose,
  eventoId,
  insumos,
  proveedores,
  initial,
  onSaved,
}: Props) {
  const isEdit = !!initial;

  const [doc, setDoc] = useState<DocumentState>(EMPTY_DOC);
  const [items, setItems] = useState<ItemState[]>([emptyItem(0)]);
  const [nextUid, setNextUid] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset state cuando se abre el modal o cambia el target a editar.
  // Render-phase update con guard de previous value (regla react-hooks/set-state-in-effect).
  const formKey = `${open ? "open" : "closed"}::${initial?.id ?? "new"}`;
  const [prevFormKey, setPrevFormKey] = useState(formKey);
  if (prevFormKey !== formKey) {
    setPrevFormKey(formKey);
    if (open) {
      if (initial) {
        const { doc: d, item: i } = fromRow(initial);
        setDoc(d);
        setItems([{ ...i, uid: 0 }]);
        setNextUid(1);
      } else {
        setDoc(EMPTY_DOC);
        setItems([emptyItem(0)]);
        setNextUid(1);
      }
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function setDocField<K extends keyof DocumentState>(key: K, val: DocumentState[K]) {
    setDoc((prev) => ({ ...prev, [key]: val }));
  }

  function setItemField(uid: number, field: keyof Omit<ItemState, "uid">, val: string) {
    setItems((prev) =>
      prev.map((it) => (it.uid === uid ? { ...it, [field]: val } : it)),
    );
  }

  function addRow() {
    setItems((prev) => [...prev, emptyItem(nextUid)]);
    setNextUid((n) => n + 1);
  }

  function removeRow(uid: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.uid !== uid)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedItems = items.filter((it) => it.insumo.trim().length > 0);
    if (trimmedItems.length === 0) {
      setError("Agregá al menos un ítem con un insumo.");
      return;
    }

    const docPayload = {
      numeroFactura: doc.numeroFactura.trim() || null,
      proveedor: doc.proveedor.trim() || null,
      fechaCompra: doc.fechaCompra.trim() || null,
      tipoOperacion: doc.tipoOperacion.trim() || "ingreso",
      obs: doc.obs.trim() || null,
    };

    startTransition(async () => {
      if (isEdit && initial) {
        // En edit solo hay 1 ítem; preservamos los campos legacy del initial
        // (costoUnitario, costoNeto, iva, nPallets, etc.) para no perder info.
        const it = trimmedItems[0];
        const payload: Partial<CompraInput> = {
          eventoId,
          insumo: it.insumo.trim(),
          recibido: parseNum(it.recibido),
          bruto: parseNum(it.bruto),
          ...docPayload,
          // legacy preservado
          pedido: initial.pedido,
          nPallets: initial.nPallets,
          nDisplay: initial.nDisplay,
          xDisplay: initial.xDisplay,
          sueltas: initial.sueltas,
          lugar: initial.lugar,
          costoUnitario: initial.costoUnitario,
          costoNeto: initial.costoNeto,
          iva: initial.iva,
        };
        const res = await updateCompraAction(initial.id, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onSaved?.();
        onClose();
        return;
      }

      // CREATE: una fila en DB por cada ítem, todas con el mismo header.
      const payloads: Partial<CompraInput>[] = trimmedItems.map((it) => ({
        eventoId,
        insumo: it.insumo.trim(),
        recibido: parseNum(it.recibido),
        bruto: parseNum(it.bruto),
        ...docPayload,
      }));
      const res = await bulkCreateComprasAction(payloads);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved?.();
      onClose();
    });
  }

  const validCount = items.filter((it) => it.insumo.trim().length > 0).length;
  const submitLabel = isEdit
    ? pending
      ? "Guardando…"
      : "Guardar cambios"
    : pending
      ? "Imputando…"
      : `Imputar ${validCount} ${validCount === 1 ? "fila" : "filas"}`;

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
            className="fixed inset-0 z-40 bg-black/30"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compra-form-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-md">
              <header className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] px-6 py-4">
                <div>
                  <h2
                    id="compra-form-title"
                    className="font-display text-lg font-bold tracking-tight text-[#333333]"
                  >
                    {isEdit ? "Editar compra" : "Imputar compras"}
                  </h2>
                  <p className="mt-1 font-sans text-xs text-[#666666]">
                    {isEdit
                      ? `Compra del evento ${eventoId}.`
                      : `Una sola cabecera de documento, varios insumos en este evento (${eventoId}).`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <form
                onSubmit={handleSubmit}
                className="flex flex-1 flex-col overflow-y-auto px-6 py-5"
              >
                <SectionTitle>Datos del documento</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Proveedor">
                    <ProveedorCombobox
                      options={proveedores}
                      value={doc.proveedor}
                      onChange={(v) => setDocField("proveedor", v)}
                    />
                  </Field>
                  <Field label="N° / código de factura">
                    <TextInput
                      value={doc.numeroFactura}
                      onChange={(v) => setDocField("numeroFactura", v)}
                    />
                  </Field>
                  <Field label="Fecha de compra">
                    <input
                      type="date"
                      value={doc.fechaCompra}
                      onChange={(e) => setDocField("fechaCompra", e.target.value)}
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                  </Field>
                  <Field label="Tipo de operación">
                    <select
                      value={doc.tipoOperacion}
                      onChange={(e) => setDocField("tipoOperacion", e.target.value)}
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                      <option value="ajuste">Ajuste</option>
                    </select>
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Observaciones (opcional)">
                    <textarea
                      value={doc.obs}
                      onChange={(e) => setDocField("obs", e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                  </Field>
                </div>

                <SectionTitle>{isEdit ? "Ítem" : "Ítems"}</SectionTitle>

                <div className="overflow-x-auto">
                  <table className="w-full font-sans text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                        <th className="px-3 py-2 text-left font-medium text-[#666666]">
                          Insumo <span className="text-[#ED75A0]">*</span>
                        </th>
                        <th className="w-40 px-3 py-2 text-right font-medium text-[#666666]">
                          Recibido (un.)
                        </th>
                        <th className="w-40 px-3 py-2 text-right font-medium text-[#666666]">
                          Costo total
                        </th>
                        {!isEdit && <th className="w-12 px-3 py-2" aria-hidden="true" />}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr
                          key={it.uid}
                          className="border-b border-[#E5E5E5] last:border-0"
                        >
                          <td className="px-3 py-2">
                            <InsumoCombobox
                              options={insumos}
                              value={it.insumo}
                              onChange={(v) => setItemField(it.uid, "insumo", v)}
                              placeholder="Buscar insumo…"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <NumInput
                              value={it.recibido}
                              onChange={(v) => setItemField(it.uid, "recibido", v)}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <NumInput
                              value={it.bruto}
                              onChange={(v) => setItemField(it.uid, "bruto", v)}
                              placeholder="0"
                            />
                          </td>
                          {!isEdit && (
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeRow(it.uid)}
                                disabled={items.length <= 1}
                                aria-label="Quitar fila"
                                className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#FCE4EE] hover:text-[#A8336B] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#666666]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!isEdit && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm font-medium text-[#666666] transition-colors hover:border-[#333333] hover:text-[#333333]"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar ítem
                    </button>
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
                    <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
                    <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E5E5] pt-4">
                  <p className="font-sans text-xs text-[#666666]">
                    {isEdit
                      ? "Solo se modifica esta compra."
                      : `${validCount} fila${validCount === 1 ? "" : "s"} válida${validCount === 1 ? "" : "s"}. Las vacías se descartan.`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={pending}
                      className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={pending || validCount === 0}
                      className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
                    >
                      {submitLabel}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-3 first:mt-0">
      <span className="font-display text-sm font-bold uppercase tracking-wide text-[#666666]">
        {children}
      </span>
      <span className="h-px flex-1 bg-[#E5E5E5]" />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-xs text-[#666666]">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
    />
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-right font-sans text-sm tabular-nums text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
    />
  );
}
