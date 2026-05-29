"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { bulkCreateComprasAction, type CompraInput } from "@/app/ffbb/actions";
import type { ExtractResponse } from "@/app/api/ffbb/extract-compras-pdf/route";

interface Props {
  open: boolean;
  onClose: () => void;
  eventoId: string;
  onSaved?: (inserted: number) => void;
}

type Status = "idle" | "selected" | "loading" | "parsed" | "error";

const fmtNum = (v: number | null | undefined): string => {
  if (v == null) return "—";
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(v);
};

const fmtSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function PdfImportSheet({ open, onClose, eventoId, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [response, setResponse] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [inserting, startInserting] = useTransition();

  // Reset cuando se abre el modal
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setFile(null);
      setStatus("idle");
      setResponse(null);
      setError(null);
      setDragOver(false);
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

  function handlePickFile(f: File | null) {
    if (!f) return;
    setFile(f);
    setStatus("selected");
    setResponse(null);
    setError(null);
  }

  async function handleProcess() {
    if (!file) return;
    setStatus("loading");
    setError(null);
    setResponse(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("eventoId", eventoId);

    try {
      const res = await fetch("/api/ffbb/extract-compras-pdf", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as ExtractResponse;
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Error ${res.status}`);
        setStatus("error");
        return;
      }
      setResponse(json);
      setStatus("parsed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
      setStatus("error");
    }
  }

  function handleInsert() {
    if (!response?.rows || response.rows.length === 0) return;
    setError(null);
    // strip el flag matchedToCanonical antes de mandar al server action
    const payload = response.rows.map((r) => {
      const { matchedToCanonical: _omit, ...rest } = r;
      void _omit;
      return rest as Partial<CompraInput>;
    });
    startInserting(async () => {
      const res = await bulkCreateComprasAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved?.(res.data?.inserted ?? payload.length);
      onClose();
    });
  }

  const rows = useMemo(() => response?.rows ?? [], [response]);
  const meta = response?.meta;
  const notMatched = useMemo(
    () => rows.filter((r) => !r.matchedToCanonical),
    [rows],
  );

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
            aria-labelledby="pdf-import-title"
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
                    id="pdf-import-title"
                    className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-[#333333]"
                  >
                    <Sparkles className="h-4 w-4 text-[#9F99F8]" />
                    Importar factura desde PDF
                  </h2>
                  <p className="mt-1 font-sans text-xs text-[#666666]">
                    El archivo se procesa en memoria y NO se guarda en ningún lado.
                    Las filas extraídas se previsualizan acá antes de insertarse en el evento{" "}
                    <span className="font-medium text-[#333333]">{eventoId}</span>.
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

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
                {(status === "idle" || status === "selected") && (
                  <>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) handlePickFile(f);
                      }}
                      className={`flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
                        dragOver
                          ? "border-[#9F99F8] bg-[#F0EFFE]"
                          : "border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#333333]"
                      }`}
                    >
                      <Upload className="h-8 w-8 text-[#666666]" />
                      <div className="text-center">
                        <p className="font-sans text-sm font-medium text-[#333333]">
                          Arrastrá un PDF o foto, o hacé click para elegir
                        </p>
                        <p className="mt-1 font-sans text-xs text-[#666666]">
                          PDF, JPG, PNG, HEIC, WEBP · hasta 10 MB
                        </p>
                      </div>
                      <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                      />
                    </button>

                    {file && (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-[#666666]" />
                          <div className="min-w-0">
                            <p className="truncate font-sans text-sm font-medium text-[#333333]">
                              {file.name}
                            </p>
                            <p className="font-sans text-xs text-[#666666]">
                              {fmtSize(file.size)} · {file.type || "tipo desconocido"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFile(null);
                            setStatus("idle");
                          }}
                          aria-label="Quitar archivo"
                          className="shrink-0 rounded-md p-1 text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )}

                {status === "loading" && (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-6 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#9F99F8]" />
                    <p className="font-sans text-sm font-medium text-[#333333]">
                      Leyendo la factura con Gemini…
                    </p>
                    <p className="font-sans text-xs text-[#666666]">
                      Esto puede tardar 10–30 segundos dependiendo del tamaño.
                    </p>
                  </div>
                )}

                {status === "parsed" && response?.rows && (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Proveedor" value={meta?.proveedor ?? "—"} />
                      <Stat label="N° Factura" value={meta?.numeroFactura ?? "—"} />
                      <Stat label="Fecha" value={meta?.fechaCompra ?? "—"} />
                      <Stat
                        label="Ítems"
                        value={`${meta?.itemsTotal ?? 0}`}
                        sub={
                          meta && meta.itemsTotal > 0
                            ? `${meta.itemsMatched}/${meta.itemsTotal} matchearon`
                            : undefined
                        }
                      />
                    </div>

                    {meta?.notas && (
                      <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3">
                        <p className="font-sans text-xs font-medium text-[#666666]">
                          Notas del modelo
                        </p>
                        <p className="mt-1 font-sans text-sm text-[#333333]">{meta.notas}</p>
                      </div>
                    )}

                    {notMatched.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-[#F6C544] bg-[#FFFBEE] p-3">
                        <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#F6C544]" />
                        <div>
                          <p className="font-sans text-sm font-medium text-[#333333]">
                            {notMatched.length} ítem{notMatched.length === 1 ? "" : "s"} sin match
                            contra <code className="rounded bg-white px-1">formulaTragoBQ</code>
                          </p>
                          <p className="mt-1 font-sans text-xs text-[#666666]">
                            Se van a insertar igual con el nombre literal del PDF. Vas a poder
                            editarlos después desde la tabla de compras imputadas.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-lg border border-[#E5E5E5]">
                      <table className="w-full font-sans text-sm">
                        <thead>
                          <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                            <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">#</th>
                            <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">Insumo</th>
                            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Recibido</th>
                            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Costo unit.</th>
                            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Neto</th>
                            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">IVA</th>
                            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Bruto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-[#666666]">
                                El modelo no detectó ítems en este documento.
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, i) => (
                              <tr
                                key={i}
                                className="border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA]"
                              >
                                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[#666666]">
                                  {i + 1}
                                </td>
                                <td className="px-3 py-2 text-[#333333]">
                                  <span className="inline-flex items-center gap-2">
                                    {row.insumo}
                                    {!row.matchedToCanonical && (
                                      <span
                                        className="rounded-full bg-[#FFF7DD] px-1.5 py-0.5 text-[10px] font-medium text-[#7A5C00]"
                                        title="No coincide con un insumo de formulaTragoBQ"
                                      >
                                        no listado
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                                  {fmtNum(row.recibido as number | null | undefined)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                                  {fmtNum(row.costoUnitario as number | null | undefined)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                                  {fmtNum(row.costoNeto as number | null | undefined)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                                  {fmtNum(row.iva as number | null | undefined)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                                  {fmtNum(row.bruto as number | null | undefined)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
                    <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
                    <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
                  </div>
                )}
              </div>

              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E5E5E5] px-6 py-4">
                {status === "parsed" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle");
                      setFile(null);
                      setResponse(null);
                    }}
                    disabled={inserting}
                    className="rounded-lg px-4 py-2 font-sans text-sm font-medium text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333] disabled:opacity-50"
                  >
                    Procesar otra
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={status === "loading" || inserting}
                  className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
                >
                  Cancelar
                </button>
                {status === "selected" && (
                  <button
                    type="button"
                    onClick={handleProcess}
                    disabled={!file}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Procesar con Gemini
                  </button>
                )}
                {status === "loading" && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white opacity-70"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando…
                  </button>
                )}
                {status === "parsed" && (
                  <button
                    type="button"
                    onClick={handleInsert}
                    disabled={inserting || rows.length === 0}
                    className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
                  >
                    {inserting
                      ? "Insertando…"
                      : `Insertar ${rows.length} fila${rows.length === 1 ? "" : "s"}`}
                  </button>
                )}
                {status === "error" && file && (
                  <button
                    type="button"
                    onClick={handleProcess}
                    className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
                  >
                    Reintentar
                  </button>
                )}
              </footer>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-3">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="mt-1 truncate font-sans text-sm font-medium text-[#333333]" title={value}>
        {value}
      </p>
      {sub && <p className="mt-0.5 font-sans text-xs text-[#999999]">{sub}</p>}
    </div>
  );
}
