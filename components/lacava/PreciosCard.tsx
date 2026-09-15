"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LaCavaPrecioRow } from "@/lib/queries/lacava";
import {
  LACAVA,
  lacavaAxisTick,
  lacavaGridProps,
  lacavaSeriesColor,
} from "./theme";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type ChartRow = { precio: string } & Record<string, number | string>;

/**
 * Tramos de precio × descuento. En La Cava el TipoTicket es casi siempre
 * "GENERAL", así que el producto real se diferencia por el precio de lista
 * (preventas / general) y el descuento del beneficio (Cencosud, Prime,
 * Prime + Cencosud). Barras apiladas: una barra por precio de lista,
 * segmentada por % de descuento aplicado.
 */
export default function PreciosCard({ precios }: { precios: LaCavaPrecioRow[] }) {
  const { chartData, buckets, tabla } = useMemo(() => {
    // Buckets de descuento presentes, orden ascendente (0 primero).
    const buckets = [...new Set(precios.map((p) => p.pctDescuento))].sort(
      (a, b) => a - b,
    );

    const porPrecio = new Map<number, ChartRow & { personasTotal: number; ventaTotal: number }>();
    for (const p of precios) {
      let row = porPrecio.get(p.precioLista);
      if (!row) {
        row = {
          precio: clp.format(p.precioLista),
          personasTotal: 0,
          ventaTotal: 0,
        };
        porPrecio.set(p.precioLista, row);
      }
      const key = `d${p.pctDescuento}`;
      row[key] = Number(row[key] ?? 0) + p.personas;
      row.personasTotal += p.personas;
      row.ventaTotal += p.venta;
    }

    const ordered = [...porPrecio.entries()].sort((a, b) => a[0] - b[0]);
    return {
      chartData: ordered.map(([, row]) => row),
      buckets,
      tabla: ordered.map(([precioLista, row]) => ({
        precioLista,
        personas: row.personasTotal,
        venta: row.ventaTotal,
      })),
    };
  }, [precios]);

  if (precios.length === 0) {
    return (
      <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
        Sin ventas registradas para esta edición.
      </p>
    );
  }

  const totalPersonas = tabla.reduce((acc, t) => acc + t.personas, 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid {...lacavaGridProps} />
          <XAxis
            dataKey="precio"
            tickLine={false}
            axisLine={{ stroke: LACAVA.borde }}
            tick={lacavaAxisTick}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={lacavaAxisTick}
            width={48}
          />
          <Tooltip
            cursor={{ fill: LACAVA.crema }}
            content={<PreciosTooltip />}
          />
          {buckets.map((b, i) => (
            <Bar
              key={b}
              dataKey={`d${b}`}
              name={b === 0 ? "Sin descuento" : `${b}% dcto`}
              stackId="personas"
              fill={lacavaSeriesColor(i)}
              radius={i === buckets.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          {buckets.map((b, i) => (
            <span
              key={b}
              className="flex items-center gap-1.5 font-sans text-xs"
              style={{ color: LACAVA.tintaSuave }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: lacavaSeriesColor(i) }}
              />
              {b === 0 ? "Sin descuento" : `${b}% dcto`}
            </span>
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: LACAVA.borde }}>
          <table className="w-full border-collapse">
            <thead style={{ backgroundColor: LACAVA.crema }}>
              <tr className="border-b" style={{ borderColor: LACAVA.borde }}>
                <th className="px-4 py-3 text-left font-sans text-xs font-medium" style={{ color: LACAVA.tintaSuave }}>
                  Precio de lista
                </th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium" style={{ color: LACAVA.tintaSuave }}>
                  Personas
                </th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium" style={{ color: LACAVA.tintaSuave }}>
                  % personas
                </th>
                <th className="px-4 py-3 text-right font-sans text-xs font-medium" style={{ color: LACAVA.tintaSuave }}>
                  Venta neta
                </th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((t) => (
                <tr
                  key={t.precioLista}
                  className="border-b last:border-b-0"
                  style={{ borderColor: LACAVA.borde }}
                >
                  <td className="px-4 py-3 font-sans text-sm tabular-nums" style={{ color: LACAVA.tinta }}>
                    {clp.format(t.precioLista)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums" style={{ color: LACAVA.tinta }}>
                    {entero.format(t.personas)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums" style={{ color: LACAVA.tintaSuave }}>
                    {totalPersonas > 0
                      ? `${Math.round((t.personas / totalPersonas) * 100)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums" style={{ color: LACAVA.tinta }}>
                    {clp.format(t.venta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-sans text-xs" style={{ color: LACAVA.tintaSutil }}>
          El descuento corresponde al beneficio usado en la compra (Tarjeta
          Cencosud, Jumbo Prime o ambos). La venta neta ya lo descuenta.
        </p>
      </div>
    </div>
  );
}

type TooltipEntry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
};

function PreciosTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => Number(p.value ?? 0) > 0);
  if (rows.length === 0) return null;
  const total = rows.reduce((acc, r) => acc + Number(r.value ?? 0), 0);
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{ backgroundColor: LACAVA.cremaClara, borderColor: LACAVA.borde }}
    >
      <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
        Precio de lista {label} · {entero.format(total)} personas
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((r) => (
          <li
            key={String(r.name)}
            className="flex items-center justify-between gap-4 font-sans text-sm"
            style={{ color: LACAVA.tinta }}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: r.fill ?? r.color }}
              />
              {String(r.name)}
            </span>
            <span className="tabular-nums">{entero.format(Number(r.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
