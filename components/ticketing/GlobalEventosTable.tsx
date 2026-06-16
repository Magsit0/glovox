"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { GlobalEventoRow } from "@/lib/queries/ticketing";
import DownloadMenu from "./DownloadMenu";

type SortKey = keyof GlobalEventoRow;
type SortDir = "asc" | "desc";

// Orden de columnas (también define los headers del Excel). `texto` = orden
// alfabético/natural; el resto se trata como fecha ISO (string YYYY-MM-DD, que
// ordena cronológicamente). Default de dirección al cambiar de columna:
// texto → asc, fecha → desc.
const COLUMNS: { key: SortKey; label: string; texto?: boolean }[] = [
  { key: "eventoId", label: "EventoID", texto: true },
  { key: "nombre", label: "Nombre", texto: true },
  { key: "venue", label: "Venue", texto: true },
  { key: "fechaInicioVenta", label: "Fecha inicio venta" },
  { key: "fechaEvento", label: "Fecha evento" },
  { key: "diasCampania", label: "Días de campaña" },
];

interface Props {
  eventos: GlobalEventoRow[];
}

export default function GlobalEventosTable({ eventos }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fechaEvento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...eventos];
    arr.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      // Valores vacíos siempre al final, sin importar la dirección.
      if (av === "" && bv === "") return 0;
      if (av === "") return 1;
      if (bv === "") return -1;
      const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [eventos, sortKey, sortDir]);

  function toggleSort(col: (typeof COLUMNS)[number]) {
    if (col.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir(col.texto ? "asc" : "desc");
    }
  }

  const excelRows = sorted.map((e) => [
    e.eventoId,
    e.nombre,
    e.venue,
    e.fechaInicioVenta,
    e.fechaEvento,
    e.diasCampania,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <DownloadMenu
          filename="ticketing-analisis-global"
          sheetName="Eventos"
          headers={COLUMNS.map((c) => c.label)}
          rows={excelRows}
          label="Descargar"
        />
      </div>

      <div className="max-h-[600px] overflow-auto rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = c.key === sortKey;
                const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={c.key}
                    aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-left font-medium text-[#666666]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c)}
                      className={`flex items-center gap-1 transition-colors hover:text-[#333333] ${active ? "text-[#333333]" : ""}`}
                      aria-label={`Ordenar por ${c.label}`}
                    >
                      {c.label}
                      <Icon className={`h-3 w-3 ${active ? "text-[#333333]" : "text-[#999999]"}`} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center font-sans text-sm text-[#999999]"
                >
                  No hay eventos para mostrar.
                </td>
              </tr>
            )}
            {sorted.map((e) => (
              <tr
                key={e.eventoId}
                className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 hover:bg-[#FAFAFA]"
              >
                <td className="px-4 py-3 font-medium text-[#333333]">{e.eventoId}</td>
                <td className="px-4 py-3 text-[#333333]">{e.nombre || "—"}</td>
                <td className="px-4 py-3 text-[#333333]">{e.venue || "—"}</td>
                <td className="px-4 py-3 tabular-nums text-[#666666]">{e.fechaInicioVenta}</td>
                <td className="px-4 py-3 tabular-nums text-[#666666]">{e.fechaEvento || "—"}</td>
                <td className="px-4 py-3 tabular-nums text-[#666666]">
                  {e.diasCampania != null ? e.diasCampania : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-sans text-xs text-[#999999]">
        {eventos.length} {eventos.length === 1 ? "evento" : "eventos"}.
      </p>
    </div>
  );
}
