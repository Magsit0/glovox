"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/components/proveedor/csv";
import type { OnepagerFfbbCategoriaProductoRow } from "@/lib/queries/onepager";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import {
  disponibles,
  enConflicto,
  filtrar,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { normalizarSeleccion } from "@/lib/filters/url";

type Props = {
  data: OnepagerFfbbCategoriaProductoRow[];
  eventoId: string;
};

// Facetas encadenadas (lib/filters/facetas.ts). Categoría es el padre: acota
// las opciones de Producto, pero elegir un producto no le esconde categorías
// (`ignora`). Ningún filtro modifica a otro: cada uno escribe solo su estado.
const FACETAS: Faceta<OnepagerFfbbCategoriaProductoRow>[] = [
  { key: "categoria", valores: (r) => r.categoria, ignora: ["producto"] },
  { key: "producto", valores: (r) => r.producto },
];

const FACETA_LABEL: Record<string, string> = {
  categoria: "Categoría",
  producto: "Producto",
};

function toItems(values: readonly string[]) {
  return values.map((v) => ({ value: v, label: v }));
}

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values))
    .filter((v) => v.length > 0)
    .sort((a, b) => a.localeCompare(b, "es-CL"));
}

export default function FfbbDetalleTable({ data, eventoId }: Props) {
  // Selección cruda de cada filtro (vacía = "Todos").
  const [categorias, setCategorias] = useState<Set<string>>(() => new Set());
  const [productos, setProductos] = useState<Set<string>>(() => new Set());

  const sel = useMemo(
    () => ({ categoria: categorias, producto: productos }),
    [categorias, productos],
  );

  // Universo de cada faceta en los datos del evento.
  const todasCategorias = useMemo(
    () => uniqueSorted(data.map((r) => r.categoria)),
    [data],
  );
  const todosProductos = useMemo(
    () => uniqueSorted(data.map((r) => r.producto)),
    [data],
  );

  // Opciones de cada dropdown: lo compatible con el otro filtro + lo ya
  // elegido. Un producto elegido que no calza con la categoría sigue a la
  // vista, atenuado (`available`), para poder desmarcarlo.
  const disp = useMemo(() => disponibles(data, FACETAS, sel), [data, sel]);
  const categoriasItems = useMemo(
    () => toItems(opcionesVisibles(todasCategorias, disp.categoria, categorias)),
    [todasCategorias, disp, categorias],
  );
  const productosItems = useMemo(
    () => toItems(opcionesVisibles(todosProductos, disp.producto, productos)),
    [todosProductos, disp, productos],
  );

  const filtered = useMemo(() => filtrar(data, FACETAS, sel), [data, sel]);

  // Filtros que chocan entre sí cuando la combinación no deja ninguna fila.
  const conflictos = useMemo(
    () =>
      enConflicto(data, FACETAS, sel).map((key) => ({
        key,
        label: FACETA_LABEL[key] ?? key,
      })),
    [data, sel],
  );

  // Cada filtro escribe solo su propio estado. Marcar todo su universo se
  // guarda como "Todos" (normalizarSeleccion).
  function cambiarCategorias(next: Set<string>) {
    setCategorias(new Set(normalizarSeleccion(next, todasCategorias)));
  }
  function cambiarProductos(next: Set<string>) {
    setProductos(new Set(normalizarSeleccion(next, todosProductos)));
  }
  function limpiarFaceta(key: string) {
    if (key === "categoria") setCategorias(new Set());
    else if (key === "producto") setProductos(new Set());
  }

  const hasActiveFilter = categorias.size > 0 || productos.size > 0;

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
        <StandardMultiFilter
          label={FACETA_LABEL.categoria}
          selected={categorias}
          onChange={cambiarCategorias}
          options={categoriasItems}
          available={disp.categoria}
          searchPlaceholder="Buscar categoría…"
        />
        <StandardMultiFilter
          label={FACETA_LABEL.producto}
          selected={productos}
          onChange={cambiarProductos}
          options={productosItems}
          available={disp.producto}
          searchPlaceholder="Buscar producto…"
        />
        {/* Único control que toca los dos filtros: vuelve al estado por
            defecto (todo en "Todos"). */}
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
        conflictos.length > 0 ? (
          <FilterConflictNotice conflicts={conflictos} onClear={limpiarFaceta} />
        ) : (
          <p className="font-sans text-sm text-[#999999]">
            Sin datos para la combinación de filtros seleccionada.
          </p>
        )
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
