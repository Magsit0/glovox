"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LaCavaBeneficio, LaCavaBeneficioRow } from "@/lib/queries/lacava";
import { LACAVA } from "./theme";
import { useEntraEnVista } from "./useEntraEnVista";
import ContadorKpi from "./ContadorKpi";
import RevelarAlVer from "./RevelarAlVer";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/** Orden y color fijos: el mismo tipo conserva su color en todas las ediciones. */
const TIPOS: { key: LaCavaBeneficio; color: string }[] = [
  { key: "Normal", color: LACAVA.verdeMedio },
  { key: "Prime", color: LACAVA.burdeos },
  { key: "Cencosud", color: LACAVA.dorado },
  { key: "Prime + Cencosud", color: LACAVA.jumbo },
  { key: "Colaboradores", color: "#557F6B" },
  { key: "Otros", color: "#B0592F" },
];

/**
 * Tipos de ticket según el beneficio usado (Normal, Prime, Cencosud,
 * Prime + Cencosud): torta por entradas y, al lado, entradas, % y venta neta
 * de cada tipo. Solo ventas pagadas.
 */
export default function BeneficiosCard({ filas }: { filas: LaCavaBeneficioRow[] }) {
  // La torta espera invisible hasta entrar en pantalla y ahí se traza.
  const [tortaRef, enVista] = useEntraEnVista<HTMLDivElement>(0.25);

  const datos = TIPOS.map((t) => {
    const fila = filas.find((f) => f.beneficio === t.key);
    return {
      ...t,
      personas: fila?.personas ?? 0,
      venta: fila?.venta ?? 0,
    };
  }).filter((d) => d.personas > 0);
  const totalPersonas = datos.reduce((acc, d) => acc + d.personas, 0);
  const totalVenta = datos.reduce((acc, d) => acc + d.venta, 0);

  if (totalPersonas === 0) {
    return (
      <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
        Sin ventas registradas para esta edición.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-center">
      <div
        ref={tortaRef}
        className={`relative h-56 ${enVista ? "" : "lacava-espera-vista"}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart key={String(enVista)}>
            <Pie
              data={datos}
              dataKey="personas"
              nameKey="key"
              innerRadius="62%"
              outerRadius="90%"
              stroke="none"
              isAnimationActive={enVista ? "auto" : false}
              // Sin la espera default (400 ms): el anillo y la cifra del
              // centro arrancan juntos.
              animationBegin={0}
            >
              {datos.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<BeneficioTooltip total={totalPersonas} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-lacava text-3xl font-bold leading-none"
            style={{ color: LACAVA.tinta }}
          >
            <ContadorKpi valor={totalPersonas} formato="entero" />
          </span>
          <span className="mt-1 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            entradas
          </span>
        </div>
      </div>

      <RevelarAlVer>
        <ul className="flex flex-col">
          {datos.map((d) => (
            <li
              key={d.key}
              className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 border-b py-2.5 last:border-b-0"
              style={{ borderColor: LACAVA.borde }}
            >
              <span
                className="flex items-center gap-2 font-sans text-sm"
                style={{ color: LACAVA.tinta }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-medium">{d.key}</span>
                <span style={{ color: LACAVA.tintaSuave }}>
                  {Math.round((d.personas / totalPersonas) * 100)}%
                </span>
              </span>
              <span
                className="text-right font-sans text-sm tabular-nums"
                style={{ color: LACAVA.tinta }}
              >
                {entero.format(d.personas)} entradas
              </span>
              <span
                className="col-span-2 pl-[18px] font-sans text-xs tabular-nums"
                style={{ color: LACAVA.tintaSuave }}
              >
                {clp.format(d.venta)} de venta neta
              </span>
            </li>
          ))}
          <li
            className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 pt-3 font-sans text-sm"
            style={{ color: LACAVA.tinta }}
          >
            <span className="font-medium">Total</span>
            <span className="text-right font-medium tabular-nums">
              {entero.format(totalPersonas)} entradas
            </span>
            <span
              className="col-span-2 text-xs tabular-nums"
              style={{ color: LACAVA.tintaSuave }}
            >
              {clp.format(totalVenta)} de venta neta
            </span>
          </li>
        </ul>
      </RevelarAlVer>
    </div>
  );
}

type TooltipEntry = {
  payload?: { key: string; personas: number; venta: number };
};

function BeneficioTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  total: number;
}) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{ backgroundColor: LACAVA.cremaClara, borderColor: LACAVA.borde }}
    >
      <p className="font-sans text-sm font-medium" style={{ color: LACAVA.tinta }}>
        {d.key}
      </p>
      <p className="mt-0.5 font-sans text-xs tabular-nums" style={{ color: LACAVA.tintaSuave }}>
        {entero.format(d.personas)} entradas ·{" "}
        {total > 0 ? Math.round((d.personas / total) * 100) : 0}% ·{" "}
        {clp.format(d.venta)}
      </p>
    </div>
  );
}
