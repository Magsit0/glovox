"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox, X } from "lucide-react";
import { useFilters } from "@/components/unabase/context/DashboardContext";
import { BrutalTooltip } from "@/components/unabase/charts/ChartTooltip";
import {
  axisTick,
  gridProps,
  INK,
  legendProps,
  seriesColor,
  SURFACE,
} from "@/lib/chart-colors";
import { compactCurrency, formatCurrency, safeText } from "@/lib/unabase/formatting";
import { compareEventsByFechaAsc } from "@/lib/unabase/dates";
import type { ExpenseRow, EventStat } from "@/lib/unabase/types";

type Mode = "total" | "percapita";

function getOrderedEventStats(rows: ExpenseRow[]): EventStat[] {
  const statsMap = new Map<string, EventStat>();
  rows.forEach((row) => {
    const key = row.key || row.EventoID || row.nombre;
    if (!statsMap.has(key)) {
      statsMap.set(key, {
        key,
        eventName: row.nombre,
        nombreGlovox: row.nombreGlovox || row.nombre,
        estado: row.estado || "Sin dato",
        fechaAsignacion: row.fechaAsignacion,
        asistentes: row.asistentes || 0,
        gasto: 0,
        presupuesto: 0,
      });
    } else if (row.asistentes > 0) {
      statsMap.get(key)!.asistentes = row.asistentes;
    }
  });
  return Array.from(statsMap.values()).sort(compareEventsByFechaAsc);
}

function truncate(text: string, max = 32): string {
  const v = safeText(text);
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

function chipClass(active: boolean): string {
  return [
    "rounded-full border px-3 py-1 font-sans text-xs transition-colors",
    active
      ? "border-[#9F99F8] bg-[#F0EFFE] text-[#9F99F8] font-medium"
      : "border-[#E5E5E5] bg-white text-[#666666] hover:border-[#333333] hover:text-[#333333]",
  ].join(" ");
}

export default function CategoryEvolutionChart() {
  const { filteredExpenseRows } = useFilters();
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("total");

  const categories = useMemo(
    () =>
      [...new Set(filteredExpenseRows.map((r) => r.categoriaGasto).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [filteredExpenseRows],
  );

  const subcategories = useMemo(() => {
    if (!selectedCats.size) return [];
    return [
      ...new Set(
        filteredExpenseRows
          .filter((r) => selectedCats.has(r.categoriaGasto))
          .map((r) => r.subCategoria)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));
  }, [filteredExpenseRows, selectedCats]);

  const items = useMemo(() => {
    if (!selectedSubs.size) return [];
    return [
      ...new Set(
        filteredExpenseRows
          .filter((r) => selectedCats.has(r.categoriaGasto) && selectedSubs.has(r.subCategoria))
          .map((r) => r.itemGasto)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));
  }, [filteredExpenseRows, selectedCats, selectedSubs]);

  const chartData = useMemo(() => {
    if (!filteredExpenseRows.length) return { data: [], groups: [] as string[] };

    const orderedStats = getOrderedEventStats(filteredExpenseRows);
    const eventIdx = new Map(orderedStats.map((s, i) => [s.key, i] as const));

    let rows: ExpenseRow[];
    let groupKeyFn: (r: ExpenseRow) => string;

    if (selectedCats.size > 0 && selectedSubs.size > 0 && selectedItems.size > 0) {
      rows = filteredExpenseRows.filter(
        (r) =>
          selectedCats.has(r.categoriaGasto) &&
          selectedSubs.has(r.subCategoria) &&
          selectedItems.has(r.itemGasto),
      );
      groupKeyFn = (r) => r.itemGasto || "Sin ítem";
    } else if (selectedCats.size > 0 && selectedSubs.size > 0) {
      rows = filteredExpenseRows.filter(
        (r) => selectedCats.has(r.categoriaGasto) && selectedSubs.has(r.subCategoria),
      );
      groupKeyFn = (r) => r.itemGasto || "Sin ítem";
    } else if (selectedCats.size > 0) {
      rows = filteredExpenseRows.filter((r) => selectedCats.has(r.categoriaGasto));
      groupKeyFn = (r) => r.subCategoria || "Sin subcategoría";
    } else {
      rows = filteredExpenseRows;
      groupKeyFn = (r) => r.categoriaGasto;
    }

    const totals = new Map<string, number>();
    rows.forEach((r) => {
      const k = groupKeyFn(r);
      totals.set(k, (totals.get(k) || 0) + r.gasto);
    });
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const topKeys = sorted.slice(0, 8);
    const otherKeys = new Set(sorted.slice(8));

    const dsMap = new Map<string, number[]>();
    topKeys.forEach((k) => dsMap.set(k, new Array(orderedStats.length).fill(0)));
    dsMap.set("Otros", new Array(orderedStats.length).fill(0));

    rows.forEach((row) => {
      const eventKey = row.key || row.EventoID || row.nombre;
      const rawGroup = groupKeyFn(row);
      const group = otherKeys.has(rawGroup) ? "Otros" : rawGroup;
      const idx = eventIdx.get(eventKey);
      if (idx === undefined) return;
      if (mode === "percapita") {
        const stat = orderedStats[idx];
        if (stat?.asistentes > 0) {
          dsMap.get(group)![idx] += row.gasto / stat.asistentes;
        }
      } else {
        dsMap.get(group)![idx] += row.gasto;
      }
    });

    const otros = dsMap.get("Otros") || [];
    const activeGroups = [...topKeys];
    if (otros.some((v) => v > 0)) activeGroups.push("Otros");

    const data = orderedStats.map((s, i) => {
      const entry: Record<string, string | number> = {
        label: truncate(s.nombreGlovox || s.eventName, 32),
      };
      activeGroups.forEach((g) => {
        entry[g] = dsMap.get(g)?.[i] ?? 0;
      });
      return entry;
    });

    return { data, groups: activeGroups };
  }, [filteredExpenseRows, selectedCats, selectedSubs, selectedItems, mode]);

  const toggleCat = (cat: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    setSelectedSubs(new Set());
    setSelectedItems(new Set());
  };

  const toggleSub = (sub: string) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      return next;
    });
    setSelectedItems(new Set());
  };

  const toggleItem = (item: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const reset = () => {
    setSelectedCats(new Set());
    setSelectedSubs(new Set());
    setSelectedItems(new Set());
  };

  const drillLevel =
    selectedSubs.size > 0 ? (selectedItems.size > 0 ? 3 : 2) : selectedCats.size > 0 ? 1 : 0;
  const breadcrumb =
    drillLevel === 0
      ? "Categorías"
      : drillLevel === 1
        ? `${[...selectedCats].join(", ")} › Subcategorías`
        : drillLevel === 2
          ? `${[...selectedCats].join(", ")} › ${[...selectedSubs].join(", ")} › Ítems`
          : `${[...selectedCats].join(", ")} › ${[...selectedSubs].join(", ")} › ${[...selectedItems].join(", ")}`;

  const chartHeight = Math.max(380, chartData.data.length * 32 + 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs text-[#666666]">{breadcrumb}</span>
        {drillLevel > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-sans text-xs text-[#666666] transition-colors hover:text-[#333333]"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs text-[#666666]">Vista</span>
          <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setMode("total")}
              className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                mode === "total"
                  ? "bg-[#F0EFFE] text-[#9F99F8]"
                  : "text-[#666666] hover:text-[#333333]"
              }`}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setMode("percapita")}
              className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                mode === "percapita"
                  ? "bg-[#F0EFFE] text-[#9F99F8]"
                  : "text-[#666666] hover:text-[#333333]"
              }`}
            >
              Per cápita
            </button>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            <span className="font-sans text-xs text-[#666666]">Categoría</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className={chipClass(selectedCats.has(cat))}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {subcategories.length > 0 && (
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            <span className="font-sans text-xs text-[#666666]">Subcategoría</span>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleSub(sub)}
                  className={chipClass(selectedSubs.has(sub))}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            <span className="font-sans text-xs text-[#666666]">Ítem</span>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={chipClass(selectedItems.has(item))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {chartData.data.length === 0 || chartData.groups.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
          <Inbox className="h-6 w-6" />
          Sin gastos para mostrar
        </div>
      ) : (
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData.data}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              barCategoryGap="30%"
            >
              <CartesianGrid {...gridProps} vertical horizontal={false} />
              <XAxis
                type="number"
                tick={axisTick}
                axisLine={{ stroke: SURFACE.divider }}
                tickLine={false}
                tickFormatter={(v: number) => compactCurrency(v)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ ...axisTick, fontSize: 11 }}
                axisLine={{ stroke: SURFACE.divider }}
                tickLine={false}
                width={220}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: SURFACE.canvas }}
                content={({ active, label, payload }) => (
                  <BrutalTooltip
                    active={active}
                    label={label}
                    items={(payload ?? []).map((p) => ({
                      name: String(p.name),
                      color: String(p.color),
                      formatted: formatCurrency(Number(p.value)),
                    }))}
                  />
                )}
              />
              <Legend {...legendProps} />
              {chartData.groups.map((g, i) => (
                <Bar
                  key={g}
                  dataKey={g}
                  stackId="gasto"
                  fill={g === "Otros" ? INK.subtle : seriesColor(i)}
                  radius={[0, 0, 0, 0]}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
