"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { FfbbListadoRow } from "@/lib/ffbb/types";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  rows: FfbbListadoRow[];
}

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

export default function FfbbListadoTable({ rows }: Props) {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string>("__all__");

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.categoriaEvento) set.add(r.categoriaEvento);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(
    () =>
      categoria === "__all__"
        ? rows
        : rows.filter((r) => r.categoriaEvento === categoria),
    [rows, categoria],
  );

  function goToDetail(id: string) {
    router.push(`/ffbb?id=${encodeURIComponent(id)}`);
  }

  function rowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDetail(id);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-sans text-2xl font-bold text-[#333333]">
            {filtered.length}
          </span>
          <span className="font-sans text-xs text-[#666666]">
            evento{filtered.length !== 1 ? "s" : ""} con ventas
          </span>
        </div>

        {categorias.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sans text-sm text-[#666666]">Categoría</span>
            <button
              type="button"
              onClick={() => setCategoria("__all__")}
              className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
                categoria === "__all__"
                  ? "bg-[#9F99F8] text-white"
                  : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
              }`}
            >
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoria(c)}
                className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
                  categoria === c
                    ? "bg-[#9F99F8] text-white"
                    : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                Evento
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                Nombre
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                Fecha
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                Categoría
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                Ventas
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                Unidades
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                Productos
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#666666]">
                Barras
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[#666666]">
                  Sin eventos con ventas FF&BB.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.eventoId}
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir detalle del evento ${row.eventoId}${row.nombre ? ` — ${row.nombre}` : ""}`}
                  onClick={() => goToDetail(row.eventoId)}
                  onKeyDown={(e) => rowKeyDown(e, row.eventoId)}
                  className="cursor-pointer border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA] focus:bg-[#FAFAFA] focus:outline-none"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-[#333333]">
                    {row.eventoId}
                  </td>
                  <td className="px-4 py-3 text-[#333333]">{row.nombre}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#666666]">
                    {formatFecha(row.fechaEvento)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#666666]">
                    {row.categoriaEvento || "—"}
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]"
                    title={formatCurrency(row.ventas)}
                  >
                    {compactCurrency(row.ventas)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                    {formatNumber(row.unidades)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                    {formatNumber(row.productosUnicos)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                    {formatNumber(row.barras)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
