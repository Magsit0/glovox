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
import type { MarcaClienteTagRow } from "@/lib/queries/medios";
import {
  setPlanMediosAction,
  upsertMediosIngresoAction,
} from "@/app/onepager/medios-actions";
import { netoToBruto } from "@/lib/constants/tax";
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
  /** Todas las marcas del catálogo + su flag (para marcar/desmarcar). */
  marcas: MarcaClienteTagRow[];
  /** Pivot cliente×evento de medios_ingresos. */
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

export default function MediosMatrixSheet({
  open,
  onClose,
  eventos,
  marcas,
  matrix,
}: Props) {
  const temporadaActual = useMemo(() => currentSeasonLabel(), []);
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [categoriasOpen, setCategoriasOpen] = useState(true);

  // Panel "gestionar plan de medios" + búsqueda de marca.
  const [managing, setManaging] = useState(false);
  const [search, setSearch] = useState("");
  // Overrides optimistas del flag por clienteId.
  const [tagOverrides, setTagOverrides] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [tagPendingId, setTagPendingId] = useState<string | null>(null);
  const [, startTag] = useTransition();

  // Estado de celdas editables.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [, startSave] = useTransition();

  // Reset al abrir.
  const formKey = open ? "open" : "closed";
  const [prevFormKey, setPrevFormKey] = useState(formKey);
  if (prevFormKey !== formKey) {
    setPrevFormKey(formKey);
    if (open) {
      const next: Record<string, number> = {};
      for (const c of matrix) next[cellKey(c.clienteId, c.eventoId)] = c.montoNeto;
      setSaved(next);
      setDraft({});
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

  function effectiveTag(c: MarcaClienteTagRow): boolean {
    return tagOverrides.has(c.id)
      ? (tagOverrides.get(c.id) as boolean)
      : c.tienePlanMedios;
  }

  // Filas de la matriz = marcas con plan de medios activo.
  const clientesMedios = useMemo<MarcaClienteRow[]>(() => {
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

  function toggleTag(c: MarcaClienteTagRow) {
    const next = !effectiveTag(c);
    setTagOverrides((prev) => new Map(prev).set(c.id, next));
    setTagPendingId(c.id);
    startTag(async () => {
      const res = await setPlanMediosAction({
        clienteId: c.id,
        tienePlanMedios: next,
      });
      setTagPendingId(null);
      if (!res.ok) {
        // revertir override en error
        setTagOverrides((prev) => new Map(prev).set(c.id, !next));
        console.error("[MediosMatrixSheet] setPlanMedios failed:", res.error);
      }
    });
  }

  function cellNeto(clienteId: string, eventoId: string): number {
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

  function commitCell(clienteId: string, eventoId: string) {
    const key = cellKey(clienteId, eventoId);
    if (!(key in draft)) return;
    const neto = parseMonto(draft[key]);
    const current = saved[key] ?? 0;
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
      const res = await upsertMediosIngresoAction({
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
        console.error("[MediosMatrixSheet] upsert failed:", res.error);
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
      for (const c of clientesMedios) sum += cellNeto(c.id, e.eventoId);
      map.set(e.eventoId, sum);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEventos, clientesMedios, draft, saved]);

  const totalesRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clientesMedios) {
      let sum = 0;
      for (const e of visibleEventos) sum += cellNeto(c.id, e.eventoId);
      map.set(c.id, sum);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesMedios, visibleEventos, draft, saved]);

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
            aria-labelledby="medios-matrix-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-[1200px] h-[90vh] bg-white border-4 border-black shadow-[8px_8px_0px_#000] rounded-none flex flex-col">
              <header className="flex items-start justify-between gap-4 border-b-4 border-black px-6 py-4 flex-shrink-0">
                <div>
                  <h2
                    id="medios-matrix-title"
                    className="font-display uppercase text-2xl leading-none text-black"
                  >
                    Imputar medios
                  </h2>
                  <p className="mt-1 font-mono-data text-[10px] uppercase text-black/60">
                    Plan de medios por marca × evento · sólo marcas con el plan
                    activo
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

              <div className="border-b-4 border-black px-6 py-3 flex-shrink-0 space-y-3">
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
                    {eventos.length === 1 ? "" : "s"} ·{" "}
                    {clientesMedios.length} marca
                    {clientesMedios.length === 1 ? "" : "s"} con plan
                  </span>
                  <button
                    type="button"
                    onClick={() => setManaging((v) => !v)}
                    aria-pressed={managing}
                    className="ml-auto font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] bg-white hover:bg-[#FFFF00] cursor-pointer transition-colors duration-150"
                  >
                    Gestionar plan de medios
                  </button>
                </div>

                {managing && (
                  <div className="border-2 border-black p-3 space-y-2 bg-white">
                    <p className="font-mono-data uppercase text-[10px] text-black/70">
                      Marcá qué marcas tienen plan de medios (aparecen como fila
                      en la matriz)
                    </p>
                    <input
                      type="text"
                      placeholder="Buscar marca…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full max-w-[280px] font-mono-data text-xs px-2 py-1.5 border-2 border-black outline-none focus:bg-[#FFFF00]/30"
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
                            className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 disabled:opacity-50 ${
                              active
                                ? "bg-black text-[#FFFF00]"
                                : "bg-white text-black hover:bg-[#FFFF00]"
                            }`}
                          >
                            {active ? "✓ " : "+ "}
                            {c.nombre}
                          </button>
                        );
                      })}
                      {marcasFiltradas.length === 0 && (
                        <span className="font-mono-data text-[10px] text-black/50">
                          Sin marcas para “{search}”.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {clientesMedios.length === 0 || visibleEventos.length === 0 ? (
                  <p className="font-mono-data text-sm text-black/50 px-6 py-6">
                    {clientesMedios.length === 0
                      ? "Ninguna marca tiene plan de medios. Activá una con “Gestionar plan de medios”."
                      : "No hay eventos para la categoría seleccionada."}
                  </p>
                ) : (
                  <MatrixGrid
                    clientes={clientesMedios}
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
  return (
    <table className="border-collapse">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-30 bg-black text-white font-mono-data uppercase text-[10px] px-3 py-2 text-left border-r-2 border-b-2 border-black min-w-[220px]">
            Marca
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
            Total marca
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
                    aria-label={`Monto neto medios ${c.nombre} en ${e.nombre}`}
                    title={neto > 0 ? `Bruto: ${fmtClp(bruto)}` : "Vacío"}
                    placeholder="$0"
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
