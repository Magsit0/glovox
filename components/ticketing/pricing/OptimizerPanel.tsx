"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronUp, Play, Sparkles } from "lucide-react";
import {
  optimizeRevenueAction,
  type OptimizeResponse,
  type OptimizerPreview,
} from "@/app/ticketing/actions";
import { ETAPA_LABEL, type Etapa } from "@/lib/ticketing-pricing/formulas";
import { formatNumber } from "@/lib/unabase/formatting";

/** Nombre corto del evento (sin el prefijo de marca) para encabezados angostos. */
const shortName = (n: string) => n.replace(/^\S+\s+/, "") || n;

interface Props {
  planId: string;
  money: (n: number) => string;
  /** Aplica los precios/stock sugeridos (canal general) al estado del builder. */
  onApply: (sug: { tipo: string; etapa: string; precio: number; stock: number }[]) => void;
}

const GENERAL_COL = "";
const ck = (tipo: string, etapa: string) => `${tipo}␟${etapa}`;

type Edit = { precio?: number; demanda?: number };

export default function OptimizerPanel({ planId, money, onApply }: Props) {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [resp, setResp] = useState<OptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [stale, setStale] = useState(false);
  const [showRef, setShowRef] = useState(true);

  // Carga inicial: setState sólo tras el await (no síncrono en el effect).
  useEffect(() => {
    let alive = true;
    optimizeRevenueAction(planId, {}).then((res) => {
      if (!alive) return;
      if (res.ok && res.data) {
        setResp(res.data);
        setSelectedIds(res.data.preview.candidates.filter((c) => c.usado).map((c) => c.eventoId));
      } else if (!res.ok) {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [planId]);

  const result = resp?.result ?? null;
  const preview = resp?.preview ?? null;

  function recalc() {
    setError(null);
    const celdas = Object.entries(edits).map(([key, v]) => {
      const [tipo, etapa] = key.split("␟");
      return { tipo, etapa, precio: v.precio, demanda: v.demanda };
    });
    startTransition(async () => {
      const res = await optimizeRevenueAction(planId, {
        celdas,
        refEventoIds: selectedIds ?? undefined,
      });
      if (res.ok && res.data) {
        setResp(res.data);
        setEdits({});
        setStale(false);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  function setEdit(tipo: string, etapa: string, field: keyof Edit, val: number) {
    setEdits((prev) => ({ ...prev, [ck(tipo, etapa)]: { ...prev[ck(tipo, etapa)], [field]: val } }));
    setStale(true);
  }

  const selSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  function toggleEvento(id: string) {
    setSelectedIds((prev) => {
      const cur = prev ?? [];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
    setStale(true);
  }
  function toggleGrupo(ids: string[], on: boolean) {
    setSelectedIds((prev) => {
      const cur = new Set(prev ?? []);
      for (const id of ids) {
        if (on) cur.add(id);
        else cur.delete(id);
      }
      return [...cur];
    });
    setStale(true);
  }

  const grupos = useMemo(() => {
    const m = new Map<string, OptimizerPreview["candidates"]>();
    for (const c of preview?.candidates ?? []) {
      const arr = m.get(c.categoriaEvento) ?? [];
      arr.push(c);
      m.set(c.categoriaEvento, arr);
    }
    return [...m.entries()];
  }, [preview]);

  // Eventos seleccionados (columnas de la tabla de detalle), en orden estable.
  const selectedEventos = useMemo(
    () => (preview?.candidates ?? []).filter((c) => selSet.has(c.eventoId)),
    [preview, selSet],
  );

  // Detalle + promedio (la referencia) recalculados EN VIVO según la selección.
  const refView = useMemo(() => {
    const filas = (preview?.referencia.filas ?? [])
      .map((f) => {
        const sel = f.porEvento.filter((p) => selSet.has(p.eventoId));
        const conPrecio = sel.filter((p) => p.precio > 0);
        const precioProm = conPrecio.length
          ? Math.round(conPrecio.reduce((s, p) => s + p.precio, 0) / conPrecio.length)
          : 0;
        const cantidadProm = sel.length
          ? Math.round(sel.reduce((s, p) => s + p.tickets, 0) / sel.length)
          : 0;
        if (precioProm <= 0) return null;
        return {
          bucket: f.bucket,
          etapaNorm: f.etapaNorm,
          etapaOrden: f.etapaOrden,
          precioProm,
          cantidadProm,
          porEvento: new Map(sel.map((p) => [p.eventoId, p])),
        };
      })
      .filter((f): f is NonNullable<typeof f> => f != null)
      .sort((a, b) => a.etapaOrden - b.etapaOrden || a.bucket.localeCompare(b.bucket));
    const magnitud = filas.reduce((s, f) => s + f.cantidadProm, 0);
    return { filas, magnitud };
  }, [preview, selSet]);

  const columnas = useMemo(() => {
    const cols: { key: string; label: string; sub?: string }[] = [
      { key: GENERAL_COL, label: "General", sub: "sin sponsor" },
    ];
    for (const s of result?.sponsors ?? []) {
      cols.push({ key: s.nombre, label: s.nombre, sub: `−${Math.round(s.disc * 100)}%` });
    }
    return cols;
  }, [result]);

  function apply() {
    if (!result) return;
    onApply(
      result.cells.map((c) => ({
        tipo: c.tipo,
        etapa: c.etapa,
        precio: c.precioBase,
        stock: c.lanes.find((l) => l.sponsor === GENERAL_COL)?.stock ?? 0,
      })),
    );
  }

  const uplift = result?.comparacion?.deltaPct ?? null;
  const laneOf = (cellIdx: number, key: string) =>
    result?.cells[cellIdx].lanes.find((l) => l.sponsor === key) ?? null;
  const fuenteLabel =
    preview?.magnitudFuente === "plan"
      ? "del plan (Σ a vender)"
      : preview?.magnitudFuente === "comparables"
        ? "mediana de la referencia"
        : "capacidad del venue";

  const numCls =
    "w-24 rounded-md border border-[#E5E5E5] bg-[#F0EFFE] px-2 py-1 text-right font-sans text-sm tabular-nums text-[#333333] hover:border-[#9F99F8] focus:border-[#9F99F8] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#333333]">
            <Sparkles className="h-5 w-5 text-[#9F99F8]" />
            Plan de ingreso óptimo · techo
          </h3>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Precio y demanda salen del histórico (editables por celda). El modelo vende el máximo
            posible dentro de la capacidad y los cupos — el techo. Ajustá los parámetros y corré el
            modelo.
          </p>
        </div>
        {result && (
          <button
            type="button"
            onClick={apply}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Aplicar sugerencias
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
          <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
        </div>
      )}

      {(loading || pending) && !result && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-[#F0F0F0]" />
          ))}
        </div>
      )}

      {result && preview && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="Ingreso techo (bruto)" value={money(result.totals.ingresoBruto)} />
            <Kpi label="Ingreso neto (sin IVA)" value={money(result.totals.ingresoNeto)} />
            <Kpi
              label="vs plan actual"
              value={uplift == null ? "—" : `${uplift >= 0 ? "+" : ""}${Math.round(uplift * 100)}%`}
              dot={uplift == null ? undefined : uplift >= 0 ? "pos" : "neg"}
            />
          </div>

          {/* PARÁMETRO 1: eventos de referencia */}
          <div className="rounded-lg border border-[#E5E5E5] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-sans text-sm font-medium text-[#333333]">
                1 · Eventos de referencia
                <span className="ml-2 font-normal text-[#999999]">
                  {preview.marca ? `${preview.marca} · ` : ""}
                  {selSet.size} de {preview.candidates.length} · magnitud {formatNumber(refView.magnitud)} ({fuenteLabel})
                </span>
              </p>
              <button
                type="button"
                onClick={() => setShowRef((v) => !v)}
                className="inline-flex items-center gap-1 font-sans text-xs font-medium text-[#9F99F8] hover:text-[#8780F0]"
              >
                {showRef ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showRef ? "Ocultar eventos" : "Mostrar eventos"}
              </button>
            </div>

            {showRef && grupos.length === 0 && (
              <p className="mt-3 font-sans text-sm text-[#999999]">
                No hay eventos históricos de esta marca; cargá precio y demanda a mano abajo.
              </p>
            )}

            {showRef && grupos.length > 0 && (
              <div className="mt-3 flex flex-col gap-3">
                {grupos.map(([cat, evs]) => {
                  const ids = evs.map((e) => e.eventoId);
                  const allOn = ids.every((id) => selSet.has(id));
                  return (
                    <div key={cat}>
                      <button
                        type="button"
                        onClick={() => toggleGrupo(ids, !allOn)}
                        className="font-sans text-xs font-medium uppercase tracking-wide text-[#9F99F8] hover:text-[#8780F0]"
                      >
                        {cat} {allOn ? "· quitar todos" : "· usar todos"}
                      </button>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {evs.map((e) => {
                          const on = selSet.has(e.eventoId);
                          return (
                            <button
                              key={e.eventoId}
                              type="button"
                              onClick={() => toggleEvento(e.eventoId)}
                              title={`${e.eventoId} · ${formatNumber(e.tickets)} tickets`}
                              className={`rounded-full border px-2.5 py-1 font-sans text-xs transition-colors ${
                                on
                                  ? "border-[#9F99F8] bg-[#F0EFFE] font-medium text-[#534AB7]"
                                  : "border-[#E5E5E5] bg-white text-[#999999] hover:border-[#333333] hover:text-[#666666]"
                              }`}
                            >
                              {e.nombre} · {formatNumber(e.tickets)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showRef && (refView.filas.length > 0 ? (
              <div className="mt-4 overflow-x-auto border-t border-[#E5E5E5] pt-4">
                <p className="mb-2 font-sans text-xs text-[#666666]">
                  Precio y cantidad vendida de cada evento seleccionado, y el{" "}
                  <span className="font-medium text-[#333333]">promedio (la referencia del modelo)</span>:
                </p>
                <table className="w-full font-sans text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] text-[#666666]">
                      <th className="px-2 py-1.5 text-left font-medium">Tipo · Etapa</th>
                      {selectedEventos.map((e) => (
                        <th key={e.eventoId} className="px-2 py-1.5 text-center font-medium" title={e.nombre}>
                          {shortName(e.nombre)}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-center font-medium text-[#534AB7]">Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refView.filas.map((f) => (
                      <tr key={`${f.bucket}|${f.etapaNorm}`} className="border-b border-[#F0F0F0] last:border-0">
                        <td className="px-2 py-1.5 whitespace-nowrap text-[#333333]">
                          {f.bucket === "VIP" ? "VIP" : "General"} · {ETAPA_LABEL[f.etapaNorm as Etapa] ?? f.etapaNorm}
                        </td>
                        {selectedEventos.map((e) => {
                          const p = f.porEvento.get(e.eventoId);
                          return (
                            <td key={e.eventoId} className="px-2 py-1.5 text-center align-middle">
                              {p ? (
                                <>
                                  <div className="tabular-nums text-[#333333]">{formatNumber(p.tickets)}</div>
                                  <div className="text-[10px] tabular-nums text-[#999999]">{money(p.precio)}</div>
                                </>
                              ) : (
                                <span className="text-[#CCCCCC]">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="bg-[#F0EFFE] px-2 py-1.5 text-center align-middle">
                          <div className="font-medium tabular-nums text-[#333333]">{formatNumber(f.cantidadProm)}</div>
                          <div className="text-[10px] tabular-nums text-[#534AB7]">{money(f.precioProm)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 border-t border-[#E5E5E5] pt-4 font-sans text-xs text-[#999999]">
                Seleccioná al menos un evento para ver su precio y cantidad vendida.
              </p>
            ))}
          </div>

          {/* PARÁMETRO 2: precio y demanda por celda (editables) */}
          <div className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
            <table className="w-full font-sans text-sm">
              <caption className="px-4 pt-4 text-left font-display text-base font-bold text-[#333333]">
                2 · Parámetros por celda
                <span className="ml-2 font-sans text-xs font-normal text-[#999999]">
                  precio = p0 histórico · demanda = D0 histórico · editables (en lavanda)
                </span>
              </caption>
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                  {["Tipo", "Etapa", "Precio (p0)", "Demanda esperada (D0)"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 font-medium uppercase tracking-wide text-[#666666] ${i < 2 ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.celdas.map((c) => {
                  const e = edits[ck(c.tipo, c.etapa)];
                  const precioVal = e?.precio ?? Math.round(c.precio);
                  const demandaVal = e?.demanda ?? Math.round(c.demanda);
                  return (
                    <tr key={ck(c.tipo, c.etapa)} className="border-b border-[#E5E5E5] last:border-0">
                      <td className="px-3 py-2 text-[#333333]">{c.tipo}</td>
                      <td className="px-3 py-2 text-[#666666]">
                        {c.etapa}
                        {c.sinHistorico && !e && (
                          <span className="ml-2 rounded bg-[#F1EFE8] px-1.5 py-0.5 text-[11px] text-[#5F5E5A]">
                            sin histórico
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={precioVal}
                          onChange={(ev) => setEdit(c.tipo, c.etapa, "precio", Number(ev.target.value) || 0)}
                          className={numCls}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={demandaVal}
                          onChange={(ev) => setEdit(c.tipo, c.etapa, "demanda", Number(ev.target.value) || 0)}
                          className={numCls}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Correr el modelo */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={recalc}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#9F99F8] px-5 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {pending ? "Corriendo…" : "Correr el modelo"}
            </button>
            {stale && !pending && (
              <span className="font-sans text-sm text-[#A8336B]">
                Cambiaste parámetros — corré el modelo para actualizar el plan.
              </span>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="rounded-lg border border-[#F6C544] bg-[#FEFBF0] p-3 font-sans text-xs text-[#7A5B00]">
              {result.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}

          {/* Plan ofrecido — matriz 3D: filas tipo×etapa, columnas por sponsor */}
          <div className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
            <table className="w-full font-sans text-sm">
              <caption className="px-4 pt-4 text-left font-display text-lg font-bold text-[#333333]">
                Plan ofrecido (techo) — precio y stock por sponsor
              </caption>
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                  <th className="px-3 py-3 text-left font-medium uppercase tracking-wide text-[#666666]">
                    Tipo / Etapa
                  </th>
                  {columnas.map((c) => (
                    <th key={c.key} className="px-3 py-3 text-center font-medium text-[#666666]">
                      <span className="block text-[#333333]">{c.label}</span>
                      {c.sub && <span className="block text-[11px] font-normal text-[#999999]">{c.sub}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.cells.map((cell, idx) => {
                  const prevTipo = idx > 0 ? result.cells[idx - 1].tipo : null;
                  const grupo = cell.tipo !== prevTipo;
                  return (
                    <FragmentRow
                      key={`${cell.tipo}|${cell.etapa}`}
                      grupo={grupo}
                      tipo={cell.tipo}
                      colSpan={columnas.length + 1}
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-[#333333]">{cell.etapa}</span>
                        {cell.sinHistorico && (
                          <span className="ml-2 rounded bg-[#F1EFE8] px-1.5 py-0.5 text-[11px] text-[#5F5E5A]">
                            sin histórico
                          </span>
                        )}
                      </td>
                      {columnas.map((c) => {
                        const lane = laneOf(idx, c.key);
                        return (
                          <td key={c.key} className="px-3 py-2.5 text-center align-middle">
                            {lane && lane.stock > 0 ? (
                              <>
                                <div className="font-medium tabular-nums text-[#333333]">
                                  {money(lane.precio)}
                                </div>
                                <div className="text-[11px] tabular-nums text-[#666666]">
                                  {formatNumber(lane.stock)}
                                </div>
                              </>
                            ) : (
                              <span className="text-[#CCCCCC]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </FragmentRow>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
                  <td className="px-3 py-3 font-medium text-[#333333]">
                    Total · {formatNumber(result.totals.ticketsVendidos)} tickets
                  </td>
                  <td
                    className="px-3 py-3 text-right font-bold tabular-nums text-[#333333]"
                    colSpan={columnas.length}
                  >
                    {money(result.totals.ingresoBruto)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Fila de la matriz, precedida de un header de grupo cuando cambia el tipo. */
function FragmentRow({
  grupo,
  tipo,
  colSpan,
  children,
}: {
  grupo: boolean;
  tipo: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {grupo && (
        <tr className="bg-[#FAFAFA]">
          <td colSpan={colSpan} className="px-3 py-2 font-medium text-[#333333]">
            {tipo}
          </td>
        </tr>
      )}
      <tr className="border-b border-[#E5E5E5] last:border-0">{children}</tr>
    </>
  );
}

function Kpi({ label, value, dot }: { label: string; value: string; dot?: "pos" | "neg" }) {
  return (
    <div className="flex flex-col rounded-lg bg-[#FAFAFA] p-4">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-[#333333]">
        {dot && (
          <span
            className={`inline-block h-2 w-2 rounded-full ${dot === "pos" ? "bg-[#B1D750]" : "bg-[#ED75A0]"}`}
          />
        )}
        {value}
      </p>
    </div>
  );
}
