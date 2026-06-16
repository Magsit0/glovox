"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Plus, Save, Search, X } from "lucide-react";
import type {
  SheetGrid,
  CellEdit,
  SheetTarget,
} from "@/lib/eventos-sheet-service";
import {
  appendColumnAction,
  appendRowAction,
  saveCellsAction,
} from "../actions";

/** 0-based → letra de columna (0 → A) para etiquetas de respaldo. */
function colLabel(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const cellKey = (r: number, c: number) => `${r}:${c}`;
const normHeader = (s: string) => s.trim().toLowerCase();

/**
 * Opciones del desplegable para una celda: vacío + lista estandarizada. Si el
 * valor actual no está en la lista (dato viejo), se incluye igual para no
 * perderlo ni mostrarlo en blanco.
 */
function venueOptions(venues: string[], current: string): string[] {
  const opts = ["", ...venues];
  if (current && !venues.includes(current)) opts.splice(1, 0, current);
  return opts;
}

interface Props {
  data: SheetGrid;
  /** Pestaña destino de las acciones de escritura. */
  target: SheetTarget;
  /** Nombres de columnas a ocultar (no editables). Match por nombre, normalizado. */
  hiddenColumns?: string[];
  /** Nombre de la columna que usa desplegable de venues (solo en eventos). */
  venueColumn?: string;
  /** Lista estandarizada de venues para el desplegable. */
  venues?: string[];
  /** Mapa columna→tipo BQ (de la pestaña _tipos): DATE/NUMERIC/BOOL. */
  columnTypes?: Record<string, string>;
}

/** Opciones del desplegable de tipo al agregar columna. */
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "STRING", label: "Texto" },
  { value: "NUMERIC", label: "Número" },
  { value: "DATE", label: "Fecha" },
  { value: "BOOL", label: "Sí/No" },
];

export default function EventosSheetEditor({
  data,
  target,
  hiddenColumns = [],
  venueColumn,
  venues = [],
  columnTypes = {},
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Valores comprometidos (lo que está en la hoja). Se resincroniza cuando el
  // server manda data fresca tras un router.refresh().
  const [baseValues, setBaseValues] = useState<string[][]>(data.values);
  // Ediciones pendientes (sin re-render por tecla). key "r:c" → CellEdit.
  const editsRef = useRef<Map<string, CellEdit>>(new Map());
  const [dirtyCount, setDirtyCount] = useState(0);
  // Bump para remontar inputs (limpia DOM/valores) tras guardar o refrescar.
  const [epoch, setEpoch] = useState(0);
  // Fila borrador para "Agregar fila".
  const [draft, setDraft] = useState<string[] | null>(null);
  // Formulario inline para "Agregar columna".
  const [adding, setAdding] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState("STRING");

  // Resincronización cuando el server manda data fresca (tras router.refresh()):
  // ajustar estado durante el render comparando el prop anterior es el patrón
  // recomendado por React (evita setState-en-effect y sus cascadas).
  const [prevData, setPrevData] = useState(data);
  if (prevData !== data) {
    setPrevData(data);
    setBaseValues(data.values);
    editsRef.current.clear();
    setDirtyCount(0);
    setDraft(null);
    setEpoch((e) => e + 1);
  }

  const colCount = data.colCount;
  const header = useMemo(() => baseValues[0] ?? [], [baseValues]);
  const hidden = useMemo(
    () => new Set(hiddenColumns.map(normHeader)),
    [hiddenColumns],
  );
  // Índices reales de columna que SÍ se muestran/editan (se preserva el índice
  // absoluto para que el guardado apunte a la celda correcta de la hoja).
  const visibleCols = useMemo(
    () =>
      Array.from({ length: colCount }, (_, c) => c).filter(
        (c) => !hidden.has(normHeader(header[c] ?? "")),
      ),
    [colCount, header, hidden],
  );
  const dataRows = useMemo(
    () =>
      baseValues.slice(1).map((cells, i) => ({ r: i + 1, cells })), // r = índice absoluto en baseValues
    [baseValues],
  );

  const venueColNorm = venueColumn ? normHeader(venueColumn) : null;
  const isVenueCol = (c: number) =>
    venueColNorm != null && normHeader(header[c] ?? "") === venueColNorm;

  // Lookup columna→tipo (normalizado) para decidir el widget de la celda.
  const typeLookup = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(columnTypes)) {
      m[normHeader(k)] = String(v).toUpperCase();
    }
    return m;
  }, [columnTypes]);
  const isDateCol = (c: number) => typeLookup[normHeader(header[c] ?? "")] === "DATE";

  const pendingValue = (r: number, c: number) =>
    editsRef.current.get(cellKey(r, c))?.newValue;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dataRows;
    return dataRows.filter(({ r, cells }) =>
      visibleCols.some((c) =>
        (pendingValue(r, c) ?? cells[c] ?? "").toLowerCase().includes(q),
      ),
    );
    // pendingValue lee un ref; recalcular sólo al cambiar query/filas es suficiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, dataRows, epoch, visibleCols]);

  function onCellChange(
    r: number,
    c: number,
    value: string,
    el: HTMLInputElement | HTMLSelectElement,
  ) {
    const original = baseValues[r]?.[c] ?? "";
    const key = cellKey(r, c);
    const before = editsRef.current.size;
    if (value === original) {
      editsRef.current.delete(key);
      el.removeAttribute("data-dirty");
    } else {
      editsRef.current.set(key, { row: r, col: c, oldValue: original, newValue: value });
      el.setAttribute("data-dirty", "true");
    }
    const after = editsRef.current.size;
    if (after !== before) setDirtyCount(after); // re-render sólo en transiciones
  }

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

  function guardar() {
    const edits = Array.from(editsRef.current.values());
    if (edits.length === 0) return;
    run(async () => {
      const res = await saveCellsAction(target, edits);
      if (res.ok) {
        // Optimista: refleja los cambios ya y limpia el estado sucio; el
        // router.refresh() del runner trae luego la versión autoritativa.
        const next = baseValues.map((row) => [...row]);
        for (const e of edits) {
          if (next[e.row]) next[e.row][e.col] = e.newValue;
        }
        setBaseValues(next);
        editsRef.current.clear();
        setDirtyCount(0);
        setEpoch((x) => x + 1);
      }
      return res;
    });
  }

  function confirmarColumna() {
    const name = newColName.trim();
    if (!name) return;
    run(async () => {
      const res = await appendColumnAction(target, name, newColType);
      if (res.ok) {
        setAdding(false);
        setNewColName("");
        setNewColType("STRING");
      }
      return res;
    });
  }

  function guardarFila() {
    if (!draft) return;
    run(async () => {
      const res = await appendRowAction(target, draft);
      if (res.ok) setDraft(null);
      return res;
    });
  }

  const hasData = baseValues.length > 0;

  return (
    <section className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en la hoja…"
            className="w-72 max-w-full rounded-lg border border-[#E5E5E5] bg-white py-2 pl-9 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={pending || adding}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Agregar columna
          </button>
          <button
            type="button"
            onClick={() => setDraft(Array.from({ length: colCount }, () => ""))}
            disabled={pending || draft !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Agregar fila
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={pending || dirtyCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {dirtyCount > 0 ? `Guardar ${dirtyCount} cambio${dirtyCount > 1 ? "s" : ""}` : "Guardar"}
          </button>
        </div>
      </div>

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white p-3">
          <input
            autoFocus
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmarColumna();
              } else if (e.key === "Escape") {
                setAdding(false);
                setNewColName("");
              }
            }}
            placeholder="Nombre de la columna…"
            className="w-64 max-w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          />
          <select
            value={newColType}
            onChange={(e) => setNewColType(e.target.value)}
            className="cursor-pointer rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={confirmarColumna}
            disabled={pending || !newColName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Crear columna
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewColName("");
              setNewColType("STRING");
            }}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm font-medium text-[#666666] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
          <span className="font-sans text-xs text-[#999999]">
            El tipo define cómo queda en BigQuery (Fecha → DATE) al sincronizar.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Cerrar"
            className="rounded p-0.5 text-[#666666] hover:text-[#333333]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Grilla */}
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-[#E5E5E5] bg-white">
        {!hasData ? (
          <p className="py-12 text-center font-sans text-sm text-[#999999]">
            La hoja está vacía.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#FAFAFA]">
                <th className="sticky left-0 z-20 border-b border-r border-[#E5E5E5] bg-[#FAFAFA] px-2 py-2 font-sans text-xs font-medium text-[#999999]">
                  #
                </th>
                {visibleCols.map((c) => (
                  <th
                    key={c}
                    className="border-b border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]"
                  >
                    {header[c] || colLabel(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ r, cells }) => (
                <tr key={`${epoch}:${r}`} className="hover:bg-[#FAFAFA]">
                  <td className="sticky left-0 z-10 border-b border-r border-[#E5E5E5] bg-white px-2 py-1 text-center font-sans text-xs tabular-nums text-[#999999]">
                    {r + 1}
                  </td>
                  {visibleCols.map((c) => {
                    const base = cells[c] ?? "";
                    const initial = pendingValue(r, c) ?? base;
                    return (
                      <td key={c} className="border-b border-[#E5E5E5] p-0">
                        {isVenueCol(c) ? (
                          <select
                            defaultValue={initial}
                            data-dirty={initial !== base ? "true" : undefined}
                            onChange={(e) =>
                              onCellChange(r, c, e.target.value, e.currentTarget)
                            }
                            className="w-full min-w-[8rem] cursor-pointer bg-transparent px-3 py-2 font-sans text-sm text-[#333333] outline-none focus:bg-[#F0EFFE] data-[dirty=true]:bg-[#F0EFFE]"
                          >
                            {venueOptions(venues, initial).map((v) => (
                              <option key={v} value={v}>
                                {v || "—"}
                              </option>
                            ))}
                          </select>
                        ) : isDateCol(c) ? (
                          <input
                            type="date"
                            defaultValue={initial}
                            data-dirty={initial !== base ? "true" : undefined}
                            onChange={(e) =>
                              onCellChange(r, c, e.target.value, e.currentTarget)
                            }
                            className="w-full min-w-[9rem] bg-transparent px-3 py-2 font-sans text-sm text-[#333333] outline-none focus:bg-[#F0EFFE] data-[dirty=true]:bg-[#F0EFFE]"
                          />
                        ) : (
                          <input
                            defaultValue={initial}
                            data-dirty={initial !== base ? "true" : undefined}
                            onChange={(e) =>
                              onCellChange(r, c, e.target.value, e.currentTarget)
                            }
                            className="w-full min-w-[8rem] bg-transparent px-3 py-2 font-sans text-sm text-[#333333] outline-none focus:bg-[#F0EFFE] data-[dirty=true]:bg-[#F0EFFE]"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {draft && (
                <tr className="bg-[#F0EFFE]">
                  <td className="sticky left-0 z-10 border-b border-r border-[#E5E5E5] bg-white px-2 py-1 text-center">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
                  </td>
                  {visibleCols.map((c, i) => {
                    const setCell = (val: string) =>
                      setDraft((d) => {
                        const next = [...(d ?? [])];
                        next[c] = val;
                        return next;
                      });
                    return (
                      <td key={c} className="border-b border-[#E5E5E5] p-0">
                        {isVenueCol(c) ? (
                          <select
                            value={draft[c] ?? ""}
                            onChange={(e) => setCell(e.target.value)}
                            className="w-full min-w-[8rem] cursor-pointer bg-transparent px-3 py-2 font-sans text-sm text-[#333333] outline-none focus:bg-white"
                          >
                            {venueOptions(venues, draft[c] ?? "").map((v) => (
                              <option key={v} value={v}>
                                {v || "—"}
                              </option>
                            ))}
                          </select>
                        ) : isDateCol(c) ? (
                          <input
                            type="date"
                            autoFocus={i === 0}
                            value={draft[c] ?? ""}
                            onChange={(e) => setCell(e.target.value)}
                            className="w-full min-w-[9rem] bg-transparent px-3 py-2 font-sans text-sm text-[#333333] outline-none focus:bg-white"
                          />
                        ) : (
                          <input
                            autoFocus={i === 0}
                            value={draft[c] ?? ""}
                            onChange={(e) => setCell(e.target.value)}
                            placeholder={header[c] || colLabel(c)}
                            className="w-full min-w-[8rem] bg-transparent px-3 py-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] outline-none focus:bg-white"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Acciones de la fila borrador */}
      {draft && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(null)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-sans text-sm font-medium text-[#666666] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Cancelar fila
          </button>
          <button
            type="button"
            onClick={guardarFila}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guardar fila
          </button>
        </div>
      )}

      <p className="font-sans text-xs text-[#999999]">
        {filtered.length} de {Math.max(dataRows.length, 0)} filas
        {query ? " (filtradas)" : ""}. Editás celdas y “Guardar” escribe sólo lo
        cambiado en Google Sheets.
        {venueColumn
          ? " La columna VENUE se elige de la lista estandarizada (pestaña “venues”)."
          : ""}{" "}
        Renombrar columnas o reordenar se hace en la hoja original.
      </p>
    </section>
  );
}
