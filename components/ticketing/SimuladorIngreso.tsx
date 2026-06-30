"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { seriesColor } from "@/lib/chart-colors";
import { formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import { proyectarDemanda, type ProyeccionMetodo } from "@/lib/ticketing/demanda-forecast";
import type { DemandaRow } from "@/lib/queries/ticketing";

interface Props {
  rows: DemandaRow[];
  proyeccion: ProyeccionMetodo;
}

type PrecioBase = "historico" | "proyectado";

const PRODUCTS = [
  { key: "general",    label: "General",             cantKey: "general"    as const, ventaKey: "generalVenta"    as const, colorIdx: 0 },
  { key: "vip",        label: "VIP",                 cantKey: "vip"        as const, ventaKey: "vipVenta"        as const, colorIdx: 1 },
  { key: "earlyEntry", label: "Early entry / Happy", cantKey: "earlyEntry" as const, ventaKey: "earlyEntryVenta" as const, colorIdx: 2 },
  { key: "free",       label: "Free / Cortesía",     cantKey: "free"       as const, ventaKey: "freeVenta"       as const, colorIdx: 3 },
  { key: "upgrade",    label: "Upgrade",             cantKey: "upgrade"    as const, ventaKey: "upgradeVenta"    as const, colorIdx: 4 },
];

function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export default function SimuladorIngreso({ rows, proyeccion }: Props) {
  const [precioBase, setPrecioBase] = useState<PrecioBase>("historico");

  // Defaults por producto:
  //  - cantidad   = proyección del próximo periodo (método activo)
  //  - histórico  = promedio ponderado real (Σventa / Σcantidad)
  //  - proyectado = venta proyectada / cantidad proyectada (mismo método)
  const { defaults, hasProj } = useMemo(() => {
    const proj = proyectarDemanda(rows, proyeccion);
    const defs = PRODUCTS.map((p) => {
      let venta = 0;
      let cantidad = 0;
      for (const r of rows) {
        venta += r[p.ventaKey];
        cantidad += r[p.cantKey];
      }
      const precioHistorico = cantidad > 0 ? Math.round(venta / cantidad) : 0;
      const cantProj = proj ? proj[p.cantKey].value : 0;
      const ventaProj = proj ? proj[p.ventaKey].value : 0;
      const precioProyectado = cantProj > 0 ? Math.round(ventaProj / cantProj) : precioHistorico;
      return { ...p, cantidad: cantProj, precioHistorico, precioProyectado };
    });
    return { defaults: defs, hasProj: proj !== null };
  }, [rows, proyeccion]);

  // Overrides editables (string crudo; ausencia = usar default).
  const [ovCant, setOvCant] = useState<Record<string, string>>({});
  const [ovPrecio, setOvPrecio] = useState<Record<string, string>>({});

  // Al cambiar los datos (filtros / proyección) se reinicia la simulación.
  // Ajustamos el estado durante el render (patrón recomendado por React) en vez
  // de un useEffect, que dispara renders en cascada. `defaults` está memoizado
  // sobre [rows, proyeccion], así que solo cambia de identidad con datos nuevos.
  const [prevDefaults, setPrevDefaults] = useState(defaults);
  if (defaults !== prevDefaults) {
    setPrevDefaults(defaults);
    setOvCant({});
    setOvPrecio({});
  }

  function changePrecioBase(b: PrecioBase) {
    setPrecioBase(b);
    setOvPrecio({}); // los precios toman el default del nuevo modo; cantidades intactas
  }

  const dirty = Object.keys(ovCant).length > 0 || Object.keys(ovPrecio).length > 0;

  const filas = defaults.map((d) => {
    const precioDefault = precioBase === "proyectado" ? d.precioProyectado : d.precioHistorico;
    const cantStr = ovCant[d.key] ?? String(d.cantidad);
    const precioStr = ovPrecio[d.key] ?? String(precioDefault);
    const cantidad = num(cantStr);
    const precio = num(precioStr);
    return { ...d, cantStr, precioStr, cantidad, precio, ingreso: cantidad * precio };
  });

  const totalIngreso = filas.reduce((s, f) => s + f.ingreso, 0);
  const totalTickets = filas.reduce((s, f) => s + f.cantidad, 0);

  const inputCls =
    "w-28 rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 text-right font-sans text-sm tabular-nums text-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";
  const toggleGroup = "flex gap-1 rounded-lg border border-[#E5E5E5] bg-white p-1";
  const toggleBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
      active ? "bg-[#F0EFFE] text-[#9F99F8]" : "text-[#666666] hover:text-[#333333]"
    }`;

  return (
    <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Simulador de ingreso
          </h3>
          <p className="mt-1 max-w-2xl font-sans text-sm text-[#666666]">
            Cantidad proyectada × precio promedio, por producto. El precio base puede ser el
            promedio histórico real o el proyectado (venta proyectada ÷ cantidad proyectada). Edita
            cualquier celda para simular escenarios.
          </p>
        </div>
        {hasProj && (
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-xs text-[#666666]">Precio base</span>
              <div className={toggleGroup}>
                <button type="button" onClick={() => changePrecioBase("historico")} className={toggleBtn(precioBase === "historico")}>
                  Histórico
                </button>
                <button type="button" onClick={() => changePrecioBase("proyectado")} className={toggleBtn(precioBase === "proyectado")}>
                  Proyectado
                </button>
              </div>
            </div>
            {dirty && (
              <button
                type="button"
                onClick={() => {
                  setOvCant({});
                  setOvPrecio({});
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restablecer
              </button>
            )}
          </div>
        )}
      </header>

      {!hasProj ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-[#E5E5E5] py-10 font-sans text-sm text-[#999999]">
          Activa una proyección (Lineal u Holt) para simular el ingreso.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
            <table className="w-full">
              <thead className="bg-[#FAFAFA]">
                <tr className="border-b border-[#E5E5E5]">
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium text-[#666666]">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">
                    Cantidad proyectada
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">
                    Precio prom. (CLP)
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium text-[#666666]">
                    Ingreso
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.key} className="border-b border-[#E5E5E5] last:border-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-sans text-sm text-[#333333]">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: seriesColor(f.colorIdx) }}
                        />
                        {f.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={f.cantStr}
                        onChange={(e) => setOvCant((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={inputCls}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={f.precioStr}
                        onChange={(e) => setOvPrecio((p) => ({ ...p, [f.key]: e.target.value }))}
                        className={inputCls}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                      {formatCurrency(f.ingreso)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-[#FAFAFA] px-4 py-3">
            <span className="font-sans text-sm font-medium text-[#666666]">
              Ingreso total simulado
              <span className="ml-2 font-normal text-[#999999]">
                · {formatNumber(totalTickets)} tickets
              </span>
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-[#333333]">
              {formatCurrency(totalIngreso)}
            </span>
          </div>
        </>
      )}
    </article>
  );
}
