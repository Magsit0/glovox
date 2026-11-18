"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "@/lib/use-router";
import type { PlanDiarioRow } from "@/lib/queries/inversion-medios";
import {
  compararPlanes,
  limpiarNombreOpcion,
  MAX_OPCIONES,
  NOMBRE_OPCION_MAX,
  planSiSeElige,
  type FilaComparacion,
  type OpcionPlan,
} from "@/lib/inversion-medios/escenarios";
import { fmtDiaMes } from "@/lib/inversion-medios/holgura";
import { SIN_TIPO, SIN_TIPO_LABEL } from "@/lib/inversion-medios/tipos";
import {
  borrarOpcionPlanAction,
  crearOpcionPlanAction,
  elegirOpcionPlanAction,
  renombrarOpcionPlanAction,
} from "../actions";
import { fmtUsd } from "./format";

const tipoLabel = (t: string) => (t === SIN_TIPO ? SIN_TIPO_LABEL : t);

/**
 * Opciones de plan de un evento (escenarios): el selector «Vigente / Opción B /
 * …», crear, renombrar y borrar opciones, elegir una como vigente (solo quien
 * define el techo y la meta) y la tabla que las compara. Una opción es un
 * borrador para mostrar a la jefatura: nunca suma en el calendario ni en los
 * totales. Ver lib/inversion-medios/escenarios.ts.
 */
export default function OpcionesPlan({
  eventoId,
  opciones,
  activaId,
  planVigente,
  techoUsd,
  hoy,
  canEdit,
  elegirVigente,
}: {
  eventoId: string;
  opciones: OpcionPlan[];
  /** Opción a la vista (`?plan=`); null = el vigente. */
  activaId: string | null;
  /** Plan vigente COMPLETO del evento (no solo la ventana del drill). */
  planVigente: PlanDiarioRow[];
  techoUsd: number | null;
  hoy: string;
  canEdit: boolean;
  /** Puede elegir una opción como vigente (editor de metas o superadmin). */
  elegirVigente: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState("");
  const activa = opciones.find((o) => o.id === activaId) ?? null;
  const base = `/inversion-medios?evento=${eventoId}`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) start(() => setError(res.error ?? "Error inesperado"));
      else after?.();
    });
  };

  const crear = () =>
    run(async () => {
      const res = await crearOpcionPlanAction({ eventoId });
      if (res.ok && res.data) router.push(`${base}&plan=${res.data.id}`);
      return res;
    });

  const guardarNombre = () => {
    if (!activa) return;
    const limpio = limpiarNombreOpcion(nombre);
    if (!limpio) return setError(`Entre 1 y ${NOMBRE_OPCION_MAX} caracteres`);
    if (limpio === activa.nombre) return setRenombrando(false);
    run(() => renombrarOpcionPlanAction({ id: activa.id, nombre: limpio }), () => setRenombrando(false));
  };

  const borrar = () => {
    if (!activa) return;
    const total = activa.rows.reduce((a, r) => a + r.montoUsd, 0);
    if (!window.confirm(`¿Borrar «${activa.nombre}» (${fmtUsd(total, 0)} de plan)? El plan vigente no cambia.`)) return;
    run(async () => {
      const res = await borrarOpcionPlanAction({ id: activa.id });
      if (res.ok) router.push(base);
      return res;
    });
  };

  const elegir = () => {
    if (!activa) return;
    const desdeHoy = (rows: PlanDiarioRow[]) => rows.filter((r) => r.fecha >= hoy).reduce((a, r) => a + r.montoUsd, 0);
    const ok = window.confirm(
      `¿Elegir «${activa.nombre}» como plan vigente?\n\n` +
        `Desde hoy (${fmtDiaMes(hoy)}) el plan pasa de ${fmtUsd(desdeHoy(planVigente), 0)} a ${fmtUsd(desdeHoy(activa.rows), 0)}. ` +
        "Los días anteriores no cambian.\n\n" +
        `El plan vigente de hoy queda guardado como otra opción («Vigente hasta ${fmtDiaMes(hoy)}»), por si hay que volver.`,
    );
    if (!ok) return;
    run(async () => {
      const res = await elegirOpcionPlanAction({ id: activa.id });
      if (res.ok) router.push(base);
      return res;
    });
  };

  const tab = (activo: boolean) =>
    `px-3 py-1.5 transition-colors ${
      activo
        ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
        : "text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
    }`;

  return (
    <section className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs font-medium text-[var(--ink-muted)]">Plan</span>
        <nav
          aria-label="Opciones de plan"
          className="flex flex-wrap overflow-hidden rounded-lg border border-[var(--divider)] font-sans text-sm"
        >
          <Link href={base} aria-current={activa ? undefined : "page"} className={tab(!activa)}>
            Vigente
          </Link>
          {opciones.map((o) => (
            <Link
              key={o.id}
              href={`${base}&plan=${o.id}`}
              aria-current={o.id === activa?.id ? "page" : undefined}
              className={`border-l border-[var(--divider)] ${tab(o.id === activa?.id)}`}
            >
              {o.nombre}
            </Link>
          ))}
        </nav>
        {canEdit && opciones.length < MAX_OPCIONES && (
          <button
            type="button"
            onClick={crear}
            disabled={pending}
            className="inline-flex items-center gap-1 font-sans text-xs font-medium text-[var(--plan)] transition-colors hover:text-[var(--plan-hover)] disabled:opacity-60"
            title="Crea una opción copiando el plan vigente completo; después cambias lo que quieras sin tocar el vigente"
          >
            <Plus className="h-3 w-3" /> Nueva opción
          </button>
        )}
      </div>

      {activa ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          {renombrando ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                guardarNombre();
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setRenombrando(false);
                }}
                maxLength={NOMBRE_OPCION_MAX}
                aria-label={`Nuevo nombre de ${activa.nombre}`}
                className="rounded-md border border-[var(--divider)] bg-[var(--surface)] px-2 py-1 font-sans text-sm text-[var(--ink)] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
              <button type="submit" disabled={pending} className={iconBtn} aria-label="Guardar nombre">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setRenombrando(false)} className={iconBtn} aria-label="Cancelar">
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2.5 py-1 font-sans text-xs font-medium text-[var(--ink)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
              Estás editando «{activa.nombre}»: es una opción, no suma en el calendario ni en los totales
            </span>
          )}
          {canEdit && !renombrando && (
            <>
              <button
                type="button"
                onClick={() => {
                  setNombre(activa.nombre);
                  setError(null);
                  setRenombrando(true);
                }}
                className="inline-flex items-center gap-1 font-sans text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
              >
                <Pencil className="h-3 w-3" /> Renombrar
              </button>
              <button
                type="button"
                onClick={borrar}
                disabled={pending}
                className="inline-flex items-center gap-1 font-sans text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" /> Borrar opción
              </button>
            </>
          )}
          {elegirVigente && (
            <button
              type="button"
              onClick={elegir}
              disabled={pending}
              className="ml-auto rounded-lg bg-[#9F99F8] px-3 py-1.5 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-60"
            >
              Elegir como plan vigente
            </button>
          )}
        </div>
      ) : (
        opciones.length === 0 && (
          <p className="mt-2 font-sans text-xs text-[var(--ink-subtle)]">
            ¿Necesitas mostrar otra alternativa? Crea una opción: parte como copia del plan vigente y se compara acá
            abajo, sin tocar el vigente.
          </p>
        )
      )}

      {error && (
        <p role="alert" className="mt-2 font-sans text-xs text-[#ED75A0]">
          {error}
        </p>
      )}

      {opciones.length > 0 && (
        <Comparacion planVigente={planVigente} opciones={opciones} activaId={activa?.id ?? null} techoUsd={techoUsd} hoy={hoy} />
      )}
    </section>
  );
}

const iconBtn =
  "inline-flex h-6 w-6 items-center justify-center rounded text-[var(--ink-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)] disabled:opacity-40";

/** Tabla que compara el vigente con cada opción (total, desde hoy, canal → tipo, mes). */
function Comparacion({
  planVigente,
  opciones,
  activaId,
  techoUsd,
  hoy,
}: {
  planVigente: PlanDiarioRow[];
  opciones: OpcionPlan[];
  activaId: string | null;
  techoUsd: number | null;
  hoy: string;
}) {
  // Cada opción, como quedaría el vigente si se elige (pasado del vigente +
  // opción desde hoy): el total y el % del techo son los que regirían.
  const comp = useMemo(
    () =>
      compararPlanes(
        [planVigente, ...opciones.map((o) => planSiSeElige(planVigente, o.rows, hoy))],
        hoy,
        tipoLabel,
      ),
    [planVigente, opciones, hoy],
  );
  const columnas = ["Vigente", ...opciones.map((o) => o.nombre)];
  const resaltada = (i: number) => (i === 0 ? activaId === null : opciones[i - 1]?.id === activaId);
  const th = "px-3 py-2 text-right text-xs font-medium text-[var(--ink-muted)]";
  const td = "px-3 py-1.5 text-right tabular-nums";

  // Monto + diferencia contra el vigente (las opciones; el vigente va solo).
  const celdas = (valores: number[], fuerte = false) =>
    valores.map((v, i) => (
      <td
        key={i}
        className={`${td} ${resaltada(i) ? "bg-[var(--purple-tint)]/40" : ""} ${fuerte ? "font-medium text-[var(--ink)]" : "text-[var(--ink)]"}`}
      >
        {fmtUsd(v, 0)}
        {i > 0 && Math.abs(v - valores[0]) >= 0.5 && (
          <span className="ml-1.5 text-[11px] text-[var(--ink-subtle)]">
            {v > valores[0] ? "+" : "−"}
            {fmtUsd(Math.abs(v - valores[0]), 0)}
          </span>
        )}
      </td>
    ));

  const filas = (titulo: string, rows: FilaComparacion[]) =>
    rows.length > 0 && (
      <>
        <tr>
          <td
            colSpan={columnas.length + 1}
            className="bg-[var(--surface-alt)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-subtle)]"
          >
            {titulo}
          </td>
        </tr>
        {rows.map((r) => (
          <tr key={r.clave} className="border-t border-[var(--grid)]">
            <td className={`px-3 py-1.5 text-left ${r.nivel === 1 ? "pl-7 text-[var(--ink-muted)]" : "text-[var(--ink)]"}`}>
              {r.label}
            </td>
            {celdas(r.valores, r.nivel === 0)}
          </tr>
        ))}
      </>
    );

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--divider)]">
      <table className="w-full font-sans text-sm">
        <thead className="bg-[var(--surface-alt)]">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--ink-muted)]">Comparación de planes</th>
            {columnas.map((c, i) => (
              <th key={i} className={`${th} ${resaltada(i) ? "text-[#9F99F8]" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-[var(--divider)]">
            <td className="px-3 py-2 text-left font-medium text-[var(--ink)]">Plan total</td>
            {celdas(comp.total, true)}
          </tr>
          {techoUsd != null && techoUsd > 0 && (
            <tr className="border-t border-[var(--grid)]">
              <td className="px-3 py-1.5 text-left text-[var(--ink-muted)]">% del techo ({fmtUsd(techoUsd, 0)})</td>
              {comp.total.map((v, i) => (
                <td key={i} className={`${td} ${resaltada(i) ? "bg-[var(--purple-tint)]/40" : ""} ${v > techoUsd ? "text-[#ED75A0]" : "text-[var(--ink-muted)]"}`}>
                  {((v / techoUsd) * 100).toFixed(0)}%
                </td>
              ))}
            </tr>
          )}
          <tr className="border-t border-[var(--grid)]">
            <td
              className="px-3 py-1.5 text-left text-[var(--ink-muted)]"
              title="Lo que cambiaría al elegir la opción: los días anteriores a hoy no se tocan"
            >
              Desde hoy ({fmtDiaMes(hoy)})
            </td>
            {celdas(comp.desdeHoy)}
          </tr>
          {filas("Por canal y tipo", comp.porCanal)}
          {filas("Por mes", comp.porMes)}
        </tbody>
      </table>
    </div>
  );
}
