"use client";

import { useMemo, useState } from "react";
import type { VentaNegocioRow } from "@/lib/unabase/types";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  ventas: VentaNegocioRow[];
}

const INITIAL_LIMIT = 50;

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(fecha);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const ALL = "__all__";

export default function VentasDocumentsTable({ ventas }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [clienteFilter, setClienteFilter] = useState(ALL);
  const [descFilter, setDescFilter] = useState(ALL);

  const sorted = useMemo(() => {
    return [...ventas].sort((a, b) => {
      const da = String(a.fecha_emision ?? "");
      const db = String(b.fecha_emision ?? "");
      if (da !== db) return db.localeCompare(da);
      return String(b.folio ?? "").localeCompare(String(a.folio ?? ""));
    });
  }, [ventas]);

  const clientes = useMemo(() => {
    const set = new Set<string>();
    for (const v of ventas) {
      const c = (v.cliente ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [ventas]);

  const descripciones = useMemo(() => {
    const set = new Set<string>();
    for (const v of ventas) {
      const ds = Array.isArray(v.items_descripciones) ? v.items_descripciones : [];
      for (const d of ds) {
        const t = String(d).trim();
        if (t) set.add(t);
      }
    }
    return Array.from(set).sort();
  }, [ventas]);

  const filtered = useMemo(() => {
    return sorted.filter((v) => {
      if (clienteFilter !== ALL && (v.cliente ?? "").trim() !== clienteFilter) {
        return false;
      }
      if (descFilter !== ALL) {
        const ds = Array.isArray(v.items_descripciones)
          ? v.items_descripciones.map((d) => String(d).trim())
          : [];
        if (!ds.includes(descFilter)) return false;
      }
      return true;
    });
  }, [sorted, clienteFilter, descFilter]);

  if (sorted.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Documentos facturados
        </h3>
        <p className="mt-2 font-sans text-sm text-[#999999]">
          Este negocio aún no tiene documentos de venta atribuidos.
        </p>
      </article>
    );
  }

  const hiddenCount = showAll ? 0 : Math.max(0, filtered.length - INITIAL_LIMIT);
  const isFiltered = clienteFilter !== ALL || descFilter !== ALL;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Documentos facturados
        </h3>
        <span className="font-sans text-xs text-[#666666]">
          {isFiltered
            ? `${formatNumber(filtered.length)} de ${formatNumber(sorted.length)} documentos`
            : `${formatNumber(sorted.length)} documento${sorted.length === 1 ? "" : "s"}`}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-4" data-no-print="true">
        <div className="flex items-center gap-2">
          <label className="font-sans text-sm text-[#666666]">Cliente</label>
          <select
            value={clienteFilter}
            onChange={(e) => setClienteFilter(e.target.value)}
            className="max-w-[260px] rounded border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-sm text-[#333333] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          >
            <option value={ALL}>Todos</option>
            {clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-sans text-sm text-[#666666]">Ítem</label>
          <select
            value={descFilter}
            onChange={(e) => setDescFilter(e.target.value)}
            className="max-w-[260px] rounded border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-sm text-[#333333] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          >
            <option value={ALL}>Todos</option>
            {descripciones.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setClienteFilter(ALL);
              setDescFilter(ALL);
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
              <Th>Tipo</Th>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <Th>Ítems</Th>
              <ThRight>Neto</ThRight>
              <ThRight>IVA</ThRight>
              <ThRight>Total</ThRight>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center font-sans text-sm text-[#999999]">
                  Sin documentos para los filtros seleccionados.
                </td>
              </tr>
            )}
            {filtered.map((v, idx) => {
              const isOverflow = !showAll && idx >= INITIAL_LIMIT;
              const docDescripciones = Array.isArray(v.items_descripciones)
                ? v.items_descripciones
                : [];
              return (
                <tr
                  key={`${v.id_documento}-${v.folio}-${idx}`}
                  {...(isOverflow ? { "data-pdf-overflow-row": "true" } : {})}
                  className={`border-b border-[#F0F0F0] transition-colors hover:bg-[#FAFAFA] ${
                    isOverflow ? "hidden print:table-row" : ""
                  }`}
                >
                  <Td className="font-medium text-[#333333]">{v.folio || "—"}</Td>
                  <Td className="text-[#666666]">{v.tipo_documento_abrev || "—"}</Td>
                  <Td className="text-[#666666]">{formatFecha(v.fecha_emision)}</Td>
                  <Td className="text-[#333333]">
                    <span className="block max-w-[240px] truncate" title={v.cliente}>
                      {v.cliente || "Sin cliente"}
                    </span>
                  </Td>
                  <Td>
                    {docDescripciones.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {docDescripciones.map((d, i) => (
                          <span
                            key={`${d}-${i}`}
                            className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-xs text-[#666666]"
                          >
                            {d}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-[#999999]">—</span>
                    )}
                  </Td>
                  <TdRight className="tabular-nums text-[#333333]">
                    {formatCurrency(v.monto_neto_atribuible)}
                  </TdRight>
                  <TdRight className="tabular-nums text-[#666666]">
                    {formatCurrency(v.monto_iva_atribuible)}
                  </TdRight>
                  <TdRight className="tabular-nums text-[#333333]">
                    {formatCurrency(v.monto_total_atribuible)}
                  </TdRight>
                  <Td className="text-[#666666]">{v.estado || "—"}</Td>
                </tr>
              );
            })}
          </tbody>
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
