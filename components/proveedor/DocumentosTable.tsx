"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { DocumentoRow } from "@/lib/queries/proveedor";
import DownloadButtons from "@/components/proveedor/DownloadButtons";
import {
  dateLabel,
  formatCurrency,
  formatNumber,
} from "@/components/proveedor/format";

interface Props {
  rows: DocumentoRow[];
  proveedor: string;
  /** true si la query alcanzó el tope de filas (detalle truncado). */
  capped: boolean;
  csvFilename: string;
}

const CSV_HEADERS = [
  "Fecha",
  "Folio",
  "Documento",
  "Tipo",
  "RUT",
  "Proveedor",
  "Negocio ID",
  "Negocio",
  "Categoría",
  "Subcategoría",
  "Ítem",
  "Estado",
  "Validado",
  "Costo empresa (CLP)",
];

function toCsvRows(rows: DocumentoRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.fecha,
    r.folio,
    r.doc,
    r.tipo,
    r.rut,
    r.proveedor,
    r.negocioId,
    r.negocioNombre,
    r.categoria,
    r.subCategoria,
    r.itemNombre,
    r.estado,
    r.validado,
    Math.round(r.costo),
  ]);
}

export default function DocumentosTable({
  rows,
  proveedor,
  capped,
  csvFilename,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.folio,
        r.doc,
        r.negocioId,
        r.negocioNombre,
        r.categoria,
        r.subCategoria,
        r.itemNombre,
        r.estado,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  const totalGasto = filtered.reduce((a, r) => a + r.costo, 0);

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white">
      <header className="flex flex-col gap-3 px-6 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Detalle de documentos
            </h2>
            <p className="font-sans text-sm text-[#666666]">
              Una fila por ítem de gasto. {formatNumber(filtered.length)} de{" "}
              {formatNumber(rows.length)} filas · {formatCurrency(totalGasto)}.
            </p>
          </div>
          <DownloadButtons
            filename={csvFilename}
            sheetName="Detalle gasto"
            headers={CSV_HEADERS}
            rows={toCsvRows(filtered)}
          />
        </div>

        <div className="relative inline-flex w-full max-w-sm items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-[#999999]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por folio, negocio, ítem…"
            className="w-full rounded-lg border border-[#E5E5E5] bg-white py-2 pl-9 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
            aria-label="Filtrar documentos"
          />
        </div>

        {capped && (
          <p className="font-sans text-xs text-[#EF8C34]">
            Mostrando las primeras {formatNumber(rows.length)} filas. Acota el rango
            de fechas para ver el resto.
          </p>
        )}
      </header>

      {filtered.length === 0 ? (
        <p className="py-12 text-center font-sans text-sm text-[#999999]">
          {proveedor
            ? "Sin documentos para los filtros seleccionados."
            : "Selecciona un proveedor para ver su detalle."}
        </p>
      ) : (
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {[
                  "Fecha",
                  "Folio",
                  "Negocio",
                  "Categoría",
                  "Ítem",
                  "Estado",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]"
                  >
                    {h}
                  </th>
                ))}
                <th className="sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                  Gasto
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={`${r.folio}-${r.negocioId}-${i}`}
                  className="border-b border-[#E5E5E5] transition-colors last:border-b-0 hover:bg-[#FAFAFA]"
                >
                  <td className="whitespace-nowrap px-4 py-3 align-top font-sans text-sm text-[#333333]">
                    {dateLabel(r.fecha)}
                  </td>
                  <td className="px-4 py-3 align-top font-sans text-sm tabular-nums text-[#333333]">
                    <span className="block">{r.folio || "—"}</span>
                    <span className="block truncate font-sans text-xs text-[#999999]" title={r.doc}>
                      {r.doc}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className="block max-w-[240px] truncate font-sans text-sm text-[#333333]"
                      title={r.negocioNombre || r.negocioId}
                    >
                      {r.negocioNombre || `Negocio ${r.negocioId}`}
                    </span>
                    <span className="block font-sans text-xs text-[#999999]">
                      {r.negocioId}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className="block max-w-[180px] truncate font-sans text-sm text-[#333333]"
                      title={r.categoria}
                    >
                      {r.categoria || "—"}
                    </span>
                    {r.subCategoria && (
                      <span
                        className="block max-w-[180px] truncate font-sans text-xs text-[#999999]"
                        title={r.subCategoria}
                      >
                        {r.subCategoria}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className="block max-w-[220px] truncate font-sans text-sm text-[#333333]"
                      title={r.itemNombre}
                    >
                      {r.itemNombre || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-sans text-sm text-[#666666]">
                    {r.estado || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-top font-sans text-sm tabular-nums text-[#333333]">
                    {formatCurrency(r.costo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
