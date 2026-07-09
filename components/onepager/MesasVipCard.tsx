"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MatrixEvento } from "./MarcaMatrixSheet";
import type { FfbbConsumoEvento } from "./FfbbConsumoChart";
import type {
  MesasVipClienteRow,
  MesasVipMatrixCell,
} from "@/lib/queries/mesasVip";
import {
  createMesasVipClienteAction,
  updateMesasVipClienteAction,
  upsertMesasVipIngresoAction,
} from "@/app/onepager/mesasvip-actions";
import { brutoToNeto, ivaFromBruto } from "@/lib/constants/tax";
import {
  consumoFromPrecio,
  ESTADOS_PAGO,
  ESTADO_PAGO_META,
  nextEstadoPago,
  type EstadoPago,
} from "@/lib/constants/mesasVip";
import { formatRut, isValidRut, normalizeRut } from "@/lib/utils/rut";
import {
  currentSeasonLabel,
  isCurrentSeasonCategory,
} from "@/lib/utils/season";
import MesasVipEvolucionChart from "./MesasVipEvolucionChart";

type TipoCliente = "empresa" | "natural";

type ClienteOverride = {
  nombre: string;
  rut: string | null;
  razonSocial: string | null;
  tipoCliente: string;
};

type Props = {
  /** Todos los eventos (columnas de la matriz; la card aplica su filtro). */
  eventos: MatrixEvento[];
  /** Eventos en scope (x-axis del gráfico de evolución). */
  scopedEvents: FfbbConsumoEvento[];
  clientes: MesasVipClienteRow[];
  matrix: MesasVipMatrixCell[];
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

function tipoLabel(tipo: TipoCliente): string {
  return tipo === "natural" ? "Nombre completo" : "Razón social";
}

function clienteSubtitle(c: { rut: string | null; razonSocial: string | null }): string {
  return [c.razonSocial, c.rut ? formatRut(c.rut) : null]
    .filter(Boolean)
    .join(" · ");
}

export default function MesasVipCard({
  eventos,
  scopedEvents,
  clientes,
  matrix,
}: Props) {
  const temporadaActual = useMemo(() => currentSeasonLabel(), []);

  const [expanded, setExpanded] = useState(false);

  // Filtros de categoría (multi-select de chips brutalistas).
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [categoriasOpen, setCategoriasOpen] = useState(true);

  // Clientes recién creados (merge con `clientes` hasta el re-render del padre).
  const [extraClientes, setExtraClientes] = useState<MesasVipClienteRow[]>([]);

  // Mini-form "Agregar cliente".
  const [addingCliente, setAddingCliente] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newRut, setNewRut] = useState("");
  const [newRazonSocial, setNewRazonSocial] = useState("");
  const [newTipo, setNewTipo] = useState<TipoCliente>("empresa");
  const [addError, setAddError] = useState<string | null>(null);
  const [addPending, startAdd] = useTransition();

  // Mini-form "Editar cliente".
  const [editingCliente, setEditingCliente] = useState(false);
  const [editClienteId, setEditClienteId] = useState<string>("");
  const [editNombre, setEditNombre] = useState("");
  const [editRut, setEditRut] = useState("");
  const [editRazonSocial, setEditRazonSocial] = useState("");
  const [editTipo, setEditTipo] = useState<TipoCliente>("empresa");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEdit] = useTransition();

  const [clienteOverrides, setClienteOverrides] = useState<
    Map<string, ClienteOverride>
  >(new Map());

  // Estado editable de las celdas: clave "clienteId::eventoId".
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({}); // precio bruto
  const [savedEstado, setSavedEstado] = useState<Record<string, EstadoPago>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [, startSave] = useTransition();

  // Reset al expandir: inicializa saved + estado desde la matriz del server.
  const [prevExpanded, setPrevExpanded] = useState(expanded);
  if (prevExpanded !== expanded) {
    setPrevExpanded(expanded);
    if (expanded) {
      const nextSaved: Record<string, number> = {};
      const nextEstado: Record<string, EstadoPago> = {};
      for (const c of matrix) {
        const k = cellKey(c.clienteId, c.eventoId);
        nextSaved[k] = c.precio;
        nextEstado[k] = c.estadoPago;
      }
      setSaved(nextSaved);
      setSavedEstado(nextEstado);
      setDraft({});
      setExtraClientes([]);
      setAddingCliente(false);
      setNewNombre("");
      setNewRut("");
      setNewRazonSocial("");
      setNewTipo("empresa");
      setAddError(null);
      setEditingCliente(false);
      setEditClienteId("");
      setEditNombre("");
      setEditRut("");
      setEditRazonSocial("");
      setEditTipo("empresa");
      setEditError(null);
      setClienteOverrides(new Map());
    }
  }

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (addingCliente) setAddingCliente(false);
        else if (editingCliente) setEditingCliente(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, addingCliente, editingCliente]);

  const allClientes = useMemo(() => {
    const seen = new Set(clientes.map((c) => c.id));
    const merged = [...extraClientes.filter((c) => !seen.has(c.id)), ...clientes];
    const withOverrides = merged.map((c) => {
      const ov = clienteOverrides.get(c.id);
      return ov
        ? {
            ...c,
            nombre: ov.nombre,
            rut: ov.rut,
            razonSocial: ov.razonSocial,
            tipoCliente: ov.tipoCliente,
          }
        : c;
    });
    return withOverrides.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-CL"));
  }, [clientes, extraClientes, clienteOverrides]);

  const categoriasOpts = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) {
      if (e.categoriaEvento) set.add(e.categoriaEvento);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [eventos]);

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

  function cellPrecio(clienteId: string, eventoId: string): number {
    const key = cellKey(clienteId, eventoId);
    if (key in draft) return parseMonto(draft[key]);
    return saved[key] ?? 0;
  }

  function cellDisplay(clienteId: string, eventoId: string): string {
    const key = cellKey(clienteId, eventoId);
    if (key in draft) return draft[key];
    const v = saved[key];
    return v ? fmtClp(v) : "";
  }

  function cellEstado(clienteId: string, eventoId: string): EstadoPago {
    return savedEstado[cellKey(clienteId, eventoId)] ?? "pendiente";
  }

  function commitCell(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    if (!(key in draft)) return;
    const precio = parseMonto(draft[key]);
    const current = saved[key] ?? 0;
    if (Math.round(precio) === Math.round(current)) {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    const estado = savedEstado[key] ?? "pendiente";
    setSavingKeys((prev) => new Set(prev).add(key));
    startSave(async () => {
      const res = await upsertMesasVipIngresoAction({
        eventoId,
        clienteId,
        precio,
        estadoPago: estado,
      });
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      if (!res.ok) {
        console.error("[MesasVipCard] upsert failed:", res.error);
        return;
      }
      if (res.data) {
        setSaved((prev) => ({ ...prev, [key]: res.data!.precio }));
        setSavedEstado((prev) => ({ ...prev, [key]: res.data!.estadoPago }));
      } else {
        // precio <= 0 → celda borrada.
        setSaved((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setSavedEstado((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  }

  function cycleEstado(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    const precio = cellPrecio(clienteId, eventoId);
    if (precio <= 0) return; // sin venta, no hay estado que ciclar
    const current = savedEstado[key] ?? "pendiente";
    const next = nextEstadoPago(current);
    setSavedEstado((prev) => ({ ...prev, [key]: next })); // optimista
    setSavingKeys((prev) => new Set(prev).add(key));
    startSave(async () => {
      const res = await upsertMesasVipIngresoAction({
        eventoId,
        clienteId,
        precio,
        estadoPago: next,
      });
      setSavingKeys((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
      if (!res.ok) {
        setSavedEstado((prev) => ({ ...prev, [key]: current })); // revertir
        console.error("[MesasVipCard] estado upsert failed:", res.error);
      }
    });
  }

  function handleCellKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    clienteId: string,
    eventoId: string,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
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

  // Preview de RUT (opcional): null si está vacío.
  const rutPreview = useMemo(() => {
    const trimmed = newRut.trim();
    if (!trimmed) return null;
    const norm = normalizeRut(trimmed);
    if (!norm) return { ok: false as const, msg: "Formato inválido" };
    if (!isValidRut(norm))
      return { ok: false as const, msg: "Dígito verificador no coincide" };
    return { ok: true as const, msg: `Se guardará como ${formatRut(norm)}` };
  }, [newRut]);

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
      setEditRut(c.rut ?? "");
      setEditRazonSocial(c.razonSocial ?? "");
      setEditTipo(c.tipoCliente === "natural" ? "natural" : "empresa");
    } else {
      setEditNombre("");
      setEditRut("");
      setEditRazonSocial("");
      setEditTipo("empresa");
    }
  }

  function handleAddCliente() {
    setAddError(null);
    startAdd(async () => {
      const res = await createMesasVipClienteAction({
        nombre: newNombre,
        rut: newRut,
        razonSocial: newRazonSocial,
        tipoCliente: newTipo,
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
                rut: c.rut,
                razonSocial: c.razonSocial,
                tipoCliente: c.tipoCliente,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
      );
      setAddingCliente(false);
      setNewNombre("");
      setNewRut("");
      setNewRazonSocial("");
      setNewTipo("empresa");
    });
  }

  function handleEditCliente() {
    setEditError(null);
    startEdit(async () => {
      const res = await updateMesasVipClienteAction({
        id: editClienteId,
        nombre: editNombre,
        rut: editRut,
        razonSocial: editRazonSocial,
        tipoCliente: editTipo,
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
          tipoCliente: updated.tipoCliente,
        });
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
                tipoCliente: updated.tipoCliente,
              }
            : c,
        ),
      );
      setEditingCliente(false);
    });
  }

  // Totales por evento (columna) y por cliente (fila) en BRUTO, y gran total.
  const totalesCol = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of visibleEventos) {
      let sum = 0;
      for (const c of allClientes) sum += cellPrecio(c.id, e.eventoId);
      map.set(e.eventoId, sum);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEventos, allClientes, draft, saved]);

  const totalesRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of allClientes) {
      let sum = 0;
      for (const e of visibleEventos) sum += cellPrecio(c.id, e.eventoId);
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

  // Total global (badge del header colapsado) — bruto directo de la matriz.
  const totalGlobal = useMemo(
    () => matrix.reduce((a, c) => a + c.precio, 0),
    [matrix],
  );

  return (
    <div className="bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-6 py-4 text-left cursor-pointer hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <span aria-hidden className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="h-6 w-6" />
          ) : (
            <ChevronRight className="h-6 w-6" />
          )}
        </span>
        <h3 className="font-display uppercase text-2xl leading-none text-black">
          Mesas VIP
        </h3>
        <span className="ml-auto flex items-center gap-3">
          <span className="font-mono-data uppercase text-[10px] text-black/60 hidden sm:inline">
            Total imputado (bruto)
          </span>
          <span className="font-display text-xl leading-none text-black tabular-nums border-2 border-black px-3 py-1 bg-[#FFFF00]">
            {fmtClp(totalGlobal)}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="border-t-4 border-black p-6 space-y-6">
          {/* Toolbar: chips de categoría + agregar/editar cliente */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoriasOpen((v) => !v)}
                aria-expanded={categoriasOpen}
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
                  {categoriasOpts.map((c) => {
                    const active = categorias.has(c);
                    const currentSeason = isCurrentSeasonCategory(
                      c,
                      temporadaActual,
                    );
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={active}
                        title={
                          currentSeason
                            ? `Temporada actual ${temporadaActual}`
                            : undefined
                        }
                        onClick={() => toggleCategoria(c)}
                        className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                          active
                            ? "bg-black text-[#FFFF00]"
                            : currentSeason
                              ? "bg-[#FFF7A8] text-black font-bold hover:bg-[#FFFF00]"
                              : "bg-white text-black hover:bg-[#FFFF00]"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </>
              )}
              <span className="font-mono-data uppercase text-[10px] text-black/70">
                {visibleEventos.length} de {eventos.length} evento
                {eventos.length === 1 ? "" : "s"}
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
                + Agregar cliente
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !editingCliente;
                  setEditingCliente(next);
                  setEditError(null);
                  if (next) {
                    setAddingCliente(false);
                    if (!editClienteId && allClientes.length > 0) {
                      handleSelectClienteEdit(allClientes[0].id);
                    }
                  }
                }}
                aria-pressed={editingCliente}
                disabled={allClientes.length === 0}
                className="font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] bg-white hover:bg-[#FFFF00] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150"
              >
                Editar cliente
              </button>
            </div>

            {addingCliente && (
              <div className="border-2 border-black p-3 space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <p className="font-mono-data uppercase text-[10px] text-black/70">
                    Nuevo cliente
                  </p>
                  <TipoToggle value={newTipo} onChange={setNewTipo} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                      Nombre del cliente
                    </label>
                    <input
                      type="text"
                      placeholder="Federico Müller, ENTEL, Pepsi..."
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      autoFocus
                      className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                      RUT <span className="text-black/40">(opcional)</span>
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
                      {tipoLabel(newTipo)} <span className="text-black/40">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder={
                        newTipo === "natural"
                          ? "Nombre completo de la persona"
                          : "Razón social del cliente"
                      }
                      value={newRazonSocial}
                      onChange={(e) => setNewRazonSocial(e.target.value)}
                      className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                    />
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
                        (rutPreview !== null && !rutPreview.ok)
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
                <div className="flex items-center gap-2">
                  <p className="font-mono-data uppercase text-[10px] text-black/70">
                    Editar cliente existente
                  </p>
                  <TipoToggle value={editTipo} onChange={setEditTipo} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                      Cliente a editar
                    </label>
                    <select
                      value={editClienteId}
                      onChange={(e) => handleSelectClienteEdit(e.target.value)}
                      className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30 cursor-pointer"
                    >
                      {allClientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                          {c.rut ? ` — ${formatRut(c.rut)}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                      Nombre del cliente
                    </label>
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                      RUT <span className="text-black/40">(opcional)</span>
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
                          editRutPreview.ok ? "text-black/60" : "text-[#FF0000]"
                        }`}
                      >
                        {editRutPreview.msg}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="font-mono-data uppercase text-[9px] text-black/60 block mb-1">
                      {tipoLabel(editTipo)} <span className="text-black/40">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={editRazonSocial}
                      onChange={(e) => setEditRazonSocial(e.target.value)}
                      className="w-full font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
                    />
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
                        (editRutPreview !== null && !editRutPreview.ok)
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

          {/* Matriz inline */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-mono-data text-[10px] uppercase text-black/60">
                Una celda = precio bruto de la(s) mesa(s) del cliente en el evento
                · enter/tab para guardar
              </p>
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-mono-data uppercase text-[10px] text-black/60">
                  Pago:
                </span>
                {ESTADOS_PAGO.map((e) => {
                  const m = ESTADO_PAGO_META[e];
                  return (
                    <span
                      key={e}
                      className="flex items-center gap-1 font-mono-data text-[10px] text-black/70"
                    >
                      <span
                        className="inline-flex w-4 h-4 items-center justify-center border-2 border-black text-[9px] font-bold"
                        style={{ background: m.bg, color: m.fg }}
                      >
                        {m.short}
                      </span>
                      {m.label}
                    </span>
                  );
                })}
                <span className="font-mono-data text-[10px] text-black/40">
                  (click para cambiar)
                </span>
              </span>
            </div>
            <div className="border-4 border-black bg-white max-h-[60vh] overflow-auto">
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
                  cellPrecio={cellPrecio}
                  cellEstado={cellEstado}
                  setDraft={setDraft}
                  commitCell={commitCell}
                  cycleEstado={cycleEstado}
                  handleCellKeyDown={handleCellKeyDown}
                  savingKeys={savingKeys}
                  totalesRow={totalesRow}
                  totalesCol={totalesCol}
                  granTotal={granTotal}
                />
              )}
            </div>
            {granTotal > 0 && (
              <p className="mt-2 font-mono-data text-[10px] uppercase text-black/60 tabular-nums">
                Gran total bruto {fmtClp(granTotal)} · neto{" "}
                {fmtClp(brutoToNeto(granTotal))} · IVA{" "}
                {fmtClp(ivaFromBruto(granTotal))}
              </p>
            )}
          </div>

          {/* Gráfico de evolución */}
          <div>
            <h4 className="font-display uppercase text-lg leading-none text-black mb-3">
              Evolución
            </h4>
            <MesasVipEvolucionChart
              events={scopedEvents}
              clientes={clientes}
              matrix={matrix}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------- tipo toggle

function TipoToggle({
  value,
  onChange,
}: {
  value: TipoCliente;
  onChange: (t: TipoCliente) => void;
}) {
  return (
    <div className="flex border-2 border-black">
      {(
        [
          { key: "empresa", label: "Empresa" },
          { key: "natural", label: "Persona natural" },
        ] as { key: TipoCliente; label: string }[]
      ).map((t, i) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.key)}
            className={`font-mono-data uppercase text-[10px] leading-none px-2 py-1 cursor-pointer transition-colors duration-150 ${
              i === 0 ? "border-r-2 border-black" : ""
            } ${
              active
                ? "bg-black text-[#FFFF00]"
                : "bg-white text-black hover:bg-[#FFFF00]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------- matrix grid

function MatrixGrid({
  clientes,
  eventos,
  cellDisplay,
  cellPrecio,
  cellEstado,
  setDraft,
  commitCell,
  cycleEstado,
  handleCellKeyDown,
  savingKeys,
  totalesRow,
  totalesCol,
  granTotal,
}: {
  clientes: MesasVipClienteRow[];
  eventos: MatrixEvento[];
  cellDisplay: (clienteId: string, eventoId: string) => string;
  cellPrecio: (clienteId: string, eventoId: string) => number;
  cellEstado: (clienteId: string, eventoId: string) => EstadoPago;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitCell: (clienteId: string, eventoId: string) => void;
  cycleEstado: (clienteId: string, eventoId: string) => void;
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
              className="sticky top-0 z-10 bg-black text-white font-mono-data uppercase text-[10px] px-2 py-2 text-left border-r-2 border-b-2 border-black min-w-[150px] max-w-[190px]"
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
        {clientes.map((c) => {
          const sub = clienteSubtitle(c);
          return (
            <tr key={c.id}>
              <th
                scope="row"
                className="sticky left-0 z-20 bg-white font-mono-data text-xs px-3 py-2 text-left border-r-2 border-b-2 border-black min-w-[220px]"
              >
                <div className="font-bold uppercase truncate" title={c.nombre}>
                  {c.nombre}
                </div>
                {sub && (
                  <div className="text-[10px] text-black/60 truncate" title={sub}>
                    {sub}
                  </div>
                )}
              </th>
              {eventos.map((e) => {
                const key = `${c.id}::${e.eventoId}`;
                const isSaving = savingKeys.has(key);
                const value = cellDisplay(c.id, e.eventoId);
                const precio = cellPrecio(c.id, e.eventoId);
                const estado = cellEstado(c.id, e.eventoId);
                const meta = ESTADO_PAGO_META[estado];
                const tip =
                  precio > 0
                    ? `Neto ${fmtClp(brutoToNeto(precio))} · IVA ${fmtClp(
                        ivaFromBruto(precio),
                      )} · Consumo ${fmtClp(consumoFromPrecio(precio))}`
                    : "Vacío";
                return (
                  <td
                    key={e.eventoId}
                    className="bg-white p-0 border-r-2 border-b-2 border-black"
                  >
                    <div className="flex items-stretch">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={value}
                        onChange={(ev) =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: ev.target.value,
                          }))
                        }
                        onBlur={() => commitCell(c.id, e.eventoId)}
                        onKeyDown={(ev) => handleCellKeyDown(ev, c.id, e.eventoId)}
                        aria-label={`Precio bruto ${c.nombre} en ${e.nombre}`}
                        title={tip}
                        placeholder="$0"
                        className={`flex-1 min-w-0 font-mono-data text-xs text-right px-2 py-1.5 outline-none tabular-nums focus:bg-[#FFFF00]/30 ${
                          isSaving
                            ? "bg-[#FFFF00]/40"
                            : precio > 0
                              ? "bg-white"
                              : "bg-white text-black/40"
                        }`}
                      />
                      {precio > 0 && (
                        <button
                          type="button"
                          onClick={() => cycleEstado(c.id, e.eventoId)}
                          title={`Estado: ${meta.label} — click para cambiar`}
                          aria-label={`Estado de pago ${c.nombre} en ${e.nombre}: ${meta.label}`}
                          style={{ background: meta.bg, color: meta.fg }}
                          className="w-6 flex-shrink-0 border-l-2 border-black font-mono-data text-[11px] font-bold leading-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          {meta.short}
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="bg-[#FFFF00] font-mono-data text-xs text-right font-bold px-3 py-2 border-l-4 border-b-2 border-black tabular-nums">
                {fmtClp(totalesRow.get(c.id) ?? 0)}
              </td>
            </tr>
          );
        })}
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
