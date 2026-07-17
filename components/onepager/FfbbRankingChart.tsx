"use client";

import { Fragment, useMemo, useState } from "react";
import type { OnepagerFfbbCategoriaProductoRow } from "@/lib/queries/onepager";
import { BRAND } from "@/lib/chart-colors";

type Props = {
  data: OnepagerFfbbCategoriaProductoRow[];
  color?: string;
};

type Metric = "venta" | "qtty";

type CategoriaGrouped = {
  categoria: string;
  venta: number;
  qtty: number;
  productos: { producto: string; venta: number; qtty: number }[];
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function fmtQty(value: number) {
  return Math.round(value).toLocaleString("es-CL");
}

export default function FfbbRankingChart({
  data,
  color = BRAND.purple,
}: Props) {
  const [metric, setMetric] = useState<Metric>("venta");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { categorias, maxValue } = useMemo(() => {
    const map = new Map<string, CategoriaGrouped>();
    for (const row of data) {
      const key = row.categoria || "—";
      const existing = map.get(key);
      if (existing) {
        existing.venta += row.venta;
        existing.qtty += row.qtty;
        existing.productos.push({
          producto: row.producto || "—",
          venta: row.venta,
          qtty: row.qtty,
        });
      } else {
        map.set(key, {
          categoria: key,
          venta: row.venta,
          qtty: row.qtty,
          productos: [
            {
              producto: row.producto || "—",
              venta: row.venta,
              qtty: row.qtty,
            },
          ],
        });
      }
    }
    const list = Array.from(map.values());
    list.sort((a, b) => b[metric] - a[metric]);
    for (const c of list) c.productos.sort((a, b) => b[metric] - a[metric]);
    const max = Math.max(...list.map((c) => c[metric]), 1);
    return { categorias: list, maxValue: max };
  }, [data, metric]);

  function toggle(cat: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const isVenta = metric === "venta";

  return (
    <div className="space-y-3">
      {/* Toggle métrica */}
      <div className="inline-flex border border-[#E5E5E5] rounded-lg overflow-hidden">
        {(
          [
            { key: "venta", label: "Venta $" },
            { key: "qtty", label: "Cantidad #" },
          ] as { key: Metric; label: string }[]
        ).map((opt) => {
          const active = metric === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMetric(opt.key)}
              className={`font-sans font-medium text-sm leading-none px-4 py-2 transition-colors duration-150 cursor-pointer ${
                active
                  ? "bg-[#F0EFFE] text-[#9F99F8]"
                  : "bg-white text-[#666666] hover:text-[#333333]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      <div className="max-h-[480px] overflow-y-auto bg-white border border-[#E5E5E5] rounded-lg">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
            <tr className="border-b border-[#E5E5E5]">
              <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left w-[40%]">
                Categoría / Producto
              </th>
              <th
                className={`font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right w-[20%] ${
                  isVenta ? "opacity-50" : ""
                }`}
              >
                Qtty
              </th>
              <th
                className={`font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right w-[20%] ${
                  isVenta ? "" : "opacity-50"
                }`}
              >
                Venta
              </th>
              <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 w-[20%]" />
            </tr>
          </thead>
          <tbody>
            {categorias.map((cat) => {
              const open = expanded.has(cat.categoria);
              const catValue = cat[metric];
              const catPct = Math.round((catValue / maxValue) * 100);
              return (
                <Fragment key={cat.categoria}>
                  <tr
                    onClick={() => toggle(cat.categoria)}
                    className="bg-[#FAFAFA] border-b border-[#E5E5E5] hover:bg-[#F0EFFE] cursor-pointer transition-colors duration-150"
                  >
                    <td className="font-sans text-sm px-4 py-3 font-medium text-[#333333]">
                      <span className="inline-block w-4">
                        {open ? "▾" : "▸"}
                      </span>
                      {cat.categoria}
                    </td>
                    <td
                      className={`font-sans text-sm px-4 py-3 text-right tabular-nums text-[#333333] ${
                        isVenta ? "opacity-50" : "font-medium"
                      }`}
                    >
                      {fmtQty(cat.qtty)}
                    </td>
                    <td
                      className={`font-sans text-sm px-4 py-3 text-right whitespace-nowrap tabular-nums text-[#333333] ${
                        isVenta ? "font-medium" : "opacity-50"
                      }`}
                    >
                      {fmtClp(cat.venta)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-[#F0F0F0] h-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${catPct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                  {open &&
                    cat.productos.map((p) => {
                      const pValue = p[metric];
                      const pPct = Math.round((pValue / maxValue) * 100);
                      return (
                        <tr
                          key={p.producto}
                          className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                        >
                          <td className="font-sans text-sm px-4 py-3 pl-10 text-[#666666]">
                            {p.producto}
                          </td>
                          <td
                            className={`font-sans text-sm px-4 py-3 text-right tabular-nums text-[#333333] ${
                              isVenta ? "opacity-50" : ""
                            }`}
                          >
                            {fmtQty(p.qtty)}
                          </td>
                          <td
                            className={`font-sans text-sm px-4 py-3 text-right whitespace-nowrap tabular-nums text-[#333333] ${
                              isVenta ? "" : "opacity-50"
                            }`}
                          >
                            {fmtClp(p.venta)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-[#F0F0F0] h-2 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pPct}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
