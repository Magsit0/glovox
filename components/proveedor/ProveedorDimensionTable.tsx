"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  ProveedorDimension,
  ProveedorDimensionRow,
} from "@/lib/queries/proveedor";
import DownloadButtons from "@/components/proveedor/DownloadButtons";
import {
  compactCurrency,
  dateLabel,
  formatCurrency,
  formatNumber,
} from "@/components/proveedor/format";

interface Props {
  /** Datos por cada dimensión disponible. Una clave por dimensión activa. */
  data: Record<ProveedorDimension, ProveedorDimensionRow[]>;
  /** Dimensión activa inicial. */
  initial?: ProveedorDimension;
  baseSearchParams?: Record<string, string | undefined>;
  /** true cuando hay un proveedor seleccionado → no muestra columna Proveedor. */
  proveedorScope?: boolean;
  /** Cantidad de filas visibles (el CSV/Excel exportan todas). */
  maxRows?: number;
  /**
   * Por cada dimensión, true si la query alcanzó su LIMIT (datos truncados).
   * Cuando es true, el componente muestra una advertencia.
   */
  capped?: Record<ProveedorDimension, boolean>;
}

type SortKey = "proveedor" | "dimension" | "gasto" | "negocios" | "promedio" | "ultima";
type SortDir = "asc" | "desc";

const DIMENSIONS: { id: ProveedorDimension; label: string }[] = [
  { id: "categoria", label: "Categoría" },
  { id: "subcategoria", label: "Subcategoría" },
  { id: "item", label: "Ítem" },
];

const DIMENSION_LABEL: Record<ProveedorDimension, string> = {
  categoria: "Categoría",
  subcategoria: "Subcategoría",
  item: "Ítem",
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#999999]" aria-hidden="true">
        <path d="M4 4l2-2 2 2M4 8l2 2 2-2" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#333333]" aria-hidden="true">
      {dir === "asc" ? (
        <path d="M3 8l3-4 3 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      ) : (
        <path d="M3 4l3 4 3-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      )}
    </svg>
  );
}

function HeaderButton({
  label,
  active,
  dir,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition-colors hover:text-[#333333] ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

export default function ProveedorDimensionTable({
  data,
  initial = "categoria",
  baseSearchParams,
  proveedorScope = false,
  maxRows = 200,
  capped,
}: Props) {
  const [dim, setDim] = useState<ProveedorDimension>(initial);
  const [sortKey, setSortKey] = useState<SortKey>("gasto");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Memo: data[dim] ?? [] crea un array nuevo en cada render con `??`,
  // lo que invalidaría el useMemo de `sorted` en cada cambio de estado.
  const rows = useMemo(() => data[dim] ?? [], [data, dim]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "proveedor":
          av = a.proveedor.toLowerCase();
          bv = b.proveedor.toLowerCase();
          break;
        case "dimension":
          av = a.dimension.toLowerCase();
          bv = b.dimension.toLowerCase();
          break;
        case "gasto":
          av = a.gasto;
          bv = b.gasto;
          break;
        case "negocios":
          av = a.negocios;
          bv = b.negocios;
          break;
        case "promedio":
          av = a.promedio;
          bv = b.promedio;
          break;
        case "ultima":
          av = a.ultimaFecha;
          bv = b.ultimaFecha;
          break;
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv, "es") : bv.localeCompare(av, "es");
      }
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === "asc" ? an - bn : bn - an;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      // texto: asc por defecto; números: desc
      setSortDir(k === "proveedor" || k === "dimension" ? "asc" : "desc");
    }
  }

  function hrefForProveedor(proveedor: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseSearchParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("proveedor", proveedor);
    return `/proveedor?${params.toString()}`;
  }

  const visible = sorted.slice(0, maxRows);
  const dimLabel = DIMENSION_LABEL[dim];

  const totalGasto = rows.reduce((a, r) => a + r.gasto, 0);

  // CSV/Excel: exporta todas las filas en el orden actual.
  const csvHeaders = [
    "Proveedor",
    "RUT",
    dimLabel,
    "Monto (CLP)",
    "Negocios",
    "Promedio x negocio (CLP)",
    "Última fecha",
  ];
  const csvRows = sorted.map((r) => [
    r.proveedor,
    r.rut,
    r.dimension,
    Math.round(r.gasto),
    r.negocios,
    Math.round(r.promedio),
    r.ultimaFecha,
  ]);

  const filename = proveedorScope
    ? `proveedor-por-${dim}`
    : `proveedores-por-${dim}`;

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white">
      <header className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Gasto por proveedor y {dimLabel.toLowerCase()}
          </h2>
          <p className="font-sans text-sm text-[#666666]">
            {rows.length > maxRows
              ? `Top ${maxRows} de ${formatNumber(rows.length)} combinaciones por monto. El CSV/Excel incluye todas.`
              : "Monto total, cantidad de negocios donde participó y promedio por negocio."}
          </p>
          {capped?.[dim] && (
            <p className="font-sans text-xs text-[#EF8C34]">
              Resultados truncados en {formatNumber(rows.length)} filas. Acota el rango
              de fechas o filtra por proveedor para ver el resto.
            </p>
          )}
          <div
            role="group"
            aria-label="Dimensión"
            className="mt-1 flex flex-wrap gap-1 self-start rounded-lg border border-[#E5E5E5] bg-white p-1"
          >
            {DIMENSIONS.map((d) => {
              const isActive = dim === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDim(d.id)}
                  className={`rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#F0EFFE] text-[#9F99F8]"
                      : "text-[#666666] hover:text-[#333333]"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
        <DownloadButtons
          filename={filename}
          sheetName={`Por ${dimLabel.toLowerCase()}`}
          headers={csvHeaders}
          rows={csvRows}
        />
      </header>

      {rows.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {!proveedorScope && (
                  <th className="sticky left-0 top-0 z-20 w-[220px] min-w-[220px] bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    <HeaderButton
                      label="Proveedor"
                      active={sortKey === "proveedor"}
                      dir={sortDir}
                      onClick={() => onSort("proveedor")}
                      align="left"
                    />
                  </th>
                )}
                <th
                  className={`sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666] ${
                    proveedorScope ? "sticky left-0 z-20 w-[260px] min-w-[260px]" : ""
                  }`}
                >
                  <HeaderButton
                    label={dimLabel}
                    active={sortKey === "dimension"}
                    dir={sortDir}
                    onClick={() => onSort("dimension")}
                    align="left"
                  />
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  <HeaderButton
                    label="Monto"
                    active={sortKey === "gasto"}
                    dir={sortDir}
                    onClick={() => onSort("gasto")}
                  />
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  <HeaderButton
                    label="Negocios"
                    active={sortKey === "negocios"}
                    dir={sortDir}
                    onClick={() => onSort("negocios")}
                  />
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  <HeaderButton
                    label="Promedio"
                    active={sortKey === "promedio"}
                    dir={sortDir}
                    onClick={() => onSort("promedio")}
                  />
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  <HeaderButton
                    label="Última"
                    active={sortKey === "ultima"}
                    dir={sortDir}
                    onClick={() => onSort("ultima")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => (
                <tr
                  key={`${r.proveedor}|${r.dimension}|${i}`}
                  className="group border-b border-[#E5E5E5] last:border-b-0"
                >
                  {!proveedorScope && (
                    <td className="sticky left-0 z-10 w-[220px] min-w-[220px] bg-white px-4 py-3 align-top group-hover:bg-[#FAFAFA]">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={hrefForProveedor(r.proveedor)}
                          className="max-w-[200px] truncate font-sans text-sm text-[#333333] transition-colors hover:text-[#9F99F8]"
                          title={r.proveedor}
                        >
                          {r.proveedor}
                        </Link>
                        {r.rut && (
                          <span className="truncate font-sans text-xs text-[#999999]">
                            {r.rut}
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  <td
                    className={`px-4 py-3 align-top group-hover:bg-[#FAFAFA] ${
                      proveedorScope ? "sticky left-0 z-10 w-[260px] min-w-[260px] bg-white" : ""
                    }`}
                  >
                    <span
                      className="block max-w-[260px] truncate font-sans text-sm text-[#333333]"
                      title={r.dimension}
                    >
                      {r.dimension}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-top font-sans text-sm font-medium tabular-nums text-[#333333] group-hover:bg-[#FAFAFA]">
                    {formatCurrency(r.gasto)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333] group-hover:bg-[#FAFAFA]">
                    {formatNumber(r.negocios)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333] group-hover:bg-[#FAFAFA]">
                    {r.negocios > 0 ? (
                      formatCurrency(r.promedio)
                    ) : (
                      <span className="text-[#999999]">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#666666] group-hover:bg-[#FAFAFA]">
                    {r.ultimaFecha ? dateLabel(r.ultimaFecha) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <p className="px-6 pb-4 font-sans text-xs text-[#999999]">
          Total: {compactCurrency(totalGasto)} · {formatNumber(rows.length)} combinaciones.
        </p>
      )}
    </article>
  );
}
