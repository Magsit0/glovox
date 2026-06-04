"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { MarcaClienteRow, MarcaMatrixCell } from "@/lib/queries/marca";
import {
  createMarcaClienteAction,
  updateMarcaClienteAction,
  upsertMarcaIngresoAction,
} from "@/app/onepager/marca-actions";
import { netoToBruto } from "@/lib/constants/tax";
import { formatRut, isValidRut, normalizeRut } from "@/lib/utils/rut";

export type MatrixEvento = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  fechaEvento: string; // YYYY-MM-DD
};

type Props = {
  open: boolean;
  onClose: () => void;
  eventos: MatrixEvento[];
  clientes: MarcaClienteRow[];
  matrix: MarcaMatrixCell[];
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseMonto(v: string): number {
  if (!v.trim()) return 0;
  const cleaned = v
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function cellKey(clienteId: string, eventoId: string): string {
  return `${clienteId}::${eventoId}`;
}

export default function MarcaMatrixSheet({
  open,
  onClose,
  eventos,
  clientes,
  matrix,
}: Props) {
  // Filtros de categoría (multi-select de chips brutalistas).
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  // Colapsa la lista de chips para liberar espacio vertical para la matriz.
  const [categoriasOpen, setCategoriasOpen] = useState(true);

  // Clientes recién creados (se mergean con `clientes` hasta que el padre
  // re-renderice con la fuente fresca).
  const [extraClientes, setExtraClientes] = useState<MarcaClienteRow[]>([]);

  // Estado del mini-form "Agregar marca" en el header.
  const [addingCliente, setAddingCliente] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newRut, setNewRut] = useState("");
  const [newRazonSocial, setNewRazonSocial] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, startAdd] = useTransition();

  // Estado del mini-form "Editar marca" en el header.
  const [editingCliente, setEditingCliente] = useState(false);
  const [editClienteId, setEditClienteId] = useState<string>("");
  const [editNombre, setEditNombre] = useState("");
  const [editRut, setEditRut] = useState("");
  const [editRazonSocial, setEditRazonSocial] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEdit] = useTransition();

  // Overrides locales para reflejar ediciones sin esperar a que el padre
  // re-render con los datos refrescados del server.
  const [clienteOverrides, setClienteOverrides] = useState<
    Map<string, { nombre: string; rut: string; razonSocial: string }>
  >(new Map());

  // Estado de los inputs editables: clave "clienteId::eventoId" → string.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [, startSave] = useTransition();

  // Reset al abrir: inicializa `saved` con la matriz que viene del server.
  const formKey = open ? "open" : "closed";
  const [prevFormKey, setPrevFormKey] = useState(formKey);
  if (prevFormKey !== formKey) {
    setPrevFormKey(formKey);
    if (open) {
      const next: Record<string, number> = {};
      for (const c of matrix) {
        next[cellKey(c.clienteId, c.eventoId)] = c.montoNeto;
      }
      setSaved(next);
      setDraft({});
      setExtraClientes([]);
      setCategorias(new Set());
      setAddingCliente(false);
      setNewNombre("");
      setNewRut("");
      setNewRazonSocial("");
      setAddError(null);
      setEditingCliente(false);
      setEditClienteId("");
      setEditNombre("");
      setEditRut("");
      setEditRazonSocial("");
      setEditError(null);
      setClienteOverrides(new Map());
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        // Si un mini-form está abierto, sólo lo cerramos; sino cerramos el sheet.
        if (addingCliente) setAddingCliente(false);
        else if (editingCliente) setEditingCliente(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, addingCliente, editingCliente]);

  // Lista mergeada de clientes (los nuevos arriba para que sean visibles).
  // Aplica overrides locales (ediciones en curso) sobre los datos del server.
  const allClientes = useMemo(() => {
    const seen = new Set(clientes.map((c) => c.id));
    const merged = [
      ...extraClientes.filter((c) => !seen.has(c.id)),
      ...clientes,
    ];
    const withOverrides = merged.map((c) => {
      const ov = clienteOverrides.get(c.id);
      return ov
        ? { ...c, nombre: ov.nombre, rut: ov.rut, razonSocial: ov.razonSocial }
        : c;
    });
    return withOverrides.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es-CL"),
    );
  }, [clientes, extraClientes, clienteOverrides]);

  // Opciones de categoría sacadas de la lista de eventos.
  const categoriasOpts = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) {
      if (e.categoriaEvento) set.add(e.categoriaEvento);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [eventos]);

  // Eventos visibles según el filtro de categoría (orden cronológico desc).
  const visibleEventos = useMemo(() => {
    const base =
      categorias.size === 0
        ? eventos
        : eventos.filter((e) => categorias.has(e.categoriaEvento));
    return [...base].sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento));
  }, [eventos, categorias]);

  function toggleCategoria(c: string) {
    setCategorias((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  // Valor actual de la celda (saved + draft override).
  function cellNeto(clienteId: string, eventoId: string): number {
    const key = cellKey(clienteId, eventoId);
    if (key in draft) return parseMonto(draft[key]);
    return saved[key] ?? 0;
  }

  function cellDisplay(clienteId: string, eventoId: string): string {
    const key = cellKey(clienteId, eventoId);
    if (key in draft) return draft[key];
    const v = saved[key];
    return v ? String(Math.round(v)) : "";
  }

  function commitCell(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    if (!(key in draft)) return;
    const rawDraft = draft[key];
    const neto = parseMonto(rawDraft);
    const current = saved[key] ?? 0;
    // Sin cambios reales → simplemente limpiamos el draft.
    if (Math.round(neto) === Math.round(current)) {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    setSavingKeys((prev) => new Set(prev).add(key));
    startSave(async () => {
      const res = await upsertMarcaIngresoAction({
        eventoId,
        clienteId,
        montoNeto: neto,
      });
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      if (!res.ok) {
        // En caso de error mantenemos el draft visible y mostramos en consola.
        console.error("[MarcaMatrixSheet] upsert failed:", res.error);
        return;
      }
      const nextValue = res.data?.montoNeto ?? 0;
      setSaved((prev) => ({ ...prev, [key]: nextValue }));
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  }

  function handleCellKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    clienteId: string,
    eventoId: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur(); // dispara onBlur → commitCell
    } else if (e.key === "Escape") {
      e.preventDefault();
      const key = cellKey(clienteId, eventoId);
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      e.currentTarget.blur();
    }
  }

  // Preview de bruto al editar.
  const rutPreview = useMemo(() => {
    const trimmed = newRut.trim();
    if (!trimmed) return null;
    const norm = normalizeRut(trimmed);
    if (!norm) return { ok: false as const, msg: "Formato inválido" };
    if (!isValidRut(norm))
      return { ok: false as const, msg: "Dígito verificador no coincide" };
    return { ok: true as const, msg: `Se guardará como ${formatRut(norm)}` };
  }, [newRut]);

  // Preview del RUT del form de EDIT — misma validación módulo-11.
  const editRutPreview = useMemo(() => {
    const trimmed = editRut.trim();
    if (!trimmed) return null;
    const norm = normalizeRut(trimmed);
    if (!norm) return { ok: false as const, msg: "Formato inválido" };
    if (!isValidRut(norm))
      return { ok: false as const, msg: "Dígito verificador no coincide" };
    return { ok: true as const, msg: `Se guardará como ${formatRut(norm)}` };
  }, [editRut]);

  function handleSelectClienteEdit(id: string) {
    setEditClienteId(id);
    setEditError(null);
    const c = allClientes.find((x) => x.id === id);
    if (c) {
      setEditNombre(c.nombre);
      setEditRut(c.rut);
      setEditRazonSocial(c.razonSocial);
    } else {
      setEditNombre("");
      setEditRut("");
      setEditRazonSocial("");
    }
  }

  // Facturador existente match para el RUT del form de Agregar: si ya hay un
  // cliente con ese RUT canónico, locked razon_social a su valor.
  const addFacturadorLock = useMemo(() => {
    if (!rutPreview || !rutPreview.ok) return null;
    const canon = normalizeRut(newRut.trim());
    if (!canon) return null;
    const match = allClientes.find((c) => c.rut === canon);
    return match ? match.razonSocial : null;
  }, [rutPreview, newRut, allClientes]);

  function handleEditCliente() {
    setEditError(null);
    startEdit(async () => {
      const res = await updateMarcaClienteAction({
        id: editClienteId,
        nombre: editNombre,
        rut: editRut,
        razonSocial: editRazonSocial,
      });
      if (!res.ok || !res.data) {
        setEditError(res.ok ? "Error desconocido" : res.error);
        return;
      }
      const updated = res.data;
      setClienteOverrides((prev) => {
        const next = new Map(prev);
        next.set(updated.id, {
          nombre: updated.nombre,
          rut: updated.rut,
          razonSocial: updated.razonSocial,
        });
        // También aplicamos la nueva razonSocial a todas las marcas que
        // comparten facturador con la editada (el server hace lo mismo).
        for (const c of allClientes) {
          if (c.id !== updated.id && c.rut === updated.rut) {
            next.set(c.id, {
              nombre: c.nombre,
              rut: updated.rut,
              razonSocial: updated.razonSocial,
            });
          }
        }
        return next;
      });
      setExtraClientes((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                nombre: updated.nombre,
                rut: updated.rut,
                razonSocial: updated.razonSocial,
                facturadorId: updated.facturadorId,
              }
            : c,
        ),
      );
      setEditingCliente(false);
    });
  }

  function handleAddCliente() {
    setAddError(null);
    startAdd(async () => {
      const res = await createMarcaClienteAction({
        nombre: newNombre,
        rut: newRut,
        razonSocial: addFacturadorLock ?? newRazonSocial,
      });
      if (!res.ok || !res.data) {
        setAddError(res.ok ? "Error desconocido" : res.error);
        return;
      }
      const c = res.data;
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
      );
      setAddingCliente(false);
      setNewNombre("");
      setNewRut("");
      setNewRazonSocial("");
    });
  }

  // Totales por evento (columna) y por cliente (fila), y gran total.
  const totalesCol = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of visibleEventos) {
      let sum = 0;
      for (const c of allClientes) {
        sum += cellNeto(c.id, e.eventoId);
      }
      map.set(e.eventoId, sum);
    }
    return map;
    // depende de visibleEventos, allClientes y de draft+saved (vía cellNeto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEventos, allClientes, draft, saved]);

  const totalesRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of allClientes) {
      let sum = 0;
      for (const e of visibleEventos) {
        sum += cellNeto(c.id, e.eventoId);
      }
      map.set(c.id, sum);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClientes, visibleEventos, draft, saved]);

  const granTotal = useMemo(() => {
    let sum = 0;
    for (const v of totalesCol.values()) sum += v;
    return sum;
  }, [totalesCol]);

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
            className="fixed inset-0 z-40 bg-black/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="marca-matrix-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[1200px] h-[90vh] bg-white border-4 border-black shadow-[8px_8px_0px_#000] rounded-none flex flex-col">
              {/* Header */}
              <header className="flex items-start justify-between gap-4 border-b-4 border-black px-6 py-4 flex-shrink-0">
                <div>
                  <h2
                    id="marca-matrix-title"
                    className="font-display uppercase text-2xl leading-none text-black"
                  >
                    Imputar marcas
                  </h2>
                  <p className="mt-1 font-mono-data text-[10px] uppercase text-black/60">
                    Una celda = una marca × un evento · click y enter o tab
                    para guardar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="border-2 border-black p-1 hover:bg-[#FFFF00] cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Toolbar: chips de categoría + "Agregar cliente" */}
              <div className="border-b-4 border-black px-6 py-3 flex-shrink-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCategoriasOpen((v) => !v)}
                    aria-expanded={categoriasOpen}
                    aria-controls="marca-matrix-categoria-chips"
                    className="font-mono-data uppercase text-[10px] text-black/70 flex items-center gap-1 cursor-pointer hover:text-black transition-colors"
                  >
                    <span aria-hidden className="font-bold">
                      {categoriasOpen ? "▾" : "▸"}
                    </span>
                    Categoría
                  </button>
                  {categoriasOpen && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCategorias(new Set())}
                        className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                          categorias.size === 0
                            ? "bg-black text-[#FFFF00]"
                            : "bg-white text-black hover:bg-[#FFFF00]"
                        }`}
                      >
                        Todas
                      </button>
                      <span
                        id="marca-matrix-categoria-chips"
                        className="contents"
                      >
                        {categoriasOpts.map((c) => {
                          const active = categorias.has(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleCategoria(c)}
                              className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                                active
                                  ? "bg-black text-[#FFFF00]"
                                  : "bg-white text-black hover:bg-[#FFFF00]"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </span>
                    </>
                  )}
                  <span className="font-mono-data uppercase text-[10px] text-black/70">
                    {visibleEventos.length} de {eventos.length} evento
                    {eventos.length === 1 ? "" : "s"}
                    {!categoriasOpen && categorias.size > 0
                      ? ` · ${categorias.size} categoría${categorias.size === 1 ? "" : "s"} activa${categorias.size === 1 ? "" : "s"}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCliente((v) => !v);
                      setAddError(null);
                      if (!addingCliente) setEditingCliente(false);
                    }}
                    aria-pressed={addingCliente}
                    className="ml-auto font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] bg-white hover:bg-[#FFFF00] cursor-pointer transition-colors duration-150"
                  >
                    + Agregar marca
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !editingCliente;
                      setEditingCliente(next);
                      setEditError(null);
                      if (next) {
                        setAddingCliente(false);
                        // Si hay clientes y aún no eligió ninguno, preseleccionamos
                        // el primero para que el form esté listo para editar.
                        if (!editClienteId && allClientes.length > 0) {
                          handleSelectClienteEdit(allClientes[0].id);
                        }
                      }
                    }}
                    aria-pressed={editingCliente}
                    disabled={allClientes.length === 0}
                    className="font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] bg-white hover:bg-[#FFFF00] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150"
                  >
                    Editar marca
                  </button>
                </div>

                {addingCliente && (
                  <div className="border-2 border-black p-3 space-y-2 bg-white">
                    <p className="font-mono-data uppercase text-[10px] text-black/70">
                      Nueva marca
                    </p>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-[180px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          Nombre de marca
                        </label>
                        <input
                          type="text"
                          placeholder="Xtreme, Entel..."
                          value={newNombre}
                          onChange={(e) => setNewNombre(e.target.value)}
                          autoFocus
                          className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                        />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          RUT facturador
                        </label>
                        <input
                          type="text"
                          placeholder="ej. 76.123.456-7"
                          value={newRut}
                          onChange={(e) => setNewRut(e.target.value)}
                          className={`w-full font-mono-data text-xs px-2 py-1.5 border-2 outline-none focus:bg-[#FFFF00]/30 ${
                            rutPreview && !rutPreview.ok
                              ? "border-[#FF0000]"
                              : "border-black"
                          }`}
                        />
                        {rutPreview && (
                          <p
                            className={`mt-1 font-mono-data text-[10px] ${
                              rutPreview.ok ? "text-black/60" : "text-[#FF0000]"
                            }`}
                          >
                            {rutPreview.msg}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          Razón social
                        </label>
                        <input
                          type="text"
                          placeholder="Razón social del facturador"
                          value={addFacturadorLock ?? newRazonSocial}
                          onChange={(e) =>
                            addFacturadorLock == null
                              ? setNewRazonSocial(e.target.value)
                              : undefined
                          }
                          readOnly={addFacturadorLock != null}
                          className={`w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30 ${
                            addFacturadorLock != null
                              ? "bg-black/5 cursor-not-allowed"
                              : ""
                          }`}
                        />
                        {addFacturadorLock != null && (
                          <p className="mt-1 font-mono-data text-[10px] text-black/60">
                            Facturador existente — se reutilizará.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 items-end">
                        <button
                          type="button"
                          onClick={() => setAddingCliente(false)}
                          disabled={addPending}
                          className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-white hover:bg-[#FFFF00] cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCliente}
                          disabled={
                            addPending ||
                            !newNombre.trim() ||
                            !rutPreview ||
                            !rutPreview.ok ||
                            !(addFacturadorLock ?? newRazonSocial).trim()
                          }
                          className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-black text-[#FFFF00] hover:bg-[#FFFF00] hover:text-black cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {addPending ? "Guardando…" : "Guardar"}
                        </button>
                      </div>
                    </div>
                    {addError && (
                      <p className="font-mono-data text-[10px] text-[#FF0000]">
                        {addError}
                      </p>
                    )}
                  </div>
                )}

                {editingCliente && (
                  <div className="border-2 border-black p-3 space-y-2 bg-white">
                    <p className="font-mono-data uppercase text-[10px] text-black/70">
                      Editar marca existente
                    </p>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          Marca a editar
                        </label>
                        <select
                          value={editClienteId}
                          onChange={(e) =>
                            handleSelectClienteEdit(e.target.value)
                          }
                          className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30 cursor-pointer"
                        >
                          {allClientes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} — {formatRut(c.rut)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          Nombre de marca
                        </label>
                        <input
                          type="text"
                          placeholder="Xtreme, Entel..."
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                        />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          RUT facturador
                        </label>
                        <input
                          type="text"
                          placeholder="ej. 76.123.456-7"
                          value={editRut}
                          onChange={(e) => setEditRut(e.target.value)}
                          className={`w-full font-mono-data text-xs px-2 py-1.5 border-2 outline-none focus:bg-[#FFFF00]/30 ${
                            editRutPreview && !editRutPreview.ok
                              ? "border-[#FF0000]"
                              : "border-black"
                          }`}
                        />
                        {editRutPreview && (
                          <p
                            className={`mt-1 font-mono-data text-[10px] ${
                              editRutPreview.ok
                                ? "text-black/60"
                                : "text-[#FF0000]"
                            }`}
                          >
                            {editRutPreview.msg}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                          Razón social
                        </label>
                        <input
                          type="text"
                          placeholder="Razón social del facturador"
                          value={editRazonSocial}
                          onChange={(e) => setEditRazonSocial(e.target.value)}
                          className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                        />
                        <p className="mt-1 font-mono-data text-[10px] text-black/60">
                          Aplica al facturador completo — afecta todas las marcas con este RUT.
                        </p>
                      </div>
                      <div className="flex gap-2 items-end">
                        <button
                          type="button"
                          onClick={() => setEditingCliente(false)}
                          disabled={editPending}
                          className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-white hover:bg-[#FFFF00] cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleEditCliente}
                          disabled={
                            editPending ||
                            !editClienteId ||
                            !editNombre.trim() ||
                            !editRutPreview ||
                            !editRutPreview.ok ||
                            !editRazonSocial.trim()
                          }
                          className="font-display uppercase text-xs leading-none px-3 py-2 border-2 border-black bg-black text-[#FFFF00] hover:bg-[#FFFF00] hover:text-black cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {editPending ? "Guardando…" : "Guardar cambios"}
                        </button>
                      </div>
                    </div>
                    {editError && (
                      <p className="font-mono-data text-[10px] text-[#FF0000]">
                        {editError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Matriz */}
              <div className="flex-1 overflow-auto">
                {allClientes.length === 0 || visibleEventos.length === 0 ? (
                  <p className="font-mono-data text-sm text-black/50 px-6 py-6">
                    {allClientes.length === 0
                      ? "No hay clientes. Agregá uno con el botón de arriba."
                      : "No hay eventos para la categoría seleccionada."}
                  </p>
                ) : (
                  <MatrixGrid
                    clientes={allClientes}
                    eventos={visibleEventos}
                    cellDisplay={cellDisplay}
                    cellNeto={cellNeto}
                    setDraft={setDraft}
                    commitCell={commitCell}
                    handleCellKeyDown={handleCellKeyDown}
                    savingKeys={savingKeys}
                    totalesRow={totalesRow}
                    totalesCol={totalesCol}
                    granTotal={granTotal}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------- matrix grid

function MatrixGrid({
  clientes,
  eventos,
  cellDisplay,
  cellNeto,
  setDraft,
  commitCell,
  handleCellKeyDown,
  savingKeys,
  totalesRow,
  totalesCol,
  granTotal,
}: {
  clientes: MarcaClienteRow[];
  eventos: MatrixEvento[];
  cellDisplay: (clienteId: string, eventoId: string) => string;
  cellNeto: (clienteId: string, eventoId: string) => number;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitCell: (clienteId: string, eventoId: string) => void;
  handleCellKeyDown: (
    e: KeyboardEvent<HTMLInputElement>,
    clienteId: string,
    eventoId: string,
  ) => void;
  savingKeys: Set<string>;
  totalesRow: Map<string, number>;
  totalesCol: Map<string, number>;
  granTotal: number;
}) {
  // Sticky top-left: bg-black, z-30. Headers de fila: z-20. Headers de col: z-10.
  return (
    <table className="border-collapse">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-30 bg-black text-white font-mono-data uppercase text-[10px] px-3 py-2 text-left border-r-2 border-b-2 border-black min-w-[220px]">
            Cliente
          </th>
          {eventos.map((e) => (
            <th
              key={e.eventoId}
              title={e.nombre}
              className="sticky top-0 z-10 bg-black text-white font-mono-data uppercase text-[10px] px-2 py-2 text-left border-r-2 border-b-2 border-black min-w-[140px] max-w-[180px]"
            >
              <div className="truncate font-bold">{e.nombre}</div>
              <div className="text-[9px] text-white/70 tabular-nums">
                {fmtFecha(e.fechaEvento)}
              </div>
            </th>
          ))}
          <th className="sticky top-0 z-10 bg-[#FFFF00] text-black font-mono-data uppercase text-[10px] px-3 py-2 text-right border-l-4 border-b-2 border-black min-w-[140px]">
            Total cliente
          </th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((c) => (
          <tr key={c.id}>
            <th
              scope="row"
              className="sticky left-0 z-20 bg-white font-mono-data text-xs px-3 py-2 text-left border-r-2 border-b-2 border-black min-w-[220px]"
            >
              <div className="font-bold uppercase truncate" title={c.nombre}>
                {c.nombre}
              </div>
              <div
                className="text-[10px] text-black/60 truncate"
                title={`${c.razonSocial} · ${formatRut(c.rut)}`}
              >
                {c.razonSocial} · {formatRut(c.rut)}
              </div>
            </th>
            {eventos.map((e) => {
              const key = `${c.id}::${e.eventoId}`;
              const isSaving = savingKeys.has(key);
              const value = cellDisplay(c.id, e.eventoId);
              const neto = cellNeto(c.id, e.eventoId);
              const bruto = netoToBruto(neto);
              return (
                <td
                  key={e.eventoId}
                  className="bg-white px-1 py-1 border-r-2 border-b-2 border-black"
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(ev) =>
                      setDraft((prev) => ({ ...prev, [key]: ev.target.value }))
                    }
                    onBlur={() => commitCell(c.id, e.eventoId)}
                    onKeyDown={(ev) => handleCellKeyDown(ev, c.id, e.eventoId)}
                    aria-label={`Monto neto ${c.nombre} en ${e.nombre}`}
                    title={neto > 0 ? `Bruto: ${fmtClp(bruto)}` : "Vacío"}
                    placeholder="0"
                    className={`w-full font-mono-data text-xs text-right px-2 py-1.5 outline-none tabular-nums focus:bg-[#FFFF00]/30 ${
                      isSaving
                        ? "bg-[#FFFF00]/40"
                        : neto > 0
                          ? "bg-white"
                          : "bg-white text-black/40"
                    }`}
                  />
                </td>
              );
            })}
            <td className="bg-[#FFFF00] font-mono-data text-xs text-right font-bold px-3 py-2 border-l-4 border-b-2 border-black tabular-nums">
              {fmtClp(totalesRow.get(c.id) ?? 0)}
            </td>
          </tr>
        ))}
        {/* Fila total por evento */}
        <tr>
          <th
            scope="row"
            className="sticky left-0 z-20 bg-[#FFFF00] font-mono-data text-xs uppercase font-bold px-3 py-2 text-left border-r-2 border-t-4 border-black"
          >
            Total evento
          </th>
          {eventos.map((e) => (
            <td
              key={e.eventoId}
              className="bg-[#FFFF00] font-mono-data text-xs text-right font-bold px-2 py-2 border-r-2 border-t-4 border-black tabular-nums"
            >
              {fmtClp(totalesCol.get(e.eventoId) ?? 0)}
            </td>
          ))}
          <td className="bg-black text-[#FFFF00] font-mono-data text-sm text-right font-bold px-3 py-2 border-l-4 border-t-4 border-black tabular-nums">
            {fmtClp(granTotal)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
