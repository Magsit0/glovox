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
import type { MarcaClienteRow } from "@/lib/queries/marca";
import type {
  MarcaClienteProductoTagRow,
  ProductoMatrixCell,
} from "@/lib/queries/producto";
import {
  setPlanProductoAction,
  upsertProductoIngresoAction,
} from "@/app/onepager/producto-actions";
import { brutoToNeto } from "@/lib/constants/tax";
import { formatRut } from "@/lib/utils/rut";
import {
  currentSeasonLabel,
  isCurrentSeasonCategory,
} from "@/lib/utils/season";

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
  /** Todas las marcas del catálogo + su flag de producto (para marcar/desmarcar). */
  marcas: MarcaClienteProductoTagRow[];
  /** Pivot cliente×evento de producto_ingresos (precio + exento). */
  matrix: ProductoMatrixCell[];
};

type CellState = { precio: number; exento: boolean };

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

// neto a partir del precio + exento: exento → precio ES el neto; afecto → precio
// es bruto (IVA incluido) → neto = ÷1,19.
function netoDe(precio: number, exento: boolean): number {
  return exento ? Math.round(precio) : brutoToNeto(precio);
}

export default function ProductoMatrixSheet({
  open,
  onClose,
  eventos,
  marcas,
  matrix,
}: Props) {
  const temporadaActual = useMemo(() => currentSeasonLabel(), []);
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [categoriasOpen, setCategoriasOpen] = useState(true);

  // Panel "gestionar plan de producto" + búsqueda de marca.
  const [managing, setManaging] = useState(false);
  const [search, setSearch] = useState("");
  // Overrides optimistas del flag por clienteId.
  const [tagOverrides, setTagOverrides] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [tagPendingId, setTagPendingId] = useState<string | null>(null);
  const [, startTag] = useTransition();

  // Estado de celdas editables. `saved` = lo persistido (precio + exento).
  // `draft` = texto del precio en edición. `exentoState` = exento elegido
  // optimista (default exento cuando no hay override ni fila guardada).
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, CellState>>({});
  const [exentoState, setExentoState] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [, startSave] = useTransition();

  // Reset al abrir.
  const formKey = open ? "open" : "closed";
  const [prevFormKey, setPrevFormKey] = useState(formKey);
  if (prevFormKey !== formKey) {
    setPrevFormKey(formKey);
    if (open) {
      const next: Record<string, CellState> = {};
      for (const c of matrix)
        next[cellKey(c.clienteId, c.eventoId)] = {
          precio: c.precio,
          exento: c.exento,
        };
      setSaved(next);
      setDraft({});
      setExentoState({});
      setCategorias(new Set());
      setManaging(false);
      setSearch("");
      setTagOverrides(new Map());
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (managing) setManaging(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, managing]);

  function effectiveTag(c: MarcaClienteProductoTagRow): boolean {
    return tagOverrides.has(c.id)
      ? (tagOverrides.get(c.id) as boolean)
      : c.tienePlanProducto;
  }

  // Filas de la matriz = marcas con plan de producto activo.
  const clientesProducto = useMemo<MarcaClienteRow[]>(() => {
    return marcas
      .filter((c) => effectiveTag(c))
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        facturadorId: c.facturadorId,
        rut: c.rut,
        razonSocial: c.razonSocial,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-CL"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcas, tagOverrides]);

  const categoriasOpts = useMemo(() => {
    const set = new Set<string>();
    for (const e of eventos) if (e.categoriaEvento) set.add(e.categoriaEvento);
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

  const marcasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? marcas.filter(
          (c) =>
            c.nombre.toLowerCase().includes(q) ||
            c.razonSocial.toLowerCase().includes(q) ||
            c.rut.toLowerCase().includes(q),
        )
      : marcas;
    // Marcadas primero, luego alfabético.
    return [...base].sort((a, b) => {
      const ta = effectiveTag(a) ? 0 : 1;
      const tb = effectiveTag(b) ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return a.nombre.localeCompare(b.nombre, "es-CL");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcas, search, tagOverrides]);

  function toggleTag(c: MarcaClienteProductoTagRow) {
    const next = !effectiveTag(c);
    setTagOverrides((prev) => new Map(prev).set(c.id, next));
    setTagPendingId(c.id);
    startTag(async () => {
      const res = await setPlanProductoAction({
        clienteId: c.id,
        tienePlanProducto: next,
      });
      setTagPendingId(null);
      if (!res.ok) {
        // revertir override en error
        setTagOverrides((prev) => new Map(prev).set(c.id, !next));
        console.error("[ProductoMatrixSheet] setPlanProducto failed:", res.error);
      }
    });
  }

  function cellPrecio(clienteId: string, eventoId: string): number {
    const key = cellKey(clienteId, eventoId);
    if (key in draft) return parseMonto(draft[key]);
    return saved[key]?.precio ?? 0;
  }
  function cellExento(clienteId: string, eventoId: string): boolean {
    const key = cellKey(clienteId, eventoId);
    if (key in exentoState) return exentoState[key];
    return saved[key]?.exento ?? true;
  }
  function cellNetoValue(clienteId: string, eventoId: string): number {
    return netoDe(cellPrecio(clienteId, eventoId), cellExento(clienteId, eventoId));
  }
  function cellDisplay(clienteId: string, eventoId: string): string {
    const key = cellKey(clienteId, eventoId);
    if (key in draft) return draft[key];
    const v = saved[key]?.precio;
    return v ? fmtClp(v) : "";
  }

  // Persiste una celda (precio + exento) y refresca el estado local.
  function persistCell(
    clienteId: string,
    eventoId: string,
    precio: number,
    exento: boolean,
  ) {
    const key = cellKey(clienteId, eventoId);
    setSavingKeys((prev) => new Set(prev).add(key));
    startSave(async () => {
      const res = await upsertProductoIngresoAction({
        eventoId,
        clienteId,
        precio,
        exento,
      });
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      if (!res.ok) {
        console.error("[ProductoMatrixSheet] upsert failed:", res.error);
        return;
      }
      setSaved((prev) => ({
        ...prev,
        [key]: {
          precio: res.data?.precio ?? 0,
          exento: res.data?.exento ?? exento,
        },
      }));
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  }

  function commitCell(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    if (!(key in draft)) return;
    const precio = parseMonto(draft[key]);
    const exento = cellExento(clienteId, eventoId);
    const prev = saved[key];
    const prevPrecio = prev?.precio ?? 0;
    const prevExento = prev?.exento ?? true;
    // Sin cambios (mismo precio y mismo exento) → sólo limpiar el draft.
    if (Math.round(precio) === Math.round(prevPrecio) && exento === prevExento) {
      setDraft((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
      return;
    }
    persistCell(clienteId, eventoId, precio, exento);
  }

  // Alterna exento/afecto de una celda. Si ya hay un precio, persiste de una;
  // si la celda está vacía, sólo deja el exento elegido para cuando se impute.
  function toggleExento(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    const next = !cellExento(clienteId, eventoId);
    setExentoState((prev) => ({ ...prev, [key]: next }));
    const precio = cellPrecio(clienteId, eventoId);
    if (precio > 0) persistCell(clienteId, eventoId, precio, next);
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

  const totalesCol = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of visibleEventos) {
      let sum = 0;
      for (const c of clientesProducto) sum += cellNetoValue(c.id, e.eventoId);
      map.set(e.eventoId, sum);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEventos, clientesProducto, draft, saved, exentoState]);

  const totalesRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clientesProducto) {
      let sum = 0;
      for (const e of visibleEventos) sum += cellNetoValue(c.id, e.eventoId);
      map.set(c.id, sum);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesProducto, visibleEventos, draft, saved, exentoState]);

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
            className="fixed inset-0 z-40 bg-[#333333]/40"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="producto-matrix-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[1200px] h-[90vh] bg-white border border-[#E5E5E5] shadow-sm rounded-lg flex flex-col">
              <header className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] px-6 py-4 flex-shrink-0">
                <div>
                  <h2
                    id="producto-matrix-title"
                    className="font-display font-bold text-xl text-[#333333]"
                  >
                    Imputar producto
                  </h2>
                  <p className="mt-1 font-sans text-xs text-[#666666]">
                    Producto por marca × evento · sólo marcas con el plan activo ·
                    montos = precio · totales = neto
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="rounded-lg border border-[#E5E5E5] p-1 text-[#666666] hover:bg-[#F5F5F5] hover:text-[#333333] cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="border-b border-[#E5E5E5] px-6 py-3 flex-shrink-0 space-y-3">
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
                        className={`font-sans text-xs px-3 py-2 border border-[#E5E5E5] rounded-lg cursor-pointer transition-colors duration-150 ${
                          categorias.size === 0
                            ? "bg-[#F0EFFE] text-[#9F99F8]"
                            : "bg-white text-[#333333] hover:bg-[#FAFAFA]"
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
                            onClick={() => toggleCategoria(c)}
                            className={`font-sans text-xs px-3 py-2 border border-[#E5E5E5] rounded-lg cursor-pointer transition-colors duration-150 ${
                              active
                                ? "bg-[#F0EFFE] text-[#9F99F8]"
                                : currentSeason
                                  ? "bg-white text-[#333333] font-medium ring-1 ring-[#F6C544] hover:bg-[#FAFAFA]"
                                  : "bg-white text-[#333333] hover:bg-[#FAFAFA]"
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
                    {eventos.length === 1 ? "" : "s"} ·{" "}
                    {clientesProducto.length} marca
                    {clientesProducto.length === 1 ? "" : "s"} con producto
                  </span>
                  <button
                    type="button"
                    onClick={() => setManaging((v) => !v)}
                    aria-pressed={managing}
                    className="ml-auto rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150"
                  >
                    Gestionar plan de producto
                  </button>
                </div>

                {managing && (
                  <div className="border border-[#E5E5E5] rounded-lg p-3 space-y-2 bg-white">
                    <p className="font-sans text-xs text-[#666666]">
                      Marcá qué marcas pagan producto (aparecen como fila en la
                      matriz)
                    </p>
                    <input
                      type="text"
                      placeholder="Buscar marca…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full max-w-[280px] rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                    />
                    <div className="flex flex-wrap gap-2 max-h-[160px] overflow-auto">
                      {marcasFiltradas.map((c) => {
                        const active = effectiveTag(c);
                        const pending = tagPendingId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={active}
                            disabled={pending}
                            onClick={() => toggleTag(c)}
                            title={`${c.razonSocial} · ${formatRut(c.rut)}`}
                            className={`font-sans text-xs px-3 py-2 border border-[#E5E5E5] rounded-lg cursor-pointer transition-colors duration-150 disabled:opacity-50 ${
                              active
                                ? "bg-[#F0EFFE] text-[#9F99F8]"
                                : "bg-white text-[#333333] hover:bg-[#FAFAFA]"
                            }`}
                          >
                            {active ? "✓ " : "+ "}
                            {c.nombre}
                          </button>
                        );
                      })}
                      {marcasFiltradas.length === 0 && (
                        <span className="font-sans text-xs text-[#999999]">
                          Sin marcas para “{search}”.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {clientesProducto.length === 0 || visibleEventos.length === 0 ? (
                  <p className="font-sans text-sm text-[#999999] px-6 py-6">
                    {clientesProducto.length === 0
                      ? "Ninguna marca paga producto. Activá una con “Gestionar plan de producto”."
                      : "No hay eventos para la categoría seleccionada."}
                  </p>
                ) : (
                  <MatrixGrid
                    clientes={clientesProducto}
                    eventos={visibleEventos}
                    cellDisplay={cellDisplay}
                    cellPrecio={cellPrecio}
                    cellExento={cellExento}
                    cellNetoValue={cellNetoValue}
                    setDraft={setDraft}
                    commitCell={commitCell}
                    toggleExento={toggleExento}
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
  cellPrecio,
  cellExento,
  cellNetoValue,
  setDraft,
  commitCell,
  toggleExento,
  handleCellKeyDown,
  savingKeys,
  totalesRow,
  totalesCol,
  granTotal,
}: {
  clientes: MarcaClienteRow[];
  eventos: MatrixEvento[];
  cellDisplay: (clienteId: string, eventoId: string) => string;
  cellPrecio: (clienteId: string, eventoId: string) => number;
  cellExento: (clienteId: string, eventoId: string) => boolean;
  cellNetoValue: (clienteId: string, eventoId: string) => number;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitCell: (clienteId: string, eventoId: string) => void;
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
          <th className="sticky top-0 left-0 z-30 bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-3 py-2 text-left border-r border-b border-[#E5E5E5] min-w-[220px]">
            Marca
          </th>
          {eventos.map((e) => (
            <th
              key={e.eventoId}
              title={e.nombre}
              className="sticky top-0 z-10 bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-2 py-2 text-left border-r border-b border-[#E5E5E5] min-w-[150px] max-w-[190px]"
            >
              <div className="truncate font-bold">{e.nombre}</div>
              <div className="text-[9px] text-[#999999] tabular-nums">
                {fmtFecha(e.fechaEvento)}
              </div>
            </th>
          ))}
          <th className="sticky top-0 z-10 bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-3 py-2 text-right border-l border-b border-[#E5E5E5] min-w-[140px]">
            Total marca
          </th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((c) => (
          <tr key={c.id}>
            <th
              scope="row"
              className="sticky left-0 z-20 bg-white font-sans text-sm text-[#333333] px-3 py-2 text-left border-r border-b border-[#E5E5E5] min-w-[220px]"
            >
              <div className="font-bold truncate" title={c.nombre}>
                {c.nombre}
              </div>
              <div
                className="text-[10px] text-[#666666] truncate"
                title={`${c.razonSocial} · ${formatRut(c.rut)}`}
              >
                {c.razonSocial} · {formatRut(c.rut)}
              </div>
            </th>
            {eventos.map((e) => {
              const key = `${c.id}::${e.eventoId}`;
              const isSaving = savingKeys.has(key);
              const value = cellDisplay(c.id, e.eventoId);
              const precio = cellPrecio(c.id, e.eventoId);
              const exento = cellExento(c.id, e.eventoId);
              const neto = cellNetoValue(c.id, e.eventoId);
              const iva = Math.round(precio) - neto;
              return (
                <td
                  key={e.eventoId}
                  className="bg-white px-1 py-1 border-r border-b border-[#E5E5E5] align-top"
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
                    aria-label={`Precio producto ${c.nombre} en ${e.nombre}`}
                    title={
                      precio > 0
                        ? exento
                          ? `Exento · neto ${fmtClp(neto)} (sin IVA)`
                          : `Afecto · neto ${fmtClp(neto)} · IVA ${fmtClp(iva)}`
                        : "Vacío"
                    }
                    placeholder="$0"
                    className={`w-full font-sans text-sm text-right px-2 py-1.5 rounded outline-none tabular-nums focus:ring-1 focus:ring-[#9F99F8] ${
                      isSaving
                        ? "bg-[#F0EFFE] text-[#9F99F8]"
                        : precio > 0
                          ? "bg-white text-[#333333]"
                          : "bg-white text-[#999999]"
                    }`}
                  />
                  {precio > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExento(c.id, e.eventoId)}
                      aria-pressed={!exento}
                      title="Cambiar exento / afecto"
                      className={`mt-1 w-full font-sans text-[9px] px-1 py-1 border border-[#E5E5E5] rounded cursor-pointer transition-colors duration-150 ${
                        exento
                          ? "bg-white text-[#666666] hover:bg-[#FAFAFA]"
                          : "bg-[#F0EFFE] text-[#9F99F8]"
                      }`}
                    >
                      {exento ? "Exento" : "Afecto +IVA"}
                    </button>
                  )}
                </td>
              );
            })}
            <td className="bg-[#F0EFFE] font-sans text-sm text-right font-bold text-[#9F99F8] px-3 py-2 border-l border-b border-[#E5E5E5] tabular-nums align-top">
              {fmtClp(totalesRow.get(c.id) ?? 0)}
            </td>
          </tr>
        ))}
        <tr>
          <th
            scope="row"
            className="sticky left-0 z-20 bg-[#F0EFFE] font-sans text-sm font-bold text-[#9F99F8] px-3 py-2 text-left border-r border-t border-[#E5E5E5]"
          >
            Total evento (neto)
          </th>
          {eventos.map((e) => (
            <td
              key={e.eventoId}
              className="bg-[#F0EFFE] font-sans text-sm text-right font-bold text-[#9F99F8] px-2 py-2 border-r border-t border-[#E5E5E5] tabular-nums"
            >
              {fmtClp(totalesCol.get(e.eventoId) ?? 0)}
            </td>
          ))}
          <td className="bg-[#9F99F8] text-white font-sans text-sm text-right font-bold px-3 py-2 border-l border-t border-[#E5E5E5] tabular-nums">
            {fmtClp(granTotal)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
