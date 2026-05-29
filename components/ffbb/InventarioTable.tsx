"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { InsumoConsumoRow } from "@/lib/ffbb/types";
import type { CompraInsumoRow } from "@/lib/queries/compras-insumo";
import { deleteCompraAction } from "@/app/ffbb/actions";
import CompraFormSheet from "./CompraFormSheet";
import PdfImportSheet from "./PdfImportSheet";

interface Props {
  rows: InsumoConsumoRow[];
  compradoByInsumo: Record<string, number>;
  compras: CompraInsumoRow[];
  insumos: string[];
  proveedores: string[];
  eventoId: string;
}

type SortKey = "insumo" | "consumido" | "comprado" | "diferencia";
type SortDir = "asc" | "desc";

const fmtCantidad = (v: number): string =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(v);

function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function InventarioTable({
  rows,
  compradoByInsumo,
  compras,
  insumos,
  proveedores,
  eventoId,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("diferencia");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [formOpen, setFormOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [editing, setEditing] = useState<CompraInsumoRow | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Sumamos consumido por insumo + tomamos comprado del map; unimos todos los insumos
  // que aparecen en cualquiera de las dos fuentes.
  const aggregated = useMemo(() => {
    const consumidoMap = new Map<string, number>();
    for (const r of rows) {
      consumidoMap.set(r.insumo, (consumidoMap.get(r.insumo) ?? 0) + r.cantidadConsumida);
    }
    const allInsumos = new Set<string>([
      ...consumidoMap.keys(),
      ...Object.keys(compradoByInsumo),
    ]);
    return Array.from(allInsumos).map((insumo) => {
      const consumido = consumidoMap.get(insumo) ?? 0;
      const comprado = compradoByInsumo[insumo] ?? 0;
      return { insumo, consumido, comprado, diferencia: comprado - consumido };
    });
  }, [rows, compradoByInsumo]);

  const sorted = useMemo(() => {
    const copy = [...aggregated];
    copy.sort((a, b) => {
      if (sortKey === "insumo") {
        const cmp = a.insumo.localeCompare(b.insumo, "es-CL");
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = a[sortKey] - b[sortKey];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [aggregated, sortKey, sortDir]);

  function onHeaderClick(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "insumo" ? "asc" : "desc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 text-[#999999]" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[#333333]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[#333333]" />
    );
  }

  function handleAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleEdit(c: CompraInsumoRow) {
    setEditing(c);
    setFormOpen(true);
  }

  function handleDelete(c: CompraInsumoRow) {
    if (!confirm(`Eliminar compra de ${c.insumo}?`)) return;
    setActionError(null);
    startDeleteTransition(async () => {
      const res = await deleteCompraAction(c.id);
      if (!res.ok) setActionError(res.error);
    });
  }

  const sumas = useMemo(() => {
    let consumido = 0;
    let comprado = 0;
    for (const r of aggregated) {
      consumido += r.consumido;
      comprado += r.comprado;
    }
    return { consumido, comprado, diferencia: comprado - consumido };
  }, [aggregated]);

  return (
    <div className="flex flex-col gap-6">
      <article className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Inventario del evento
            </h2>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              <span className="font-medium">Consumido</span> = ventas × fórmula (BigQuery).{" "}
              <span className="font-medium">Comprado</span> = suma de imputaciones (tipo
              <code className="mx-1 rounded bg-[#F5F5F5] px-1 py-0.5 text-xs">ingreso</code>) en este evento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPdfOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-3 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
              title="Subir factura en PDF o imagen y dejá que Gemini extraiga las compras"
            >
              <Sparkles className="h-4 w-4 text-[#9F99F8]" />
              Importar PDF
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-3 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
            >
              <Plus className="h-4 w-4" />
              Imputar compra
            </button>
          </div>
        </header>

        {actionError && (
          <div className="flex items-start gap-2 rounded-lg border border-[#ED75A0] bg-white p-3">
            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
            <p className="flex-1 font-sans text-sm text-[#333333]">{actionError}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                  <button
                    type="button"
                    onClick={() => onHeaderClick("insumo")}
                    className="inline-flex items-center gap-1 hover:text-[#333333]"
                  >
                    Insumo
                    {sortIcon("insumo")}
                  </button>
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                  <button
                    type="button"
                    onClick={() => onHeaderClick("consumido")}
                    className="ml-auto inline-flex items-center gap-1 hover:text-[#333333]"
                  >
                    Consumido
                    {sortIcon("consumido")}
                  </button>
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                  <button
                    type="button"
                    onClick={() => onHeaderClick("comprado")}
                    className="ml-auto inline-flex items-center gap-1 hover:text-[#333333]"
                  >
                    Comprado
                    {sortIcon("comprado")}
                  </button>
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                  <button
                    type="button"
                    onClick={() => onHeaderClick("diferencia")}
                    className="ml-auto inline-flex items-center gap-1 hover:text-[#333333]"
                    title="Comprado − Consumido"
                  >
                    Diferencia
                    {sortIcon("diferencia")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#666666]">
                    Sin movimientos en este evento.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  const dotColor =
                    row.diferencia > 0
                      ? "#B1D750"
                      : row.diferencia < 0
                        ? "#ED75A0"
                        : "#999999";
                  return (
                    <tr
                      key={row.insumo}
                      className="border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA]"
                    >
                      <td className="px-4 py-3 text-[#333333]">{row.insumo}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                        {row.consumido > 0 ? fmtCantidad(row.consumido) : (
                          <span className="text-[#999999]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                        {row.comprado > 0 ? fmtCantidad(row.comprado) : (
                          <span className="text-[#999999]">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="text-[#333333]">{fmtCantidad(row.diferencia)}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
                  <td className="px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Totales
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#333333]">
                    {fmtCantidad(sumas.consumido)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#333333]">
                    {fmtCantidad(sumas.comprado)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[#333333]">
                    {fmtCantidad(sumas.diferencia)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p className="font-sans text-xs text-[#999999]">
          {sorted.length} insumo{sorted.length === 1 ? "" : "s"} con movimiento ·{" "}
          {compras.length} compra{compras.length === 1 ? "" : "s"} imputadas
        </p>
      </article>

      <article className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header>
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Compras imputadas
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            Detalle por compra. Editá o eliminá una fila para corregir un error.
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">Fecha</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">Insumo</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">Proveedor</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">N° Factura</th>
                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[#666666]">Tipo</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Recibido</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Bruto</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-[#666666]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {compras.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#666666]">
                    No hay compras imputadas todavía.
                  </td>
                </tr>
              ) : (
                compras.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA]"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-[#666666]">
                      {formatFecha(c.fechaCompra)}
                    </td>
                    <td className="px-3 py-2 text-[#333333]">{c.insumo}</td>
                    <td className="px-3 py-2 text-[#666666]">{c.proveedor ?? "—"}</td>
                    <td className="px-3 py-2 text-[#666666]">{c.numeroFactura ?? "—"}</td>
                    <td className="px-3 py-2 text-[#666666]">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          c.tipoOperacion === "ingreso"
                            ? "bg-[#E7F4D0] text-[#3F6310]"
                            : c.tipoOperacion === "egreso"
                              ? "bg-[#FCE4EE] text-[#A8336B]"
                              : "bg-[#F0F0F0] text-[#666666]"
                        }`}
                      >
                        {c.tipoOperacion}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                      {c.recibido != null ? fmtCantidad(c.recibido) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#333333]">
                      {c.bruto != null ? fmtCantidad(c.bruto) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          aria-label={`Editar compra de ${c.insumo}`}
                          className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#F0EFFE] hover:text-[#9F99F8]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={deletePending}
                          aria-label={`Eliminar compra de ${c.insumo}`}
                          className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#FCE4EE] hover:text-[#A8336B] disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <CompraFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        eventoId={eventoId}
        insumos={insumos}
        proveedores={proveedores}
        initial={editing}
      />
      <PdfImportSheet
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        eventoId={eventoId}
      />
    </div>
  );
}
