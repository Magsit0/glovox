"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox } from "lucide-react";
import Panel from "@/components/cierre-mensual/financiero/Panel";
import CierreNegocioLink from "@/components/cierre-mensual/CierreNegocioLink";
import type { FinBusiness } from "@/components/cierre-mensual/financiero/FinancieroTab";
import { ChartTooltip } from "@/components/cierre-mensual/charts/ChartTooltip";
import { axisTick, BRAND, gridProps, INK, legendProps, SURFACE } from "@/lib/chart-colors";
import {
  periodKeyFromTs,
  periodLabel,
  resolveFechaFinanciera,
  type PeriodGrain,
} from "@/lib/unabase/dates";
import {
  compactCurrency,
  formatCurrency,
  formatNumber,
  parseNumber,
  safeText,
} from "@/lib/unabase/formatting";
import type { NegocioRow } from "@/lib/unabase/types";

interface Props {
  finRows: FinBusiness[];
  negociosRows: NegocioRow[];
  negociosLoading: boolean;
  negociosError: string | null;
  grain: PeriodGrain;
}

interface CobranzaNegocio {
  n: NegocioRow;
  ts: number;
  usaFallback: boolean;
  venta: number;
  facturado: number;
  cobrado: number;
  porCobrar: number;
  porFacturar: number;
}

const DAY_MS = 86_400_000;

const formatShortDate = (ts: number): string =>
  Number.isFinite(ts)
    ? new Date(ts).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Sin fecha";

export default function DevengoCajaSection({
  finRows,
  negociosRows,
  negociosLoading,
  negociosError,
  grain,
}: Props) {
  // Referencia "hoy" fija por montaje (regla de pureza de render): la
  // antigüedad no necesita refrescarse en vivo dentro de la sesión.
  const [now] = useState(() => Date.now());
  const scoped = useMemo<CobranzaNegocio[]>(() => {
    // Mismo universo que el resto de la pestaña: los negocio_id de las filas
    // filtradas (eventos con presupuesto). El detalle de cobranza sale del
    // maestro de negocios.
    const ids = new Set<string>();
    finRows.forEach(({ b }) => b.negocioIds.forEach((id) => ids.add(id)));
    return negociosRows
      .filter((n) => ids.has(n.id))
      .map((n) => {
        const ff = resolveFechaFinanciera(n.fecha_realizacion, n.fecha_asignacion);
        return {
          n,
          ts: ff.ts,
          usaFallback: ff.usaFallback,
          venta: parseNumber(n.total_neto),
          facturado: parseNumber(n.total_facturado),
          cobrado: parseNumber(n.total_cobrado),
          porCobrar: parseNumber(n.total_por_cobrar),
          porFacturar: parseNumber(n.total_por_facturar),
        };
      });
  }, [finRows, negociosRows]);

  const totals = useMemo(
    () =>
      scoped.reduce(
        (acc, r) => ({
          venta: acc.venta + r.venta,
          facturado: acc.facturado + r.facturado,
          cobrado: acc.cobrado + r.cobrado,
          porCobrar: acc.porCobrar + r.porCobrar,
          porFacturar: acc.porFacturar + r.porFacturar,
        }),
        { venta: 0, facturado: 0, cobrado: 0, porCobrar: 0, porFacturar: 0 },
      ),
    [scoped],
  );

  const serie = useMemo(() => {
    const map = new Map<
      string,
      { cobrado: number; porCobrar: number; porFacturar: number; venta: number }
    >();
    scoped.forEach((r) => {
      if (!Number.isFinite(r.ts)) return;
      const key = periodKeyFromTs(r.ts, grain);
      const curr = map.get(key) ?? { cobrado: 0, porCobrar: 0, porFacturar: 0, venta: 0 };
      curr.cobrado += r.cobrado;
      curr.porCobrar += r.porCobrar;
      curr.porFacturar += r.porFacturar;
      curr.venta += r.venta;
      map.set(key, curr);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ label: periodLabel(key, grain), ...v }));
  }, [scoped, grain]);

  const aging = useMemo(() => {
    const buckets = [
      { key: "futuro", label: "Aún no realizado", color: BRAND.teal, monto: 0, negocios: 0 },
      { key: "b30", label: "0–30 días", color: BRAND.green, monto: 0, negocios: 0 },
      { key: "b60", label: "31–60 días", color: BRAND.yellow, monto: 0, negocios: 0 },
      { key: "b90", label: "61–90 días", color: BRAND.orange, monto: 0, negocios: 0 },
      { key: "b90p", label: "Más de 90 días", color: BRAND.pink, monto: 0, negocios: 0 },
      { key: "sinFecha", label: "Sin fecha", color: INK.subtle, monto: 0, negocios: 0 },
    ];
    const add = (key: string, monto: number) => {
      const b = buckets.find((x) => x.key === key)!;
      b.monto += monto;
      b.negocios += 1;
    };
    scoped.forEach((r) => {
      if (r.porCobrar <= 0) return;
      if (!Number.isFinite(r.ts)) return add("sinFecha", r.porCobrar);
      if (r.ts > now) return add("futuro", r.porCobrar);
      const days = Math.floor((now - r.ts) / DAY_MS);
      if (days <= 30) return add("b30", r.porCobrar);
      if (days <= 60) return add("b60", r.porCobrar);
      if (days <= 90) return add("b90", r.porCobrar);
      return add("b90p", r.porCobrar);
    });
    return buckets.filter((b) => b.negocios > 0);
  }, [scoped, now]);

  const top = useMemo(
    () =>
      [...scoped]
        .filter((r) => r.porCobrar > 0)
        .sort((a, b) => b.porCobrar - a.porCobrar)
        .slice(0, 10),
    [scoped],
  );

  if (negociosError) {
    return (
      <Panel title="Devengo vs caja">
        <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-4">
          <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">{negociosError}</p>
        </div>
      </Panel>
    );
  }

  if (negociosLoading) {
    return (
      <Panel title="Devengo vs caja">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[#F0F0F0]" />
          ))}
        </div>
      </Panel>
    );
  }

  if (!scoped.length) {
    return (
      <Panel title="Devengo vs caja">
        <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
          <Inbox className="h-6 w-6" />
          Sin negocios en el alcance filtrado
        </div>
      </Panel>
    );
  }

  const pctFacturado = totals.venta ? totals.facturado / totals.venta : 0;
  const pctCobrado = totals.facturado ? totals.cobrado / totals.facturado : 0;
  const dso = totals.venta > 0 ? Math.round((totals.porCobrar / totals.venta) * 365) : null;
  const maxAging = Math.max(...aging.map((b) => b.monto), 1);

  const kpis = [
    {
      label: "Venta neta",
      value: compactCurrency(totals.venta),
      sub: `${formatNumber(scoped.length)} negocios del alcance`,
      dot: null as string | null,
    },
    {
      label: "Facturado",
      value: compactCurrency(totals.facturado),
      sub: `${(pctFacturado * 100).toFixed(1)}% de la venta`,
      dot: pctFacturado >= 0.8 ? "#B1D750" : "#F6C544",
    },
    {
      label: "Cobrado",
      value: compactCurrency(totals.cobrado),
      sub: `${(pctCobrado * 100).toFixed(1)}% de lo facturado`,
      dot: pctCobrado >= 0.8 ? "#B1D750" : "#F6C544",
    },
    {
      label: "Por cobrar",
      value: compactCurrency(totals.porCobrar),
      sub: dso === null ? "—" : `DSO ~${formatNumber(dso)} días`,
      dot: totals.porCobrar > 0 ? "#ED75A0" : "#B1D750",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <article
            key={k.label}
            className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <div className="font-sans text-xs text-[#666666]">{k.label}</div>
            <div className="mt-2 truncate font-display text-4xl font-extrabold leading-none tracking-tight text-[#333333]">
              {k.value}
            </div>
            <div className="mt-3 flex items-center gap-2">
              {k.dot && (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: k.dot }}
                />
              )}
              <span className="truncate font-sans text-xs text-[#666666]">{k.sub}</span>
            </div>
          </article>
        ))}
      </section>

      <Panel
        title="Devengo vs caja por período"
        subtitle="La utilidad no es caja: cuánto de la venta de cada período ya se cobró, cuánto está facturado sin cobrar y cuánto falta por facturar"
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={serie}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            barCategoryGap="30%"
          >
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              axisLine={{ stroke: SURFACE.divider }}
              tickLine={false}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => compactCurrency(v)}
            />
            <Tooltip
              cursor={{ fill: SURFACE.canvas }}
              content={({ active, label, payload }) => (
                <ChartTooltip
                  active={active}
                  label={label}
                  items={(payload ?? []).map((p) => ({
                    name: String(p.name),
                    color:
                      String(p.dataKey) === "venta" ? BRAND.purple : String(p.color),
                    formatted: formatCurrency(Number(p.value)),
                  }))}
                />
              )}
            />
            <Legend {...legendProps} />
            <Bar
              dataKey="cobrado"
              name="Cobrado"
              stackId="caja"
              fill={BRAND.green}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="porCobrar"
              name="Por cobrar"
              stackId="caja"
              fill={BRAND.yellow}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="porFacturar"
              name="Por facturar"
              stackId="caja"
              fill={BRAND.teal}
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="venta"
              name="Venta neta"
              stroke={BRAND.purple}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive
              animationDuration={400}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="font-sans text-xs text-[#999999]">
          Montos netos del maestro de negocios. Si la línea de venta no coincide
          con la barra apilada, hay diferencias entre venta contratada y el
          ciclo facturación/cobro de ese período.
        </p>
      </Panel>

      <Panel
        title="Antigüedad del saldo por cobrar"
        subtitle="Días desde la fecha de realización del negocio hasta hoy"
      >
        <div className="flex flex-col gap-3">
          {aging.map((b) => (
            <div key={b.key} className="flex items-center gap-3">
              <div className="w-36 shrink-0 font-sans text-xs text-[#666666]">{b.label}</div>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-[#FAFAFA]">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${Math.max(2, (b.monto / maxAging) * 100)}%`,
                    background: b.color,
                  }}
                />
              </div>
              <div className="w-28 shrink-0 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                {compactCurrency(b.monto)}
              </div>
              <div className="w-24 shrink-0 text-right font-sans text-xs tabular-nums text-[#999999]">
                {formatNumber(b.negocios)} neg.
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Mayores saldos por cobrar"
        subtitle="Top 10 negocios del alcance con saldo pendiente de cobro"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">Negocio</th>
                <th className="px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">Realización</th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">Venta neta</th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">Facturado</th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">Cobrado</th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">Por cobrar</th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">% cobrado</th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">Días</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => {
                const dias = Number.isFinite(r.ts)
                  ? Math.max(0, Math.floor((now - r.ts) / DAY_MS))
                  : null;
                const pct = r.facturado ? r.cobrado / r.facturado : null;
                return (
                  <tr
                    key={r.n.id}
                    className="border-b border-[#E5E5E5] transition-colors hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 font-sans text-sm text-[#333333]">
                      <CierreNegocioLink
                        negocioIds={[r.n.id]}
                        subtitle={`${safeText(r.n.area_negocio)}`}
                      >
                        {safeText(r.n.referencia)}
                      </CierreNegocioLink>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#333333]">
                      {formatShortDate(r.ts)}
                      {r.usaFallback && (
                        <span className="ml-1.5 font-sans text-xs text-[#999999]">(asignación)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatCurrency(r.venta)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatCurrency(r.facturado)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatCurrency(r.cobrado)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                      {formatCurrency(r.porCobrar)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {pct === null ? "—" : `${(pct * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {dias === null ? "—" : formatNumber(dias)}
                    </td>
                  </tr>
                );
              })}
              {!top.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center font-sans text-sm text-[#999999]"
                  >
                    Sin saldos por cobrar en el alcance filtrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="font-sans text-xs text-[#999999]">
          DSO proxy = saldo por cobrar × 365 / venta neta del alcance visible
          (fórmula de días en cuentas por cobrar aplicada al universo filtrado).
        </p>
      </Panel>
    </div>
  );
}
