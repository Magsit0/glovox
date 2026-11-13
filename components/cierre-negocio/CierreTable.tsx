"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useRouter } from "@/lib/use-router";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import {
  calza,
  disponibles,
  enConflicto,
  filtrar,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";
import { normalizarSeleccion } from "@/lib/filters/url";
import type { NegocioRow } from "@/lib/unabase/types";

/**
 * Filtros del listado (regla única de lib/filters/facetas.ts):
 *   - Área de negocio y Cliente: multi-selección (StandardMultiFilter).
 *   - Estado del negocio, Estado NV y Estado de compras: pills de un valor, con
 *     una pill "Todos" (= selección vacía).
 * Cada control escribe solo su propia key. El encadenamiento acota las
 * opciones, nunca las selecciones: el valor activo siempre se ve, aunque los
 * otros filtros lo dejen sin datos (atenuado), y se puede cambiar o limpiar.
 */
type FacetaKey = "area" | "cliente" | "estado" | "estadonv" | "estadocierre";
type Selecciones = Record<FacetaKey, Set<string>>;

const FACETAS: Faceta<NegocioRow>[] = [
  { key: "area", valores: (r) => r.area_negocio },
  { key: "cliente", valores: (r) => r.razon_cliente },
  { key: "estado", valores: (r) => r.estado },
  { key: "estadonv", valores: (r) => r.estadonv },
  // "true" / "false" (LOWER(compras_cerradas)); String() por si llega booleano.
  {
    key: "estadocierre",
    valores: (r) => (r.estadocierre == null ? null : String(r.estadocierre)),
  },
];

const FACETA_KEYS = FACETAS.map((f) => f.key as FacetaKey);

const FACETA_LABEL: Record<FacetaKey, string> = {
  area: "Área de negocio",
  cliente: "Cliente",
  estado: "Estado del negocio",
  estadonv: "Estado NV",
  estadocierre: "Estado de compras",
};

/**
 * Estado por defecto del listado: negocios abiertos pendientes de cierre
 * (NOTA DE VENTA / EN PROCESO / compras abiertas), sin área ni cliente. Es a
 * donde vuelve "Limpiar filtros". Nadie muta estos Sets.
 */
const DEFAULT_SEL: Selecciones = {
  area: new Set(),
  cliente: new Set(),
  estado: new Set(["NOTA DE VENTA"]),
  estadonv: new Set(["EN PROCESO"]),
  estadocierre: new Set(["false"]),
};

const EMPTY: ReadonlySet<string> = new Set();

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function formatEstadoCierre(v: string): string {
  if (v === "true") return "Cerrado";
  if (v === "false") return "Abierto";
  return v;
}

/**
 * Pills de un solo valor. "Todos" escribe la selección vacía. Un valor activo
 * que no calza con los otros filtros sigue visible (borde punteado, tinte
 * --purple-tint y texto morado en vez del relleno sólido) para que se entienda
 * por qué no hay resultados.
 */
function PillFilter({
  label,
  options,
  selected,
  available,
  onChange,
  format = (v) => v,
}: {
  label: string;
  options: readonly string[];
  selected: ReadonlySet<string>;
  available: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  format?: (value: string) => string;
}) {
  const pillBase =
    "rounded-full border px-4 py-1.5 font-sans text-xs font-medium transition-colors";
  const inactive =
    "border-[var(--divider)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]";
  const active = "border-[#9F99F8] bg-[#9F99F8] text-white";
  const activeUnavailable = "border-dashed border-[#9F99F8] bg-[var(--purple-tint)] text-[#9F99F8]";
  const isAll = selected.size === 0;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center justify-end gap-3">
      <span className="font-sans text-sm text-[var(--ink-muted)]">{label}</span>
      <button
        type="button"
        aria-pressed={isAll}
        onClick={() => onChange(new Set())}
        className={`${pillBase} ${isAll ? active : inactive}`}
      >
        Todos
      </button>
      {options.map((value) => {
        const isActive = selected.has(value);
        const unavailable = !available.has(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(new Set([value]))}
            title={unavailable ? "Sin datos con los otros filtros" : undefined}
            className={`${pillBase} ${
              isActive ? (unavailable ? activeUnavailable : active) : inactive
            }`}
          >
            {format(value)}
          </button>
        );
      })}
    </div>
  );
}

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
  // Los defaults no se corrigen cuando cambian `rows` (GrupoNav cambia de grupo
  // sin volver a montar la tabla): si ya no calzan, se ven atenuados y el aviso
  // de conflicto ofrece limpiar cada filtro.
  const [sel, setSel] = useState<Selecciones>(DEFAULT_SEL);

  // Regla 2: cada filtro escribe solo su propia key.
  const setFaceta = (key: FacetaKey, next: Set<string>) =>
    setSel((prev) => ({ ...prev, [key]: next }));

  // Universo de cada faceta en `rows` (orden alfabético), sin vacíos.
  const universo = useMemo(() => {
    const out = {} as Record<FacetaKey, string[]>;
    for (const f of FACETAS) {
      const set = new Set<string>();
      for (const r of rows) {
        const v = f.valores(r);
        if (typeof v === "string" && v) set.add(v);
      }
      out[f.key as FacetaKey] = Array.from(set).sort();
    }
    return out;
  }, [rows]);

  // Valores compatibles de cada faceta con lo elegido en las otras.
  const disp = useMemo(() => disponibles(rows, FACETAS, sel), [rows, sel]);

  // Opciones visibles: compatibles + lo ya seleccionado (aunque haya quedado
  // incompatible o no exista en `rows`), para poder verlo y cambiarlo.
  const opciones = useMemo(() => {
    const out = {} as Record<FacetaKey, string[]>;
    for (const key of FACETA_KEYS) {
      out[key] = opcionesVisibles(universo[key], disp[key] ?? EMPTY, sel[key]);
    }
    return out;
  }, [universo, disp, sel]);

  const filtered = useMemo(() => filtrar(rows, FACETAS, sel), [rows, sel]);

  // Filtros que chocan entre sí cuando la combinación no deja ningún negocio.
  // Sin filas de entrada no hay conflicto que explicar: la tabla dice "Sin resultados".
  // Ninguna faceta declara `ignora`, así que enConflicto devuelve todas las
  // activas (incluidos los 3 estados por defecto). Primero se ofrecen solo las
  // que, limpiadas por sí solas, devuelven negocios; si ninguna basta, enConflicto.
  const conflictos = useMemo(() => {
    if (rows.length === 0 || filtered.length > 0) return [];
    const liberan = FACETA_KEYS.filter(
      (key) =>
        sel[key].size > 0 && rows.some((r) => calza(r, FACETAS, sel, new Set([key]))),
    );
    const keys = liberan.length > 0 ? liberan : (enConflicto(rows, FACETAS, sel) as FacetaKey[]);
    return keys.map((key) => ({ key, label: FACETA_LABEL[key] ?? key }));
  }, [rows, sel, filtered]);

  // Multi-selección: marcar el universo entero de la faceta se guarda como "Todos".
  const onMultiChange = (key: "area" | "cliente", next: Set<string>) =>
    setFaceta(key, new Set(normalizarSeleccion(next, universo[key])));

  const isDefault = FACETA_KEYS.every((key) => sameSet(sel[key], DEFAULT_SEL[key]));

  // Cliente único: el elegido, o el único del universo (grupo de GrupoNav por
  // RUT). En ese caso elegirlo se normaliza a "Todos", y el RUT igual debe verse.
  const clienteUnico =
    sel.cliente.size === 1
      ? Array.from(sel.cliente)[0]
      : universo.cliente.length === 1
        ? universo.cliente[0]
        : null;
  const rutClienteUnico =
    clienteUnico != null
      ? rows.find((r) => r.razon_cliente === clienteUnico)?.rut_cliente
      : undefined;

  function goToInforme(id: string) {
    const params = new URLSearchParams();
    params.set("id", id);
    // Guarda la URL del listado actual (incluye area + categoría/cliente/ejecutivo,
    // ya que GrupoNav la sincroniza) para que "Volver al listado" regrese acá.
    if (typeof window !== "undefined") {
      params.set("from", window.location.pathname + window.location.search);
    }
    router.push(`/cierre-negocio?${params.toString()}`);
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
          <span className="font-sans text-2xl font-bold text-[var(--ink)]">{filtered.length}</span>
          <span className="font-sans text-xs text-[var(--ink-muted)]">
            negocio{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <PillFilter
            label={FACETA_LABEL.estado}
            options={opciones.estado}
            selected={sel.estado}
            available={disp.estado ?? EMPTY}
            onChange={(next) => setFaceta("estado", next)}
          />
          <PillFilter
            label={FACETA_LABEL.estadonv}
            options={opciones.estadonv}
            selected={sel.estadonv}
            available={disp.estadonv ?? EMPTY}
            onChange={(next) => setFaceta("estadonv", next)}
          />
          <PillFilter
            label={FACETA_LABEL.estadocierre}
            options={opciones.estadocierre}
            selected={sel.estadocierre}
            available={disp.estadocierre ?? EMPTY}
            onChange={(next) => setFaceta("estadocierre", next)}
            format={formatEstadoCierre}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-4">
          <StandardMultiFilter
            label={FACETA_LABEL.area}
            selected={sel.area}
            onChange={(next) => onMultiChange("area", next)}
            options={opciones.area.map((a) => ({ value: a, label: a }))}
            available={disp.area}
            allLabel="Todas"
            searchPlaceholder="Buscar área..."
          />
          <div className="flex items-end gap-2">
            <StandardMultiFilter
              label={FACETA_LABEL.cliente}
              selected={sel.cliente}
              onChange={(next) => onMultiChange("cliente", next)}
              options={opciones.cliente.map((c) => ({ value: c, label: c }))}
              available={disp.cliente}
              allLabel="Todos"
              searchPlaceholder="Buscar cliente..."
            />
            {rutClienteUnico && (
              <span className="pb-2 font-sans text-sm text-[var(--ink-muted)]">
                Rut del cliente:{" "}
                <span className="text-[var(--ink)]">{formatRut(rutClienteUnico)}</span>
              </span>
            )}
          </div>
          {(sel.area.size > 0 || sel.cliente.size > 0) && (
            <span className="pb-2.5 font-sans text-xs text-[var(--ink-muted)]">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
          {/* Vuelve al estado por defecto (NOTA DE VENTA / EN PROCESO / Abierto,
              sin área ni cliente). Único control que toca varios filtros. */}
          {!isDefault && (
            <button
              type="button"
              onClick={() => setSel(DEFAULT_SEL)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
        <FilterConflictNotice
          conflicts={conflictos}
          onClear={(key) => setFaceta(key as FacetaKey, new Set())}
        />
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
