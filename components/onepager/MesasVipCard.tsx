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
import {
  consumoFromPrecio,
  netoFromPrecio,
  ivaFromPrecio,
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
  const [saved, setSaved] = useState<Record<string, number>>({}); // precio
  const [savedEstado, setSavedEstado] = useState<Record<string, EstadoPago>>({});
  const [savedExento, setSavedExento] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [, startSave] = useTransition();

  // Reset al expandir: inicializa saved + estado desde la matriz del server.
  const [prevExpanded, setPrevExpanded] = useState(expanded);
  if (prevExpanded !== expanded) {
    setPrevExpanded(expanded);
    if (expanded) {
      const nextSaved: Record<string, number> = {};
      const nextEstado: Record<string, EstadoPago> = {};
      const nextExento: Record<string, boolean> = {};
      for (const c of matrix) {
        const k = cellKey(c.clienteId, c.eventoId);
        nextSaved[k] = c.precio;
        nextEstado[k] = c.estadoPago;
        nextExento[k] = c.exento;
      }
      setSaved(nextSaved);
      setSavedEstado(nextEstado);
      setSavedExento(nextExento);
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

  function cellExento(clienteId: string, eventoId: string): boolean {
    return savedExento[cellKey(clienteId, eventoId)] ?? true;
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
    const exento = savedExento[key] ?? true;
    setSavingKeys((prev) => new Set(prev).add(key));
    startSave(async () => {
      const res = await upsertMesasVipIngresoAction({
        eventoId,
        clienteId,
        precio,
        estadoPago: estado,
        exento,
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
        setSavedExento((prev) => ({ ...prev, [key]: res.data!.exento }));
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
        setSavedExento((prev) => {
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
        exento: savedExento[key] ?? true,
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

  function toggleExento(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    const precio = cellPrecio(clienteId, eventoId);
    if (precio <= 0) return; // sin venta, no hay IVA que marcar
    const current = savedExento[key] ?? true;
    const next = !current;
    setSavedExento((prev) => ({ ...prev, [key]: next })); // optimista
    setSavingKeys((prev) => new Set(prev).add(key));
    startSave(async () => {
      const res = await upsertMesasVipIngresoAction({
        eventoId,
        clienteId,
        precio,
        estadoPago: savedEstado[key] ?? "pendiente",
        exento: next,
      });
      setSavingKeys((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
      if (!res.ok) {
        setSavedExento((prev) => ({ ...prev, [key]: current })); // revertir
        console.error("[MesasVipCard] exento upsert failed:", res.error);
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

  // Neto/IVA del gran total: exento aporta completo; afecto deriva ÷1,19.
  const granNetoIva = useMemo(() => {
    let neto = 0;
    for (const c of allClientes) {
      for (const e of visibleEventos) {
        const p = cellPrecio(c.id, e.eventoId);
        if (p > 0) neto += netoFromPrecio(p, cellExento(c.id, e.eventoId));
      }
    }
    return { neto, iva: Math.round(granTotal) - neto };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClientes, visibleEventos, draft, saved, savedExento, granTotal]);

  // Total global (badge del header colapsado) — bruto directo de la matriz.
  const totalGlobal = useMemo(
    () => matrix.reduce((a, c) => a + c.precio, 0),
    [matrix],
  );

  return (
    <div className="bg-white border border-[#E5E5E5] shadow-sm rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-6 py-4 text-left cursor-pointer hover:bg-[#FAFAFA] transition-colors duration-150"
      >
        <span aria-hidden className="flex-shrink-0 text-[#666666]">
          {expanded ? (
            <ChevronDown className="h-6 w-6" />
          ) : (
            <ChevronRight className="h-6 w-6" />
          )}
        </span>
        <h3 className="font-display font-bold text-xl leading-none text-[#333333]">
          Mesas VIP
        </h3>
        <span className="ml-auto flex items-center gap-3">
          <span className="font-sans text-xs text-[#666666] hidden sm:inline">
            Total imputado (bruto)
          </span>
          <span className="font-display font-bold text-lg leading-none text-white tabular-nums rounded-lg px-3 py-1 bg-[#9F99F8]">
            {fmtClp(totalGlobal)}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#E5E5E5] p-6 space-y-6">
          {/* Toolbar: chips de categoría + agregar/editar cliente */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategoriasOpen((v) => !v)}
                aria-expanded={categoriasOpen}
                className="font-sans text-xs text-[#666666] flex items-center gap-1 cursor-pointer hover:text-[#333333] transition-colors"
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
                    className={`font-sans text-xs leading-none px-3 py-2 border rounded-lg cursor-pointer transition-colors duration-150 ${
                      categorias.size === 0
                        ? "border-[#9F99F8] bg-[#F0EFFE] text-[#9F99F8]"
                        : "border-[#E5E5E5] bg-white text-[#333333] hover:bg-[#FAFAFA]"
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
                        className={`font-sans text-xs leading-none px-3 py-2 border rounded-lg cursor-pointer transition-colors duration-150 ${
                          active
                            ? "border-[#9F99F8] bg-[#F0EFFE] text-[#9F99F8]"
                            : currentSeason
                              ? "border-[#F6C544] bg-white text-[#333333] font-medium hover:bg-[#FAFAFA]"
                              : "border-[#E5E5E5] bg-white text-[#333333] hover:bg-[#FAFAFA]"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </>
              )}
              <span className="font-sans text-xs text-[#666666]">
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
                className="ml-auto rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
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
                className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150"
              >
                Editar cliente
              </button>
            </div>

            {addingCliente && (
              <div className="border border-[#E5E5E5] rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <p className="font-sans text-xs text-[#666666]">
                    Nuevo cliente
                  </p>
                  <TipoToggle value={newTipo} onChange={setNewTipo} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      Nombre del cliente
                    </label>
                    <input
                      type="text"
                      placeholder="Federico Müller, ENTEL, Pepsi..."
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      autoFocus
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      RUT <span className="text-[#999999]">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej. 76.123.456-7"
                      value={newRut}
                      onChange={(e) => setNewRut(e.target.value)}
                      className={`w-full rounded-lg border bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:outline-none focus:ring-1 ${
                        rutPreview && !rutPreview.ok
                          ? "border-[#ED75A0] focus:border-[#ED75A0] focus:ring-[#ED75A0]"
                          : "border-[#E5E5E5] hover:border-[#333333] focus:border-[#9F99F8] focus:ring-[#9F99F8]"
                      }`}
                    />
                    {rutPreview && (
                      <p
                        className={`mt-1 font-sans text-xs ${
                          rutPreview.ok ? "text-[#666666]" : "text-[#ED75A0]"
                        }`}
                      >
                        {rutPreview.msg}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      {tipoLabel(newTipo)} <span className="text-[#999999]">(opcional)</span>
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
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <button
                      type="button"
                      onClick={() => setAddingCliente(false)}
                      disabled={addPending}
                      className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer disabled:opacity-50 transition-colors"
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
                      className="rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {addPending ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                </div>
                {addError && (
                  <p className="font-sans text-xs text-[#ED75A0]">
                    {addError}
                  </p>
                )}
              </div>
            )}

            {editingCliente && (
              <div className="border border-[#E5E5E5] rounded-lg p-3 space-y-2 bg-white">
                <div className="flex items-center gap-2">
                  <p className="font-sans text-xs text-[#666666]">
                    Editar cliente existente
                  </p>
                  <TipoToggle value={editTipo} onChange={setEditTipo} />
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      Cliente a editar
                    </label>
                    <select
                      value={editClienteId}
                      onChange={(e) => handleSelectClienteEdit(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8] cursor-pointer"
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
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      Nombre del cliente
                    </label>
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      RUT <span className="text-[#999999]">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="ej. 76.123.456-7"
                      value={editRut}
                      onChange={(e) => setEditRut(e.target.value)}
                      className={`w-full rounded-lg border bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:outline-none focus:ring-1 ${
                        editRutPreview && !editRutPreview.ok
                          ? "border-[#ED75A0] focus:border-[#ED75A0] focus:ring-[#ED75A0]"
                          : "border-[#E5E5E5] hover:border-[#333333] focus:border-[#9F99F8] focus:ring-[#9F99F8]"
                      }`}
                    />
                    {editRutPreview && (
                      <p
                        className={`mt-1 font-sans text-xs ${
                          editRutPreview.ok ? "text-[#666666]" : "text-[#ED75A0]"
                        }`}
                      >
                        {editRutPreview.msg}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="font-sans text-xs text-[#666666] block mb-1">
                      {tipoLabel(editTipo)} <span className="text-[#999999]">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={editRazonSocial}
                      onChange={(e) => setEditRazonSocial(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                  </div>
                  <div className="flex gap-2 items-end">
                    <button
                      type="button"
                      onClick={() => setEditingCliente(false)}
                      disabled={editPending}
                      className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer disabled:opacity-50 transition-colors"
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
                      className="rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {editPending ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </div>
                </div>
                {editError && (
                  <p className="font-sans text-xs text-[#ED75A0]">
                    {editError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Matriz inline */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-sans text-xs text-[#666666]">
                Una celda = monto de la(s) mesa(s) del cliente en el evento ·
                enter/tab para guardar
              </p>
              <span className="flex items-center gap-1 font-sans text-xs text-[#666666]">
                <span className="inline-flex w-6 h-4 items-center justify-center rounded border border-[#E5E5E5] text-[9px] font-bold bg-white text-[#999999]">
                  EX
                </span>
                exento
                <span className="inline-flex w-8 h-4 items-center justify-center rounded border border-[#9F99F8] text-[9px] font-bold bg-[#9F99F8] text-white ml-1">
                  IVA
                </span>
                afecto
              </span>
              <span className="flex items-center gap-2 flex-wrap">
                <span className="font-sans text-xs text-[#666666]">
                  Pago:
                </span>
                {ESTADOS_PAGO.map((e) => {
                  const m = ESTADO_PAGO_META[e];
                  return (
                    <span
                      key={e}
                      className="flex items-center gap-1 font-sans text-xs text-[#666666]"
                    >
                      <span
                        className="inline-flex w-4 h-4 items-center justify-center rounded-full border border-[#E5E5E5] text-[9px] font-bold"
                        style={{ background: m.bg, color: m.fg }}
                      >
                        {m.short}
                      </span>
                      {m.label}
                    </span>
                  );
                })}
                <span className="font-sans text-xs text-[#999999]">
                  (click para cambiar)
                </span>
              </span>
            </div>
            <div className="border border-[#E5E5E5] rounded-lg bg-white max-h-[60vh] overflow-auto">
              {allClientes.length === 0 || visibleEventos.length === 0 ? (
                <p className="font-sans text-sm text-[#999999] px-6 py-6">
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
                  cellExento={cellExento}
                  setDraft={setDraft}
                  commitCell={commitCell}
                  cycleEstado={cycleEstado}
                  toggleExento={toggleExento}
                  handleCellKeyDown={handleCellKeyDown}
                  savingKeys={savingKeys}
                  totalesRow={totalesRow}
                  totalesCol={totalesCol}
                  granTotal={granTotal}
                />
              )}
            </div>
            {granTotal > 0 && (
              <p className="mt-2 font-sans text-xs text-[#666666] tabular-nums">
                Gran total {fmtClp(granTotal)}
                {granNetoIva.iva > 0
                  ? ` · neto ${fmtClp(granNetoIva.neto)} · IVA ${fmtClp(granNetoIva.iva)}`
                  : " · exento (sin IVA)"}
              </p>
            )}
          </div>

          {/* Gráfico de evolución */}
          <div>
            <h4 className="font-display font-bold text-lg leading-none text-[#333333] mb-3">
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
    <div className="flex rounded-lg border border-[#E5E5E5] overflow-hidden">
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
            className={`font-sans text-xs leading-none px-3 py-2 cursor-pointer transition-colors duration-150 ${
              i === 0 ? "border-r border-[#E5E5E5]" : ""
            } ${
              active
                ? "bg-[#F0EFFE] text-[#9F99F8]"
                : "bg-white text-[#333333] hover:bg-[#FAFAFA]"
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
  cellExento,
  setDraft,
  commitCell,
  cycleEstado,
  toggleExento,
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
  cellExento: (clienteId: string, eventoId: string) => boolean;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitCell: (clienteId: string, eventoId: string) => void;
  cycleEstado: (clienteId: string, eventoId: string) => void;
  toggleExento: (clienteId: string, eventoId: string) => void;
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
          <th className="sticky top-0 left-0 z-30 bg-[#FAFAFA] font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 text-left border-r border-b border-[#E5E5E5] min-w-[220px]">
            Cliente
          </th>
          {eventos.map((e) => (
            <th
              key={e.eventoId}
              title={e.nombre}
              className="sticky top-0 z-10 bg-[#FAFAFA] font-sans uppercase tracking-wide text-xs font-medium text-[#666666] px-4 py-3 text-left border-r border-b border-[#E5E5E5] min-w-[175px] max-w-[210px]"
            >
              <div className="truncate font-bold">{e.nombre}</div>
              <div className="text-[9px] text-[#999999] tabular-nums">
                {fmtFecha(e.fechaEvento)}
              </div>
            </th>
          ))}
          <th className="sticky top-0 z-10 bg-[#F0EFFE] font-sans uppercase tracking-wide text-xs font-medium text-[#9F99F8] px-4 py-3 text-right border-l border-b border-[#E5E5E5] min-w-[140px]">
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
                className="sticky left-0 z-20 bg-white font-sans text-sm text-[#333333] px-4 py-3 text-left border-r border-b border-[#E5E5E5] min-w-[220px]"
              >
                <div className="font-medium text-[#333333] truncate" title={c.nombre}>
                  {c.nombre}
                </div>
                {sub && (
                  <div className="text-xs text-[#666666] truncate" title={sub}>
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
                const exento = cellExento(c.id, e.eventoId);
                const meta = ESTADO_PAGO_META[estado];
                const tip =
                  precio <= 0
                    ? "Vacío"
                    : exento
                      ? `Exento (sin IVA) · Consumo ${fmtClp(consumoFromPrecio(precio))}`
                      : `Neto ${fmtClp(netoFromPrecio(precio, false))} · IVA ${fmtClp(
                          ivaFromPrecio(precio, false),
                        )} · Consumo ${fmtClp(consumoFromPrecio(precio))}`;
                return (
                  <td
                    key={e.eventoId}
                    className="bg-white p-0 border-r border-b border-[#E5E5E5]"
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
                        aria-label={`Monto ${c.nombre} en ${e.nombre}`}
                        title={tip}
                        placeholder="$0"
                        className={`flex-1 min-w-0 font-sans text-sm text-right px-3 py-2 outline-none tabular-nums focus:bg-[#F0EFFE] ${
                          isSaving
                            ? "bg-[#F0EFFE]"
                            : precio > 0
                              ? "bg-white text-[#333333]"
                              : "bg-white text-[#999999]"
                        }`}
                      />
                      {precio > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleExento(c.id, e.eventoId)}
                            title={
                              exento
                                ? "Exento (sin IVA) — click para marcar afecto"
                                : "Afecto a IVA — click para marcar exento"
                            }
                            aria-label={`IVA ${c.nombre} en ${e.nombre}: ${exento ? "exento" : "afecto"}`}
                            className={`w-8 flex-shrink-0 border-l border-[#E5E5E5] font-sans text-[9px] font-bold leading-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity ${
                              exento
                                ? "bg-white text-[#999999]"
                                : "bg-[#9F99F8] text-white"
                            }`}
                          >
                            {exento ? "EX" : "IVA"}
                          </button>
                          <button
                            type="button"
                            onClick={() => cycleEstado(c.id, e.eventoId)}
                            title={`Estado: ${meta.label} — click para cambiar`}
                            aria-label={`Estado de pago ${c.nombre} en ${e.nombre}: ${meta.label}`}
                            style={{ background: meta.bg, color: meta.fg }}
                            className="w-6 flex-shrink-0 border-l border-[#E5E5E5] font-sans text-[11px] font-bold leading-none cursor-pointer flex items-center justify-center hover:opacity-80 transition-opacity"
                          >
                            {meta.short}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="bg-[#F0EFFE] font-sans text-sm text-right font-medium text-[#333333] px-4 py-3 border-l border-b border-[#E5E5E5] tabular-nums">
                {fmtClp(totalesRow.get(c.id) ?? 0)}
              </td>
            </tr>
          );
        })}
        <tr>
          <th
            scope="row"
            className="sticky left-0 z-20 bg-[#F0EFFE] font-sans text-sm font-medium text-[#9F99F8] px-4 py-3 text-left border-r border-t border-[#E5E5E5]"
          >
            Total evento
          </th>
          {eventos.map((e) => (
            <td
              key={e.eventoId}
              className="bg-[#F0EFFE] font-sans text-sm text-right font-medium text-[#333333] px-4 py-3 border-r border-t border-[#E5E5E5] tabular-nums"
            >
              {fmtClp(totalesCol.get(e.eventoId) ?? 0)}
            </td>
          ))}
          <td className="bg-[#9F99F8] text-white font-sans text-sm text-right font-semibold px-4 py-3 border-l border-t border-[#E5E5E5] tabular-nums">
            {fmtClp(granTotal)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
