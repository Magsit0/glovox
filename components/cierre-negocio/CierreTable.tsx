"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { NegocioRow } from "@/lib/unabase/types";

function parseDateStr(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr);
  if (match) {
    const d = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysSince(dateStr: string): number | null {
  const d = parseDateStr(dateStr);
  if (!d) return null;
  return Math.abs(Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function daysSinceUpdated(dateStr: string): number | null {
  return daysSince(dateStr);
}

function formatRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, "");
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

const COLUMNS: { key: keyof NegocioRow; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "fecha_asignacion", label: "F. Asignación" },
  { key: "fecha_realizacion", label: "F. Realización" },
  { key: "referencia", label: "Nombre Negocio" },
  { key: "ejecutivo", label: "Ejecutivo" },
  { key: "area_negocio", label: "Área" },
  { key: "fecha_cierre_negocio", label: "F. Cierre" },
  { key: "total_neto", label: "Total Neto" },
  { key: "total_venta", label: "Total Venta" },
  { key: "total_facturado", label: "Total Facturado" },
  { key: "total_cobrado", label: "Total Cobrado" },
  { key: "updated_at", label: "Actualizado" },
];

export default function CierreTable({ rows }: { rows: NegocioRow[] }) {
  const router = useRouter();
  const [area, setArea] = useState("__all__");
  const [cliente, setCliente] = useState("__all__");
  const [estado, setEstado] = useState("NOTA DE VENTA");
  const [estadonv, setEstadonv] = useState("EN PROCESO");
  const [estadocierre, setEstaodocierre] = useState("false");

  const applyExcept = (exclude: "area" | "cliente" | "estado" | "estadonv" | "estadocierre") =>
    rows
      .filter((r) => exclude === "area"       || area       === "__all__" || r.area_negocio === area)
      .filter((r) => exclude === "cliente"    || cliente    === "__all__" || r.razon_cliente === cliente)
      .filter((r) => exclude === "estado"     || estado     === "__all__" || r.estado === estado)
      .filter((r) => exclude === "estadonv"   || estadonv   === "__all__" || r.estadonv === estadonv)
      .filter((r) => exclude === "estadocierre" || estadocierre === "__all__" || String(r.estadocierre) === estadocierre);

  const areas = useMemo(() => {
    const set = new Set(applyExcept("area").map((r) => r.area_negocio).filter(Boolean));
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cliente, estado, estadonv, estadocierre]);

  const clientes = useMemo(() => {
    const set = new Set(applyExcept("cliente").map((r) => r.razon_cliente).filter(Boolean));
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, area, estado, estadonv, estadocierre]);

  const estados = useMemo(() => {
    const set = new Set(applyExcept("estado").map((r) => r.estado).filter(Boolean));
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, area, cliente, estadonv, estadocierre]);

  const estadosnv = useMemo(() => {
    const set = new Set(applyExcept("estadonv").map((r) => r.estadonv).filter(Boolean));
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, area, cliente, estado, estadocierre]);

  const estadoscierre = useMemo(() => {
    const set = new Set(
      applyExcept("estadocierre")
        .map((r) => r.estadocierre)
        .filter((v) => v != null)
        .map((v) => String(v)),
    );
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, area, cliente, estado, estadonv]);

  const filtered = rows
    .filter((r) => area === "__all__" || r.area_negocio === area)
    .filter((r) => cliente === "__all__" || r.razon_cliente === cliente)
    .filter((r) => estado === "__all__" || r.estado === estado)
    .filter((r) => estadonv === "__all__" || r.estadonv === estadonv)
    .filter((r) => estadocierre === "__all__" || String(r.estadocierre) === estadocierre);

  function goToInforme(id: string) {
    router.push(`/cierre-negocio?id=${encodeURIComponent(id)}`);
  }

  function rowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToInforme(id);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col justify-center">
          <span className="font-sans text-2xl font-bold text-[#333333]">{filtered.length}</span>
          <span className="font-sans text-xs text-[#666666]">negocio{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-3">
        <span className="font-sans text-sm text-[#666666]">Estado del negocio</span>
        {estados.map((e) => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
              estado === e
                ? "bg-[#9F99F8] text-white"
                : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="font-sans text-sm text-[#666666]">Estado NV</span>
        {estadosnv.map((e) => (
          <button
            key={e}
            onClick={() => setEstadonv(e)}
            className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
              estadonv === e
                ? "bg-[#9F99F8] text-white"
                : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3">
        <span className="font-sans text-sm text-[#666666]">Estado de compras</span>
        {estadoscierre.map((e) => (
          <button
            key={e}
            onClick={() => setEstaodocierre(e)}
            className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
              estadocierre === e
                ? "bg-[#9F99F8] text-white"
                : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
            }`}
          >
            {e === "true" ? "Cerrado" : "Abierto"}
          </button>
        ))}
      </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="font-sans text-sm text-[#666666]">Área de negocio</label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="rounded border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-sm text-[#333333] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          >
            <option value="__all__">Todas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-sans text-sm text-[#666666]">Cliente</label>
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="rounded border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-sm text-[#333333] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          >
            <option value="__all__">Todos</option>
            {clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {cliente !== "__all__" && (() => {
            const rut = rows.find((r) => r.razon_cliente === cliente)?.rut_cliente;
            return rut ? (
              <span className="font-sans text-sm text-[#666666]">
                Rut del cliente: <span className="text-[#333333]">{formatRut(rut)}</span>
              </span>
            ) : null;
          })()}
        </div>
        {(area !== "__all__" || cliente !== "__all__") && (
          <span className="font-sans text-xs text-[#666666]">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-8 text-center text-[#666666]"
                  >
                    Sin resultados.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver informe de cierre del negocio ${row.id}${row.referencia ? ` - ${row.referencia}` : ""}`}
                    onClick={() => goToInforme(row.id)}
                    onKeyDown={(e) => rowKeyDown(e, row.id)}
                    className="cursor-pointer border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA] focus:bg-[#FAFAFA] focus:outline-none"
                  >
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className="whitespace-nowrap px-4 py-3 text-[#333333]"
                      >
                        {row[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 rounded-lg border border-[#E5E5E5] bg-white">
          <table className="font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                  Días desde creación
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[#666666]">
                  Días sin modificación
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[#666666]">—</td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const days = daysSince(row.fecha_asignacion);
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver informe de cierre del negocio ${row.id}`}
                      onClick={() => goToInforme(row.id)}
                      onKeyDown={(e) => rowKeyDown(e, row.id)}
                      className="cursor-pointer border-b border-[#E5E5E5] last:border-0 transition-colors hover:bg-[#FAFAFA] focus:bg-[#FAFAFA] focus:outline-none"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                        {days != null ? days : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[#333333]">
                        {(() => { const d = daysSinceUpdated(row.updated_at); return d != null ? d : "—"; })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
