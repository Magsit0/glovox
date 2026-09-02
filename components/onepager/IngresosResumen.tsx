"use client";

import type { ReactNode } from "react";
import RebatePctEditor from "@/components/cierre-negocio/RebatePctEditor";
import { INK } from "@/lib/chart-colors";
import { brutoToNeto } from "@/lib/constants/tax";
import { rebateFrom } from "@/lib/constants/rebate";
import { getIngresoColor } from "./IngresoChart";

export type MontoNetoBruto = { neto: number; bruto: number };

type Props = {
  eventoId: string;
  /** Venta de tickets a valor cara, BRUTA (glovox.tickets). */
  ventaTicketsBruto: number;
  /** Venta FF&BB BRUTA (onfire.soldItems). */
  ventaFfBbBruto: number;
  /** Cargo por servicio completo, BRUTO (cierreEventos). null = sin cierre aún. */
  cargoServicioBruto: number | null;
  /** % de rebate en puntos (55 = 55%) — misma fila `rebate_config` que /cierre-negocio. */
  rebatePct: number;
  marcas: MontoNetoBruto;
  mesasVip: MontoNetoBruto;
  medios: MontoNetoBruto;
  producto: MontoNetoBruto;
  costos: { neto: number; bruto: number; lineas: number; negocios: number };
  facturado: { neto: number; bruto: number; docs: number };
  asistentes: number | null;
};

function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (abs >= 10_000) return (v / 1_000).toFixed(1).replace(/\.?0+$/, "") + "K";
  return Math.round(v).toLocaleString("es-CL");
}
const fmtCompact = (v: number) => "$" + compact(v);
const fmtClp = (v: number) => "$" + Math.round(v).toLocaleString("es-CL");

type Metric = {
  key: string;
  label: string;
  color: string;
  /** Monto NETO — número principal. null = sin dato. */
  neto: number | null;
  /** Monto con IVA. Si coincide con el neto, la fuente es exenta. */
  bruto: number | null;
  source: string;
  /** Contenido entre el monto y la fuente (ej: editor del % de rebate). */
  extra?: ReactNode;
};

/**
 * Card de ingreso al estilo del "Inputs externos" de /cierre-negocio, en la
 * superficie blanca del one-pager: neto como número principal, IVA y total con
 * IVA debajo, fuente al pie. Punto de color = el mismo del donut de la tabla.
 */
function MetricCard({ m }: { m: Metric }) {
  const hasValue = m.neto != null;
  const hasIva =
    hasValue && m.bruto != null && Math.round(m.bruto) !== Math.round(m.neto!);
  return (
    <article className="flex h-full min-h-[148px] flex-col rounded-lg border border-[#E5E5E5] bg-white p-5">
      <p className="flex items-center gap-2 font-sans text-xs text-[#666666]">
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: m.color }}
        />
        <span className="truncate">{m.label}</span>
      </p>
      <p
        className="mt-2 font-display text-3xl font-bold leading-none tracking-tight text-[#333333] truncate"
        title={hasValue ? `${fmtClp(m.neto!)} neto` : undefined}
      >
        {hasValue ? fmtCompact(m.neto!) : "—"}
      </p>
      <p className="mt-2 font-sans text-xs text-[#666666] truncate">
        {hasIva ? (
          <>
            <span className="text-[#999999]">IVA</span> {fmtCompact(m.bruto! - m.neto!)}
            <span className="text-[#999999]"> · Total</span> {fmtCompact(m.bruto!)}
          </>
        ) : (
          <span className="text-[#999999]">{hasValue ? "Sin IVA" : "Sin dato"}</span>
        )}
      </p>
      {m.extra && <div className="mt-3">{m.extra}</div>}
      {/* mt-auto: la fuente siempre al pie, aunque la card Rebate sea más alta. */}
      <p className="mt-auto pt-3 font-sans text-xs text-[#999999] truncate">{m.source}</p>
    </article>
  );
}

/**
 * Resumen de ingresos del evento — mismas 7 fuentes y misma aritmética que el
 * bloque "Inputs externos" de /cierre-negocio (neto = bruto ÷ 1,19 para
 * tickets/FF&BB/rebate; imputaciones ya vienen neto+bruto), más el bloque
 * Unabase (costos y facturado, netos) para leer todo en la misma base.
 */
export default function IngresosResumen({
  eventoId,
  ventaTicketsBruto,
  ventaFfBbBruto,
  cargoServicioBruto,
  rebatePct,
  marcas,
  mesasVip,
  medios,
  producto,
  costos,
  facturado,
  asistentes,
}: Props) {
  // Rebate: solo el pct% del cargo por servicio es ingreso Glovox. La
  // proporción neto/bruto es lineal, así que se deriva igual que tickets.
  const rebateBruto = cargoServicioBruto != null ? rebateFrom(cargoServicioBruto, rebatePct) : null;
  const rebateNeto = rebateBruto != null ? brutoToNeto(rebateBruto) : null;

  const ticketsNeto = brutoToNeto(ventaTicketsBruto);
  const ffbbNeto = brutoToNeto(ventaFfBbBruto);

  const totalNeto =
    ticketsNeto + (rebateNeto ?? 0) + ffbbNeto +
    marcas.neto + mesasVip.neto + medios.neto + producto.neto;
  const totalBruto =
    ventaTicketsBruto + (rebateBruto ?? 0) + ventaFfBbBruto +
    marcas.bruto + mesasVip.bruto + medios.bruto + producto.bruto;
  const hasAsistentes = asistentes != null && asistentes > 0;

  const top: Metric[] = [
    {
      key: "TICKETS",
      label: "Venta tickets",
      color: getIngresoColor("TICKETS"),
      neto: ticketsNeto,
      bruto: ventaTicketsBruto,
      source: "desde Punto Ticket · valor cara",
    },
    {
      key: "REBATE",
      label: "Rebate",
      color: getIngresoColor("REBATE"),
      neto: rebateNeto,
      bruto: rebateBruto,
      source: "desde Punto Ticket · cargo por servicio",
      extra: (
        <div className="flex flex-col gap-1">
          <RebatePctEditor eventoId={eventoId} porcentaje={rebatePct} />
          <span className="font-sans text-xs text-[#999999]">
            {cargoServicioBruto != null
              ? `Cargo por servicio ${fmtCompact(brutoToNeto(cargoServicioBruto))} neto · ${fmtCompact(cargoServicioBruto)} total`
              : "Sin cargo por servicio en cierreEventos aún"}
          </span>
        </div>
      ),
    },
    {
      key: "FFBB",
      label: "Venta FF&BB",
      color: getIngresoColor("FFBB"),
      neto: ffbbNeto,
      bruto: ventaFfBbBruto,
      source: "desde OnFire",
    },
  ];

  const manual = (key: string, label: string, m: MontoNetoBruto): Metric => ({
    key,
    label,
    color: getIngresoColor(key),
    neto: m.neto,
    bruto: m.bruto,
    source: "imputado en el one-pager",
  });
  const extras: Metric[] = [
    manual("MARCAS", "Marcas", marcas),
    manual("MESAS VIP", "Mesas VIP", mesasVip),
    manual("MEDIOS", "Medios", medios),
    manual("PRODUCTO", "Producto", producto),
  ];

  const unabase: Metric[] = [
    {
      key: "COSTOS",
      label: "Costos",
      color: INK.subtle,
      neto: costos.negocios > 0 ? costos.neto : null,
      bruto: costos.negocios > 0 ? costos.bruto : null,
      source:
        costos.negocios > 0
          ? `desde Unabase · ${costos.lineas.toLocaleString("es-CL")} líneas · ${costos.negocios} negocio${costos.negocios === 1 ? "" : "s"}`
          : "sin negocio vigente en Unabase",
    },
    {
      key: "FACTURADO",
      label: "Facturado",
      color: INK.subtle,
      neto: facturado.docs > 0 ? facturado.neto : null,
      bruto: facturado.docs > 0 ? facturado.bruto : null,
      source:
        facturado.docs > 0
          ? `desde Unabase · ${facturado.docs.toLocaleString("es-CL")} documento${facturado.docs === 1 ? "" : "s"} de venta`
          : "sin facturas en Unabase",
    },
  ];

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-xl font-bold tracking-tight text-[#333333]">
          Ingresos
        </h2>
        <span className="font-sans text-xs text-[#666666]">
          Montos netos (sin IVA); IVA y total con IVA debajo de cada monto. Mismo
          criterio que el cierre de negocio.
        </span>
      </header>

      {/* 7 fuentes a la izquierda → confluyen al total (spotlight) a la derecha.
          Arriba ticketera/OnFire; abajo las imputaciones manuales. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {top.map((m) => (
              <MetricCard key={m.key} m={m} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {extras.map((m) => (
              <MetricCard key={m.key} m={m} />
            ))}
          </div>
        </div>

        {/* Spotlight KPI (docs/STYLE_DASHBOARD.md): la única card con relleno de
            marca en la vista, para que el total destaque. */}
        <article className="flex h-full flex-col justify-center rounded-xl bg-[#9F99F8] p-8 lg:col-span-1">
          <p className="font-sans text-xs text-white/80">Total ingresos</p>
          <p
            className="mt-2 font-display text-5xl font-bold leading-none tracking-tight text-white"
            title={`${fmtClp(totalNeto)} neto`}
          >
            {fmtCompact(totalNeto)}
          </p>
          <p className="mt-4 font-sans text-sm text-white/80">
            IVA {fmtCompact(totalBruto - totalNeto)}
            {"  ·  "}
            Total {fmtCompact(totalBruto)}
          </p>
          {hasAsistentes && (
            <p className="mt-2 font-sans text-sm text-white/80">
              {fmtClp(totalNeto / asistentes!)} neto por asistente
            </p>
          )}
          <p className="mt-4 font-sans text-xs text-white/80">
            Tickets + Rebate + FF&BB + Marcas + Mesas VIP + Medios + Producto
          </p>
        </article>
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-sans text-xs text-[#666666]">
          Unabase — costos y facturación del negocio del evento
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {unabase.map((m) => (
            <MetricCard key={m.key} m={m} />
          ))}
        </div>
      </div>
    </section>
  );
}
