"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { NegocioRow } from "@/lib/unabase/types";

function formatFecha(dateStr: string): string {
  if (!dateStr) return "—";
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr);
  const d = match
    ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
    : new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

const COLUMNS: { key: keyof NegocioRow; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "referencia", label: "Nombre negocio" },
  { key: "area_negocio", label: "Área" },
  { key: "razon_cliente", label: "Cliente" },
  { key: "ejecutivo", label: "Ejecutivo" },
  { key: "estado", label: "Estado" },
];

export default function AdminNegociosTable({ rows }: { rows: NegocioRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.id, r.referencia, r.area_negocio, r.razon_cliente, r.ejecutivo, r.estado]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col justify-center">
          <span className="font-display text-2xl font-bold text-[#333333]">{filtered.length}</span>
          <span className="font-sans text-xs text-[#666666]">
            negocio{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente, ejecutivo..."
            className="w-full rounded-lg border border-[#E5E5E5] bg-white py-2 pl-9 pr-3 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-left font-medium uppercase tracking-wide text-[#666666]"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="sticky top-0 z-10 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-left font-medium uppercase tracking-wide text-[#666666]">
                  Fecha de creación
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-4 py-12 text-center font-sans text-sm text-[#999999]">
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 hover:bg-[#FAFAFA]"
                  >
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-4 py-3 text-[#333333]">
                        {row[col.key] || "—"}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3 text-[#333333]">
                      {formatFecha(row.fecha_asignacion)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
