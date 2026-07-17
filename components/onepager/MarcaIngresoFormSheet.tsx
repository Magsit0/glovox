"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { MarcaClienteRow } from "@/lib/queries/marca";
import { createMarcaIngresoAction } from "@/app/onepager/marca-actions";
import { netoToBruto } from "@/lib/constants/tax";
import ClienteCombobox from "./ClienteCombobox";

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

/**
 * Acepta tipeo con separadores tipo CL ("1.234.567"), comas o punto decimal.
 * Devuelve 0 si no parsea.
 */
function parseMonto(v: string): number {
  if (!v.trim()) return 0;
  const cleaned = v
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

type Props = {
  open: boolean;
  onClose: () => void;
  eventoId: string;
  clientes: MarcaClienteRow[];
};

export default function MarcaIngresoFormSheet({
  open,
  onClose,
  eventoId,
  clientes,
}: Props) {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [montoNetoStr, setMontoNetoStr] = useState("");
  const [extraClientes, setExtraClientes] = useState<MarcaClienteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Mergeamos clientes recién creados desde el combobox para que sigan
  // disponibles si el padre todavía no se ha re-renderizado.
  const merged = useMemo(() => {
    const seen = new Set(clientes.map((c) => c.id));
    return [...clientes, ...extraClientes.filter((c) => !seen.has(c.id))];
  }, [clientes, extraClientes]);

  const netoNum = useMemo(() => parseMonto(montoNetoStr), [montoNetoStr]);
  const brutoNum = useMemo(() => netoToBruto(netoNum), [netoNum]);

  // Reset al abrir el sheet (render-phase update con guard de prev value).
  const formKey = `${open ? "open" : "closed"}::${eventoId}`;
  const [prevKey, setPrevKey] = useState(formKey);
  if (prevKey !== formKey) {
    setPrevKey(formKey);
    if (open) {
      setClienteId(null);
      setMontoNetoStr("");
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clienteId) {
      setError("Seleccioná un cliente.");
      return;
    }
    if (netoNum <= 0) {
      setError("Ingresá un monto neto válido.");
      return;
    }
    startTransition(async () => {
      const res = await createMarcaIngresoAction({
        eventoId,
        clienteId,
        montoNeto: netoNum,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
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
            aria-labelledby="marca-ingreso-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-lg bg-white border border-[#E5E5E5] shadow-md rounded-lg">
              <header className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-6 py-4">
                <h2
                  id="marca-ingreso-title"
                  className="font-display font-bold text-lg leading-none text-[#333333]"
                >
                  Imputar ingreso
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="rounded-lg p-1 text-[#333333] hover:bg-[#F5F5F5] cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div className="space-y-1">
                  <label className="font-sans text-xs text-[#666666] block">
                    Cliente
                  </label>
                  <ClienteCombobox
                    clientes={merged}
                    value={clienteId}
                    onChange={setClienteId}
                    onClienteCreated={(c) =>
                      setExtraClientes((prev) =>
                        prev.some((p) => p.id === c.id)
                          ? prev
                          : [
                              ...prev,
                              {
                                id: c.id,
                                nombre: c.nombre,
                                facturadorId: c.facturadorId,
                                rut: c.rut,
                                razonSocial: c.razonSocial,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                              },
                            ],
                      )
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-sans text-xs text-[#666666] block">
                    Monto neto (CLP)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={montoNetoStr}
                    onChange={(e) => setMontoNetoStr(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] tabular-nums"
                  />
                </div>

                <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg px-4 py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-sans text-xs text-[#666666]">
                      Monto + IVA (19%)
                    </span>
                    <span className="font-display font-bold text-2xl leading-none text-[#333333] tabular-nums">
                      {fmtClp(brutoNum)}
                    </span>
                  </div>
                </div>

                {error && (
                  <p className="font-sans text-xs text-[#ED75A0] border border-[#ED75A0] rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={pending}
                    className="flex-1 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !clienteId || netoNum <= 0}
                    className="flex-1 rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {pending ? "Guardando…" : "Agregar"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
