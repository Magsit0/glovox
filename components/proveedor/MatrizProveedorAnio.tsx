"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MatrizProveedorAnioRow } from "@/lib/queries/proveedor";
import DownloadButtons from "@/components/proveedor/DownloadButtons";
import { compactCurrency, formatCurrency } from "@/components/proveedor/format";

interface Props {
  years: number[];
  rows: MatrizProveedorAnioRow[];
  baseSearchParams?: Record<string, string | undefined>;
  /** Cantidad de filas visibles (el CSV exporta todas). */
  maxRows?: number;
}

type SortDir = "asc" | "desc";

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

export default function MatrizProveedorAnio({
  years,
  rows,
  baseSearchParams,
  maxRows = 100,
}: Props) {
  // sortKey: "label" | "total" | un año ("2024")
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      if (sortKey === "label") {
        return sortDir === "asc"
          ? a.proveedor.localeCompare(b.proveedor, "es")
          : b.proveedor.localeCompare(a.proveedor, "es");
      }
      const av = sortKey === "total" ? a.total : a.byYear[sortKey] ?? 0;
      const bv = sortKey === "total" ? b.total : b.byYear[sortKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return out;
  }, [rows, sortKey, sortDir]);

  function onSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "label" ? "asc" : "desc");
    }
  }

  function hrefFor(proveedor: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(baseSearchParams ?? {})) {
      if (v) params.set(k, v);
    }
    params.set("proveedor", proveedor);
    return `/proveedor?${params.toString()}`;
  }

  const visible = sorted.slice(0, maxRows);

  // Columnas de año: solo las que tienen al menos un valor entre las filas
  // visibles (recientes primero). Un año cuyo gasto vive solo en proveedores de
  // la cola —fuera del top mostrado— no aparece como columna vacía. El CSV/Excel
  // exporta todas las filas, así que igual incluye todos los años.
  const displayYears = years
    .filter(
      (y) =>
        // El año por el que se ordena nunca se oculta (al ordenar asc suben los
        // ceros y, si no, la columna recién clickeada desaparecería).
        String(y) === sortKey ||
        visible.some((r) => (r.byYear[String(y)] ?? 0) !== 0),
    )
    .sort((a, b) => b - a);
  const hiddenYears = years.length - displayYears.length;

  // CSV: años en orden cronológico (ascendente), total al final.
  const csvHeaders = ["Proveedor", "RUT", ...years.map(String), "Total"];
  const csvRows = sorted.map((r) => [
    r.proveedor,
    r.rut,
    ...years.map((y) => Math.round(r.byYear[String(y)] ?? 0)),
    Math.round(r.total),
  ]);

  const totalGeneral = rows.reduce((a, r) => a + r.total, 0);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white">
      <header className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Matriz de gasto por proveedor y año
          </h2>
          <p className="font-sans text-sm text-[#666666]">
            {rows.length > maxRows
              ? `Top ${maxRows} de ${rows.length} proveedores por gasto total. Descarga el CSV para todos. Gasto según la fecha del documento; acota los años con el filtro de fechas.`
              : "Gasto por proveedor y año, según la fecha del documento. Click en un proveedor para ver su detalle."}
          </p>
        </div>
        <DownloadButtons
          filename="matriz-proveedor-anio"
          sheetName="Proveedor por año"
          headers={csvHeaders}
          rows={csvRows}
        />
      </header>

      {rows.length === 0 || displayYears.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          Sin datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="sticky left-0 top-0 z-20 w-[220px] min-w-[220px] bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  <HeaderButton
                    label="Proveedor"
                    active={sortKey === "label"}
                    dir={sortDir}
                    onClick={() => onSort("label")}
                    align="left"
                  />
                </th>
                <th className="sticky top-0 z-10 whitespace-nowrap border-r border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  <HeaderButton
                    label="Total"
                    active={sortKey === "total"}
                    dir={sortDir}
                    onClick={() => onSort("total")}
                  />
                </th>
                {displayYears.map((y) => (
                  <th
                    key={y}
                    className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]"
                  >
                    <HeaderButton
                      label={String(y)}
                      active={sortKey === String(y)}
                      dir={sortDir}
                      onClick={() => onSort(String(y))}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.proveedor}
                  className="group border-b border-[#E5E5E5] last:border-b-0"
                >
                  <td className="sticky left-0 z-10 w-[220px] min-w-[220px] bg-white px-4 py-3 align-top group-hover:bg-[#FAFAFA]">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={hrefFor(r.proveedor)}
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
                  <td className="whitespace-nowrap border-r border-[#E5E5E5] bg-white px-4 py-3 text-right align-top font-sans text-sm font-medium tabular-nums text-[#333333] group-hover:bg-[#FAFAFA]">
                    {formatCurrency(r.total)}
                  </td>
                  {displayYears.map((y) => {
                    const v = r.byYear[String(y)];
                    return (
                      <td
                        key={y}
                        className="whitespace-nowrap px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333] group-hover:bg-[#FAFAFA]"
                      >
                        {v ? (
                          formatCurrency(v)
                        ) : (
                          <span className="text-[#999999]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && displayYears.length > 0 && (
        <p className="px-6 pb-4 font-sans text-xs text-[#999999]">
          Total general: {compactCurrency(totalGeneral)} · {rows.length} proveedores ·{" "}
          {displayYears.length} {displayYears.length === 1 ? "año" : "años"} con datos
          {hiddenYears > 0
            ? ` (se ocultan ${hiddenYears} ${hiddenYears === 1 ? "año sin gasto" : "años sin gasto"} entre las filas visibles; el CSV/Excel los incluye)`
            : ""}
          .
        </p>
      )}
    </article>
  );
}
