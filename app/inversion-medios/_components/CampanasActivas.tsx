"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CampanaReciente } from "@/lib/queries/inversion-medios";
import { addDiasIso } from "@/lib/inversion-medios/evento";
import { esRemarketing, tipoDeObjetivo } from "@/lib/inversion-medios/tipos";
import { fmtDiaCorto, fmtUsd } from "./format";

/**
 * "Campañas activas" del calendario: qué campañas están corriendo AHORA, según
 * el gasto declarado. El mart no trae el estado (activa/pausada) ni el
 * presupuesto diario de la campaña, así que "activa" = tuvo gasto en alguno de
 * los dos últimos días del mart. Las que gastaron en los últimos 7 días pero no
 * en esos dos quedan como "detenidas" (se apagaron, o se quedaron sin entrega).
 *
 * El ancla es la última fecha del mart (`realMaxFecha`), no "hoy": si el
 * pipeline de ads no corrió, la lista sigue mostrando lo último conocido y las
 * cabeceras dicen de qué día es cada número.
 */

const VENTANA = 14; // días de la mini serie (la query trae exactamente esta ventana)
const SEMANA = 7; // universo de la lista: campañas con gasto en estos días

// Mismo código de color por plataforma que el resto de la ruta (PLAT_DOT del
// calendario, PLAT_COLOR del drill).
const PLAT: Record<string, { label: string; color: string }> = {
  meta: { label: "Meta", color: "#9F99F8" },
  google: { label: "Google", color: "#B1D750" },
  tiktok: { label: "TikTok", color: "#87DACD" },
};
const PLAT_OTRA = { label: "Otra", color: "#B4B2A9" };
const ORDEN_PLAT = ["meta", "google", "tiktok"];

type Fila = {
  c: CampanaReciente;
  /** Gasto por día, alineado a `ventana` (VENTANA valores). */
  serie: number[];
  /** Penúltimo y último día del mart. */
  prev: number;
  ult: number;
  semana: number;
  ultimoGasto: string;
  activa: boolean;
};

type Grupo = {
  key: string;
  eventoId: string | null;
  nombre: string;
  fecha: string;
  filas: Fila[];
  prev: number;
  ult: number;
  semana: number;
};

function agrupar(filas: Fila[]): Grupo[] {
  const porEvento = new Map<string, Grupo>();
  for (const f of filas) {
    const key = f.c.eventoId ?? "";
    let g = porEvento.get(key);
    if (!g) {
      g = {
        key,
        eventoId: f.c.eventoId,
        nombre: f.c.eventoNombre,
        fecha: f.c.eventoFecha,
        filas: [],
        prev: 0,
        ult: 0,
        semana: 0,
      };
      porEvento.set(key, g);
    }
    g.filas.push(f);
    g.prev += f.prev;
    g.ult += f.ult;
    g.semana += f.semana;
  }
  const grupos = [...porEvento.values()];
  for (const g of grupos) g.filas.sort((a, b) => b.semana - a.semana);
  // Mismo orden que las filas del calendario (fecha del evento); el gasto sin
  // evento va al final, como la fila "No atribuido".
  return grupos.sort((a, b) => {
    if (!a.eventoId !== !b.eventoId) return a.eventoId ? -1 : 1;
    return (
      (a.fecha || "9999").localeCompare(b.fecha || "9999") ||
      (a.eventoId ?? "").localeCompare(b.eventoId ?? "")
    );
  });
}

/** Días entre dos fechas ISO, contando ambos extremos. */
function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** '2025-10-16' → '16 oct 2025' si el año difiere del de referencia. */
function fmtFecha(iso: string, refIso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 4) === refIso.slice(0, 4)
    ? fmtDiaCorto(iso)
    : `${fmtDiaCorto(iso)} ${iso.slice(0, 4)}`;
}

export default function CampanasActivas({
  campanas,
  realMaxFecha,
  hoy,
  pais,
}: {
  campanas: CampanaReciente[];
  /** Última fecha del mart: el ancla de la ventana. */
  realMaxFecha: string;
  hoy: string;
  /** Filtro de país del calendario ("" = todos). Lo no atribuido no tiene país. */
  pais: string;
}) {
  const [open, setOpen] = useState(false);
  const [modo, setModo] = useState<"activas" | "detenidas">("activas");

  const ref = realMaxFecha;
  const prevDia = addDiasIso(ref, -1);
  // El mart de HOY es parcial (los ads llegan ~09:45).
  const parcial = ref >= hoy;

  const ventana = useMemo(
    () => Array.from({ length: VENTANA }, (_, i) => addDiasIso(ref, i - (VENTANA - 1))),
    [ref],
  );

  const filas = useMemo<Fila[]>(() => {
    const col = new Map(ventana.map((f, i) => [f, i]));
    return campanas
      .filter((c) => !pais || c.pais === pais)
      .map((c) => {
        const serie = new Array<number>(VENTANA).fill(0);
        let ultimoGasto = "";
        for (const d of c.dias) {
          const i = col.get(d.fecha);
          if (i === undefined || !(d.usd > 0)) continue;
          serie[i] += d.usd;
          if (d.fecha > ultimoGasto) ultimoGasto = d.fecha;
        }
        const prev = serie[VENTANA - 2];
        const ult = serie[VENTANA - 1];
        const semana = serie.slice(VENTANA - SEMANA).reduce((a, b) => a + b, 0);
        return { c, serie, prev, ult, semana, ultimoGasto, activa: prev > 0 || ult > 0 };
      })
      .filter((f) => f.semana > 0);
  }, [campanas, pais, ventana]);

  const activas = useMemo(() => filas.filter((f) => f.activa), [filas]);
  const detenidas = useMemo(() => filas.filter((f) => !f.activa), [filas]);
  const grupos = useMemo(
    () => agrupar(modo === "activas" ? activas : detenidas),
    [modo, activas, detenidas],
  );

  const porPlataforma = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const f of activas) cuenta.set(f.c.plataforma, (cuenta.get(f.c.plataforma) ?? 0) + 1);
    return [...cuenta.entries()]
      .sort(
        (a, b) =>
          (ORDEN_PLAT.indexOf(a[0]) + 1 || 99) - (ORDEN_PLAT.indexOf(b[0]) + 1 || 99),
      )
      .map(([plat, n]) => ({ ...(PLAT[plat] ?? PLAT_OTRA), n }));
  }, [activas]);

  if (!ref) return null;

  const diasLabel = `el ${fmtDiaCorto(prevDia)} o el ${fmtDiaCorto(ref)}${parcial ? " (parcial)" : ""}`;
  const lista = modo === "activas" ? activas : detenidas;
  const th = "sticky top-0 z-10 bg-[var(--surface-alt)] px-4 py-3 font-sans text-xs font-medium text-[var(--ink-muted)] shadow-[inset_0_-1px_0_var(--divider)]";

  return (
    <section className="isolate overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-[var(--surface-alt)]"
      >
        <span className="flex items-start gap-2">
          {open ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          )}
          <span>
            <span className="block font-display text-lg font-bold text-[var(--ink)]">
              Campañas activas
            </span>
            <span className="block font-sans text-xs text-[var(--ink-muted)]">
              {activas.length === 0
                ? `Ninguna campaña con gasto ${diasLabel}`
                : `${activas.length} ${activas.length === 1 ? "campaña" : "campañas"} con gasto ${diasLabel}`}
              {detenidas.length > 0 &&
                ` · ${detenidas.length} sin gasto desde hace 2 días o más`}
              {pais ? " · sin las no atribuidas (no tienen país)" : ""}
            </span>
          </span>
        </span>
        {porPlataforma.length > 0 && (
          <span className="flex flex-wrap items-center gap-2">
            {porPlataforma.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2.5 py-1 font-sans text-xs font-medium tabular-nums text-[var(--ink)]"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label} {p.n}
              </span>
            ))}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--divider)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
            <div
              className="flex overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] font-sans text-sm"
              role="group"
              aria-label="Campañas activas o detenidas"
            >
              {(
                [
                  ["activas", "Activas", activas.length],
                  ["detenidas", "Detenidas", detenidas.length],
                ] as const
              ).map(([k, label, n]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setModo(k)}
                  aria-pressed={modo === k}
                  className={`px-3 py-2 tabular-nums transition-colors ${
                    modo === k
                      ? "bg-[var(--purple-tint)] font-medium text-[#9F99F8]"
                      : "text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
                  }`}
                >
                  {label} · {n}
                </button>
              ))}
            </div>
            <p className="max-w-3xl font-sans text-xs text-[var(--ink-subtle)]">
              {modo === "activas"
                ? `Campañas con gasto ${diasLabel}.`
                : `Gastaron en los últimos 7 días, pero no ${diasLabel}.`}{" "}
              Se deduce del gasto declarado: el dato no trae el estado de la campaña, así
              que una activa que no gastó no aparece y una pausada hoy sigue apareciendo
              por el gasto de ayer.
            </p>
          </div>

          {lista.length === 0 ? (
            <p className="border-t border-[var(--divider)] py-12 text-center font-sans text-sm text-[var(--ink-subtle)]">
              {modo === "activas"
                ? `Sin campañas con gasto ${diasLabel}.`
                : "Ninguna campaña dejó de gastar en los últimos 7 días."}
            </p>
          ) : (
            <div className="max-h-[480px] overflow-auto border-t border-[var(--divider)]">
              <table className="w-full font-sans text-sm">
                <thead>
                  <tr>
                    <th className={`${th} text-left`}>Campaña</th>
                    <th className={`${th} text-left`}>Tipo</th>
                    <th className={`${th} text-left`}>Últimos 14 días</th>
                    {modo === "activas" ? (
                      <>
                        <th className={`${th} text-right`}>{fmtDiaCorto(prevDia)}</th>
                        <th className={`${th} text-right`}>
                          {fmtDiaCorto(ref)}
                          {parcial && (
                            <span className="block font-normal text-[var(--ink-subtle)]">parcial</span>
                          )}
                        </th>
                      </>
                    ) : (
                      <th className={`${th} text-left`}>Último gasto</th>
                    )}
                    <th className={`${th} text-right`}>7 días</th>
                    <th
                      className={`${th} text-left`}
                      title="Primer día con gasto de la racha actual: 7 días seguidos sin gasto la cortan"
                    >
                      Gastando desde
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <Fragment key={g.key || "__na"}>
                      <tr className="border-b border-[var(--divider)] bg-[var(--surface-sunken)]">
                        <td colSpan={3} className="px-4 py-2">
                          {g.eventoId ? (
                            <Link
                              href={`/inversion-medios?evento=${g.eventoId}`}
                              className="font-medium text-[var(--ink)] transition-colors hover:text-[#9F99F8]"
                            >
                              {g.nombre || g.eventoId}
                            </Link>
                          ) : (
                            <span className="font-medium text-[var(--ink-muted)]">No atribuido</span>
                          )}
                          <span className="ml-2 text-xs text-[var(--ink-subtle)]">
                            {g.eventoId
                              ? `${g.eventoId}${g.fecha ? ` · evento ${fmtFecha(g.fecha, ref)}` : ""}`
                              : "sin evento reconocible en el nombre"}
                            {` · ${g.filas.length} ${g.filas.length === 1 ? "campaña" : "campañas"}`}
                          </span>
                        </td>
                        {modo === "activas" ? (
                          <>
                            <MontoCell value={g.prev} strong />
                            <MontoCell value={g.ult} strong />
                          </>
                        ) : (
                          <td />
                        )}
                        <MontoCell value={g.semana} strong />
                        <td />
                      </tr>
                      {g.filas.map((f) => {
                        const plat = PLAT[f.c.plataforma] ?? PLAT_OTRA;
                        return (
                          <tr
                            key={`${f.c.plataforma}|${f.c.campaignId}`}
                            className="border-b border-[var(--divider)] transition-colors duration-150 hover:bg-[var(--surface-alt)]"
                          >
                            <td className="py-2.5 pl-8 pr-4 text-[var(--ink)]">
                              <span className="inline-flex flex-wrap items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: plat.color }}
                                  title={plat.label}
                                />
                                {esRemarketing(f.c.campaignName) && <RmktBadge />}
                                {f.c.campaignName}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-muted)]">
                              {tipoDeObjetivo(f.c.plataforma, f.c.objective)}
                            </td>
                            <td className="px-4 py-2.5">
                              <MiniSerie
                                valores={f.serie}
                                fechas={ventana}
                                color={plat.color}
                                parcial={parcial}
                              />
                            </td>
                            {modo === "activas" ? (
                              <>
                                <MontoCell value={f.prev} />
                                <MontoCell value={f.ult} />
                              </>
                            ) : (
                              <td className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-muted)]">
                                {fmtFecha(f.ultimoGasto, ref)}
                              </td>
                            )}
                            <MontoCell value={f.semana} strong />
                            <td
                              className="whitespace-nowrap px-4 py-2.5 text-[var(--ink-muted)]"
                              title={
                                f.c.desde
                                  ? `${diasEntre(f.c.desde, ref)} días desde el inicio de la racha`
                                  : undefined
                              }
                            >
                              {fmtFecha(f.c.desde, ref)}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MontoCell({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <td
      className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${
        strong ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"
      }`}
    >
      {value > 0 ? fmtUsd(value) : <span className="text-[var(--divider)]">·</span>}
    </td>
  );
}

/** Mismo badge que el drill: sub-etiqueta, no saca a la campaña de su tipo. */
function RmktBadge() {
  return (
    <span
      className="rounded-full bg-[var(--purple-tint)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--plan)]"
      title="Campaña de remarketing (suma dentro de su tipo)"
    >
      RMKT
    </span>
  );
}

/** Barras del gasto diario de los últimos 14 días, escaladas a su propio máximo. */
function MiniSerie({
  valores,
  fechas,
  color,
  parcial,
}: {
  valores: number[];
  fechas: string[];
  color: string;
  /** El último día es parcial (los ads de hoy llegan ~09:45). */
  parcial: boolean;
}) {
  const max = Math.max(...valores);
  const ultimo = valores.length - 1;
  return (
    <div className="flex h-6 w-[110px] items-end gap-px" aria-hidden>
      {valores.map((v, i) => (
        <span
          key={fechas[i]}
          title={`${fmtDiaCorto(fechas[i])}: ${v > 0 ? fmtUsd(v) : "sin gasto"}${parcial && i === ultimo ? " · parcial" : ""}`}
          className="flex-1 rounded-t-sm"
          style={{
            height: v > 0 && max > 0 ? `${Math.max(12, (v / max) * 100)}%` : "2px",
            backgroundColor: v > 0 ? color : "var(--divider)",
          }}
        />
      ))}
    </div>
  );
}
