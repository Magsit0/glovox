"use client";

import { useMemo } from "react";
import type { Country as PgCountry } from "@/db/schema";
import {
  computeTotals,
  derivePrecioVariante,
  ingresoNeto,
  type FilaInput,
} from "@/lib/ticketing-pricing/formulas";
import {
  fiscalForCountry,
  formatMoney,
  STAGE_OPTIONS,
  type PlanDoc,
} from "@/lib/ticketing-pricing/config";
import { formatNumber } from "@/lib/unabase/formatting";
import type { EventInfo } from "@/lib/queries/ticketing";
import EventoTimeseriesChart from "./EventoTimeseriesChart";

interface Props {
  nombre: string;
  country: PgCountry;
  fechaEvento: string;
  doc: PlanDoc;
  /** Info del evento (de categoriaEvento); para anclar el forecast en su fecha. */
  eventInfo?: EventInfo | null;
}

function fmtFecha(v: string, locale = "es-CL"): string {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Pre-informe (tipo cierre): datos generales del evento + el plan en formato
 * matriz tipo×etapa, con totales, capacidad, venta esperada e ingreso neto/bruto.
 * Vista de solo lectura derivada del estado actual del builder.
 */
export default function PlanInforme({ nombre, country, fechaEvento, doc, eventInfo }: Props) {
  const fiscal = useMemo(() => fiscalForCountry(country), [country]);
  const money = (v: number) => formatMoney(v, fiscal);

  const etapas = useMemo(
    () => STAGE_OPTIONS.filter((e) => doc.etapas.includes(e)),
    [doc.etapas],
  );
  const tipos = doc.tiposProducto;

  const precioDe = useMemo(() => {
    const m = new Map<string, { precio: number | null; stock: number | null }>();
    // Sólo celdas base (general): el precio base p_ij vive ahí; las de sponsor
    // tienen precio derivado.
    for (const c of doc.celdas) {
      if (c.sponsor === "") m.set(`${c.tipo}|${c.etapa}`, { precio: c.precio, stock: c.stock });
    }
    return m;
  }, [doc.celdas]);

  const params = useMemo(
    () => ({ cpsPct: doc.cpsPct, rebatePct: doc.rebatePct }),
    [doc.cpsPct, doc.rebatePct],
  );

  // Por tipo: a vender, cortesías, ingreso bruto (Σ precio×stock de sus celdas).
  const porTipo = useMemo(() => {
    return tipos.map((tipo) => {
      const cfg = doc.tiposConfig.find((c) => c.tipo === tipo);
      let ingresoBruto = 0;
      for (const etapa of etapas) {
        const cel = precioDe.get(`${tipo}|${etapa}`);
        if (cel?.precio != null && cel?.stock != null) ingresoBruto += cel.precio * cel.stock;
      }
      return {
        tipo,
        aVender: cfg?.aVender ?? null,
        cortesias: cfg?.cortesias ?? null,
        ingresoBruto,
      };
    });
  }, [tipos, etapas, doc.tiposConfig, precioDe]);

  // Filas para totales = SOLO las celdas visibles en la matriz (tipos × etapas
  // mostrados), para que el footer cuadre siempre con la suma de las filas.
  const filas: FilaInput[] = useMemo(() => {
    const out: FilaInput[] = [];
    for (const tipo of tipos) {
      for (const etapa of etapas) {
        const cel = precioDe.get(`${tipo}|${etapa}`);
        if (cel) out.push({ precio: cel.precio, stock: cel.stock });
      }
    }
    return out;
  }, [tipos, etapas, precioDe]);

  // Celdas con precio definido, en orden de matriz, para el descuento por sponsor.
  const precioRows = useMemo(() => {
    const out: { tipo: string; etapa: string; precio: number }[] = [];
    for (const tipo of tipos) {
      for (const etapa of etapas) {
        const cel = precioDe.get(`${tipo}|${etapa}`);
        if (cel?.precio != null) out.push({ tipo, etapa, precio: cel.precio });
      }
    }
    return out;
  }, [tipos, etapas, precioDe]);
  const totals = useMemo(() => computeTotals(filas, params), [filas, params]);

  const totalAVender = porTipo.reduce((a, t) => a + (t.aVender ?? 0), 0);
  const totalCortesias = porTipo.reduce((a, t) => a + (t.cortesias ?? 0), 0);
  const usados = totalAVender + totalCortesias;
  const capacidad = doc.venueCapacidad;
  const capValido = capacidad != null && capacidad > 0;
  const ocupacionPct = capValido ? Math.round((usados / capacidad) * 100) : null;
  const sobrepasa = capValido && usados > capacidad;
  const netoProyectado = ingresoNeto(totals.ingresos, fiscal.ivaPct);

  const monedaLabel = fiscal.currency;

  // Forecast: magnitud = Σ a vender (fallback Σ stock → capacidad del venue); ancla = fecha del evento.
  const magnitud =
    totalAVender > 0
      ? totalAVender
      : totals.stock > 0
        ? totals.stock
        : (eventInfo?.capacidad ?? doc.venueCapacidad ?? 0);
  const eventDate = eventInfo?.fechaEvento || fechaEvento || undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Datos generales */}
      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-sans text-xs uppercase tracking-wide text-[#666666]">
              Pre-informe del plan
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#333333]">
              {nombre || "Evento sin nombre"}
            </h2>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              {country === "PE" ? "Perú" : "Chile"} · {fmtFecha(fechaEvento, fiscal.locale)} · Moneda{" "}
              {monedaLabel} · IVA {Math.round(fiscal.ivaPct * 100)}%
            </p>
          </div>
          <div className="flex flex-wrap gap-2 font-sans text-xs text-[#666666]">
            <span className="rounded-full bg-[#FAFAFA] px-2.5 py-1">CPS {Math.round(doc.cpsPct * 100)}%</span>
            <span className="rounded-full bg-[#FAFAFA] px-2.5 py-1">Rebate {Math.round(doc.rebatePct * 100)}%</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Capacidad venue" value={capValido ? formatNumber(capacidad) : "—"} />
          <Kpi label="Tickets a vender" value={formatNumber(totalAVender)} />
          <Kpi label="Cortesías" value={formatNumber(totalCortesias)} />
          <Kpi
            label="Venta esperada"
            value={doc.ventaEsperada != null ? money(doc.ventaEsperada) : "—"}
          />
          <Kpi label="Ingreso proyectado" value={money(totals.ingresos)} hint="bruto (IVA incl.)" />
          <Kpi label="Ingreso neto" value={money(netoProyectado)} hint="sin IVA (para factura)" />
        </div>

        {capValido && (
          <p
            className={`mt-4 font-sans text-sm ${sobrepasa ? "text-[#A8336B]" : "text-[#666666]"}`}
          >
            {sobrepasa ? "⚠ " : ""}
            Ocupación: {formatNumber(usados)} de {formatNumber(capacidad)} ({ocupacionPct}%) —
            tickets a vender + cortesías.
            {sobrepasa ? " Sobrepasa la capacidad del venue." : ""}
          </p>
        )}
      </section>

      {/* Evolución del evento: real + forecast (esperado) */}
      {doc.eventoId && (
        <EventoTimeseriesChart
          key={doc.eventoId}
          eventoId={doc.eventoId}
          etapas={doc.etapasConfig}
          magnitud={magnitud}
          eventDate={eventDate}
        />
      )}

      {/* Matriz tipo × etapa */}
      {tipos.length === 0 || etapas.length === 0 ? (
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-8 text-center font-sans text-sm text-[#999999]">
          El plan todavía no tiene etapas ni tipos para mostrar.
        </div>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
          <table className="w-full font-sans text-sm">
            <caption className="px-4 pt-4 text-left font-display text-lg font-bold text-[#333333]">
              Matriz de precios por tipo y etapa
              <span className="ml-2 font-sans text-xs font-normal text-[#999999]">
                (precio base, {monedaLabel})
              </span>
            </caption>
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="px-3 py-3 text-left font-medium uppercase tracking-wide text-[#666666]">
                  Tipo
                </th>
                {etapas.map((e) => (
                  <th
                    key={e}
                    className="px-3 py-3 text-right font-medium uppercase tracking-wide text-[#666666]"
                  >
                    {e}
                  </th>
                ))}
                <th className="px-3 py-3 text-right font-medium uppercase tracking-wide text-[#666666]">
                  A vender
                </th>
                <th className="px-3 py-3 text-right font-medium uppercase tracking-wide text-[#666666]">
                  Cortesías
                </th>
                <th className="px-3 py-3 text-right font-medium uppercase tracking-wide text-[#666666]">
                  Ingreso bruto
                </th>
              </tr>
            </thead>
            <tbody>
              {porTipo.map((t) => (
                <tr key={t.tipo} className="border-b border-[#E5E5E5] last:border-0">
                  <td className="px-3 py-2.5 font-medium text-[#333333]">{t.tipo}</td>
                  {etapas.map((e) => {
                    const cel = precioDe.get(`${t.tipo}|${e}`);
                    return (
                      <td key={e} className="px-3 py-2.5 text-right tabular-nums text-[#333333]">
                        {cel?.precio != null ? money(cel.precio) : <span className="text-[#CCCCCC]">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#666666]">
                    {t.aVender != null ? formatNumber(t.aVender) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#666666]">
                    {t.cortesias != null ? formatNumber(t.cortesias) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#333333]">
                    {money(t.ingresoBruto)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
                <td className="px-3 py-3 font-medium text-[#333333]">Totales</td>
                {etapas.map((e) => (
                  <td key={e} className="px-3 py-3" />
                ))}
                <td className="px-3 py-3 text-right tabular-nums font-medium text-[#333333]">
                  {formatNumber(totalAVender)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-medium text-[#333333]">
                  {formatNumber(totalCortesias)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-bold text-[#333333]">
                  {money(totals.ingresos)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {/* Resumen económico */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ingreso bruto (venta)" value={money(totals.ingresos)} card />
        <Kpi label="Ingreso neto (sin IVA)" value={money(netoProyectado)} card />
        <Kpi label="Rebate recuperado" value={money(totals.rebate)} card />
        <Kpi label="Ingreso + rebate" value={money(totals.ingresoTotal)} card />
      </section>

      {/* Función objetivo (modelo) — planteada, a resolver en una iteración futura */}
      <section className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h3 className="font-display text-lg font-bold text-[#333333]">Función objetivo</h3>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Planteada para optimizar el plan de pricing. La resolución (asignación óptima de
          cantidades) se define en una iteración posterior.
        </p>

        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-4">
          <div className="flex items-baseline gap-3 font-sans text-sm">
            <span className="w-24 shrink-0 text-[#666666]">Maximizar</span>
            <span className="text-[#333333]">
              Σ<sub>i</sub> q<sub>i</sub> · p<sub>i</sub>
              <span className="ml-2 text-xs text-[#999999]">(ingreso bruto total)</span>
            </span>
          </div>
          <div className="flex items-baseline gap-3 font-sans text-sm">
            <span className="w-24 shrink-0 text-[#666666]">Sujeto a</span>
            <span className="text-[#333333]">
              Σ<sub>i</sub> q<sub>i</sub> ≤ T
              <span className="ml-2 text-xs text-[#999999]">
                (capacidad{capValido ? ` = ${formatNumber(capacidad)}` : ""})
              </span>
            </span>
          </div>
          <div className="flex items-baseline gap-3 font-sans text-sm">
            <span className="w-24 shrink-0" />
            <span className="text-[#333333]">
              0 ≤ q<sub>i</sub> ≤ esperado<sub>i</sub>
              <span className="ml-2 text-xs text-[#999999]">(límite por fila)</span>
            </span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 font-sans text-xs text-[#666666] sm:grid-cols-2">
          <div>
            <dt className="inline font-medium text-[#333333]">q<sub>i</sub></dt> — tickets a vender de la
            fila i (producto × etapa × sponsor)
          </div>
          <div>
            <dt className="inline font-medium text-[#333333]">p<sub>i</sub></dt> — precio bruto de la fila i
          </div>
          <div>
            <dt className="inline font-medium text-[#333333]">T</dt> — capacidad del venue
          </div>
          <div>
            <dt className="inline font-medium text-[#333333]">esperado<sub>i</sub></dt> — límite esperado
            por fila (imputado o histórico)
          </div>
        </dl>

        <p className="mt-3 font-sans text-xs text-[#999999]">
          Nota: restricción a confirmar (¿debe incorporar el tiempo t<sub>i</sub> por etapa?).
        </p>
      </section>

      {/* Sponsors — resumen */}
      {doc.sponsors.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white p-6">
          <h3 className="font-display text-lg font-bold text-[#333333]">Sponsors y descuentos</h3>
          <table className="mt-4 w-full font-sans text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="px-3 py-2 text-left font-medium text-[#666666]">Marca</th>
                <th className="px-3 py-2 text-right font-medium text-[#666666]">Descuento</th>
                <th className="px-3 py-2 text-right font-medium text-[#666666]">Cupo dcto.</th>
              </tr>
            </thead>
            <tbody>
              {doc.sponsors.map((s, i) => (
                <tr key={`${s.nombre}|${i}`} className="border-b border-[#E5E5E5] last:border-0">
                  <td className="px-3 py-2 text-[#333333]">{s.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#666666]">
                    {Math.round(s.pct * 100)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#666666]">
                    {s.cupo != null ? formatNumber(s.cupo) : "Sin límite"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Precios con descuento por sponsor (matriz completa) */}
      {doc.sponsors.length > 0 && precioRows.length > 0 && (
        <section className="overflow-x-auto rounded-lg border border-[#E5E5E5] bg-white">
          <table className="w-full font-sans text-sm">
            <caption className="px-4 pt-4 text-left font-display text-lg font-bold text-[#333333]">
              Precios con descuento por sponsor
              <span className="ml-2 font-sans text-xs font-normal text-[#999999]">
                (precio final por marca, {monedaLabel})
              </span>
            </caption>
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <th className="px-3 py-3 text-left font-medium uppercase tracking-wide text-[#666666]">
                  Tipo
                </th>
                <th className="px-3 py-3 text-left font-medium uppercase tracking-wide text-[#666666]">
                  Etapa
                </th>
                <th className="px-3 py-3 text-right font-medium uppercase tracking-wide text-[#666666]">
                  Base
                </th>
                {doc.sponsors.map((s, i) => (
                  <th
                    key={`${s.nombre}|${i}`}
                    className="px-3 py-3 text-right font-medium uppercase tracking-wide text-[#666666]"
                  >
                    {s.nombre} ({Math.round(s.pct * 100)}%)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {precioRows.map((f) => (
                <tr key={`${f.tipo}|${f.etapa}`} className="border-b border-[#E5E5E5] last:border-0">
                  <td className="px-3 py-2.5 text-[#333333]">{f.tipo}</td>
                  <td className="px-3 py-2.5 text-[#666666]">{f.etapa}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#666666]">
                    {money(f.precio)}
                  </td>
                  {doc.sponsors.map((s, i) => (
                    <td
                      key={`${s.nombre}|${i}`}
                      className="px-3 py-2.5 text-right tabular-nums text-[#333333]"
                    >
                      {money(derivePrecioVariante(f.precio, s.pct))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  card,
}: {
  label: string;
  value: string;
  hint?: string;
  card?: boolean;
}) {
  return (
    <div className={card ? "flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-5" : "flex flex-col"}>
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="mt-1 font-display text-xl font-bold leading-tight tracking-tight text-[#333333]">
        {value}
      </p>
      {hint && <p className="mt-0.5 font-sans text-[11px] text-[#999999]">{hint}</p>}
    </div>
  );
}
