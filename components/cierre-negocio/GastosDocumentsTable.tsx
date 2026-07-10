"use client";

import { useMemo, useState } from "react";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import type { DetalleGastoRow } from "@/lib/unabase/types";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  gastos: DetalleGastoRow[];
}

const INITIAL_LIMIT = 50;

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(fecha);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function GastosDocumentsTable({ gastos }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [proveedorFilter, setProveedorFilter] = useState<Set<string>>(new Set());
  const [categoriaFilter, setCategoriaFilter] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    return [...gastos].sort((a, b) => {
      const da = String(a.fecha ?? "");
      const db = String(b.fecha ?? "");
      if (da !== db) return db.localeCompare(da);
      return String(b.folio ?? "").localeCompare(String(a.folio ?? ""));
    });
  }, [gastos]);

  const proveedores = useMemo(() => {
    const set = new Set<string>();
    for (const g of gastos) {
      const p = (g.proveedor ?? "").trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort();
  }, [gastos]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const g of gastos) {
      const c = (g.item_categoria ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [gastos]);

  const filtered = useMemo(() => {
    return sorted.filter((g) => {
      if (proveedorFilter.size > 0 && !proveedorFilter.has((g.proveedor ?? "").trim())) {
        return false;
      }
      if (categoriaFilter.size > 0 && !categoriaFilter.has((g.item_categoria ?? "").trim())) {
        return false;
      }
      return true;
    });
  }, [sorted, proveedorFilter, categoriaFilter]);

  const totalMonto = useMemo(
    () => filtered.reduce((sum, g) => sum + Number(g.costoempresa ?? 0), 0),
    [filtered],
  );

  if (sorted.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Documentos de gasto
        </h3>
        <p className="mt-2 font-sans text-sm text-[#999999]">
          Este negocio aún no tiene gastos documentados.
        </p>
      </article>
    );
  }

  const hiddenCount = showAll ? 0 : Math.max(0, filtered.length - INITIAL_LIMIT);
  const categoriaSeleccionada = categoriaFilter.size > 0;
  const isFiltered = proveedorFilter.size > 0 || categoriaSeleccionada;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Documentos de gasto
        </h3>
        <span className="font-sans text-xs text-[#666666]">
          {isFiltered
            ? `${formatNumber(filtered.length)} de ${formatNumber(sorted.length)} documentos`
            : `${formatNumber(sorted.length)} documento${sorted.length === 1 ? "" : "s"}`}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-4" data-no-print="true">
        <StandardMultiFilter
          label="Proveedor"
          selected={proveedorFilter}
          onChange={setProveedorFilter}
          options={proveedores.map((p) => ({ value: p, label: p }))}
          allLabel="Todos"
          searchPlaceholder="Buscar proveedor..."
        />
        <StandardMultiFilter
          label="Categoría"
          selected={categoriaFilter}
          onChange={setCategoriaFilter}
          options={categorias.map((c) => ({ value: c, label: c }))}
          allLabel="Todas"
          searchPlaceholder="Buscar categoría..."
        />
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setProveedorFilter(new Set());
              setCategoriaFilter(new Set());
            }}
            className="font-sans text-xs text-[#666666] transition-colors hover:text-[#333333]"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div
        className="max-h-[480px] overflow-auto print:max-h-none print:overflow-visible"
        data-pdf-table-wrap
      >
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left font-sans text-xs uppercase tracking-wide text-[#666666]">
              <Th>Folio</Th>
              <Th>Doc</Th>
              <Th>Fecha</Th>
              <Th>Proveedor</Th>
              <Th>{categoriaSeleccionada ? "Subcategoría" : "Categoría"}</Th>
              <Th>Item</Th>
              <ThRight>Monto</ThRight>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center font-sans text-sm text-[#999999]">
                  Sin documentos para los filtros seleccionados.
                </td>
              </tr>
            )}
            {filtered.map((g, idx) => {
              const isOverflow = !showAll && idx >= INITIAL_LIMIT;
              return (
                <tr
                  key={`${g.id}-${g.folio}-${idx}`}
                  {...(isOverflow ? { "data-pdf-overflow-row": "true" } : {})}
                  className={`border-b border-[#F0F0F0] transition-colors hover:bg-[#FAFAFA] ${
                    isOverflow ? "hidden print:table-row" : ""
                  }`}
                >
                  <Td className="font-medium text-[#333333]">{g.folio || "—"}</Td>
                  <Td className="text-[#666666]">{g.doc || "—"}</Td>
                  <Td className="text-[#666666]">{formatFecha(g.fecha)}</Td>
                  <Td className="text-[#333333]">
                    <span className="block max-w-[220px] truncate" title={g.proveedor}>
                      {g.proveedor || "Sin proveedor"}
                    </span>
                  </Td>
                  <Td>
                    {(() => {
                      const valor = categoriaSeleccionada ? g.item_sub_categoria : g.item_categoria;
                      return valor ? (
                        <span className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-xs text-[#666666]">
                          {valor}
                        </span>
                      ) : (
                        <span className="text-[#999999]">—</span>
                      );
                    })()}
                  </Td>
                  <Td className="text-[#666666]">
                    <span className="block max-w-[200px] truncate" title={g.item_nombre}>
                      {g.item_nombre || "—"}
                    </span>
                  </Td>
                  <TdRight className="tabular-nums text-[#333333]">
                    {formatCurrency(g.costoempresa)}
                  </TdRight>
                  <Td className="text-[#666666]">{g.estado || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="font-sans text-sm">
                <TdFoot colSpan={6} className="font-medium text-[#333333]">
                  Total {isFiltered ? "filtrado" : ""}
                </TdFoot>
                <TdFootRight className="font-medium tabular-nums text-[#333333]">
                  {formatCurrency(totalMonto)}
                </TdFootRight>
                <TdFoot />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          data-no-print="true"
          className="self-start rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-xs font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
        >
          Mostrar {formatNumber(hiddenCount)} más
        </button>
      )}
    </article>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 font-medium">{children}</th>
  );
}

function ThRight({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 text-right font-medium">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 font-sans text-sm ${className}`}>{children}</td>;
}

function TdRight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-right font-sans text-sm ${className}`}>{children}</td>
  );
}

function TdFoot({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`sticky bottom-0 z-10 border-t border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 font-sans text-sm ${className}`}
    >
      {children}
    </td>
  );
}

function TdFootRight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`sticky bottom-0 z-10 border-t border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-right font-sans text-sm ${className}`}
    >
      {children}
    </td>
  );
}
