"use client";

import { useMemo, useState } from "react";
import type { DocVentaRow } from "@/lib/unabase/types";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  ventas: DocVentaRow[];
}

const INITIAL_LIMIT = 50;

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(fecha);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isTruthy(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const str = String(value).trim().toLowerCase();
  return str === "true" || str === "1";
}

function signed(value: number, negative: boolean): string {
  const abs = formatCurrency(Math.abs(value));
  return negative ? `-${abs}` : abs;
}

export default function VentasDocumentsTable({ ventas }: Props) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    return [...ventas].sort((a, b) => {
      const da = String(a.fechaEmision ?? "");
      const db = String(b.fechaEmision ?? "");
      if (da !== db) return db.localeCompare(da);
      return String(b.folio ?? "").localeCompare(String(a.folio ?? ""));
    });
  }, [ventas]);

  if (sorted.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Documentos facturados
        </h3>
        <p className="mt-2 font-sans text-sm text-[#999999]">
          Este negocio aún no tiene documentos de venta cargados.
        </p>
      </article>
    );
  }

  const hiddenCount = showAll ? 0 : Math.max(0, sorted.length - INITIAL_LIMIT);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-bold tracking-tight text-[#333333]">
          Documentos facturados
        </h3>
        <span className="font-sans text-xs text-[#666666]">
          {formatNumber(sorted.length)} documento{sorted.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="overflow-x-auto" data-pdf-table-wrap>
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left font-sans text-xs uppercase tracking-wide text-[#666666]">
              <Th>Folio</Th>
              <Th>Tipo</Th>
              <Th>Fecha</Th>
              <Th>Cliente</Th>
              <ThRight>Neto</ThRight>
              <ThRight>IVA</ThRight>
              <ThRight>Total</ThRight>
              <ThRight>Cobrado</ThRight>
              <ThRight>Por cobrar</ThRight>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v, idx) => {
              const isNc = isTruthy(v.is_nc);
              const isNd = isTruthy(v.is_nd);
              const rowColor = isNc ? "text-[#ED75A0]" : "text-[#333333]";
              const isOverflow = !showAll && idx >= INITIAL_LIMIT;
              return (
                <tr
                  key={`${v.id}-${v.folio}`}
                  {...(isOverflow ? { "data-pdf-overflow-row": "true" } : {})}
                  className={`border-b border-[#F0F0F0] transition-colors hover:bg-[#FAFAFA] ${
                    isOverflow ? "hidden print:table-row" : ""
                  }`}
                >
                  <Td className={`${rowColor} font-medium`}>
                    <span className="inline-flex items-center gap-2">
                      {isNd && (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: "#F6C544" }}
                          title="Nota de débito"
                        />
                      )}
                      {v.folio || "—"}
                    </span>
                  </Td>
                  <Td className="text-[#666666]">{v.tipoDocumentoVentaAbrev || "—"}</Td>
                  <Td className="text-[#666666]">{formatFecha(v.fechaEmision)}</Td>
                  <Td className={rowColor}>
                    <span className="block max-w-[260px] truncate" title={v.cliente}>
                      {v.cliente || "Sin cliente"}
                    </span>
                  </Td>
                  <TdRight className={`${rowColor} tabular-nums`}>
                    {signed(v.totalNeto_raw, isNc)}
                  </TdRight>
                  <TdRight className="tabular-nums text-[#666666]">
                    {formatCurrency(v.iva_raw)}
                  </TdRight>
                  <TdRight className={`${rowColor} tabular-nums`}>
                    {signed(v.totalFactura_raw, isNc)}
                  </TdRight>
                  <TdRight className="tabular-nums text-[#666666]">
                    {formatCurrency(v.cobrado_raw)}
                  </TdRight>
                  <TdRight className="tabular-nums text-[#666666]">
                    {formatCurrency(v.porCobrar_raw)}
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
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function ThRight({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right font-medium">{children}</th>;
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
