"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Search } from "lucide-react";
import type { NegocioRow } from "@/lib/unabase/types";
import { toggleVariableEnviadoAction } from "../actions";

export type VariableMarca = {
  enviado: boolean;
  periodo: string | null;
  marcadoAt: string;
};

function formatFecha(dateStr: string): string {
  if (!dateStr) return "—";
  // dd-mm-yyyy (legacy) e yyyy-mm-dd (CAST de DATE en BQ) se construyen en hora
  // local: new Date("yyyy-mm-dd") parsea UTC y en Chile mostraría el día anterior.
  const ddmm = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const d = ddmm
    ? new Date(Number(ddmm[3]), Number(ddmm[2]) - 1, Number(ddmm[1]))
    : iso
      ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      : new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

// "yyyy-mm" → "jun 2026" (construcción local, mismo motivo que formatFecha).
function formatPeriodo(periodo: string | null): string {
  if (!periodo) return "";
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return periodo;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleDateString("es-CL", { month: "short", year: "numeric" });
}

function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// estadocierre viene como "true"/"false" (LOWER(compras_cerradas) en la query);
// mismo mapeo que pillFor() en components/cierre-negocio/NegocioHeader.tsx.
function formatCierre(v: string): string {
  if (v === "true") return "cerrado";
  if (v === "false") return "abierto";
  return v || "—";
}

const COLUMNS: { key: keyof NegocioRow; label: string; format?: (v: string) => string }[] = [
  { key: "id", label: "ID" },
  { key: "fecha_asignacion", label: "Fecha de creación", format: formatFecha },
  { key: "referencia", label: "Nombre negocio" },
  { key: "area_negocio", label: "Área" },
  { key: "razon_cliente", label: "Cliente" },
  { key: "ejecutivo", label: "Ejecutivo" },
  { key: "estado", label: "Estado" },
  { key: "estadonv", label: "Estado NV" },
  { key: "estadocierre", label: "Compras cerradas", format: formatCierre },
  { key: "updated_at", label: "Última actualización", format: formatFecha },
];

type MarcaLocal = { enviado: boolean; periodo: string | null };

export default function AdminNegociosTable({
  rows,
  marcas,
}: {
  rows: NegocioRow[];
  marcas: Record<string, VariableMarca>;
}) {
  const [search, setSearch] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  // Mes del variable con que se guardan las próximas marcas (permite marcado
  // retroactivo: poner un mes anterior y clickear los pills de ese mes).
  const [mesVariable, setMesVariable] = useState(mesActual());
  // "" = todos los períodos; "yyyy-mm" = solo enviados de ese período.
  const [periodoFiltro, setPeriodoFiltro] = useState("");
  // Update optimista: el override local pisa la marca del server hasta que la
  // action confirme (se revierte si falla).
  const [overrides, setOverrides] = useState<Record<string, MarcaLocal>>({});
  // id del negocio cuyo período se está editando inline (lápiz del pill).
  const [editandoPeriodo, setEditandoPeriodo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const marcaDe = (id: string): MarcaLocal =>
    overrides[id] ?? marcas[id] ?? { enviado: false, periodo: null };

  const periodosDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const m = marcaDe(r.id);
      if (m.enviado && m.periodo) set.add(m.periodo);
    }
    return Array.from(set).sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, marcas, overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (q) {
      out = out.filter((r) =>
        [r.id, r.referencia, r.area_negocio, r.razon_cliente, r.ejecutivo, r.estado, r.estadonv, formatCierre(r.estadocierre)]
          .some((v) => (v ?? "").toString().toLowerCase().includes(q)),
      );
    }
    if (soloPendientes) {
      out = out.filter((r) => !marcaDe(r.id).enviado);
    } else if (periodoFiltro) {
      out = out.filter((r) => {
        const m = marcaDe(r.id);
        return m.enviado && m.periodo === periodoFiltro;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, soloPendientes, periodoFiltro, marcas, overrides]);

  const pendientes = useMemo(
    () => rows.reduce((acc, r) => acc + (marcaDe(r.id).enviado ? 0 : 1), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, marcas, overrides],
  );

  function guardar(id: string, next: MarcaLocal) {
    setError(null);
    setOverrides((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      const res = await toggleVariableEnviadoAction(
        id,
        next.enviado,
        next.periodo ?? undefined,
      );
      if (!res.ok) {
        setOverrides((prev) => {
          const rest = { ...prev };
          delete rest[id];
          return rest;
        });
        setError(res.error);
      }
    });
  }

  function toggle(id: string) {
    const actual = marcaDe(id);
    guardar(
      id,
      actual.enviado
        ? { enviado: false, periodo: null }
        : { enviado: true, periodo: mesVariable },
    );
  }

  // Cambia solo el período de un negocio ya enviado (edición inline del pill).
  function cambiarPeriodo(id: string, periodo: string) {
    setEditandoPeriodo(null);
    if (!periodo || periodo === marcaDe(id).periodo) return;
    guardar(id, { enviado: true, periodo });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col justify-center">
            <span className="font-display text-2xl font-bold text-[#333333]">{filtered.length}</span>
            <span className="font-sans text-xs text-[#666666]">
              negocio{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-display text-2xl font-bold text-[#333333]">{pendientes}</span>
            <span className="font-sans text-xs text-[#666666]">
              pendiente{pendientes !== 1 ? "s" : ""} de enviar
            </span>
          </div>
          <label className="flex items-center gap-2">
            <span className="font-sans text-xs text-[#666666]">Mes del variable</span>
            <input
              type="month"
              value={mesVariable}
              onChange={(e) => setMesVariable(e.target.value || mesActual())}
              className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSoloPendientes((v) => !v);
              setPeriodoFiltro("");
            }}
            className={
              soloPendientes
                ? "rounded-lg bg-[#F0EFFE] px-3 py-2 font-sans text-sm font-medium text-[#9F99F8] transition-colors"
                : "rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333]"
            }
          >
            Solo pendientes
          </button>
          <select
            value={periodoFiltro}
            onChange={(e) => {
              setPeriodoFiltro(e.target.value);
              if (e.target.value) setSoloPendientes(false);
            }}
            className={
              periodoFiltro
                ? "rounded-lg bg-[#F0EFFE] px-3 py-2 font-sans text-sm font-medium text-[#9F99F8] transition-colors focus:outline-none"
                : "rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
            }
          >
            <option value="">Todos los períodos</option>
            {periodosDisponibles.map((p) => (
              <option key={p} value={p}>
                Enviados en {formatPeriodo(p)}
              </option>
            ))}
          </select>
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

      {error && (
        <p className="font-sans text-xs text-[#ED75A0]">
          No se pudo guardar la marca: {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                {/* Variable e ID inmovilizados también a la izquierda (scroll
                    horizontal): ancho fijo en Variable para que el offset
                    left-[200px] del ID calce. Separador como box-shadow inset
                    (los border no acompañan a las celdas sticky con
                    border-collapse). */}
                <th className="sticky left-0 top-0 z-30 w-[200px] min-w-[200px] whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-left font-medium uppercase tracking-wide text-[#666666]">
                  Variable
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`sticky top-0 whitespace-nowrap bg-[#FAFAFA] px-4 py-3 text-left font-medium uppercase tracking-wide text-[#666666] ${
                      col.key === "id"
                        ? "left-[200px] z-30 shadow-[inset_-1px_0_0_#E5E5E5]"
                        : "z-20"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
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
                filtered.map((row) => {
                  const marca = marcaDe(row.id);
                  const original = marcas[row.id];
                  // Nota de venta = tinte verde suave (tint de #B1D750) para
                  // distinguirla al ojo de las cotizaciones, que quedan en blanco.
                  const esNV = (row.estado ?? "").toLowerCase() === "nota de venta";
                  const bgFila = esNV
                    ? "bg-[#F7FBEB] hover:bg-[#EFF6DC]"
                    : "hover:bg-[#FAFAFA]";
                  const bgSticky = esNV
                    ? "bg-[#F7FBEB] group-hover:bg-[#EFF6DC]"
                    : "bg-white group-hover:bg-[#FAFAFA]";
                  return (
                    <tr
                      key={row.id}
                      className={`group border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 ${bgFila}`}
                    >
                      <td className={`sticky left-0 z-10 w-[200px] min-w-[200px] whitespace-nowrap px-4 py-2 transition-colors duration-150 ${bgSticky}`}>
                        {editandoPeriodo === row.id ? (
                          <input
                            type="month"
                            autoFocus
                            defaultValue={marca.periodo ?? mesVariable}
                            onChange={(e) => cambiarPeriodo(row.id, e.target.value)}
                            onBlur={() => setEditandoPeriodo(null)}
                            className="rounded-lg border border-[#9F99F8] bg-white px-2 py-1 font-sans text-xs text-[#333333] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggle(row.id)}
                              title={
                                original && overrides[row.id] === undefined
                                  ? `Marcado el ${formatFecha(original.marcadoAt.slice(0, 10))}`
                                  : undefined
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333] transition-colors hover:border-[#333333]"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${marca.enviado ? "bg-[#B1D750]" : "bg-[#F6C544]"}`}
                              />
                              {marca.enviado
                                ? `Enviado${marca.periodo ? ` · ${formatPeriodo(marca.periodo)}` : ""}`
                                : "Pendiente"}
                            </button>
                            {marca.enviado && (
                              <button
                                type="button"
                                onClick={() => setEditandoPeriodo(row.id)}
                                title="Editar mes del variable"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#999999] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-4 py-3 text-[#333333] ${
                            col.key === "id"
                              ? `sticky left-[200px] z-10 shadow-[inset_-1px_0_0_#E5E5E5] transition-colors duration-150 ${bgSticky}`
                              : ""
                          }`}
                        >
                          {col.format ? col.format(row[col.key]) : row[col.key] || "—"}
                        </td>
                      ))}
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
