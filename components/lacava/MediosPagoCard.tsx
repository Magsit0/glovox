"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LaCavaMedioRow } from "@/lib/queries/lacava";
import { LACAVA, lacavaSeriesColor } from "./theme";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const clpCompacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

/** Cuántos medios se muestran con color propio; el resto se agrupa en "Otros". */
const TOP = 5;

/**
 * Medios de pago de la edición (solo ventas reales): donut por venta neta con
 * los medios principales + "Otros", y tabla completa con montos.
 */
export default function MediosPagoCard({ medios }: { medios: LaCavaMedioRow[] }) {
  const totalVenta = medios.reduce((acc, m) => acc + m.venta, 0);
  const totalTransacciones = medios.reduce((acc, m) => acc + m.transacciones, 0);

  const donutData = useMemo(() => {
    const top = medios.slice(0, TOP).map((m) => ({
      nombre: m.medioPago,
      venta: m.venta,
    }));
    const resto = medios.slice(TOP);
    if (resto.length > 0) {
      top.push({
        nombre: `Otros (${resto.length})`,
        venta: resto.reduce((acc, m) => acc + m.venta, 0),
      });
    }
    return top;
  }, [medios]);

  if (medios.length === 0) {
    return (
      <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
        Sin ventas registradas para esta edición.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              dataKey="venta"
              nameKey="nombre"
              innerRadius="62%"
              outerRadius="90%"
              stroke="none"
              isAnimationActive={false}
            >
              {donutData.map((d, i) => (
                <Cell key={d.nombre} fill={lacavaSeriesColor(i)} />
              ))}
            </Pie>
            <Tooltip content={<MediosTooltip total={totalVenta} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-lacava text-3xl font-bold leading-none"
            style={{ color: LACAVA.tinta }}
          >
            ${clpCompacto.format(totalVenta)}
          </span>
          <span className="mt-1 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            venta neta
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {donutData.map((d, i) => (
          <span
            key={d.nombre}
            className="flex items-center gap-1.5 font-sans text-xs"
            style={{ color: LACAVA.tintaSuave }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: lacavaSeriesColor(i) }}
            />
            {d.nombre}
            {totalVenta > 0 && ` · ${Math.round((d.venta / totalVenta) * 100)}%`}
          </span>
        ))}
      </div>

      <div
        className="overflow-auto rounded-lg border"
        style={{ borderColor: LACAVA.borde, maxHeight: 380 }}
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10" style={{ backgroundColor: LACAVA.crema }}>
            <tr className="border-b" style={{ borderColor: LACAVA.borde }}>
              <Th align="left">Medio de pago</Th>
              <Th align="right">Transacciones</Th>
              <Th align="right">Venta neta</Th>
              <Th align="right">% venta</Th>
              <Th align="right">Ticket promedio</Th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {medios.map((m) => (
              <tr
                key={m.medioPago}
                className="border-b last:border-b-0"
                style={{ borderColor: LACAVA.borde }}
              >
                <Td align="left">{m.medioPago}</Td>
                <Td align="right">{entero.format(m.transacciones)}</Td>
                <Td align="right">{clp.format(m.venta)}</Td>
                <Td align="right">
                  {totalVenta > 0
                    ? `${((m.venta / totalVenta) * 100).toFixed(1)}%`
                    : "—"}
                </Td>
                <Td align="right">
                  {m.transacciones > 0 ? clp.format(m.venta / m.transacciones) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ backgroundColor: LACAVA.crema }}>
            <tr className="border-t" style={{ borderColor: LACAVA.borde }}>
              <Td align="left">
                <span className="font-medium">Total</span>
              </Td>
              <Td align="right">{entero.format(totalTransacciones)}</Td>
              <Td align="right">{clp.format(totalVenta)}</Td>
              <Td align="right">100%</Td>
              <Td align="right">
                {totalTransacciones > 0
                  ? clp.format(totalVenta / totalTransacciones)
                  : "—"}
              </Td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Th({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <th
      className={`px-4 py-3 font-sans text-xs font-medium ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: LACAVA.tintaSuave }}
    >
      {children}
    </th>
  );
}

function Td({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <td
      className={`px-4 py-3 font-sans text-sm tabular-nums ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: LACAVA.tinta }}
    >
      {children}
    </td>
  );
}

function MediosTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name?: string | number; value?: number | string }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = typeof p.value === "number" ? p.value : Number(p.value);
  return (
    <div
      className="max-w-[280px] rounded-lg border px-3 py-2 font-sans text-sm shadow-md"
      style={{
        backgroundColor: LACAVA.cremaClara,
        borderColor: LACAVA.borde,
        color: LACAVA.tinta,
      }}
    >
      {String(p.name)} · {clp.format(value)}
      {total > 0 && ` (${Math.round((value / total) * 100)}%)`}
    </div>
  );
}
