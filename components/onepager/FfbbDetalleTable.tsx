"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/components/proveedor/csv";
import type { OnepagerFfbbCategoriaProductoRow } from "@/lib/queries/onepager";
import MultiFilter from "./MultiFilter";

type Props = {
  data: OnepagerFfbbCategoriaProductoRow[];
  eventoId: string;
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values))
    .filter((v) => v.length > 0)
    .sort((a, b) => a.localeCompare(b, "es-CL"));
}

function inSet(set: Set<string>, value: string): boolean {
  return set.size === 0 || set.has(value);
}

export default function FfbbDetalleTable({ data, eventoId }: Props) {
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [productos, setProductos] = useState<Set<string>>(new Set());

  const categoriasOpts = useMemo(
    () => uniqueSorted(data.map((r) => r.categoria)),
    [data],
  );

  // Las opciones de producto se acotan a las categorías seleccionadas.
  const productosOpts = useMemo(() => {
    const filtered = data.filter((r) => inSet(categorias, r.categoria));
    return uniqueSorted(filtered.map((r) => r.producto));
  }, [data, categorias]);

  // Si una categoría se deselecciona, descartamos los productos elegidos que ya
  // no están disponibles (sin perder el estado crudo de `productos`).
  const effectiveProductos = useMemo(() => {
    if (productos.size === 0) return productos;
    const valid = new Set(productosOpts);
    const next = new Set<string>();
    for (const p of productos) if (valid.has(p)) next.add(p);
    return next;
  }, [productos, productosOpts]);

  const filtered = useMemo(
    () =>
      data.filter(
        (r) =>
          inSet(categorias, r.categoria) &&
          inSet(effectiveProductos, r.producto),
      ),
    [data, categorias, effectiveProductos],
  );

  const hasActiveFilter = categorias.size > 0 || effectiveProductos.size > 0;

  if (data.length === 0) {
    return <p className="font-sans text-sm text-[#999999]">Sin datos.</p>;
  }

  const totalVenta = filtered.reduce((a, r) => a + r.venta, 0);
  const totalQtty = filtered.reduce((a, r) => a + r.qtty, 0);

  function handleDownload() {
    downloadCsv(
      `ffbb-detalle-${eventoId}`,
      ["Producto", "Categoría", "Venta (CLP)", "Cantidad"],
      filtered.map((r) => [
        r.producto,
        r.categoria,
        Math.round(r.venta),
        r.qtty,
      ]),
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros + descarga */}
      <div className="flex flex-wrap items-end gap-3">
        <MultiFilter
          label="Categoría"
          selected={categorias}
          onChange={setCategorias}
          options={categoriasOpts}
        />
        <MultiFilter
          label="Producto"
          selected={effectiveProductos}
          onChange={setProductos}
          options={productosOpts}
        />
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setCategorias(new Set());
              setProductos(new Set());
            }}
            className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          onClick={handleDownload}
          disabled={filtered.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          Descargar CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="font-sans text-sm text-[#999999]">
          Sin datos para la combinación de filtros seleccionada.
        </p>
      ) : (
        <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
                  Producto
                </th>
                <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
                  Categoría
                </th>
                <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                  Venta (CLP)
                </th>
                <th className="bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={`${r.categoria}::${r.producto}::${i}`}
                  className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                >
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 font-medium">
                    {r.producto || "—"}
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3">
                    {r.categoria || "—"}
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                    {fmtClp(r.venta)}
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                    {r.qtty.toLocaleString("es-CL")}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
                <td className="font-sans text-sm text-[#333333] px-4 py-3 font-semibold">
                  Total ({filtered.length} prod.)
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-3" />
                <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-semibold tabular-nums">
                  {fmtClp(totalVenta)}
                </td>
                <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-semibold tabular-nums">
                  {totalQtty.toLocaleString("es-CL")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
