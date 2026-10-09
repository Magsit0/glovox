"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDiasIso } from "@/lib/inversion-medios/evento";
import { fmtDiaMes, type CanalDesvio, type Holgura } from "@/lib/inversion-medios/holgura";
import { fmtUsd } from "./format";

const PLAT_COLOR: Record<string, string> = {
  Meta: "#9F99F8",
  Google: "#B1D750",
  TikTok: "#87DACD",
  Otras: "#B4B2A9",
};

/** Monto con signo: +$28 / -$2,410. Bajo medio dólar se lee como cero. */
export function fmtSigned(v: number, digits: 0 | 2 = 0): string {
  if (Math.abs(v) < 0.5) return fmtUsd(0, digits);
  return v > 0 ? `+${fmtUsd(v, digits)}` : fmtUsd(v, digits);
}

/** Tono del desvío/holgura: rosa si falta plata, verde si sobra. */
export function toneClass(v: number | null): string {
  if (v == null || Math.abs(v) < 0.5) return "text-[var(--ink)]";
  return v < 0 ? "text-[#ED75A0]" : "text-[var(--green-ink)]";
}

/**
 * Las dos secciones nuevas del drill (2026-10-09):
 *  - "Holgura para lo que queda": techo − real cerrado − plan pendiente, y su
 *    reparto por día hasta el evento. Responde "cuánto más puedo darle a los
 *    días que siguen", que antes se resolvía reescribiendo el plan pasado.
 *  - "Desvío vs plan": plan − real de los días cerrados, por canal, con el
 *    acumulado en el tiempo. El plan de esos días no se edita (salvo
 *    superadmin), así que este número mide la planificación de verdad.
 */
export default function HolguraEvento({
  holgura,
  canales,
  techoUsd,
  hoy,
  ultimoDia,
}: {
  holgura: Holgura;
  canales: CanalDesvio[];
  techoUsd: number | null;
  hoy: string;
  /** Último día del evento ('' si no tiene fecha). */
  ultimoDia: string;
}) {
  const { corte, realCerrado, planCerrado, planPendiente, porAsignar, diasRestantes, porDia, desvio } = holgura;

  const porDiaRedondo = porDia != null ? Math.round(porDia) : null;
  const mensaje =
    porAsignar == null
      ? null
      : diasRestantes === 0
        ? porAsignar < 0
          ? `El evento ya pasó: se gastó ${fmtUsd(-porAsignar, 0)} sobre el techo.`
          : `El evento ya pasó: quedaron ${fmtUsd(porAsignar, 0)} sin usar del techo.`
        : porDiaRedondo === 0
          ? "El plan de lo que queda ya calza con el techo."
          : porDiaRedondo! > 0
            ? `Puedes sumar ≈ ${fmtUsd(porDiaRedondo!, 0)} por día al plan de aquí al evento.`
            : `Debes recortar ≈ ${fmtUsd(-porDiaRedondo!, 0)} por día de aquí al evento para no pasarte del techo.`;
  const dotMensaje =
    porDiaRedondo == null || porDiaRedondo === 0 ? "bg-[#999999]" : porDiaRedondo > 0 ? "bg-[#B1D750]" : "bg-[#ED75A0]";

  return (
    <>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="font-display text-lg font-bold text-[var(--ink)]">Holgura para lo que queda</h2>
          <span className="font-sans text-xs text-[var(--ink-subtle)]">
            {corte
              ? `al cierre del ${fmtDiaMes(corte)} · un día se cierra con la corrida diaria del mart (~10:45)`
              : "el mart aún no tiene días cerrados"}
          </span>
        </div>
        <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
          {techoUsd == null ? (
            <p className="font-sans text-sm text-[var(--ink-subtle)]">
              El evento no tiene techo cargado: el presupuesto (budgetPm) se define en /admin/eventos.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-stretch gap-2.5">
                <Termino label="Techo" value={fmtUsd(techoUsd)} hint="presupuesto del evento" />
                <Operador>−</Operador>
                <Termino
                  label={corte ? `Real al ${fmtDiaMes(corte)}` : "Real cerrado"}
                  value={fmtUsd(realCerrado)}
                  hint="lo que ya se gastó (días cerrados)"
                />
                <Operador>−</Operador>
                <Termino
                  label={corte ? `Plan desde el ${fmtDiaMes(addDiasIso(corte, 1))}` : "Plan pendiente"}
                  value={fmtUsd(planPendiente)}
                  valueClass="text-[var(--plan)]"
                  hint="lo que ya está planificado"
                />
                <Operador>=</Operador>
                <Termino
                  label="Por asignar"
                  value={fmtUsd(porAsignar ?? 0)}
                  valueClass={toneClass(porAsignar)}
                  hint={
                    diasRestantes > 0
                      ? `en ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} (${fmtDiaMes(hoy)} → ${fmtDiaMes(ultimoDia)})`
                      : "el evento ya pasó"
                  }
                  destacado
                />
              </div>
              {mensaje && (
                <p className="mt-3 flex items-center gap-2 font-sans text-sm font-medium text-[var(--ink)]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotMensaje}`} />
                  {mensaje}
                </p>
              )}
              <p className="mt-2 max-w-[90ch] font-sans text-xs leading-relaxed text-[var(--ink-subtle)]">
                Para repartirlo, usa <span className="text-[var(--ink-muted)]">Rellenar rango</span> (icono
                de calendario en cada fila de tipo) sobre los días que vienen. El número se recalcula solo:
                cuando el plan de lo que queda suma justo lo disponible, queda en $0.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="font-display text-lg font-bold text-[var(--ink)]">Desvío vs plan</h2>
          <span className="font-sans text-xs text-[var(--ink-subtle)]">
            días cerrados · el plan de cada día tal como se planificó, sin reescribir
          </span>
        </div>
        {canales.length === 0 ? (
          <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6 text-center font-sans text-sm text-[var(--ink-subtle)]">
            Aún no hay días cerrados con plan o gasto.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[5fr_6fr]">
            <div className="min-w-0 overflow-x-auto rounded-lg border border-[var(--divider)] bg-[var(--surface)]">
              <table className="w-full min-w-[460px]">
                <thead>
                  <tr className="border-b border-[var(--divider)] bg-[var(--surface-alt)]">
                    <th className="px-4 py-3 text-left font-sans text-xs font-medium text-[var(--ink-muted)]">Canal</th>
                    <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[var(--ink-muted)]">
                      Plan al {fmtDiaMes(corte)}
                    </th>
                    <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[var(--ink-muted)]">
                      Real al {fmtDiaMes(corte)}
                    </th>
                    <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[var(--ink-muted)]">Desvío</th>
                    <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[var(--ink-muted)]">Real / plan</th>
                  </tr>
                </thead>
                <tbody>
                  {canales.map((c) => (
                    <FilaCanal key={c.plataforma} label={c.label} plan={c.plan} real={c.real} />
                  ))}
                  <FilaCanal label="Total" plan={planCerrado} real={realCerrado} total />
                </tbody>
              </table>
            </div>
            <div className="min-w-0 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-sans text-xs text-[var(--ink-muted)]">Acumulado desde el primer día con plan o gasto</p>
                <div className="flex items-center gap-3 font-sans text-xs text-[var(--ink-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--plan)]" /> plan
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--ink)]" /> real
                  </span>
                </div>
              </div>
              <DesvioChart acumulado={holgura.acumulado} />
              <p className="mt-2 flex items-center gap-2 font-sans text-sm font-medium text-[var(--ink)]">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${desvio < -0.5 ? "bg-[#ED75A0]" : "bg-[#B1D750]"}`} />
                {planCerrado <= 0
                  ? `No hubo plan en los días cerrados: todo el gasto (${fmtUsd(realCerrado, 0)}) cuenta como desvío.`
                  : desvio < -0.5
                    ? `En los días cerrados se gastó ${Math.round((realCerrado / planCerrado - 1) * 100)}% más de lo planificado (${fmtUsd(-desvio, 0)} sobre el plan).`
                    : `En los días cerrados se gastó ${Math.round((1 - realCerrado / planCerrado) * 100)}% menos de lo planificado (${fmtUsd(desvio, 0)} bajo el plan).`}
              </p>
            </div>
          </div>
        )}
        <p className="font-sans text-xs leading-relaxed text-[var(--ink-subtle)]">
          Desvío = plan − real. <span className="text-[var(--green-ink)]">Positivo</span>: se gastó menos de lo
          planificado. <span className="text-[#ED75A0]">Negativo</span>: se gastó más. Se compara por canal y no por
          tipo porque parte del plan antiguo está cargado como &quot;Sin tipo&quot;.
        </p>
      </section>
    </>
  );
}

function Termino({
  label,
  value,
  hint,
  valueClass = "text-[var(--ink)]",
  destacado,
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`min-w-0 flex-[1_1_150px] rounded-lg border px-3.5 py-3 ${
        destacado ? "border-[var(--ink)]" : "border-[var(--divider)]"
      }`}
    >
      <p className="font-sans text-xs text-[var(--ink-muted)]">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-bold leading-none tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-2 font-sans text-[11px] text-[var(--ink-subtle)]">{hint}</p>
    </div>
  );
}

function Operador({ children }: { children: string }) {
  return (
    <span aria-hidden className="flex items-center px-0.5 font-sans text-xl text-[var(--ink-subtle)]">
      {children}
    </span>
  );
}

function FilaCanal({ label, plan, real, total }: { label: string; plan: number; real: number; total?: boolean }) {
  const d = plan - real;
  const ratio = plan <= 0 ? "sin plan" : real / plan > 5 ? "más de 5×" : `${Math.round((real / plan) * 100)}%`;
  return (
    <tr className={total ? "" : "border-b border-[var(--divider)]"}>
      <td className={`px-4 py-2.5 font-sans text-sm text-[var(--ink)] ${total ? "font-medium" : ""}`}>
        {!total && (
          <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: PLAT_COLOR[label] }} />
        )}
        {label}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-sans text-sm font-medium tabular-nums text-[var(--plan)]">
        {fmtUsd(plan, 0)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[var(--ink)] ${total ? "font-medium" : ""}`}>
        {fmtUsd(real, 0)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-sans text-sm tabular-nums ${toneClass(d)} ${total ? "font-medium" : ""}`}>
        {fmtSigned(d)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[var(--ink-muted)]">{ratio}</td>
    </tr>
  );
}

function DesvioChart({ acumulado }: { acumulado: Holgura["acumulado"] }) {
  // Arranca en el primer día con plan o gasto: los días vacíos del inicio de la
  // ventana solo aplastarían la curva contra el eje.
  const data = useMemo(() => {
    const desde = acumulado.findIndex((d) => d.plan > 0 || d.real > 0);
    return (desde < 0 ? [] : acumulado.slice(desde)).map((d) => ({
      label: fmtDiaMes(d.fecha),
      plan: Math.round(d.plan),
      real: Math.round(d.real),
    }));
  }, [acumulado]);
  if (data.length < 2) return null;
  return (
    <div className="mt-4 h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--divider)" }}
            tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "var(--ink-subtle)" }}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontFamily: "var(--font-sans)", fontSize: 12, fill: "var(--ink-subtle)" }}
            tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
            width={52}
          />
          <ChartTooltip content={<DesvioTooltip />} cursor={{ stroke: "var(--divider)" }} />
          <Line type="monotone" dataKey="plan" stroke="var(--plan)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="real" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: { dataKey?: string | number; value?: number }[];
};

function DesvioTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const plan = Number(payload.find((p) => p.dataKey === "plan")?.value ?? 0);
  const real = Number(payload.find((p) => p.dataKey === "real")?.value ?? 0);
  return (
    <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 font-sans text-sm text-[var(--ink)] shadow-md">
      <p className="text-xs text-[var(--ink-muted)]">Acumulado al {label}</p>
      <p className="tabular-nums">
        <span className="text-[var(--plan)]">plan</span> {fmtUsd(plan, 0)}
      </p>
      <p className="tabular-nums">real {fmtUsd(real, 0)}</p>
      <p className={`tabular-nums ${toneClass(plan - real)}`}>desvío {fmtSigned(plan - real)}</p>
    </div>
  );
}
